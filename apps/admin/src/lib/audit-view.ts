// Audit-trail view assembly (pure; testable without a DB).
//
// PRD §16.1: staff can "view and search … audit trail". The two-row
// intent/result model (lib/audit.ts) is paired here into one logical entry
// per action. NOTE: `admin_audit_log.action` has NO DB CHECK constraint
// (verified: apps/web/drizzle/0025_admin_audit_log.sql — plain text), so
// unknown action strings must render gracefully, never crash.

import type { BadgeVariant } from './ui'

export interface AuditIntentRow {
  id: string
  createdAt: Date
  actorEmail: string
  action: string
  targetType: string
  targetId: string
  organizationId: string | null
  orgName?: string | null
  params: unknown
}

export interface AuditResultRow {
  intentId: string | null
  createdAt: Date
  params: unknown
}

export type AuditOutcome = 'ok' | 'failed' | 'no_result'

export interface AuditEntry extends AuditIntentRow {
  outcome: AuditOutcome
  resultCode: string | null
  resultAt: Date | null
}

// Result params come from runAudited: the execute() return value on success
// ({ ok: true, ... }) or { ok: false, code } on failure/exception. A missing
// result row means "outcome unknown" — either in flight or the by-design
// swallowed result-write failure (audit.ts).
function deriveOutcome(result: AuditResultRow | undefined): {
  outcome: AuditOutcome
  resultCode: string | null
  resultAt: Date | null
} {
  if (!result) return { outcome: 'no_result', resultCode: null, resultAt: null }
  const params = (result.params ?? {}) as Record<string, unknown>
  const code =
    typeof params.code === 'string' ? params.code
    : typeof params.error === 'string' ? params.error
    : null
  if (params.ok === true) return { outcome: 'ok', resultCode: code, resultAt: result.createdAt }
  return { outcome: 'failed', resultCode: code, resultAt: result.createdAt }
}

/** Merge result rows onto their intent by intentId; newest-intent-first order is preserved. */
export function pairAuditRows(intents: AuditIntentRow[], results: AuditResultRow[]): AuditEntry[] {
  const resultByIntent = new Map<string, AuditResultRow>()
  for (const r of results) {
    if (r.intentId) resultByIntent.set(r.intentId, r)
  }
  return intents.map((intent) => ({
    ...intent,
    ...deriveOutcome(resultByIntent.get(intent.id)),
  }))
}

export const AUDIT_OUTCOME_BADGE: Record<AuditOutcome, BadgeVariant> = {
  ok: 'success',
  failed: 'error',
  no_result: 'warning',
}

export const AUDIT_OUTCOME_LABEL: Record<AuditOutcome, string> = {
  ok: 'ok',
  failed: 'failed',
  no_result: 'unknown',
}

// The known action vocabulary (drives the filter tabs). Unknown actions still
// render — this is a UI convenience list, not a constraint.
export const AUDIT_ACTIONS: readonly string[] = [
  'force_backup',
  'invalidate_connection',
  'force_migration',
]

const PARAMS_MAX = 80

/** Safe one-line params rendering for the table cell (full JSON in title=). */
export function summarizeParams(params: unknown): string {
  if (params === null || params === undefined) return ''
  let text: string
  try {
    text = typeof params === 'string' ? params : JSON.stringify(params)
  } catch {
    return '[unserializable]'
  }
  if (text === '{}') return ''
  return text.length > PARAMS_MAX ? `${text.slice(0, PARAMS_MAX)}…` : text
}
