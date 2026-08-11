/**
 * SSO account-link audit (web-auth-airtable-sso task 2.2, design
 * Decision 2 corroboration hardening).
 *
 * Fired from `databaseHooks.account.create.after` whenever better-auth
 * writes an accounts row. For providerId 'airtable' it writes the audit row
 * for the link/sign-up, noting whether the whoami user id (the better-auth
 * accountId) corroborates a `connections.platformConfig.at_user_id` in one
 * of the user's Organizations. A MISMATCH is recorded in the audit row —
 * it never blocks (Airtable-verified email is the authorization bar; the
 * Connection may legitimately belong to a teammate).
 *
 * New-user vs existing-user is inferred from the users row age: better-auth
 * creates user+account back-to-back on SSO sign-up, so a users row older
 * than the threshold means the identity linked to an EXISTING account.
 * Best-effort — never throws into the sign-in flow.
 */

import { and, eq, inArray } from 'drizzle-orm'
import type { AppDb } from '../../db'
import {
  connections,
  organizationMembers,
  platforms,
  users,
} from '../../db/schema'
import { writeAuthAuditSafe } from '../auth-audit'

const NEW_USER_THRESHOLD_MS = 60 * 1000

export interface LinkedAccount {
  providerId: string
  /** Airtable user id from whoami. */
  accountId: string
  userId: string
}

export async function handleSsoAccountLinked(
  db: AppDb,
  account: LinkedAccount,
  now: Date = new Date(),
): Promise<void> {
  if (account.providerId !== 'airtable') return
  try {
    const [userRow] = await db
      .select({ email: users.email, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, account.userId))
      .limit(1)

    const isNewUser =
      !!userRow &&
      now.getTime() - userRow.createdAt.getTime() < NEW_USER_THRESHOLD_MS

    // Corroboration: at_user_id on the user's orgs' Airtable Connections.
    const memberOrgs = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, account.userId))
    const orgIds = memberOrgs.map((m) => m.organizationId)

    let corroborated = false
    let corroborationMismatch = false
    if (orgIds.length > 0) {
      const rows = await db
        .select({ platformConfig: connections.platformConfig })
        .from(connections)
        .innerJoin(platforms, eq(platforms.id, connections.platformId))
        .where(
          and(
            inArray(connections.organizationId, orgIds),
            eq(platforms.slug, 'airtable'),
          ),
        )
      const atUserIds = rows
        .map(
          (r) =>
            (r.platformConfig as { at_user_id?: string } | null)?.at_user_id,
        )
        .filter((v): v is string => typeof v === 'string')
      corroborated = atUserIds.includes(account.accountId)
      corroborationMismatch = atUserIds.length > 0 && !corroborated
    }

    await writeAuthAuditSafe(db, {
      kind: isNewUser ? 'sso_user_created' : 'sso_account_linked',
      actorUserId: account.userId,
      actorEmail: userRow?.email ?? null,
      targetType: 'account',
      targetId: account.accountId,
      metadata: {
        provider: 'airtable',
        atUserId: account.accountId,
        corroborated,
        corroborationMismatch,
      },
    })
  } catch {
    // Audit is best-effort; sign-in must not fail.
  }
}
