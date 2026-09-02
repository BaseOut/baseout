// @lat: [[architecture#Architecture#Account Context]]
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
import { eq, and, desc } from 'drizzle-orm'
import { listSpacesForOrg } from './spaces'
import { isInternalEmail } from './capabilities/internal-access'
import type { OrgRuntimeEnv } from './runtime-env'

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

export function shouldPromoteToStaff(input: {
  role?: string | null
  email?: string | null
}): boolean {
  return input.role !== 'super' && isInternalEmail(input.email)
}

async function promoteToStaffIfInternal(
  db: AppDb,
  user: { id: string; role?: string | null; email?: string | null },
): Promise<void> {
  if (!shouldPromoteToStaff(user)) return
  await db.update(users).set({ role: 'super' }).where(eq(users.id, user.id))
}

export async function getAccountContext(
  db: AppDb,
  userId: string,
  runtimeEnv: OrgRuntimeEnv | null,
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
        role: users.role,
      },
      org: {
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
      },
      orgRuntimeEnv: organizations.runtimeEnv,
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
  try {
    await promoteToStaffIfInternal(db, user)
  } catch {
    // Staff access also resolves at the admin handoff gate. Promotion makes
    // role-only surfaces catch up, but a transient write failure must not block
    // normal account loading.
  }
  const prefsOrgMatchesEnv =
    !!row.org?.id &&
    runtimeEnv !== null &&
    row.orgRuntimeEnv === runtimeEnv

  let organization: AccountContext['organization'] = prefsOrgMatchesEnv
    ? row.org
    : null
  let membership: AccountContext['membership'] =
    prefsOrgMatchesEnv && row.membership?.role ? row.membership : null
  let space: AccountContext['space'] =
    prefsOrgMatchesEnv && row.space?.id ? row.space : null

  // Fallback: no in-env active org — first same-env membership (prefer is_default).
  if (!organization && runtimeEnv !== null) {
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
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizations.runtimeEnv, runtimeEnv),
        ),
      )
      .orderBy(desc(organizationMembers.isDefault))
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
