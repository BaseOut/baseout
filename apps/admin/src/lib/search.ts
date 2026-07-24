// Support omnisearch (admin-support-search). One staff-held identifier → the
// right entity page. Detection is a pure, precedence-ordered shape test
// (detectQuery); the DB execution (runSearch, below) is thin Drizzle that runs
// ONLY the shape-relevant lookups. All branching — shape, redirect decision,
// group truncation, disambiguation context — lives in the pure functions here so
// it is unit-tested without a DB (house style). Master DB only; no *_enc column
// is ever selected (the admin mirror omits them); no per-Space DB is touched.

import { and, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import { users } from '@baseout/db-schema'
import type { AppDb } from '../db'
import {
  atBases,
  backupRuns,
  connections,
  organizationMembers,
  organizations,
  restoreRuns,
  spaces,
  subscriptionItems,
  subscriptions,
} from '../db/schema'
import { entityHref, type EntityType } from './entity-link'

// ── Shape detection ────────────────────────────────────────────────────────

export type QueryKind =
  | 'empty'
  | 'uuid'
  | 'stripe-customer'
  | 'stripe-subscription'
  | 'at-base'
  | 'email'
  | 'text'

export type LookupTarget =
  | 'backup_runs'
  | 'restore_runs'
  | 'connections'
  | 'spaces'
  | 'organizations'
  | 'subscriptions'
  | 'at_bases'
  | 'users'

export interface QueryPlan {
  kind: QueryKind
  normalized: string
  /** True when the shape yields a redirect-eligible exact identifier (D2). */
  exact: boolean
  lookups: LookupTarget[]
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CUS_RE = /^cus_[A-Za-z0-9]+$/
const SUB_RE = /^sub_[A-Za-z0-9]+$/
const APP_RE = /^app[A-Za-z0-9]{10,}$/ // Airtable base IDs are `app` + a long alphanumeric tail

/** Precedence-ordered shape test (design D1). First match wins. */
export function detectQuery(q: string): QueryPlan {
  const normalized = (q ?? '').trim()
  const base = { normalized }
  if (normalized.length < 2) return { ...base, kind: 'empty', exact: false, lookups: [] }
  if (UUID_RE.test(normalized))
    return { ...base, kind: 'uuid', exact: true, lookups: ['backup_runs', 'restore_runs', 'connections', 'spaces', 'organizations'] }
  if (CUS_RE.test(normalized)) return { ...base, kind: 'stripe-customer', exact: true, lookups: ['organizations'] }
  if (SUB_RE.test(normalized)) return { ...base, kind: 'stripe-subscription', exact: true, lookups: ['subscriptions'] }
  if (APP_RE.test(normalized)) return { ...base, kind: 'at-base', exact: true, lookups: ['at_bases'] }
  if (normalized.includes('@')) return { ...base, kind: 'email', exact: true, lookups: ['users'] }
  return { ...base, kind: 'text', exact: false, lookups: ['organizations', 'spaces', 'users'] }
}

/** Escape LIKE/ILIKE metacharacters so user input is matched literally. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}

// ── Link targets + redirect ──────────────────────────────────────────────────

// admin-entity-linking (sibling change) has landed, so every entity resolves to
// a real detail/anchor route through entityHref — the D3 fallback matrix
// (space/user → owning org) is moot. A base has no page of its own: it links to
// its owning Space; a base with no known Space is unlinked.
export type ResultEntityType = EntityType | 'base'

export interface MatchRef {
  type: ResultEntityType
  id: string
  /** For a base — its owning Space, whose page is the link target. */
  spaceId?: string | null
}

export function linkFor(ref: MatchRef): string | null {
  if (ref.type === 'base') return ref.spaceId ? entityHref('space', ref.spaceId) : null
  return entityHref(ref.type, ref.id)
}

/**
 * Redirect straight to the entity only when the shape is an exact identifier AND
 * exactly one entity matched (D2). Free-text and multi-match fall through to the
 * grouped list.
 */
export function decideRedirect(plan: QueryPlan, exactMatches: MatchRef[]): string | null {
  if (!plan.exact) return null
  if (exactMatches.length !== 1) return null
  return linkFor(exactMatches[0])
}

// ── Result groups + truncation ───────────────────────────────────────────────

export const GROUP_LIMIT = 10

export interface ResultRow {
  id: string
  label: string
  context: string | null
  href: string | null
}
export interface ResultGroup {
  key: string
  label: string
  rows: ResultRow[]
  truncated: boolean
}

/**
 * Slice a group to GROUP_LIMIT and flag truncation. Callers fetch GROUP_LIMIT+1
 * rows so a full+1 result set surfaces the "narrow your query" signal. Empty
 * groups are dropped (return null).
 */
export function finalizeGroup(key: string, label: string, rows: ResultRow[]): ResultGroup | null {
  if (rows.length === 0) return null
  return { key, label, rows: rows.slice(0, GROUP_LIMIT), truncated: rows.length > GROUP_LIMIT }
}

// ── Disambiguation context (D6 — assembled from one bounded query per group) ──

/** tier(s) + subscription status per org, e.g. `growth/pro · active`. */
export function orgContext(
  rows: Array<{ organizationId: string; tier: string; subscriptionStatus: string }>,
): Map<string, string> {
  const byOrg = new Map<string, { tiers: Set<string>; status: string }>()
  for (const r of rows) {
    const cur = byOrg.get(r.organizationId) ?? { tiers: new Set<string>(), status: r.subscriptionStatus }
    cur.tiers.add(r.tier)
    byOrg.set(r.organizationId, cur)
  }
  const out = new Map<string, string>()
  for (const [orgId, { tiers, status }] of byOrg) {
    out.set(orgId, `${[...tiers].sort().join('/')} · ${status}`)
  }
  return out
}

/** Each user's org memberships joined into one line, e.g. `Acme, Globex`. */
export function membershipContext(rows: Array<{ userId: string; organizationName: string }>): Map<string, string> {
  const byUser = new Map<string, string[]>()
  for (const r of rows) {
    const list = byUser.get(r.userId) ?? []
    list.push(r.organizationName)
    byUser.set(r.userId, list)
  }
  return new Map([...byUser].map(([id, names]) => [id, names.join(', ')]))
}

// ── Execution (thin Drizzle; branching delegated to the pure fns above) ───────

export interface SearchResult {
  redirect: string | null
  groups: ResultGroup[]
}

const LIM = GROUP_LIMIT + 1 // fetch +1 to detect truncation

/** `%q%` ILIKE pattern with metacharacters escaped. */
function contains(q: string): string {
  return `%${escapeLike(q)}%`
}

export async function runSearch(db: AppDb, plan: QueryPlan): Promise<SearchResult> {
  switch (plan.kind) {
    case 'empty':
      return { redirect: null, groups: [] }
    case 'uuid':
      return uuidSearch(db, plan.normalized)
    case 'stripe-customer':
      return exactOrg(db, plan, eq(organizations.stripeCustomerId, plan.normalized))
    case 'stripe-subscription':
      return stripeSubscriptionSearch(db, plan)
    case 'at-base':
      return atBaseSearch(db, plan)
    case 'email':
      return emailSearch(db, plan)
    case 'text':
      return textSearch(db, plan.normalized)
  }
}

// UUID: probe the 5 PK tables concurrently. Usually one hits → redirect; a
// cross-table collision falls through to a grouped list with owning context.
async function uuidSearch(db: AppDb, id: string): Promise<SearchResult> {
  const [b, r, c, s, o] = await Promise.all([
    db.select({ id: backupRuns.id, orgName: organizations.name, spaceName: spaces.name })
      .from(backupRuns).leftJoin(spaces, eq(backupRuns.spaceId, spaces.id)).leftJoin(organizations, eq(spaces.organizationId, organizations.id))
      .where(and(eq(backupRuns.id, id), isNull(backupRuns.deletedAt))).limit(1),
    db.select({ id: restoreRuns.id, orgName: organizations.name, spaceName: spaces.name })
      .from(restoreRuns).leftJoin(spaces, eq(restoreRuns.spaceId, spaces.id)).leftJoin(organizations, eq(spaces.organizationId, organizations.id))
      .where(eq(restoreRuns.id, id)).limit(1),
    db.select({ id: connections.id, displayName: connections.displayName, orgName: organizations.name })
      .from(connections).leftJoin(organizations, eq(connections.organizationId, organizations.id)).where(eq(connections.id, id)).limit(1),
    db.select({ id: spaces.id, name: spaces.name, orgName: organizations.name })
      .from(spaces).leftJoin(organizations, eq(spaces.organizationId, organizations.id)).where(eq(spaces.id, id)).limit(1),
    db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug }).from(organizations).where(eq(organizations.id, id)).limit(1),
  ])

  const matches: MatchRef[] = [
    ...b.map((x: any) => ({ type: 'backup_run' as const, id: x.id })),
    ...r.map((x: any) => ({ type: 'restore_run' as const, id: x.id })),
    ...c.map((x: any) => ({ type: 'connection' as const, id: x.id })),
    ...s.map((x: any) => ({ type: 'space' as const, id: x.id })),
    ...o.map((x: any) => ({ type: 'org' as const, id: x.id })),
  ]
  const redirect = decideRedirect({ kind: 'uuid', normalized: id, exact: true, lookups: [] }, matches)
  if (redirect) return { redirect, groups: [] }

  const groups = [
    finalizeGroup('backup_runs', 'Backup runs', b.map((x: any) => row(x.id, x.spaceName ?? x.id, x.orgName, entityHref('backup_run', x.id)))),
    finalizeGroup('restore_runs', 'Restore runs', r.map((x: any) => row(x.id, x.spaceName ?? x.id, x.orgName, entityHref('restore_run', x.id)))),
    finalizeGroup('connections', 'Connections', c.map((x: any) => row(x.id, x.displayName ?? x.id, x.orgName, entityHref('connection', x.id)))),
    finalizeGroup('spaces', 'Spaces', s.map((x: any) => row(x.id, x.name, x.orgName, entityHref('space', x.id)))),
    finalizeGroup('organizations', 'Organizations', o.map((x: any) => row(x.id, x.name, x.slug, entityHref('org', x.id)))),
  ].filter(Boolean) as ResultGroup[]
  return { redirect: null, groups }
}

async function exactOrg(db: AppDb, plan: QueryPlan, where: SQL): Promise<SearchResult> {
  const rows = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
    .from(organizations)
    .where(where)
    .limit(LIM)
  const matches: MatchRef[] = rows.map((x: any) => ({ type: 'org' as const, id: x.id }))
  const redirect = decideRedirect(plan, matches)
  if (redirect) return { redirect, groups: [] }
  const ctx = await orgContextFor(db, rows.map((x: any) => x.id))
  const group = finalizeGroup('organizations', 'Organizations', rows.map((x: any) => row(x.id, x.name, ctx.get(x.id) ?? x.slug, entityHref('org', x.id))))
  return { redirect: null, groups: group ? [group] : [] }
}

// A subscription ID resolves to the owning Organization.
async function stripeSubscriptionSearch(db: AppDb, plan: QueryPlan): Promise<SearchResult> {
  const rows = await db
    .select({ orgId: subscriptions.organizationId, orgName: organizations.name, slug: organizations.slug })
    .from(subscriptions)
    .leftJoin(organizations, eq(subscriptions.organizationId, organizations.id))
    .where(eq(subscriptions.stripeSubscriptionId, plan.normalized))
    .limit(LIM)
  const matches: MatchRef[] = rows.map((x: any) => ({ type: 'org' as const, id: x.orgId }))
  const redirect = decideRedirect(plan, matches)
  if (redirect) return { redirect, groups: [] }
  const group = finalizeGroup('organizations', 'Organizations', rows.map((x: any) => row(x.orgId, x.orgName ?? x.orgId, x.slug, entityHref('org', x.orgId))))
  return { redirect: null, groups: group ? [group] : [] }
}

// A base ID resolves to its owning Space (a base has no page of its own).
async function atBaseSearch(db: AppDb, plan: QueryPlan): Promise<SearchResult> {
  const rows = await db
    .select({ id: atBases.id, name: atBases.name, spaceId: atBases.spaceId, spaceName: spaces.name, orgName: organizations.name })
    .from(atBases)
    .leftJoin(spaces, eq(atBases.spaceId, spaces.id))
    .leftJoin(organizations, eq(spaces.organizationId, organizations.id))
    .where(eq(atBases.atBaseId, plan.normalized))
    .limit(LIM)
  const matches: MatchRef[] = rows.map((x: any) => ({ type: 'base' as const, id: x.id, spaceId: x.spaceId }))
  const redirect = decideRedirect(plan, matches)
  if (redirect) return { redirect, groups: [] }
  const group = finalizeGroup(
    'bases',
    'Bases',
    rows.map((x: any) => row(x.id, x.name, [x.spaceName, x.orgName].filter(Boolean).join(' · ') || null, linkFor({ type: 'base', id: x.id, spaceId: x.spaceId }))),
  )
  return { redirect: null, groups: group ? [group] : [] }
}

// Email: exact match (redirect-eligible) then prefix match for the list.
async function emailSearch(db: AppDb, plan: QueryPlan): Promise<SearchResult> {
  const lower = plan.normalized.toLowerCase()
  const [exact, prefix] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email })
      .from(users).where(sql`lower(${users.email}) = ${lower}`).limit(2),
    db.select({ id: users.id, name: users.name, email: users.email })
      .from(users).where(sql`lower(${users.email}) like ${escapeLike(lower) + '%'}`).limit(LIM),
  ])
  const redirect = decideRedirect(plan, exact.map((x: any) => ({ type: 'user' as const, id: x.id })))
  if (redirect) return { redirect, groups: [] }
  const ctx = await membershipContextFor(db, prefix.map((x: any) => x.id))
  const group = finalizeGroup('users', 'Users', prefix.map((x: any) => row(x.id, x.name ?? x.email, ctx.get(x.id) ?? x.email, entityHref('user', x.id))))
  return { redirect: null, groups: group ? [group] : [] }
}

// Free-text: ILIKE substring across org name/slug, space name, user name.
async function textSearch(db: AppDb, q: string): Promise<SearchResult> {
  const pat = contains(q)
  const [orgs, sp, us] = await Promise.all([
    db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
      .from(organizations).where(or(ilike(organizations.name, pat), ilike(organizations.slug, pat))).limit(LIM),
    db.select({ id: spaces.id, name: spaces.name, orgName: organizations.name })
      .from(spaces).leftJoin(organizations, eq(spaces.organizationId, organizations.id)).where(ilike(spaces.name, pat)).limit(LIM),
    db.select({ id: users.id, name: users.name, email: users.email })
      .from(users).where(ilike(users.name, pat)).limit(LIM),
  ])
  const [orgCtx, memberCtx] = await Promise.all([
    orgContextFor(db, orgs.map((x: any) => x.id)),
    membershipContextFor(db, us.map((x: any) => x.id)),
  ])
  const groups = [
    finalizeGroup('organizations', 'Organizations', orgs.map((x: any) => row(x.id, x.name, orgCtx.get(x.id) ?? x.slug, entityHref('org', x.id)))),
    finalizeGroup('spaces', 'Spaces', sp.map((x: any) => row(x.id, x.name, x.orgName, entityHref('space', x.id)))),
    finalizeGroup('users', 'Users', us.map((x: any) => row(x.id, x.name ?? x.email, memberCtx.get(x.id) ?? x.email, entityHref('user', x.id)))),
  ].filter(Boolean) as ResultGroup[]
  return { redirect: null, groups }
}

// Context fetches — one bounded query keyed by the group's matched IDs (D6).
async function orgContextFor(db: AppDb, orgIds: string[]): Promise<Map<string, string>> {
  if (!orgIds.length) return new Map()
  const rows = await db
    .select({ organizationId: subscriptions.organizationId, tier: subscriptionItems.tier, subscriptionStatus: subscriptions.status })
    .from(subscriptionItems)
    .innerJoin(subscriptions, eq(subscriptionItems.subscriptionId, subscriptions.id))
    .where(inArray(subscriptions.organizationId, orgIds))
  return orgContext(rows)
}

async function membershipContextFor(db: AppDb, userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map()
  const rows = await db
    .select({ userId: organizationMembers.userId, organizationName: organizations.name })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(inArray(organizationMembers.userId, userIds))
  return membershipContext(rows)
}

function row(id: string, label: string, context: string | null, href: string | null): ResultRow {
  return { id, label, context, href }
}
