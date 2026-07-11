// Notifications inbox I/O (server-notifications-inbox).
//
// Loads the feed's live sources — master-DB backup_runs + connections scoped
// to the Space, per-Space bo_at_schema_updates via withSpaceSchema — applies
// the 30-day window + per-source cap at load time, and hands the plain rows to
// the pure deriveInboxItems. Triage mutations are idempotent upserts into
// bo_at_inbox_state / bo_at_inbox_mutes (absolute set-based patches, never
// toggles). `done` on a state-backed id (conn:*) throws StateBackedDoneError,
// which the route maps to 422 — state-backed rows self-heal and offer no
// Mark done (web spec).

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { spacePg } from "@baseout/db-schema/space";
import type { AppDb } from "../../db/worker";
import { backupRuns, backupRunBases, connections, spaces } from "../../db/schema";
import type { SpaceTx } from "../per-space/space-db-pg";
import {
  deriveInboxItems,
  INBOX_FEED_CAP,
  type ConnectionSourceRow,
  type InboxItemView,
  type InboxMuteRow,
  type InboxStateRow,
  type RunSourceRow,
  type SchemaUpdateSourceRow,
} from "./derive";

/** Feed window — the most recent 30 days (design.md §Alert kinds). */
export const INBOX_WINDOW_DAYS = 30;

/** Connection statuses derived as connection-broken (design.md kind table). */
const BROKEN_CONNECTION_STATUSES = ["invalid", "expired", "revoked"];

// ───────────────────────── feed orchestration ─────────────────────────

export interface InboxFeedSourcesMaster {
  runs: RunSourceRow[];
  connections: ConnectionSourceRow[];
}

export interface InboxFeedSourcesSpace {
  schemaUpdates: SchemaUpdateSourceRow[];
  states: InboxStateRow[];
  mutes: InboxMuteRow[];
}

export interface InboxFeedDeps {
  now: Date;
  loadMasterSources: (since: Date) => Promise<InboxFeedSourcesMaster>;
  loadSpaceSources: (since: Date) => Promise<InboxFeedSourcesSpace>;
}

/**
 * Assemble the feed: load both halves (windowed), derive, merge triage state.
 * Loaders are injected so the orchestration is testable without a DB; the
 * route wires readMasterInboxSources / readSpaceInboxSources in.
 */
export async function loadInboxFeed(deps: InboxFeedDeps): Promise<InboxItemView[]> {
  const since = new Date(deps.now.getTime() - INBOX_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const master = await deps.loadMasterSources(since);
  const space = await deps.loadSpaceSources(since);
  return deriveInboxItems({
    runs: master.runs,
    connections: master.connections,
    schemaUpdates: space.schemaUpdates,
    states: space.states,
    mutes: space.mutes,
    now: deps.now,
  });
}

// ───────────────────────── master-DB loaders ─────────────────────────

const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);

/**
 * Load the Space's run + connection sources from the master DB. Runs are the
 * Space's terminal backup_runs rows in the window (soft-deleted excluded),
 * enriched with backup_run_bases for base names; connections are the Space's
 * Organization's rows in a broken status.
 */
export async function readMasterInboxSources(
  db: AppDb,
  spaceId: string,
  since: Date,
): Promise<InboxFeedSourcesMaster> {
  // completed_at is set on every terminal transition; started_at covers rows
  // that failed before completion stamped. modified_at is the last resort.
  const runTs = sql<Date>`coalesce(${backupRuns.completedAt}, ${backupRuns.startedAt}, ${backupRuns.modifiedAt})`;
  const runRows = await db
    .select({
      id: backupRuns.id,
      status: backupRuns.status,
      errorMessage: backupRuns.errorMessage,
      completedAt: backupRuns.completedAt,
      startedAt: backupRuns.startedAt,
      modifiedAt: backupRuns.modifiedAt,
    })
    .from(backupRuns)
    .where(
      and(
        eq(backupRuns.spaceId, spaceId),
        inArray(backupRuns.status, ["failed", "succeeded"]),
        isNull(backupRuns.deletedAt),
        sql`${runTs} >= ${since}`,
      ),
    )
    .orderBy(desc(runTs))
    .limit(INBOX_FEED_CAP);

  const runIds = runRows.map((r) => r.id);
  const baseRows = runIds.length
    ? await db
        .select({
          runId: backupRunBases.runId,
          atBaseId: backupRunBases.atBaseId,
          baseName: backupRunBases.baseName,
        })
        .from(backupRunBases)
        .where(inArray(backupRunBases.runId, runIds))
    : [];
  const basesByRun = new Map<string, { atBaseId: string; baseName: string }[]>();
  for (const b of baseRows) {
    const list = basesByRun.get(b.runId) ?? [];
    list.push({ atBaseId: b.atBaseId, baseName: b.baseName });
    basesByRun.set(b.runId, list);
  }

  const runs: RunSourceRow[] = runRows.map((r) => {
    const bases = basesByRun.get(r.id) ?? [];
    const single = bases.length === 1 ? bases[0]! : null;
    return {
      runId: r.id,
      status: r.status,
      baseId: single?.atBaseId ?? null,
      baseName: single?.baseName ?? null,
      baseCount: bases.length,
      errorMessage: r.errorMessage,
      at: (r.completedAt ?? r.startedAt ?? r.modifiedAt).toISOString(),
    };
  });

  const connRows = await db
    .select({
      id: connections.id,
      displayName: connections.displayName,
      status: connections.status,
      invalidatedAt: connections.invalidatedAt,
      modifiedAt: connections.modifiedAt,
    })
    .from(connections)
    .innerJoin(spaces, eq(connections.organizationId, spaces.organizationId))
    .where(and(eq(spaces.id, spaceId), inArray(connections.status, BROKEN_CONNECTION_STATUSES)));

  const connectionSources: ConnectionSourceRow[] = connRows.map((c) => ({
    connectionId: c.id,
    displayName: c.displayName,
    status: c.status,
    at: (c.invalidatedAt ?? c.modifiedAt).toISOString(),
  }));

  return { runs, connections: connectionSources };
}

// ───────────────────────── per-Space loaders ─────────────────────────

/**
 * Load the per-Space feed sources inside `withSpaceSchema(...)`: windowed
 * schema updates (with run dates + base names) plus the full triage state
 * and mute sets (both small — bounded by triage activity, not data volume).
 */
export async function readSpaceInboxSources(
  tx: SpaceTx,
  since: Date,
): Promise<InboxFeedSourcesSpace> {
  const updateTs = sql<Date>`coalesce(${spacePg.baseRuns.completedAt}, ${spacePg.baseRuns.startedAt})`;
  const updateRows = await tx
    .select({
      id: spacePg.schemaUpdates.id,
      baseId: spacePg.schemaUpdates.baseId,
      baseName: spacePg.bases.name,
      entityType: spacePg.schemaUpdates.entityType,
      changeType: spacePg.schemaUpdates.changeType,
      changeTypeName: spacePg.schemaUpdates.changeTypeName,
      breaksData: spacePg.schemaUpdates.breaksData,
      completedAt: spacePg.baseRuns.completedAt,
      startedAt: spacePg.baseRuns.startedAt,
    })
    .from(spacePg.schemaUpdates)
    .leftJoin(spacePg.baseRuns, eq(spacePg.schemaUpdates.runId, spacePg.baseRuns.id))
    .leftJoin(spacePg.bases, eq(spacePg.schemaUpdates.baseId, spacePg.bases.baseId))
    .where(sql`${updateTs} >= ${since}`)
    .orderBy(desc(updateTs))
    .limit(INBOX_FEED_CAP);

  const schemaUpdates: SchemaUpdateSourceRow[] = updateRows
    .map((u) => ({
      updateId: u.id,
      baseId: u.baseId,
      baseName: u.baseName,
      entityType: u.entityType,
      changeType: u.changeType,
      changeTypeName: u.changeTypeName,
      breaksData: u.breaksData,
      at: isoOrNull(u.completedAt ?? u.startedAt),
    }))
    .filter((u): u is SchemaUpdateSourceRow => u.at !== null);

  const stateRows = await tx.select().from(spacePg.inboxState);
  const states: InboxStateRow[] = stateRows.map((s) => ({
    itemId: s.itemId,
    read: s.read,
    done: s.done,
    snoozedUntil: isoOrNull(s.snoozedUntil),
  }));

  const muteRows = await tx.select({ baseId: spacePg.inboxMutes.baseId }).from(spacePg.inboxMutes);

  return { schemaUpdates, states, mutes: muteRows };
}

// ───────────────────────── triage mutations ─────────────────────────

export const TRIAGE_ACTIONS = ["read", "unread", "done", "undone", "snooze", "unsnooze"] as const;
export type TriageAction = (typeof TRIAGE_ACTIONS)[number];

/** Malformed triage command — the route maps this to 400. */
export class InvalidTriageError extends Error {}

/**
 * `done` on a state-backed id (`conn:*`) — the route maps this to 422.
 * State-backed rows resolve by fixing the state (reconnect), not by triage.
 */
export class StateBackedDoneError extends Error {}

export interface TriageStatePatch {
  read?: boolean;
  done?: boolean;
  snoozedUntil?: Date | null;
}

/**
 * Pure decision: the absolute bo_at_inbox_state patch a triage action writes.
 * Absolute (never a toggle), so re-sending the same command is idempotent.
 * Throws before any I/O — the route validates by calling this first.
 */
export function triagePatch(
  itemId: string,
  action: string,
  snoozedUntil?: string,
): TriageStatePatch {
  if (!itemId) throw new InvalidTriageError("itemId is required");
  if (!(TRIAGE_ACTIONS as readonly string[]).includes(action)) {
    throw new InvalidTriageError(`unknown action: ${action}`);
  }
  switch (action as TriageAction) {
    case "read":
      return { read: true };
    case "unread":
      return { read: false };
    case "done":
      if (itemId.startsWith("conn:")) {
        throw new StateBackedDoneError(
          "state-backed items self-heal and cannot be marked done",
        );
      }
      return { done: true };
    case "undone":
      return { done: false };
    case "snooze": {
      const ts = snoozedUntil ? new Date(snoozedUntil) : null;
      if (!ts || Number.isNaN(ts.getTime())) {
        throw new InvalidTriageError("snooze requires a valid snoozedUntil timestamp");
      }
      return { snoozedUntil: ts };
    }
    case "unsnooze":
      return { snoozedUntil: null };
  }
}

/**
 * Idempotent triage upsert into bo_at_inbox_state. Runs inside
 * `withSpaceSchema(...)`. Untouched fields keep their column defaults on
 * insert and their existing values on conflict.
 */
export async function applyTriage(
  tx: SpaceTx,
  cmd: { itemId: string; action: string; snoozedUntil?: string },
  now: Date = new Date(),
): Promise<void> {
  const patch = triagePatch(cmd.itemId, cmd.action, cmd.snoozedUntil);
  await tx
    .insert(spacePg.inboxState)
    .values({ itemId: cmd.itemId, ...patch, updatedAt: now })
    .onConflictDoUpdate({
      target: spacePg.inboxState.itemId,
      set: { ...patch, updatedAt: now },
    });
}

/** Idempotent per-base mute flip in bo_at_inbox_mutes (row present = muted). */
export async function applyMute(
  tx: SpaceTx,
  cmd: { baseId: string; muted: boolean },
  now: Date = new Date(),
): Promise<void> {
  if (cmd.muted) {
    await tx
      .insert(spacePg.inboxMutes)
      .values({ baseId: cmd.baseId, createdAt: now })
      .onConflictDoNothing();
  } else {
    await tx.delete(spacePg.inboxMutes).where(eq(spacePg.inboxMutes.baseId, cmd.baseId));
  }
}
