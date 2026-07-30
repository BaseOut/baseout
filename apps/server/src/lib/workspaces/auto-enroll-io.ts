// Production wiring for the run-start workspace auto-enroll check
// (server-mcp-workspaces). processRunStart calls the dep this module builds
// BEFORE fetchIncludedBases, inside a try/catch — MCP failure (or the
// spike-documented 403 on today's grant) NEVER fails or delays the run: the
// check skips with a reason and the run proceeds on the configured base set.
//
// Flow per run: read the Space's space_workspaces rows + config flags → fetch
// the connection's workspace listing (cache-BYPASSED — correctness path;
// the ~60s cache belongs to the picker route) → pure decideAutoEnroll → write:
//   - space_workspaces auto rows for standing-flag enrollments,
//   - at_bases upserts (workspace identity stamped; discovered_via
//     'rediscovery_scheduled' — the existing vocabulary, on INSERT only),
//   - backup_configuration_bases inserts (is_included, is_auto_discovered),
//   - last_checked_at stamps on every enrolled row,
//   - space_events notifications: 'workspaces_auto_enrolled' /
//     'bases_auto_enrolled' / 'bases_auto_enroll_capped' (additive kinds on
//     the existing surface).

import { and, eq } from "drizzle-orm";
import {
  atBases,
  backupConfigurationBases,
  backupConfigurations,
  spaceEvents,
  spaceWorkspaces,
} from "../../db/schema";
import type { AppDb } from "../../db/worker";
import type { Env } from "../../env";
import { resolveCapabilities } from "../capabilities/resolve";
import { fetchConnectionWorkspaces } from "../../pages/api/internal/connections/workspaces";
import { decideAutoEnroll, type WorkspaceListingEntry } from "./auto-enroll";

export interface WorkspaceAutoEnrollArgs {
  spaceId: string;
  connectionId: string;
  organizationId: string;
  configId: string;
}

export type WorkspaceAutoEnrollResult =
  | { ok: true; enrolledWorkspaces: number; added: number; skipped: number }
  | { ok: false; reason: string };

export function buildWorkspaceAutoEnrollDep(
  db: AppDb,
  env: Env,
): (args: WorkspaceAutoEnrollArgs) => Promise<WorkspaceAutoEnrollResult> {
  return async (args) => {
    const { spaceId, connectionId, configId } = args;

    // 1. Enrollment rows + config flags. Nothing enrolled AND legacy flag off
    //    AND standing flag off → nothing to do, skip the MCP round-trip.
    const enrolledRows = await db
      .select()
      .from(spaceWorkspaces)
      .where(eq(spaceWorkspaces.spaceId, spaceId));
    const [config] = await db
      .select({
        autoAddFutureBases: backupConfigurations.autoAddFutureBases,
        autoEnrollNewWorkspaces: backupConfigurations.autoEnrollNewWorkspaces,
      })
      .from(backupConfigurations)
      .where(eq(backupConfigurations.id, configId))
      .limit(1);
    if (!config) return { ok: false, reason: "config_not_found" };
    const anyAutoAdd =
      enrolledRows.some((r) => r.autoEnrollFutureBases) ||
      config.autoEnrollNewWorkspaces ||
      (enrolledRows.length === 0 && config.autoAddFutureBases);
    if (!anyAutoAdd) return { ok: true, enrolledWorkspaces: 0, added: 0, skipped: 0 };

    // 2. Current listing (cache-bypassed). Today's grant 403s here — the
    //    documented degraded state until Features §17 Q20 resolves.
    const listing = await fetchConnectionWorkspaces(env, db, connectionId);
    if (!listing.ok) return { ok: false, reason: listing.reason };

    // 3. Configured base set + cap.
    const configured = await db
      .select({
        atBaseId: atBases.atBaseId,
        isIncluded: backupConfigurationBases.isIncluded,
      })
      .from(backupConfigurationBases)
      .innerJoin(atBases, eq(atBases.id, backupConfigurationBases.atBaseId))
      .where(eq(backupConfigurationBases.backupConfigurationId, configId));
    const configuredBaseIds = new Set(configured.map((r) => r.atBaseId));
    const currentIncludedCount = configured.filter((r) => r.isIncluded).length;
    const { capabilities } = await resolveCapabilities(db, args.organizationId, "airtable");
    const cap = capabilities?.basesPerSpace ?? null;

    const listingEntries: WorkspaceListingEntry[] = listing.workspaces.map((w) => ({
      workspaceId: w.id,
      workspaceName: w.name,
      bases: (w.bases ?? []).map((b) => ({ atBaseId: b.id, name: b.name })),
    }));

    const decision = decideAutoEnroll({
      enrolled: enrolledRows.map((r) => ({
        workspaceId: r.workspaceId,
        autoEnrollFutureBases: r.autoEnrollFutureBases,
      })),
      autoEnrollNewWorkspaces: config.autoEnrollNewWorkspaces,
      legacyAutoAddFutureBases: config.autoAddFutureBases,
      listing: listingEntries,
      configuredBaseIds,
      cap,
      currentIncludedCount,
    });

    const now = new Date();

    // 4. Standing-flag enrollments (existing rows never modified).
    for (const ws of decision.workspacesToEnroll) {
      await db
        .insert(spaceWorkspaces)
        .values({
          spaceId,
          workspaceId: ws.workspaceId,
          workspaceName: ws.workspaceName,
          autoEnrollFutureBases: true,
          enrolledVia: "auto",
          lastCheckedAt: now,
        })
        .onConflictDoNothing();
    }

    // 5. Base additions: at_bases upsert (workspace identity stamped) +
    //    config-bases insert. The bases join THIS run because processRunStart
    //    calls fetchIncludedBases after this dep resolves.
    for (const add of decision.toAdd) {
      const [baseRow] = await db
        .insert(atBases)
        .values({
          spaceId,
          atBaseId: add.atBaseId,
          name: add.name,
          discoveredVia: "rediscovery_scheduled",
          lastSeenAt: now,
          workspaceId: add.workspaceId,
          workspaceName: add.workspaceName,
        })
        .onConflictDoUpdate({
          target: [atBases.spaceId, atBases.atBaseId],
          set: {
            name: add.name,
            lastSeenAt: now,
            workspaceId: add.workspaceId,
            workspaceName: add.workspaceName,
          },
        })
        .returning({ id: atBases.id });
      if (!baseRow) continue;
      await db
        .insert(backupConfigurationBases)
        .values({
          backupConfigurationId: configId,
          atBaseId: baseRow.id,
          isIncluded: true,
          isAutoDiscovered: true,
        })
        .onConflictDoNothing();
    }

    // 6. Freshness stamp for the settings UI.
    await db
      .update(spaceWorkspaces)
      .set({ lastCheckedAt: now })
      .where(eq(spaceWorkspaces.spaceId, spaceId));

    // 7. Notifications — never partial-silent (design Decision 3).
    const events: { kind: string; payload: Record<string, unknown> }[] = [];
    if (decision.workspacesToEnroll.length) {
      events.push({
        kind: "workspaces_auto_enrolled",
        payload: { workspaces: decision.workspacesToEnroll },
      });
    }
    if (decision.toAdd.length) {
      events.push({
        kind: "bases_auto_enrolled",
        payload: {
          added: decision.toAdd.map((a) => ({
            atBaseId: a.atBaseId,
            name: a.name,
            workspaceId: a.workspaceId,
            workspaceName: a.workspaceName,
          })),
        },
      });
    }
    if (decision.skipped.length) {
      events.push({
        kind: "bases_auto_enroll_capped",
        payload: {
          skipped: decision.skipped.map((a) => ({
            atBaseId: a.atBaseId,
            name: a.name,
            workspaceId: a.workspaceId,
            workspaceName: a.workspaceName,
          })),
          tierCap: cap,
        },
      });
    }
    for (const e of events) {
      await db.insert(spaceEvents).values({ spaceId, kind: e.kind, payload: e.payload });
    }

    return {
      ok: true,
      enrolledWorkspaces: decision.workspacesToEnroll.length,
      added: decision.toAdd.length,
      skipped: decision.skipped.length,
    };
  };
}

// Rediscovery stamping (task 2.2): re-stamp at_bases workspace identity from a
// successful listing — null-tolerant, name drift re-stamped every listing
// (design open question 3: names are NOT treated as stable).
export async function stampWorkspaceIdentity(
  db: AppDb,
  spaceId: string,
  workspaces: { id: string; name: string | null; bases?: { id: string; name: string }[] }[],
): Promise<void> {
  for (const ws of workspaces) {
    for (const base of ws.bases ?? []) {
      await db
        .update(atBases)
        .set({ workspaceId: ws.id, workspaceName: ws.name })
        .where(and(eq(atBases.spaceId, spaceId), eq(atBases.atBaseId, base.id)));
    }
  }
  // Membership-free envelopes leave identity untouched (never nulled) — the
  // columns are nullable-first and absence must not regress prior stamps.
}
