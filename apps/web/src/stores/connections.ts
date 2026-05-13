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
}

export const $integrations = atom<IntegrationsState | null>(null)
