// Staff force-backup — admin flavor of apps/web/src/lib/backup-runs/start.ts
// startBackupRun(). Same contract (active connection → included bases →
// INSERT queued row → engine start → orphan DELETE on engine rejection),
// minus web's per-org IDOR check: staff is cross-org by definition and the
// route's `role='super'` middleware gate is the authorization. The space row
// is fetched by the route as a pre-audit precondition and passed in.
//
// Note: this path bypasses customer quota gating (web's path has none today
// either); the audit intent/result rows are the accountability mechanism.

import type { EngineStartRunError, EngineStartRunResult } from '../backup-engine'

export interface ForceBackupSpace {
  id: string
  organizationId: string
}

export interface ForceBackupDeps {
  /** Most-relevant Airtable connection in the org, regardless of status. */
  fetchAirtableConnection: (
    organizationId: string,
  ) => Promise<{ id: string; status: string } | null>
  countIncludedBases: (spaceId: string) => Promise<number>
  insertBackupRun: (input: {
    spaceId: string
    connectionId: string
    isTrial: boolean
  }) => Promise<string>
  deleteBackupRun: (runId: string) => Promise<void>
  engineStartRun: (runId: string) => Promise<EngineStartRunResult>
}

export type ForceBackupResult =
  | { ok: true; runId: string; triggerRunIds: string[] }
  | { ok: false; code: 'no_active_connection' | 'invalid_connection' | 'no_bases_selected' }
  | { ok: false; code: EngineStartRunError['code']; status: number }

export async function forceBackup(
  space: ForceBackupSpace,
  deps: ForceBackupDeps,
): Promise<ForceBackupResult> {
  const connection = await deps.fetchAirtableConnection(space.organizationId)
  if (!connection) return { ok: false, code: 'no_active_connection' }
  if (connection.status !== 'active') return { ok: false, code: 'invalid_connection' }

  const baseCount = await deps.countIncludedBases(space.id)
  if (baseCount === 0) return { ok: false, code: 'no_bases_selected' }

  const runId = await deps.insertBackupRun({
    spaceId: space.id,
    connectionId: connection.id,
    isTrial: false,
  })

  const engineResult = await deps.engineStartRun(runId)
  if (engineResult.ok) {
    return { ok: true, runId: engineResult.runId, triggerRunIds: engineResult.triggerRunIds }
  }

  // Engine rejected — undo the INSERT so retry is clean. A DELETE failure is
  // swallowed: surfacing it would mask the real engine error.
  try {
    await deps.deleteBackupRun(runId)
  } catch {
    // intentional — see above
  }

  return { ok: false, code: engineResult.code, status: engineResult.status }
}
