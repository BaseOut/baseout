import { atom } from 'nanostores'
import type { Frequency } from '@web/lib/capabilities/tier-capabilities'

/**
 * Summary of a connection safe for client-side consumption.
 * Never carries tokens or ciphertext — those stay server-side.
 */
export interface ConnectionSummary {
  id: string
  platformSlug: string
  platformName: string
  status: string
  displayName: string | null
  airtableUserId: string | null
  isEnterprise: boolean
  basesCount: number
  createdAt: string
}

export interface BaseSummary {
  id: string
  atBaseId: string
  name: string
  isIncluded: boolean
  /** Discovered in Airtable since the Space's last backup (not yet in any config). */
  isNew?: boolean
  /**
   * True when this base was pulled in automatically (workspace auto-add or a
   * newly auto-enrolled workspace) **during the most recent rediscovery** — the
   * same "since the Space's last backup" window as `isNew`, not a permanent
   * record of how the base was chosen.
   *
   * This is deliberately a RECENCY flag. Arriving automatically is an event, and
   * an event rendered as a lasting badge never expires: months on, half the list
   * would still be announcing an origin nobody is acting on any more, on the one
   * surface whose job is choosing. So the engine clears it on the next run, and
   * the badge fades with it. The permanent provenance record — who enrolled what,
   * and how — lives in Settings, where enrollment is audited rather than picked.
   */
  isAutoDiscovered?: boolean
  /**
   * Workspace the base belongs to (base-picker-workspace-grouping). Supplied by
   * the engine's MCP workspace listing (main-repo `web-workspace-bases` /
   * `server-mcp-workspaces`). Optional: older syncs or an MCP-unavailable
   * connection leave these blank, and the picker degrades to a "Workspace
   * unknown" group rather than blocking on the fetch.
   */
  workspaceId?: string
  workspaceName?: string
  /**
   * The per-base workspace lookup has not returned YET (progressive resolution).
   *
   * Deliberately a THIRD state, never folded into "no workspaceId". Getting a
   * base's workspace costs one extra Airtable API call per base (Dan 2026-07-28),
   * so on a long list the answers land over time. "We have not asked yet" and
   * "we asked and there is no workspace" are different facts about the user's
   * Airtable, and the picker must not state the second while only the first is
   * true — hence a `Still matching` bucket that is never the `No workspace` one.
   */
  workspacePending?: boolean
}

export interface BackupPolicy {
  /** Currently saved frequency (defaults to 'monthly' from the schema). */
  frequency: Frequency
  /**
   * Backup scope (backup-schedule-and-scope / server-split-backup-schedules):
   * 'schema-data' = full backup (data + schema schedules), 'schema-only' = schema
   * schedule only, no record data. Optional; defaults to 'schema-data'.
   * @deprecated superseded by the recordData/attachments depth toggles (Dan's
   * 2026-07-01 restructure); kept for back-compat fallback in props.
   */
  scope?: 'schema-only' | 'schema-data'
  /**
   * Backup depth (backup-schedule-and-scope, Dan's 2026-07-01 restructure).
   * Schema is always on. `recordData` and `attachments` are independent toggles
   * that drive which schedule box shows. Optional; recordData defaults from
   * `scope` (schema-data → true), attachments defaults false.
   */
  recordData?: boolean
  attachments?: boolean
  /** Schema tied to the data schedule ("Same schedule as the data backup"). Default true. */
  schemaTied?: boolean
  /** Schema-backup cadence (can run more often than data). Optional; falls back to `frequency`. */
  schemaFrequency?: Frequency
  /** Data-backup cadence. Optional; falls back to `frequency` (the legacy single cadence). */
  dataFrequency?: Frequency
  /** Next scheduled schema run (ISO) or null when not yet scheduled. */
  nextSchemaAt?: string | null
  /** Next scheduled data run (ISO) or null. Falls back to `nextScheduledAt`. */
  nextDataAt?: string | null
  /** Currently saved storage destination (defaults to 'r2_managed'). */
  storageType: string
  /**
   * Engine-written timestamp of the next scheduled fire (ISO-8601) or
   * null when no alarm has been armed yet (pre-bootstrap or
   * instant-frequency). Surface in the IntegrationsView "Next backup:
   * <date>" line. Phase B of baseout-backup-schedule-and-cancel.
   */
  nextScheduledAt: string | null
  /**
   * When true, bases newly discovered in the Airtable workspace by the
   * SpaceDO alarm or a manual rescan are auto-included in the next
   * backup run — subject to the tier basesPerSpace cap. Per PRD Phase 1C
   * and the workspace-rediscovery change.
   */
  autoAddFutureBases: boolean
}

/**
 * The active Space's connected BYOS storage destination, if any. There is
 * at most one per Space (`storage_destinations.space_id` is UNIQUE), so a
 * non-null value means that provider is currently connected.
 *
 * Client-safe: carries only the provider type, the connected account email,
 * and the connect timestamp — never the AES-256-GCM token ciphertext, which
 * stays server-side (mirrors the ConnectionSummary contract above).
 */
export interface StorageDestinationSummary {
  /** 'google_drive' | 'box' | 'dropbox' | 'onedrive' (or 'local_fs'). */
  type: string
  /** OAuth account email for the connected provider, when the provider returns one. */
  accountEmail: string | null
  /** ISO-8601 timestamp of when the destination was connected. */
  connectedAt: string
}

/**
 * One unread row from `space_events` — surfaced inline in the
 * IntegrationsView banner. Currently only the `bases_discovered` kind
 * is produced; future kinds (token_expiry, schema_drift) will land as
 * additive `kind` values without a schema change.
 */
export interface SpaceEventSummary {
  id: string
  kind: 'bases_discovered'
  createdAt: string
  payload: {
    discovered: string[]
    autoAdded: string[]
    blockedByTier: string[]
    tierCap: number | null
  }
}

/**
 * One Airtable workspace's auto-add posture, as tracked by the picker's
 * per-workspace macro (workspace-auto-enroll). Distinct from `BackupPolicy.
 * autoAddFutureBases`, which is the legacy single-workspace fallback used
 * when a connection has no workspace grouping at all.
 */
export interface WorkspaceEnrollment {
  workspaceId: string
  workspaceName: string
  /** Whether future bases discovered in this workspace are auto-added, up to the tier cap. */
  autoAdd: boolean
  /** How the workspace itself entered the Space's config — picked by hand, or pulled in by the standing "Auto-enroll new workspaces" rule. */
  enrolledVia: 'manual' | 'auto'
  /** Bases from this workspace currently included in the backup. */
  includedBaseCount: number
  /** ISO-8601 timestamp of the last rediscovery check for this workspace, or null if never checked. */
  lastCheckedAt: string | null
  /** True when this workspace's auto-add is blocked by the tier's bases-per-Space cap. */
  capBlocked?: boolean
}

export interface IntegrationsState {
  connections: ConnectionSummary[]
  bases: BaseSummary[]
  /** Tier cap for "Bases per Space" (Features §4.1). null = unlimited (Enterprise). */
  tierBasesPerSpace: number | null
  /** Frequencies the active org's tier can pick (Features §6.1). */
  availableFrequencies: readonly Frequency[]
  /** Whether a backup_configurations row exists for the active Space. */
  hasBackupConfig: boolean
  /** Current backup policy for the Space. Always present (defaults applied). */
  policy: BackupPolicy
  /**
   * The Space's connected BYOS storage destination, or null when none is
   * connected. Drives the "Connected as <email> · Reconnect" vs bare
   * "Connect X" rendering in the StoragePicker.
   */
  storageDestination: StorageDestinationSummary | null
  /**
   * Unread per-Space events to render as the inline banner on the
   * integrations page. Engine writes 'bases_discovered' rows during
   * workspace rediscovery; the UI dismisses them via the dismiss route.
   */
  unreadEvents: SpaceEventSummary[]
  /**
   * Per-workspace auto-add posture for this Space's connection
   * (workspace-auto-enroll). Optional — older fixtures / connections without
   * workspace grouping omit it and the picker falls back to the legacy
   * `policy.autoAddFutureBases` single toggle.
   */
  enrolledWorkspaces?: WorkspaceEnrollment[]
  /**
   * Standing rule: a workspace created in Airtable AFTER setup is enrolled
   * automatically (added to `enrolledWorkspaces`, `enrolledVia: 'auto'`) at
   * the next backup run, rather than requiring a manual pick. Optional,
   * defaults to false (opt-in).
   */
  autoEnrollNewWorkspaces?: boolean
  /**
   * How far the per-base workspace lookup has got for this connection
   * (base-picker-progressive-grouping). 'off' = not running / not applicable,
   * so the picker is a plain flat table and says nothing about workspaces.
   */
  wsResolve?: WorkspaceResolveState
  /** Bases whose workspace is known so far. Resumes after a reload; never resets to 0. */
  wsResolvedCount?: number
  /** Bases the lookup has to get through in total. */
  wsTotalCount?: number
  /**
   * The user's own answer to "Group by workspace?", remembered against this
   * connection. We NEVER group because we decided to — a returning user sees
   * groups only because they asked for them once.
   */
  groupByWorkspace?: boolean
  /** Names the user typed for workspaces, with the reason they typed them. */
  workspaceAliases?: WorkspaceAlias[]
}

/**
 * 'off'       → nothing to say; flat table, no toolbar line.
 * 'resolving' → the counter line; the table does not move while it ticks.
 * 'ready'     → the OFFER line; still flat until the user clicks.
 * 'failed'    → the retry line; flat, and the flat table is still complete.
 */
export type WorkspaceResolveState = 'off' | 'resolving' | 'ready' | 'failed'

/**
 * A name the USER typed for an Airtable workspace, stored against the workspace
 * id — and, critically, stored with the REASON they typed it.
 *
 * 'placeholder-fill' — they only typed it because Airtable withheld the name
 *   ("Workspace 3" told them nothing). When the real name later arrives, the
 *   Airtable name takes over: theirs was a stand-in, not a preference.
 * 'custom' — they deliberately chose a different name. Airtable's name never
 *   overrides it.
 *
 * Every alias starts as 'placeholder-fill'. It is promoted to 'custom' only by
 * the user answering "Keep mine" to the one prompt shown when the real name
 * lands. Dual display (theirs leading, Airtable's muted beside it) is EARNED by
 * that answer and is never the default — a permanent second name in a group
 * header re-breaks the truncation that header was already fixed for once.
 */
export interface WorkspaceAlias {
  workspaceId: string
  alias: string
  kind: 'placeholder-fill' | 'custom'
}

export const $integrations = atom<IntegrationsState | null>(null)
