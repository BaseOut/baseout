// Staff-session gate for apps/admin (tracer slice).
//
// Reuses the existing apps/web better-auth login: admin does NOT run a
// better-auth runtime. It reads the `better-auth.session_token` cookie, looks
// the token up in the master-DB `sessions` table, and requires the linked
// `users.role` to be 'super'. Validation is read-only — admin never issues,
// mutates, or deletes a session.
//
// This is an INTERIM gate. The `admin` umbrella change replaces it with Google
// Workspace SSO. See openspec/changes/admin-foundation/proposal.md.

// Parses the raw Cookie header for the better-auth session token. Accepts both
// the dev cookie name and the prod `__Secure-` variant. Copied from
// apps/web/src/lib/session-cache.ts (kept identical on purpose).
export function extractSessionTokenCookie(cookieHeader: string): string | null {
  const m = cookieHeader.match(
    /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/,
  )
  return m ? m[1] : null
}

// Better Auth's cookie value is `<token>.<signature>`; the DB `sessions.token`
// column stores the token portion. We look up by the pre-`.` token, and also
// include the full decoded value as a fallback in case a future better-auth
// version stores the value whole. The DB lookup (token existence + expiry) is
// the real check; HMAC-signature verification is a noted hardening follow-up.
export function sessionTokenCandidates(cookieValue: string): string[] {
  let decoded = cookieValue
  try {
    decoded = decodeURIComponent(cookieValue)
  } catch {
    // malformed percent-encoding — fall back to the raw value
  }
  const beforeDot = decoded.split('.')[0]
  return Array.from(new Set([beforeDot, decoded].filter(Boolean)))
}

export type GateRow = { role: string; expiresAt: Date } | null

export type GateDecision =
  | { ok: true }
  | { ok: false; reason: 'no-session' | 'expired' | 'not-super' }

// Pure access decision given the looked-up session+user row and the current
// time. Keeps the policy testable in isolation from the DB and the request.
export function decideAccess(row: GateRow, now: Date): GateDecision {
  if (!row) return { ok: false, reason: 'no-session' }
  if (row.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: 'expired' }
  }
  if (row.role !== 'super') return { ok: false, reason: 'not-super' }
  return { ok: true }
}
