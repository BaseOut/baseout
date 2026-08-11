/**
 * 2FA audit + notification pipeline (web-auth-2fa task 2.1).
 *
 * Events are emitted by the adapter storage hook (activation) and the
 * all-methods response hooks (enroll/disable/backup-code/failed-challenge)
 * and land here: one auth_audit_log row per event, plus a security
 * notification email for the user-visible ones. Best-effort by design —
 * an audit/email hiccup must never fail an auth action.
 */

import { eq } from 'drizzle-orm'
import type { AppDb } from '../../db'
import { users } from '../../db/schema'
import { writeAuthAuditSafe, type AuthAuditKind } from '../auth-audit'
import { sendEmail, type SendEmailEnv } from '../email/send'
import {
  renderTwoFactorEmail,
  type TwoFactorEmailKind,
} from '../email/templates/two-factor'

export type TwoFactorEventKind =
  | 'enroll_started'
  | 'enabled'
  | 'disabled'
  | 'backup_code_consumed'
  | 'challenge_failed'

export interface TwoFactorEvent {
  kind: TwoFactorEventKind
  userId: string | null
  email?: string | null
  metadata?: Record<string, unknown>
}

const AUDIT_KIND: Record<TwoFactorEventKind, AuthAuditKind> = {
  enroll_started: '2fa_enroll_started',
  enabled: '2fa_enabled',
  disabled: '2fa_disabled',
  backup_code_consumed: '2fa_backup_code_consumed',
  challenge_failed: '2fa_challenge_failed',
}

/** Kinds that notify the user by email (spec: enroll(=activation), disable,
 * backup-code consumption, failed challenges). enroll_started is audit-only
 * — activation ('enabled') is the meaningful enrollment notification. */
const EMAILED_KINDS: ReadonlySet<TwoFactorEventKind> = new Set([
  'enabled',
  'disabled',
  'backup_code_consumed',
  'challenge_failed',
])

export async function handleTwoFactorEvent(
  db: AppDb,
  emailEnv: SendEmailEnv,
  event: TwoFactorEvent,
): Promise<void> {
  try {
    let email = event.email ?? null
    if (!email && event.userId) {
      const [row] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, event.userId))
        .limit(1)
      email = row?.email ?? null
    }

    await writeAuthAuditSafe(db, {
      kind: AUDIT_KIND[event.kind],
      actorUserId: event.userId,
      actorEmail: email,
      metadata: event.metadata ?? null,
    })

    if (email && EMAILED_KINDS.has(event.kind)) {
      const rendered = renderTwoFactorEmail({
        kind: event.kind as TwoFactorEmailKind,
      })
      await sendEmail({ to: email, ...rendered }, emailEnv)
    }
  } catch {
    // Never fail the auth action for observability side-effects.
  }
}
