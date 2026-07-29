import { atom } from 'nanostores'
import type { Frequency } from '../lib/capabilities/tier-capabilities'

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
  /** Airtable workspace identity (web-workspace-bases) — null until a
   * workspace-aware pass stamps it; the picker groups by these and falls
   * back to flat when absent. */
  workspaceId?: string | null
  workspaceName?: string | null
  /**
   * True when this base was pulled in automatically (workspace auto-add or a
   * newly auto-enrolled workspace) during the most recent rediscovery — a
   * RECENCY flag (same window as `isNew`), cleared by the engine on the next
   * run. Permanent provenance lives in Settings. (base-picker fork model.)
   */
  isAutoDiscovered?: boolean
  /**
   * The per-base workspace lookup has not returned YET (progressive
   * resolution) — a THIRD state, never folded into "no workspaceId"
   * ("Still matching" bucket vs "No workspace" bucket). Server-persisted
   * workspace stamping leaves this false/absent.
   */
  workspacePending?: boolean
}

export interface BackupPolicy {
  /** Currently saved DATA (full-backup) frequency (defaults to 'monthly'). */
  frequency: Frequency
  /**
   * server-backup-scope: what the schedule(s) back up.
   *   'schema_and_data' (default) — full data backups on `frequency`, plus a
   *     more-frequent schema-only schedule when `schemaFrequency` is set.
   *   'schema_only' — no data backup; schema refreshes on `schemaFrequency`.
   */
  scope: 'schema_only' | 'schema_and_data'
  /**
   * server-backup-scope: cadence of the schema-only schedule, or null when the
   * schema refreshes only alongside each full data backup.
   */
  schemaFrequency: Frequency | null
  /**
   * Engine-written next-fire of the schema schedule (ISO-8601) or null when no
   * schema alarm is armed. Surface as "Next schema backup: <date>".
   */
  schemaNextScheduledAt: string | null
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
 * presence in storageDestinations means that provider is currently connected.
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
  /** How the workspace entered the Space's config — picked by hand, or pulled in by the standing "Auto-enroll new workspaces" rule. */
  enrolledVia: 'manual' | 'auto'
  /** Bases from this workspace currently included in the backup. */
  includedBaseCount: number
  /** ISO-8601 timestamp of the last rediscovery check, or null if never checked. */
  lastCheckedAt: string | null
  /** True when this workspace's auto-add is blocked by the tier's bases-per-Space cap. */
  capBlocked?: boolean
}

/**
 * 'off'       → nothing to say; flat table, no toolbar line.
 * 'resolving' → the counter line; the table does not move while it ticks.
 * 'ready'     → the OFFER line; still flat until the user clicks.
 * 'failed'    → the retry line; flat, and the flat table is still complete.
 * Server-persisted workspace stamping renders as 'off' — the data is
 * already there at SSR time, so there is nothing to progressively resolve.
 */
export type WorkspaceResolveState = 'off' | 'resolving' | 'ready' | 'failed'

/**
 * A name the USER typed for an Airtable workspace, stored against the
 * workspace id with the REASON they typed it: 'placeholder-fill' (typed only
 * because Airtable withheld the name; the real name takes over when it lands)
 * vs 'custom' (deliberate; never overridden). Promotion to 'custom' happens
 * only via the one "Keep mine" prompt.
 */
export interface WorkspaceAlias {
  workspaceId: string
  alias: string
  kind: 'placeholder-fill' | 'custom'
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
   * The Space's connected storage destinations (one per provider type, most
   * recently connected first; empty when none). The PRIMARY — the one backups
   * write to — is the entry whose type matches policy.storageType. Drives
   * "Connected as <email> · Reconnect" vs bare "Connect X" rendering plus the
   * Connected/Primary indicators in the destination views.
   */
  storageDestinations: StorageDestinationSummary[]
  /**
   * Unread per-Space events to render as the inline banner on the
   * integrations page. Engine writes 'bases_discovered' rows during
   * workspace rediscovery; the UI dismisses them via the dismiss route.
   */
  unreadEvents: SpaceEventSummary[]
  /**
   * Per-workspace auto-add posture for this Space's connection
   * (workspace-auto-enroll). Optional — connections without workspace
   * grouping omit it and the picker falls back to the legacy
   * `policy.autoAddFutureBases` single toggle.
   */
  enrolledWorkspaces?: WorkspaceEnrollment[]
  /**
   * Standing rule: a workspace created in Airtable AFTER setup is enrolled
   * automatically (`enrolledVia: 'auto'`) at the next backup run. Optional,
   * defaults to false (opt-in). Persisted on
   * `backup_configurations.auto_enroll_new_workspaces`.
   */
  autoEnrollNewWorkspaces?: boolean
  /** Progressive workspace-lookup state — 'off' under server-persisted stamping. */
  wsResolve?: WorkspaceResolveState
  /** Bases whose workspace is known so far (progressive mode only). */
  wsResolvedCount?: number
  /** Bases the lookup has to get through in total (progressive mode only). */
  wsTotalCount?: number
  /**
   * The user's remembered answer to "Group by workspace?" for this
   * connection. Grouped by default; a user who switches it off stays off.
   */
  groupByWorkspace?: boolean
  /** Names the user typed for workspaces, with the reason they typed them. */
  workspaceAliases?: WorkspaceAlias[]
}

export const $integrations = atom<IntegrationsState | null>(null)
