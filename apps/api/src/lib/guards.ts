// Shared per-request authorization guards. Every handler runs one of these first:
// they apply the pure grant decision (authorizeGrant) AND confirm the entity
// exists within the tenant — both paths return the SAME tenant-safe 404 code so
// existence of other tenants' ids is never confirmed.

import { and, eq } from "drizzle-orm";
import { organizations, spaces } from "../db/schema";
import { authorizeGrant, type Scope } from "./auth";
import { notFound } from "./errors";
import type { OperationContext } from "./registry";

export async function requireOrg(c: OperationContext, scope: Scope): Promise<string> {
  const orgId = c.params.orgId!;
  const authz = authorizeGrant({ grant: c.grant, pathOrgId: orgId, requiredScope: scope });
  if (!authz.ok) throw authz.error;
  const [org] = await c.db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) throw notFound("org_not_found", "Organization not found.");
  return orgId;
}

export async function requireSpace(c: OperationContext, scope: Scope): Promise<{ orgId: string; spaceId: string }> {
  const orgId = c.params.orgId!;
  const spaceId = c.params.spaceId!;
  const authz = authorizeGrant({ grant: c.grant, pathOrgId: orgId, pathSpaceId: spaceId, requiredScope: scope });
  if (!authz.ok) throw authz.error;
  const [space] = await c.db
    .select({ id: spaces.id })
    .from(spaces)
    .where(and(eq(spaces.id, spaceId), eq(spaces.organizationId, orgId)))
    .limit(1);
  if (!space) throw notFound("space_not_found", "Space not found.");
  return { orgId, spaceId };
}
