/**
 * Join-request lifecycle (openspec/changes/web-signup-domain-association,
 * design Decision 4).
 *
 * pending → approved | declined | expired (~7 days). One open request per
 * (user, org); a decline applies a ~30-day re-request cool-down. Approval
 * creates membership via the existing team-member machinery (the
 * organization_members insert shape used by onboarding). All transitions
 * write auth_audit_log rows.
 *
 * Pure decision functions (evaluateCreateRequest / evaluateDecision) carry
 * the policy and are unit-tested; the db functions compose them.
 * Expiry is applied lazily on read/create/decide — no cron in apps/web.
 */

import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import type { AppDb } from '../../db'
import {
  organizationJoinRequests,
  organizationMembers,
  organizations,
  users,
} from '../../db/schema'
import { writeAuthAudit } from '../auth-audit'
import { resolveOrganizationsForEmail } from './domain-association'

export const JOIN_REQUEST_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000
export const DECLINE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

export type JoinRequestStatus = 'pending' | 'approved' | 'declined' | 'expired'

export interface JoinRequestSnapshot {
  id: string
  organizationId: string
  requesterUserId: string
  status: string
  expiresAt: Date
  declineCooldownUntil: Date | null
  createdAt: Date
}

// ── Pure policy ─────────────────────────────────────────────────────────────

export type CreateRequestEvaluation =
  | { ok: true; expiresAt: Date }
  | { ok: false; reason: 'pending_exists' }
  | { ok: false; reason: 'cooldown'; until: Date }

export function evaluateCreateRequest(inputs: {
  now: Date
  /** This requester's prior requests for the target org (any status). */
  existing: JoinRequestSnapshot[]
}): CreateRequestEvaluation {
  const { now, existing } = inputs
  const openPending = existing.find(
    (r) => r.status === 'pending' && r.expiresAt.getTime() > now.getTime(),
  )
  if (openPending) return { ok: false, reason: 'pending_exists' }

  const activeCooldown = existing
    .filter(
      (r) =>
        r.status === 'declined' &&
        r.declineCooldownUntil &&
        r.declineCooldownUntil.getTime() > now.getTime(),
    )
    .sort(
      (a, b) =>
        (b.declineCooldownUntil?.getTime() ?? 0) -
        (a.declineCooldownUntil?.getTime() ?? 0),
    )[0]
  if (activeCooldown?.declineCooldownUntil) {
    return { ok: false, reason: 'cooldown', until: activeCooldown.declineCooldownUntil }
  }

  return { ok: true, expiresAt: new Date(now.getTime() + JOIN_REQUEST_EXPIRY_MS) }
}

export type DecisionEvaluation =
  | { ok: true; nextStatus: 'approved' | 'declined'; declineCooldownUntil: Date | null }
  | { ok: false; reason: 'not_admin' | 'not_pending' | 'expired' }

const DECIDER_ROLES = new Set(['owner', 'admin'])

export function evaluateDecision(inputs: {
  request: JoinRequestSnapshot
  /** Actor's membership role in the request's org, or null when not a member. */
  actorRole: string | null
  now: Date
  action: 'approve' | 'decline'
}): DecisionEvaluation {
  const { request, actorRole, now, action } = inputs
  if (!actorRole || !DECIDER_ROLES.has(actorRole)) {
    return { ok: false, reason: 'not_admin' }
  }
  if (request.status !== 'pending') return { ok: false, reason: 'not_pending' }
  if (request.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: 'expired' }
  }
  return {
    ok: true,
    nextStatus: action === 'approve' ? 'approved' : 'declined',
    declineCooldownUntil:
      action === 'decline' ? new Date(now.getTime() + DECLINE_COOLDOWN_MS) : null,
  }
}

// ── DB lifecycle ────────────────────────────────────────────────────────────

/**
 * Lazily transition past-expiry pending rows to 'expired' (+ audit rows).
 * Scoped by org or requester so reads stay cheap.
 */
export async function expireStaleJoinRequests(
  db: AppDb,
  scope: { organizationId?: string; requesterUserId?: string },
  now: Date = new Date(),
): Promise<number> {
  const conditions = [
    eq(organizationJoinRequests.status, 'pending'),
    lt(organizationJoinRequests.expiresAt, now),
  ]
  if (scope.organizationId) {
    conditions.push(eq(organizationJoinRequests.organizationId, scope.organizationId))
  }
  if (scope.requesterUserId) {
    conditions.push(eq(organizationJoinRequests.requesterUserId, scope.requesterUserId))
  }
  const expired = await db
    .update(organizationJoinRequests)
    .set({ status: 'expired', modifiedAt: now })
    .where(and(...conditions))
    .returning({
      id: organizationJoinRequests.id,
      organizationId: organizationJoinRequests.organizationId,
      requesterUserId: organizationJoinRequests.requesterUserId,
    })
  for (const row of expired) {
    await writeAuthAudit(db, {
      kind: 'join_request_expired',
      actorUserId: row.requesterUserId,
      organizationId: row.organizationId,
      targetType: 'join_request',
      targetId: row.id,
    })
  }
  return expired.length
}

export type CreateJoinRequestResult =
  | {
      ok: true
      requestId: string
      expiresAt: Date
      organization: { id: string; name: string; slug: string }
      adminEmails: string[]
    }
  | {
      ok: false
      reason: 'domain_mismatch' | 'already_member' | 'pending_exists' | 'cooldown'
      until?: Date
    }

/**
 * Create a join request from `requester` to `organizationId`, after
 * validating that the org actually resolves from the requester's verified
 * email domain (server-side validation — the client's offer list is UX).
 * Returns the org admins' emails so the route can notify them.
 */
export async function createJoinRequest(
  db: AppDb,
  inputs: {
    requester: { id: string; email: string }
    organizationId: string
  },
  now: Date = new Date(),
): Promise<CreateJoinRequestResult> {
  const { requester, organizationId } = inputs

  const { domain, organizations: matches } = await resolveOrganizationsForEmail(
    db,
    requester.email,
  )
  const target = matches.find((o) => o.id === organizationId)
  if (!target) return { ok: false, reason: 'domain_mismatch' }

  const [membership] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, requester.id),
      ),
    )
    .limit(1)
  if (membership) return { ok: false, reason: 'already_member' }

  await expireStaleJoinRequests(db, { requesterUserId: requester.id }, now)

  const existing = await db
    .select({
      id: organizationJoinRequests.id,
      organizationId: organizationJoinRequests.organizationId,
      requesterUserId: organizationJoinRequests.requesterUserId,
      status: organizationJoinRequests.status,
      expiresAt: organizationJoinRequests.expiresAt,
      declineCooldownUntil: organizationJoinRequests.declineCooldownUntil,
      createdAt: organizationJoinRequests.createdAt,
    })
    .from(organizationJoinRequests)
    .where(
      and(
        eq(organizationJoinRequests.organizationId, organizationId),
        eq(organizationJoinRequests.requesterUserId, requester.id),
      ),
    )
    .orderBy(desc(organizationJoinRequests.createdAt))

  const evaluation = evaluateCreateRequest({ now, existing })
  if (!evaluation.ok) {
    if (evaluation.reason === 'cooldown') {
      return { ok: false, reason: 'cooldown', until: evaluation.until }
    }
    return { ok: false, reason: evaluation.reason }
  }

  const [inserted] = await db
    .insert(organizationJoinRequests)
    .values({
      organizationId,
      requesterUserId: requester.id,
      status: 'pending',
      domain,
      expiresAt: evaluation.expiresAt,
    })
    .returning({ id: organizationJoinRequests.id })

  await writeAuthAudit(db, {
    kind: 'join_request_created',
    actorUserId: requester.id,
    actorEmail: requester.email,
    organizationId,
    targetType: 'join_request',
    targetId: inserted.id,
    metadata: { domain },
  })

  const adminRows = await db
    .select({ email: users.email })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        inArray(organizationMembers.role, ['owner', 'admin']),
      ),
    )

  return {
    ok: true,
    requestId: inserted.id,
    expiresAt: evaluation.expiresAt,
    organization: target,
    adminEmails: adminRows.map((r) => r.email),
  }
}

export type DecideJoinRequestResult =
  | {
      ok: true
      status: 'approved' | 'declined'
      requester: { id: string; email: string }
      organization: { id: string; name: string }
    }
  | {
      ok: false
      reason: 'not_found' | 'not_admin' | 'not_pending' | 'expired'
    }

/**
 * Approve or decline a pending request. The actor must be an owner/admin of
 * the request's org. Approval creates the membership row (role 'member')
 * via the same organization_members shape onboarding uses; idempotent on
 * the (org, user) unique.
 */
export async function decideJoinRequest(
  db: AppDb,
  inputs: {
    requestId: string
    actor: { id: string; email: string }
    action: 'approve' | 'decline'
  },
  now: Date = new Date(),
): Promise<DecideJoinRequestResult> {
  const { requestId, actor, action } = inputs

  const [row] = await db
    .select({
      id: organizationJoinRequests.id,
      organizationId: organizationJoinRequests.organizationId,
      requesterUserId: organizationJoinRequests.requesterUserId,
      status: organizationJoinRequests.status,
      expiresAt: organizationJoinRequests.expiresAt,
      declineCooldownUntil: organizationJoinRequests.declineCooldownUntil,
      createdAt: organizationJoinRequests.createdAt,
      orgName: organizations.name,
    })
    .from(organizationJoinRequests)
    .innerJoin(
      organizations,
      eq(organizations.id, organizationJoinRequests.organizationId),
    )
    .where(eq(organizationJoinRequests.id, requestId))
    .limit(1)
  if (!row) return { ok: false, reason: 'not_found' }

  const [actorMembership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, row.organizationId),
        eq(organizationMembers.userId, actor.id),
      ),
    )
    .limit(1)

  const evaluation = evaluateDecision({
    request: row,
    actorRole: actorMembership?.role ?? null,
    now,
    action,
  })
  if (!evaluation.ok) {
    if (evaluation.reason === 'expired') {
      await expireStaleJoinRequests(db, { organizationId: row.organizationId }, now)
    }
    return { ok: false, reason: evaluation.reason }
  }

  await db
    .update(organizationJoinRequests)
    .set({
      status: evaluation.nextStatus,
      decidedAt: now,
      decidedByUserId: actor.id,
      declineCooldownUntil: evaluation.declineCooldownUntil,
      modifiedAt: now,
    })
    .where(eq(organizationJoinRequests.id, row.id))

  if (evaluation.nextStatus === 'approved') {
    // Existing team-member machinery: the organization_members insert shape
    // used by onboarding (role ladder 'owner' | 'admin' | 'member').
    await db
      .insert(organizationMembers)
      .values({
        organizationId: row.organizationId,
        userId: row.requesterUserId,
        role: 'member',
        invitedByUserId: actor.id,
        invitedAt: row.createdAt,
        acceptedAt: sql`now()`,
      })
      .onConflictDoNothing({
        target: [organizationMembers.organizationId, organizationMembers.userId],
      })
  }

  await writeAuthAudit(db, {
    kind:
      evaluation.nextStatus === 'approved'
        ? 'join_request_approved'
        : 'join_request_declined',
    actorUserId: actor.id,
    actorEmail: actor.email,
    organizationId: row.organizationId,
    targetType: 'join_request',
    targetId: row.id,
    metadata: { requesterUserId: row.requesterUserId },
  })

  const [requesterRow] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, row.requesterUserId))
    .limit(1)

  return {
    ok: true,
    status: evaluation.nextStatus,
    requester: requesterRow ?? { id: row.requesterUserId, email: '' },
    organization: { id: row.organizationId, name: row.orgName },
  }
}
