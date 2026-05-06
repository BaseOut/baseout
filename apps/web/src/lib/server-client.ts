/**
 * Typed client for `apps/web` → `apps/server` calls.
 *
 * Spec: openspec/changes/baseout-web-run-now-contract/specs/web-run-now-contract/spec.md
 *
 * Today this is a stub: every call throws `NotImplementedError` because the
 * server-side `POST /api/internal/runs/start` is not yet built (see
 * `baseout-server-engine-core`). Once that endpoint is live, this module
 * becomes the live HTTP caller — request/response types, validation, and
 * error mapping are already wired so the only swap is the inner fetch.
 */

const TRIGGERED_BY_VALUES = ['manual', 'scheduled', 'webhook', 'trial'] as const
export type TriggeredBy = (typeof TRIGGERED_BY_VALUES)[number]

export interface EnqueueRunRequest {
  runId: string
  spaceId: string
  connectionId: string
  triggeredBy: TriggeredBy
  isTrial: boolean
  metadata?: Record<string, unknown>
}

export type EnqueueRunErrorCode =
  | 'not_authenticated'
  | 'forbidden'
  | 'invalid_body'
  | 'conflict'
  | 'not_yet_implemented'
  | 'internal_error'

export type EnqueueRunResponse =
  | { ok: true; runId: string; queuedAt: string; idempotent: boolean }
  | { ok: false; code: EnqueueRunErrorCode; error: string; spec?: string }

export class NotImplementedError extends Error {
  readonly code: EnqueueRunErrorCode = 'not_yet_implemented'
  constructor(message = 'Run enqueue is not yet implemented; see Spec header') {
    super(message)
    this.name = 'NotImplementedError'
  }
}

/**
 * Validate a candidate request body against the contract. Returns either the
 * typed object or a string describing the first violation. Pure — no I/O.
 *
 * Mirrors `EnqueueRunRequest` field-for-field. New fields require a v2 spec.
 */
export function parseEnqueueRunRequest(
  raw: unknown,
): { ok: true; value: EnqueueRunRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Body must be a JSON object' }
  }
  const r = raw as Record<string, unknown>

  if (typeof r.runId !== 'string' || r.runId.length === 0) {
    return { ok: false, error: 'runId must be a non-empty string' }
  }
  if (typeof r.spaceId !== 'string' || r.spaceId.length === 0) {
    return { ok: false, error: 'spaceId must be a non-empty string' }
  }
  if (typeof r.connectionId !== 'string' || r.connectionId.length === 0) {
    return { ok: false, error: 'connectionId must be a non-empty string' }
  }
  if (typeof r.triggeredBy !== 'string' ||
      !TRIGGERED_BY_VALUES.includes(r.triggeredBy as TriggeredBy)) {
    return {
      ok: false,
      error: `triggeredBy must be one of: ${TRIGGERED_BY_VALUES.join(', ')}`,
    }
  }
  if (typeof r.isTrial !== 'boolean') {
    return { ok: false, error: 'isTrial must be a boolean' }
  }
  if (r.metadata !== undefined &&
      (typeof r.metadata !== 'object' || r.metadata === null || Array.isArray(r.metadata))) {
    return { ok: false, error: 'metadata, if present, must be an object' }
  }

  return {
    ok: true,
    value: {
      runId: r.runId,
      spaceId: r.spaceId,
      connectionId: r.connectionId,
      triggeredBy: r.triggeredBy as TriggeredBy,
      isTrial: r.isTrial,
      metadata: r.metadata as Record<string, unknown> | undefined,
    },
  }
}

/**
 * Constant-time string equality. Length-mismatch returns false immediately;
 * otherwise XORs every byte. Used for `x-internal-token` validation on routes
 * that gate on the shared internal secret.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

/**
 * Live caller — TODO: wire to `apps/server`'s `POST /api/internal/runs/start`
 * once `baseout-server-engine-core` ships. Until then, throws.
 */
export async function enqueueRun(
  _payload: EnqueueRunRequest,
): Promise<EnqueueRunResponse> {
  throw new NotImplementedError()
}
