/**
 * Orchestrates the Configure page's single Save action:
 *
 *   1. PATCH the backup-config policy (frequency) via saveBackupConfig.
 *   2. On first-time setup, POST a first backup run via runBackup.
 *   3. Tell the caller where to navigate (/?status=…) — Space Home.
 *
 * Pure async function with injected deps (save-config / run-backup
 * helpers), so the decision logic is testable without a DOM or network.
 */

import {
  saveBackupConfig,
  type SaveConfigError,
  type SaveConfigInput,
  type SaveConfigResult,
} from './save-config'
import {
  describeRunBackupError,
  runBackup,
  type RunBackupResult,
} from './run-backup'

export interface ConfigureSaveInput {
  spaceId: string
  frequency?: 'monthly' | 'weekly' | 'daily' | 'instant'
  /** server-backup-scope: what the schedule(s) back up. */
  scope?: 'schema_only' | 'schema_and_data'
  /** server-backup-scope: schema-only cadence, or null to clear it. */
  schemaFrequency?: 'monthly' | 'weekly' | 'daily' | 'instant' | null
  /** Selected primary destination (shared-multi-destinations). */
  storageType?: string
  /** First-time setup: kick off the first backup right after saving. */
  runFirstBackup: boolean
}

export type ConfigureSaveOutcome =
  | { ok: true; redirect: string }
  | { ok: false; message: string }

export interface ConfigureSaveDeps {
  saveConfigImpl?: (input: SaveConfigInput) => Promise<SaveConfigResult>
  runBackupImpl?: (spaceId: string) => Promise<RunBackupResult>
}

function describeSaveConfigError(error: SaveConfigError): string {
  switch (error) {
    case 'frequency_not_allowed':
      return 'That schedule is not available on your plan.'
    case 'unauthenticated':
      return 'Please sign in again.'
    case 'network':
      return 'Network error — check your connection and try again.'
    case 'destination_not_connected':
      return 'Connect that destination before making it the primary.'
    default:
      return 'Could not save changes. Please try again.'
  }
}

export async function saveConfigureForm(
  input: ConfigureSaveInput,
  deps: ConfigureSaveDeps = {},
): Promise<ConfigureSaveOutcome> {
  const saveConfigFn = deps.saveConfigImpl ?? saveBackupConfig
  const runBackupFn = deps.runBackupImpl ?? runBackup

  if (
    input.frequency !== undefined ||
    input.scope !== undefined ||
    input.schemaFrequency !== undefined ||
    input.storageType !== undefined
  ) {
    const saved = await saveConfigFn({
      spaceId: input.spaceId,
      frequency: input.frequency,
      scope: input.scope,
      schemaFrequency: input.schemaFrequency,
      storageType: input.storageType,
    })
    if (!saved.ok) {
      return { ok: false, message: describeSaveConfigError(saved.error) }
    }
  }

  if (input.runFirstBackup) {
    const run = await runBackupFn(input.spaceId)
    if (!run.ok) {
      // Config is saved at this point; surface why the run didn't start so
      // the user can fix it (e.g. pick a base) and hit Save again.
      return { ok: false, message: describeRunBackupError(run.error) }
    }
    return { ok: true, redirect: '/?status=running' }
  }

  return { ok: true, redirect: '/?status=saved' }
}
