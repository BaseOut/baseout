/**
 * Auth-event audit writer (web-signup-domain-association; consumed by
 * web-auth-2fa + web-auth-airtable-sso).
 *
 * Append-only single-row events into baseout.auth_audit_log. Callers on the
 * request-critical path that must never fail the user action (better-auth
 * databaseHooks, notification side-effects) should use
 * `writeAuthAuditSafe`; lifecycle transitions (join-request decisions) use
 * `writeAuthAudit` and let failures surface.
 *
 * metadata must never contain tokens, secrets, TOTP material, or *_enc
 * values (schema header rule).
 */

import type { AppDb } from '../db'
import { authAuditLog } from '../db/schema'

export type AuthAuditKind =
  // Core authentication lifecycle (SOC 2 CC7.2): login-link attempt + sign-in.
  | 'magic_link_requested'
  | 'session_created'
  | 'signup_domain_matched'
  | 'join_request_created'
  | 'join_request_approved'
  | 'join_request_declined'
  | 'join_request_expired'
  | 'sso_account_linked'
  | 'sso_user_created'
  | '2fa_enroll_started'
  | '2fa_enabled'
  | '2fa_disabled'
  | '2fa_backup_code_consumed'
  | '2fa_challenge_failed'
  // BYOK provider-key lifecycle (shared-ai-byok 2.1) — metadata carries
  // provider + last_four + actor ONLY, never the key/ciphertext.
  | 'ai_key_added'
  | 'ai_key_rotated'
  | 'ai_key_revoked'

export interface AuthAuditEntry {
  kind: AuthAuditKind
  actorUserId?: string | null
  actorEmail?: string | null
  organizationId?: string | null
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown> | null
}

export async function writeAuthAudit(
  db: AppDb,
  entry: AuthAuditEntry,
): Promise<void> {
  await db.insert(authAuditLog).values({
    kind: entry.kind,
    actorUserId: entry.actorUserId ?? null,
    actorEmail: entry.actorEmail ?? null,
    organizationId: entry.organizationId ?? null,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? null,
  })
}

/** Best-effort variant for hooks that must never block the user action. */
export async function writeAuthAuditSafe(
  db: AppDb,
  entry: AuthAuditEntry,
): Promise<void> {
  try {
    await writeAuthAudit(db, entry)
  } catch {
    // Audit failure must not fail signup/sign-in — swallowed by design.
  }
}
