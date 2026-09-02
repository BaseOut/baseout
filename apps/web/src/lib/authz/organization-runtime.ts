import { and, eq } from 'drizzle-orm'
import type { AppDb } from '../../db'
import { organizationMembers, organizations } from '../../db/schema'
import {
  organizationIsWritableForEnv,
  type OrgRuntimeEnv,
} from '../runtime-env'

export class OrganizationRuntimeError extends Error {
  constructor(public readonly code: 'forbidden' | 'env_mismatch') {
    super(code)
  }
}

/**
 * Shared write-path guard (design D10): membership AND Organization
 * `runtime_env` = this Worker. Call before any mutation that accepts an
 * Organization id from the client or a handoff cookie.
 */
export async function requireWritableOrganization(
  db: AppDb,
  input: {
    organizationId: string
    userId: string
    runtimeEnv: OrgRuntimeEnv | null
  },
): Promise<void> {
  const [row] = await db
    .select({
      memberId: organizationMembers.id,
      orgRuntimeEnv: organizations.runtimeEnv,
    })
    .from(organizations)
    .leftJoin(
      organizationMembers,
      and(
        eq(organizationMembers.organizationId, organizations.id),
        eq(organizationMembers.userId, input.userId),
      ),
    )
    .where(eq(organizations.id, input.organizationId))
    .limit(1)

  const allowed = organizationIsWritableForEnv({
    isMember: !!row?.memberId,
    orgRuntimeEnv: row?.orgRuntimeEnv,
    workerEnv: input.runtimeEnv,
  })
  if (!allowed) {
    throw new OrganizationRuntimeError(
      row?.memberId ? 'env_mismatch' : 'forbidden',
    )
  }
}
