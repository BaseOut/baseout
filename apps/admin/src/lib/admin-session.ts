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

// Parses the raw Cookie header for the session-token value. Two sources, in
// priority order:
//   1. web's better-auth cookie (dev name or the `__Secure-` prod variant) —
//      the local-dev path, where web and admin share the baseout.local host.
//      Regex copied from apps/web/src/lib/session-cache.ts.
//   2. `baseout_admin_session` — admin's own host-only cookie, set by
//      /auth/handoff on the DEPLOYED path where web's cookie can never reach
//      this origin (host-only + workers.dev is on the Public Suffix List).
//      Carries the same `<token>.<signature>` value.
// The better-auth cookie wins when both are present so local dev always
// reflects web's live session.
export function extractSessionTokenCookie(cookieHeader: string): string | null {
  const betterAuth = cookieHeader.match(
    /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/,
  )
  if (betterAuth) return betterAuth[1]
  const handoff = cookieHeader.match(/(?:^|;\s*)baseout_admin_session=([^;]+)/)
  return handoff ? handoff[1] : null
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

// Staff email domain (openspec/changes/shared-staff-domain-access). This is a
// DELIBERATE lockstep copy of apps/web's `INTERNAL_EMAIL_DOMAINS` /
// `isInternalEmail` (apps/web/src/lib/capabilities/internal-access.ts) — admin
// cannot import web code, and cross-app imports are out of scope here. The `@`
// prefix is security-critical: it anchors the match to the domain part so a
// lookalike like `x@evil-openside.com` or `x@openside.com.evil.net` is denied.
// Keep this byte-identical to web's constant.
const STAFF_EMAIL_DOMAIN = '@openside.com'

// Staff-access predicate: an explicit `role === 'super'` OR a verified
// @openside.com email. Verified because Baseout is magic-link only — an
// established session proves the user owns the address. Additive: it only ever
// grants, never downgrades an existing super.
export function isStaff(input: { role?: string | null; email?: string | null }): boolean {
  if (input.role === 'super') return true
  if (!input.email) return false
  return input.email.trim().toLowerCase().endsWith(STAFF_EMAIL_DOMAIN)
}

export type GateRow = { role: string; email?: string | null; expiresAt: Date } | null

export type GateDecision =
  | { ok: true }
  | { ok: false; reason: 'no-session' | 'expired' | 'not-staff' }

// Pure access decision given the looked-up session+user row and the current
// time. Keeps the policy testable in isolation from the DB and the request.
export function decideAccess(row: GateRow, now: Date): GateDecision {
  if (!row) return { ok: false, reason: 'no-session' }
  if (row.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: 'expired' }
  }
  if (!isStaff(row)) return { ok: false, reason: 'not-staff' }
  return { ok: true }
}
