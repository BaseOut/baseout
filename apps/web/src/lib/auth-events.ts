/**
 * Authentication-lifecycle audit hooks (SOC 2 CC7.2 — security-event logging
 * *including authentication*). The auth_audit_log already covers signup / SSO /
 * 2FA events; this closes the core gap flagged in the evidence pack: nothing
 * recorded the two most-scrutinised authentication events — a login-link
 * (authentication attempt) and a successful sign-in (session creation).
 *
 * Wired from middleware into auth-factory's `magicLink.sendMagicLink`
 * (onMagicLinkRequested) and `databaseHooks.session.create.after`
 * (onSessionCreated), mirroring the existing account-created / SSO / 2FA sinks.
 *
 * Best-effort by design (`writeAuthAuditSafe`): an audit write must NEVER block
 * a login. metadata carries only non-secret request context (IP, user agent) —
 * never the magic-link URL, tokens, or any *_enc value (schema header rule).
 */

import type { AppDb } from '../db'
import { writeAuthAuditSafe } from './auth-audit'

/** A login-link was requested for `email` — the authentication *attempt*. */
export async function handleMagicLinkRequested(
  db: AppDb,
  input: { email: string },
): Promise<void> {
  await writeAuthAuditSafe(db, {
    kind: 'magic_link_requested',
    actorEmail: input.email,
  })
}

export interface SignInSession {
  userId: string
  ipAddress?: string | null
  userAgent?: string | null
}

/** A session row was written — a *successful* authentication (any method). */
export async function handleSessionCreated(
  db: AppDb,
  session: SignInSession,
): Promise<void> {
  await writeAuthAuditSafe(db, {
    kind: 'session_created',
    actorUserId: session.userId,
    metadata: {
      ip: session.ipAddress ?? null,
      userAgent: session.userAgent ?? null,
    },
  })
}
