/**
 * Fork hook at the single post-verification account-creation point
 * (openspec/changes/web-signup-domain-association task 2.1, design
 * Decision 1).
 *
 * Every new user record — magic-link signup and Airtable SSO alike — is
 * created by better-auth AFTER email verification (magic-link click /
 * Airtable-verified email), so `databaseHooks.user.create.after` in
 * auth-factory is the one place both paths cross. This handler resolves the
 * new user's domain against existing Organizations and records the match as
 * an audit row; the /welcome onboarding flow then OFFERS the join-or-create
 * fork via GET /api/onboarding/domain-association (suggest-never-auto-join:
 * the fork never blocks — the user proceeds in their own account while a
 * request pends).
 *
 * Never throws: association is an offer, not a gate on signup.
 */

import type { AppDb } from '../../db'
import { writeAuthAuditSafe } from '../auth-audit'
import { resolveOrganizationsForEmail } from './domain-association'

export interface CreatedUser {
  id: string
  email: string
}

export async function handleAccountCreated(
  db: AppDb,
  user: CreatedUser,
  runtimeEnv: import('../runtime-env').OrgRuntimeEnv | null,
): Promise<void> {
  try {
    const { domain, organizations } = await resolveOrganizationsForEmail(
      db,
      user.email,
      runtimeEnv,
    )
    if (organizations.length === 0) return
    await writeAuthAuditSafe(db, {
      kind: 'signup_domain_matched',
      actorUserId: user.id,
      actorEmail: user.email,
      metadata: {
        domain,
        organizationIds: organizations.map((o) => o.id),
      },
    })
  } catch {
    // Domain resolution failure must never block account creation.
  }
}
