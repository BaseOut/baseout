// Ack / un-ack a triage-queue error (admin-error-triage §3). Goes through
// runAudited like every other staff mutation — CSRF-checked at the route,
// rate-limited + intent/result audited here — then appends one admin_error_acks
// `phase` row (append-only). The note body lives ONLY in admin_error_acks; the
// audit params carry `hasNote`, never the text.

import { runAudited, type AuditDeps } from '../audit'
import { checkOrigin } from '../origin'
import { json } from './http'

export const ERROR_TARGET_TYPES = ['backup_run', 'backup_run_base', 'restore_run', 'connection', 'space_database'] as const
export type ErrorTargetType = (typeof ERROR_TARGET_TYPES)[number]

export interface AckRowInsert {
  phase: 'ack' | 'unack'
  targetType: ErrorTargetType
  targetId: string
  targetState: string | null
  organizationId: string | null
  ackedByUserId: string
  ackedByEmail: string
  note: string | null
}

export interface ValidatedAck {
  targetType: ErrorTargetType
  targetId: string
  targetState: string | null
  organizationId: string | null
  note: string | null
}

export type AckValidation = { ok: true; value: ValidatedAck } | { ok: false; error: string }

/** Defensive body validation (route boundary). Unknown target types → 400. */
export function validateAckBody(body: unknown): AckValidation {
  const b = (body ?? {}) as Record<string, unknown>
  if (typeof b.targetType !== 'string' || !ERROR_TARGET_TYPES.includes(b.targetType as ErrorTargetType)) {
    return { ok: false, error: 'invalid_target_type' }
  }
  if (typeof b.targetId !== 'string' || b.targetId.length === 0) return { ok: false, error: 'invalid_request' }
  if (b.note !== undefined && b.note !== null && typeof b.note !== 'string') return { ok: false, error: 'invalid_request' }
  return {
    ok: true,
    value: {
      targetType: b.targetType as ErrorTargetType,
      targetId: b.targetId,
      targetState: typeof b.targetState === 'string' ? b.targetState : null,
      organizationId: typeof b.organizationId === 'string' ? b.organizationId : null,
      note: typeof b.note === 'string' ? b.note : null,
    },
  }
}

export interface HandleAckInput {
  origin: string | null
  selfOrigin: string
  body: unknown
  actor: { id: string; email: string }
}
export interface HandleAckDeps {
  audit: AuditDeps
  insertAck: (row: AckRowInsert) => Promise<void>
}

/** Shared handler for both routes; `phase` selects ack vs un-ack. */
export async function handleAckPost(phase: 'ack' | 'unack', input: HandleAckInput, deps: HandleAckDeps): Promise<Response> {
  if (!checkOrigin(input.origin, input.selfOrigin)) return json(403, { error: 'bad_origin' })
  const parsed = validateAckBody(input.body)
  if (!parsed.ok) return json(400, { error: parsed.error })
  const v = parsed.value

  const audited = await runAudited<{ ok: true }>(
    {
      actor: input.actor,
      action: phase === 'ack' ? 'acknowledge_error' : 'unacknowledge_error',
      targetType: v.targetType,
      targetId: v.targetId,
      organizationId: v.organizationId,
      // note body excluded from the audit trail — only its presence is recorded.
      params: { targetType: v.targetType, targetId: v.targetId, hasNote: v.note !== null },
    },
    async () => {
      await deps.insertAck({
        phase,
        targetType: v.targetType,
        targetId: v.targetId,
        targetState: v.targetState,
        organizationId: v.organizationId,
        ackedByUserId: input.actor.id,
        ackedByEmail: input.actor.email,
        note: v.note,
      })
      return { ok: true }
    },
    deps.audit,
  )

  if (!audited.ok) {
    if (audited.code === 'rate_limited') return json(429, { error: 'rate_limited' })
    if (audited.code === 'audit_write_failed') return json(500, { error: 'audit_write_failed' })
    return json(500, { error: 'exception' })
  }
  return json(200, { ok: true })
}
