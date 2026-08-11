// Write-then-execute audit helper — the only door to a staff mutation.
// Writes an admin_audit_log 'intent' row BEFORE the action executes (the
// parent `admin` change's hard rule) and appends a 'result' row after.
// Append-only: outcome is a second row, never an UPDATE.
//
// The rate guard counts recent intent rows from admin_audit_log itself, so
// it is durable across Worker isolates (an in-memory bucket would not be).

export const RATE_LIMIT_MAX = 10
export const RATE_LIMIT_WINDOW_MS = 60_000

export type AdminAction =
  | 'force_backup'
  | 'invalidate_connection'
  | 'force_migration'
  // admin-error-triage: acknowledge / un-acknowledge a triage-queue error.
  | 'acknowledge_error'
  | 'unacknowledge_error'
  // shared-entitlements 2.4 / admin-entitlements 3.2: set-or-clear a per-account
  // feature override. Domain write = applyOverrideWrite from @baseout/db-schema.
  | 'set_entitlement_override'
export type AuditTargetType =
  | 'space'
  | 'connection'
  | 'organization'
  // admin-error-triage ack targets (a source-row of the error queue).
  | 'backup_run'
  | 'backup_run_base'
  | 'restore_run'
  | 'space_database'

export interface AuditIntent {
  actor: { id: string; email: string }
  action: AdminAction
  targetType: AuditTargetType
  targetId: string
  organizationId?: string | null
  params?: Record<string, unknown>
}

export interface AuditRow {
  phase: 'intent' | 'result'
  intentId?: string
  actorUserId: string
  actorEmail: string
  action: string
  targetType: string
  targetId: string
  organizationId?: string | null
  params?: Record<string, unknown>
}

export interface AuditDeps {
  /** INSERT one admin_audit_log row; returns the new row id. */
  insertAuditRow: (row: AuditRow) => Promise<string>
  /** Count this actor's 'intent' rows in the trailing window. */
  countRecentIntentsByActor: (actorUserId: string, windowMs: number) => Promise<number>
}

export type AuditedResult<T> =
  | { ok: true; value: T; intentId: string }
  | { ok: false; code: 'rate_limited' | 'audit_write_failed' }
  | { ok: false; code: 'exception'; intentId: string }

export async function runAudited<T extends { ok: boolean }>(
  intent: AuditIntent,
  execute: () => Promise<T>,
  deps: AuditDeps,
): Promise<AuditedResult<T>> {
  const recent = await deps.countRecentIntentsByActor(intent.actor.id, RATE_LIMIT_WINDOW_MS)
  if (recent >= RATE_LIMIT_MAX) return { ok: false, code: 'rate_limited' }

  const base = {
    actorUserId: intent.actor.id,
    actorEmail: intent.actor.email,
    action: intent.action,
    targetType: intent.targetType,
    targetId: intent.targetId,
    organizationId: intent.organizationId ?? null,
  }

  let intentId: string
  try {
    intentId = await deps.insertAuditRow({ ...base, phase: 'intent', params: intent.params })
  } catch {
    return { ok: false, code: 'audit_write_failed' }
  }

  let value: T
  try {
    value = await execute()
  } catch {
    await writeResultRow(deps, base, intentId, { ok: false, code: 'exception' })
    return { ok: false, code: 'exception', intentId }
  }

  await writeResultRow(deps, base, intentId, value as unknown as Record<string, unknown>)
  return { ok: true, value, intentId }
}

async function writeResultRow(
  deps: AuditDeps,
  base: Omit<AuditRow, 'phase' | 'intentId' | 'params'>,
  intentId: string,
  params: Record<string, unknown>,
): Promise<void> {
  try {
    await deps.insertAuditRow({ ...base, phase: 'result', intentId, params })
  } catch {
    // Swallowed: the intent row + domain tables already record the action;
    // a lost result row reads as "outcome unknown" by design.
  }
}
