// Pure inbox-feed derivation (server-notifications-inbox).
//
// Derivation, not a mailbox: the GET route recomputes the feed from live
// sources (mirrored backup_runs + connections, per-Space bo_at_schema_updates)
// and merges the persisted triage state (bo_at_inbox_state / bo_at_inbox_mutes)
// on top. Deterministic ids (`run:<id>`, `schema:<id>`, `conn:<id>`) make
// triage idempotent, and state-backed rows (conn:*) self-heal — they simply
// stop being derived once the connection recovers.
//
// The emitted shape mirrors apps/web/src/components/layout/inbox.ts `InboxItem`
// FIELD-FOR-FIELD, except `space` — the web fan-out labels rows with the Space
// name itself. Title copy uses the `*bold*` marker convention.
//
// The 30-day window + per-source caps are applied at LOAD time (io.ts); this
// module only merges, filters mutes, sorts newest-first, and caps the merged
// feed. Deferred kinds (health-drop, automation-off, interface-unpublished,
// chat-doc) extend this kind table when their backends exist — see design.md.

/** Kinds the engine derives today — a subset of the web `InboxKind` union. */
export type InboxKind =
  | "connection-broken"
  | "backup-failed"
  | "schema-breaking"
  | "backup-ok"
  | "schema-changed";

export interface InboxAction {
  label: string;
  href: string;
  /** Lucide token, e.g. `lucide--refresh-cw`. */
  icon: string;
  primary?: boolean;
}

/** Mirror of the web `InboxItem` minus `space` (web adds it at fan-out time). */
export interface InboxItemView {
  id: string;
  kind: InboxKind;
  /** Row copy — `*markers*` render bold on the web side. */
  title: string;
  detail?: string;
  /** Base display name. Doubles as the web rollup key. */
  base?: string;
  /** Airtable base id — the web mute key (`bo_at_inbox_mutes.base_id`). */
  baseId?: string;
  /** ISO timestamp. */
  at: string;
  href?: string;
  action?: InboxAction;
  read?: boolean;
  done?: boolean;
  snoozedUntil?: string | null;
  stateBacked?: boolean;
  resolved?: boolean;
}

// ---- Injected source rows (fetched by io.ts, plain data here) ----

export interface RunSourceRow {
  runId: string;
  /** Master backup_runs.status — only 'failed' / 'succeeded' emit items. */
  status: string;
  /** Set when the run covered exactly one base (title + mute key). */
  baseId: string | null;
  baseName: string | null;
  /** Number of bases the run covered (title copy for multi-base runs). */
  baseCount?: number;
  errorMessage?: string | null;
  at: string;
}

export interface ConnectionSourceRow {
  connectionId: string;
  displayName: string | null;
  /** Already filtered to broken statuses by the loader; kept for context. */
  status: string;
  at: string;
}

export interface SchemaUpdateSourceRow {
  updateId: string;
  baseId: string;
  baseName: string | null;
  entityType: string;
  changeType: string;
  changeTypeName: string | null;
  breaksData: boolean;
  at: string;
}

export interface InboxStateRow {
  itemId: string;
  read: boolean;
  done: boolean;
  snoozedUntil: string | null;
}

export interface InboxMuteRow {
  baseId: string;
}

export interface DeriveInboxInput {
  runs: RunSourceRow[];
  connections: ConnectionSourceRow[];
  schemaUpdates: SchemaUpdateSourceRow[];
  states: InboxStateRow[];
  mutes: InboxMuteRow[];
  /**
   * Reserved for kinds that need time-relative copy or debounce (health-drop).
   * Snooze is NOT evaluated here — future snoozedUntil hides nothing
   * engine-side; the web panel handles display.
   */
  now: Date;
}

/** Merged-feed cap per Space (design.md §Alert kinds). */
export const INBOX_FEED_CAP = 200;

/** Activity-lane kinds — the only rows a per-base mute drops. */
const ACTIVITY_KINDS: ReadonlySet<InboxKind> = new Set<InboxKind>([
  "backup-ok",
  "schema-changed",
]);

const RECONNECT_ACTION: InboxAction = {
  label: "Reconnect",
  href: "/integrations",
  icon: "lucide--refresh-cw",
  primary: true,
};

/** The base a row concerns, for mute matching (undefined = never muted). */
interface DerivedItem {
  item: InboxItemView;
  baseId?: string;
}

function fromRun(row: RunSourceRow): DerivedItem | null {
  if (row.status !== "failed" && row.status !== "succeeded") return null;
  const failed = row.status === "failed";
  const single = row.baseId && row.baseName ? row.baseName : null;
  const title = failed
    ? single
      ? `*${single}* backup failed`
      : "Backup failed"
    : single
      ? `*${single}* backed up`
      : (row.baseCount ?? 0) > 1
        ? `${row.baseCount} bases backed up`
        : "Backup completed";
  const item: InboxItemView = {
    id: `run:${row.runId}`,
    kind: failed ? "backup-failed" : "backup-ok",
    title,
    at: row.at,
    href: `/backups/runs/${row.runId}`,
  };
  if (single) item.base = single;
  if (failed && row.errorMessage) item.detail = row.errorMessage;
  return { item, baseId: row.baseId ?? undefined };
}

function fromConnection(row: ConnectionSourceRow): DerivedItem {
  const name = row.displayName ?? "Airtable";
  return {
    item: {
      id: `conn:${row.connectionId}`,
      kind: "connection-broken",
      title: `*${name}* connection needs reconnecting`,
      detail: "Backups are paused until you reconnect.",
      at: row.at,
      href: "/integrations",
      action: { ...RECONNECT_ACTION },
      stateBacked: true,
    },
  };
}

function fromSchemaUpdate(row: SchemaUpdateSourceRow): DerivedItem {
  const base = row.baseName ?? row.baseId;
  const item: InboxItemView = {
    id: `schema:${row.updateId}`,
    kind: row.breaksData ? "schema-breaking" : "schema-changed",
    title: row.breaksData
      ? `Breaking schema change in *${base}*`
      : `Schema changed in *${base}*`,
    detail: row.changeTypeName ?? row.changeType,
    base,
    at: row.at,
    href: "/schema?tab=changelog",
  };
  return { item, baseId: row.baseId };
}

/**
 * Derive the per-Space inbox feed from pre-fetched (windowed) source rows.
 * Merges triage state, drops muted activity rows, sorts newest-first, caps.
 */
export function deriveInboxItems(input: DeriveInboxInput): InboxItemView[] {
  const derived: DerivedItem[] = [];

  for (const row of input.connections) derived.push(fromConnection(row));
  for (const row of input.runs) {
    const d = fromRun(row);
    if (d) derived.push(d);
  }
  for (const row of input.schemaUpdates) derived.push(fromSchemaUpdate(row));

  const mutedBases = new Set(input.mutes.map((m) => m.baseId));
  const stateById = new Map(input.states.map((s) => [s.itemId, s]));

  const items: InboxItemView[] = [];
  for (const { item, baseId } of derived) {
    // Muted bases drop activity-lane rows only — attention rows ignore mutes
    // ("unable to hide an attention row", web spec).
    if (ACTIVITY_KINDS.has(item.kind) && baseId && mutedBases.has(baseId)) continue;
    if (baseId) item.baseId = baseId;

    const state = stateById.get(item.id);
    if (state) {
      item.read = state.read;
      item.done = state.done;
      item.snoozedUntil = state.snoozedUntil;
    }
    items.push(item);
  }

  items.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  return items.slice(0, INBOX_FEED_CAP);
}
