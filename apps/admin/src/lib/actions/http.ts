// Shared plumbing for the staff-action POST routes.

import type { AuditedResult } from '../audit'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export const methodNotAllowed = (): Response => json(405, { error: 'method_not_allowed' })

/** Maps runAudited's pre/mid-execution failures to a response; null on success. */
export function mapAuditFailure<T>(result: AuditedResult<T>): Response | null {
  if (result.ok) return null
  if (result.code === 'rate_limited') return json(429, { error: 'rate_limited' })
  if (result.code === 'audit_write_failed') return json(500, { error: 'audit_write_failed' })
  return json(500, { error: 'exception' })
}
