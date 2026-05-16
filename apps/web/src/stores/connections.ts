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
}

export interface BackupPolicy {
  /** Currently saved frequency (defaults to 'monthly' from the schema). */
  frequency: Frequency
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
   * Unread per-Space events to render as the inline banner on the
   * integrations page. Engine writes 'bases_discovered' rows during
   * workspace rediscovery; the UI dismisses them via the dismiss route.
   */
  unreadEvents: SpaceEventSummary[]
}

export const $integrations = atom<IntegrationsState | null>(null)
