/**
 * Account context loader — resolves the full "viewer" for a given user.
 *
 * Reads user preferences to determine active org + space, with a fallback
 * to the user's first org membership if no preferences are set.
 */

import type { AppDb } from '../db'
import {
  users,
  organizations,
  organizationMembers,
  spaces,
  userPreferences,
} from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { listSpacesForOrg } from './spaces'

export interface AccountContext {
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
  organization: {
    id: string
    name: string
    slug: string
  } | null
  membership: {
    role: string
    isDefault: boolean
  } | null
  space: {
    id: string
    name: string
    status: string
  } | null
  // Every Space in the active organization. Empty when the viewer has no org
  // yet (pre-onboarding). Powers the sidebar Space selector dropdown.
  spaces: Array<{ id: string; name: string; status: string }>
}

export async function getAccountContext(
  db: AppDb,
  userId: string,
): Promise<AccountContext | null> {
  // Happy path: one round-trip. Joins user → prefs → active org → membership → active space.
  // Null right-side rows are fine — when prefs row is missing or its fk columns are null,
  // the dependent leftJoins return null and we fall through to the fallback query below.
  const [row] = await db
    .select({
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
      org: {
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
      },
      membership: {
        role: organizationMembers.role,
        isDefault: organizationMembers.isDefault,
      },
      space: {
        id: spaces.id,
        name: spaces.name,
        status: spaces.status,
      },
    })
    .from(users)
    .leftJoin(userPreferences, eq(userPreferences.userId, users.id))
    .leftJoin(
      organizations,
      eq(organizations.id, userPreferences.activeOrganizationId),
    )
    .leftJoin(
      organizationMembers,
      and(
        eq(organizationMembers.organizationId, organizations.id),
        eq(organizationMembers.userId, users.id),
      ),
    )
    .leftJoin(spaces, eq(spaces.id, userPreferences.activeSpaceId))
    .where(eq(users.id, userId))
    .limit(1)

  if (!row) return null

  const user = row.user
  let organization: AccountContext['organization'] = row.org?.id ? row.org : null
  let membership: AccountContext['membership'] = row.membership?.role
    ? row.membership
    : null
  let space: AccountContext['space'] = row.space?.id ? row.space : null

  // Fallback: no active-org preference set — resolve default membership + first space
  // in a single second query.
  if (!organization) {
    const [fallback] = await db
      .select({
        org: {
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
        },
        membership: {
          role: organizationMembers.role,
          isDefault: organizationMembers.isDefault,
        },
        space: {
          id: spaces.id,
          name: spaces.name,
          status: spaces.status,
        },
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationMembers.organizationId),
      )
      .leftJoin(spaces, eq(spaces.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, userId))
      .limit(1)

    if (fallback) {
      organization = fallback.org
      membership = fallback.membership
      if (!space) space = fallback.space?.id ? fallback.space : null
    }
  }

  const allSpaces = organization ? await listSpacesForOrg(db, organization.id) : []

  return { user, organization, membership, space, spaces: allSpaces }
}
