import type { AppDb } from '../db'
import { spaces, userPreferences } from '../db/schema'
import { and, eq, sql } from 'drizzle-orm'

export interface SpaceSummary {
  id: string
  name: string
  status: string
}

export async function listSpacesForOrg(
  db: AppDb,
  organizationId: string,
): Promise<SpaceSummary[]> {
  return await db
    .select({
      id: spaces.id,
      name: spaces.name,
      status: spaces.status,
    })
    .from(spaces)
    .where(eq(spaces.organizationId, organizationId))
    .orderBy(spaces.createdAt)
}

export type SpaceErrorDetail =
  | { kind: 'invalid'; field: 'name'; message: string }
  | { kind: 'forbidden'; message: string }

export class SpaceError extends Error {
  constructor(public detail: SpaceErrorDetail) {
    super(detail.kind === 'invalid' ? detail.message : detail.message)
  }
}

const SPACE_NAME_MAX = 100

export function validateSpaceName(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) {
    throw new SpaceError({
      kind: 'invalid',
      field: 'name',
      message: 'Space name is required.',
    })
  }
  if (value.length > SPACE_NAME_MAX) {
    throw new SpaceError({
      kind: 'invalid',
      field: 'name',
      message: `Space name must be ${SPACE_NAME_MAX} characters or fewer.`,
    })
  }
  return value
}

export interface CreateSpaceInput {
  userId: string
  organizationId: string
  name: string
}

export interface CreatedSpace {
  id: string
  name: string
}

export async function createSpaceForOrg(
  db: AppDb,
  input: CreateSpaceInput,
): Promise<CreatedSpace> {
  const name = validateSpaceName(input.name)

  return await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(spaces)
      .values({
        organizationId: input.organizationId,
        name,
        status: 'setup_incomplete',
        onboardingStep: 1,
      })
      .returning({ id: spaces.id, name: spaces.name })

    await tx
      .insert(userPreferences)
      .values({
        userId: input.userId,
        activeOrganizationId: input.organizationId,
        activeSpaceId: created.id,
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          activeOrganizationId: input.organizationId,
          activeSpaceId: created.id,
          modifiedAt: sql`now()`,
        },
      })

    return { id: created.id, name: created.name }
  })
}

export interface SwitchSpaceInput {
  userId: string
  organizationId: string
  spaceId: string
}

export async function switchActiveSpace(
  db: AppDb,
  input: SwitchSpaceInput,
): Promise<void> {
  const [row] = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(
      and(
        eq(spaces.id, input.spaceId),
        eq(spaces.organizationId, input.organizationId),
      ),
    )
    .limit(1)

  if (!row) {
    throw new SpaceError({
      kind: 'forbidden',
      message: 'That Space is not available.',
    })
  }

  await db
    .insert(userPreferences)
    .values({
      userId: input.userId,
      activeOrganizationId: input.organizationId,
      activeSpaceId: input.spaceId,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        activeOrganizationId: input.organizationId,
        activeSpaceId: input.spaceId,
        modifiedAt: sql`now()`,
      },
    })
}
