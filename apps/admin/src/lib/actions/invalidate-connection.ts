// Staff invalidate-connection — flips connections.status to 'invalid' (the
// route precondition-checks existence + already-invalid before auditing),
// then best-effort cancels every queued/running backup run on the
// connection. Cancel failures never roll back the flip: the operator intent
// is "stop trusting this connection", and the run-reconciliation sweep is
// the safety net for stragglers. The connection_status_audit Postgres
// trigger (web migration 0015) independently records the status change.

import type { EngineCancelRunResult } from '../backup-engine'

export type CancelledRunOutcome =
  | { runId: string; ok: true }
  | { runId: string; ok: false; code: string }

export interface InvalidateConnectionDeps {
  /** UPDATE connections SET status='invalid', invalidated_at=now(), modified_at=now(). */
  markConnectionInvalid: (connectionId: string) => Promise<void>
  /** Ids of backup_runs on this connection with status IN ('queued','running'). */
  fetchActiveRunIdsForConnection: (connectionId: string) => Promise<string[]>
  /** null when the engine binding/token is absent — cancels are skipped. */
  engineCancelRun: ((runId: string) => Promise<EngineCancelRunResult>) | null
}

export interface InvalidateConnectionResult {
  ok: true
  cancelledRuns: CancelledRunOutcome[] | 'skipped_no_engine'
}

export async function invalidateConnection(
  connectionId: string,
  deps: InvalidateConnectionDeps,
): Promise<InvalidateConnectionResult> {
  await deps.markConnectionInvalid(connectionId)

  if (!deps.engineCancelRun) return { ok: true, cancelledRuns: 'skipped_no_engine' }

  const runIds = await deps.fetchActiveRunIdsForConnection(connectionId)
  const cancelledRuns: CancelledRunOutcome[] = []
  for (const runId of runIds) {
    try {
      const result = await deps.engineCancelRun(runId)
      cancelledRuns.push(result.ok ? { runId, ok: true } : { runId, ok: false, code: result.code })
    } catch {
      cancelledRuns.push({ runId, ok: false, code: 'engine_unreachable' })
    }
  }

  return { ok: true, cancelledRuns }
}
