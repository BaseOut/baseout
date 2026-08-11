/**
 * Known-domain resolution for signup association
 * (openspec/changes/web-signup-domain-association, design Decision 3).
 *
 * An Organization's known domains derive from its members' verified email
 * domains (public providers excluded), unioned with explicit
 * `organization_domains` mode='add' entries and minus mode='suppress'
 * entries. Derivation is a query, not a synced column — correctness over
 * cache until scale demands otherwise.
 *
 * Pure set algebra lives in `applyDomainOverrides` (unit-tested); the db
 * wrapper `resolveOrganizationsForEmail` composes the queries.
 */

import { and, eq, sql } from 'drizzle-orm'
import type { AppDb } from '../../db'
import {
  organizationDomains,
  organizationMembers,
  organizations,
  users,
} from '../../db/schema'
import { PUBLIC_EMAIL_DOMAINS } from './public-email-domains'

export interface MatchedOrganization {
  id: string
  name: string
  slug: string
}

/** Multiple matching orgs on one domain: list all, capped (design open Q1). */
export const MAX_DOMAIN_MATCHES = 3

const PUBLIC_DOMAIN_SET: ReadonlySet<string> = new Set(PUBLIC_EMAIL_DOMAINS)

/** Lowercased domain of an email address, or null when malformed. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1) return null
  const domain = email.slice(at + 1).trim().toLowerCase()
  if (!domain || !domain.includes('.')) return null
  return domain
}

export function isPublicEmailDomain(
  domain: string,
  denylist: ReadonlySet<string> = PUBLIC_DOMAIN_SET,
): boolean {
  return denylist.has(domain.toLowerCase())
}

export interface DomainOverrideInputs {
  /** Orgs with a verified member on the domain (derivation query). */
  derived: MatchedOrganization[]
  /** Orgs with an organization_domains mode='add' row for the domain. */
  added: MatchedOrganization[]
  /** Org ids with an organization_domains mode='suppress' row for the domain. */
  suppressed: string[]
  cap?: number
}

/** derived ∪ added − suppressed, deduped, capped at MAX_DOMAIN_MATCHES. */
export function applyDomainOverrides(
  inputs: DomainOverrideInputs,
): MatchedOrganization[] {
  const suppressed = new Set(inputs.suppressed)
  const seen = new Set<string>()
  const out: MatchedOrganization[] = []
  const cap = inputs.cap ?? MAX_DOMAIN_MATCHES
  for (const org of [...inputs.derived, ...inputs.added]) {
    if (suppressed.has(org.id) || seen.has(org.id)) continue
    seen.add(org.id)
    out.push(org)
    if (out.length >= cap) break
  }
  return out
}

export interface DomainAssociationResult {
  domain: string | null
  organizations: MatchedOrganization[]
}

/**
 * Resolve the Organizations a new user's verified email domain associates
 * with. Public or malformed domains resolve to nothing — the standard
 * own-account path applies.
 */
export async function resolveOrganizationsForEmail(
  db: AppDb,
  email: string,
): Promise<DomainAssociationResult> {
  const domain = emailDomain(email)
  if (!domain || isPublicEmailDomain(domain)) {
    return { domain, organizations: [] }
  }

  const [derived, overrides] = await Promise.all([
    db
      .selectDistinct({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .innerJoin(
        organizations,
        eq(organizations.id, organizationMembers.organizationId),
      )
      .where(
        and(
          eq(users.emailVerified, true),
          sql`lower(split_part(${users.email}, '@', 2)) = ${domain}`,
        ),
      ),
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        mode: organizationDomains.mode,
      })
      .from(organizationDomains)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationDomains.organizationId),
      )
      .where(eq(organizationDomains.domain, domain)),
  ])

  return {
    domain,
    organizations: applyDomainOverrides({
      derived,
      added: overrides
        .filter((o) => o.mode === 'add')
        .map(({ id, name, slug }) => ({ id, name, slug })),
      suppressed: overrides
        .filter((o) => o.mode === 'suppress')
        .map((o) => o.id),
    }),
  }
}
