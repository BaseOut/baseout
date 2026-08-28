// Org / Space / platform read endpoints — served from the master DB in-Worker
// (design D3). Scope: org:read.

import { and, asc, count, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";
import { atBases, connections, organizations, platforms, spacePlatforms, spaces } from "../db/schema";
import { paginate, parseCursor, parseLimit } from "../lib/pagination";
import { requireOrg, requireSpace } from "../lib/guards";
import { resolveApiPlan } from "../lib/entitlements";
import { json } from "../lib/responses";
import type { Operation, OperationContext } from "../lib/registry";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** platform codes + base counts for a page of space ids (batched, not N+1). */
async function decorateSpaces(c: OperationContext, spaceIds: string[]) {
  if (!spaceIds.length) return { codesBySpace: new Map<string, string[]>(), countBySpace: new Map<string, number>() };
  const platRows = await c.db
    .select({ spaceId: spacePlatforms.spaceId, code: platforms.code })
    .from(spacePlatforms)
    .innerJoin(platforms, eq(spacePlatforms.platformId, platforms.id))
    .where(inArray(spacePlatforms.spaceId, spaceIds));
  const codesBySpace = new Map<string, string[]>();
  for (const r of platRows) {
    if (!r.spaceId) continue;
    const arr = codesBySpace.get(r.spaceId) ?? [];
    arr.push(r.code);
    codesBySpace.set(r.spaceId, arr);
  }
  const countRows = await c.db
    .select({ spaceId: atBases.spaceId, n: count() })
    .from(atBases)
    .where(inArray(atBases.spaceId, spaceIds))
    .groupBy(atBases.spaceId);
  const countBySpace = new Map<string, number>();
  for (const r of countRows) if (r.spaceId) countBySpace.set(r.spaceId, Number(r.n));
  return { codesBySpace, countBySpace };
}

export const orgOperations: Operation[] = [
  {
    method: "GET",
    path: "/v1/orgs/{orgId}",
    scope: "org:read",
    summary: "Get an Organization's profile.",
    responseSchema: z.object({ id: z.string(), name: z.string(), createdAt: z.string().nullable(), plan: z.string().nullable() }),
    handler: async (c) => {
      const orgId = await requireOrg(c, "org:read");
      const [org] = await c.db
        .select({ id: organizations.id, name: organizations.name, createdAt: organizations.createdAt })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);
      // plan = the org's resolved entitlement plan slug (api-productionization
      // D2); null when there is no active/trialing subscription.
      const plan = await resolveApiPlan(c.db, orgId, c.now);
      return json({ id: org!.id, name: org!.name, createdAt: iso(org!.createdAt), plan: plan?.planSlug ?? null }, c.requestId);
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces",
    scope: "org:read",
    summary: "List the Organization's Spaces.",
    querySchema: z.object({ limit: z.number().int().min(1).max(100).optional(), cursor: z.string().optional() }),
    handler: async (c) => {
      const orgId = await requireOrg(c, "org:read");
      const limit = parseLimit(c.query.get("limit"));
      const cursor = parseCursor(c.query.get("cursor"));
      const afterId = cursor && typeof cursor[0] === "string" ? cursor[0] : null;
      // A Space-bound token only ever sees its own Space.
      const where = [eq(spaces.organizationId, orgId)];
      if (c.grant.spaceId) where.push(eq(spaces.id, c.grant.spaceId));
      if (afterId) where.push(gt(spaces.id, afterId));
      const rows = await c.db
        .select({ id: spaces.id, name: spaces.name, status: spaces.status })
        .from(spaces)
        .where(and(...where))
        .orderBy(asc(spaces.id))
        .limit(limit + 1);
      const page = paginate(rows, limit, (r) => [r.id]);
      const { codesBySpace, countBySpace } = await decorateSpaces(c, page.data.map((s) => s.id));
      return json(
        {
          data: page.data.map((s) => ({
            id: s.id,
            name: s.name,
            status: s.status,
            platformCodes: codesBySpace.get(s.id) ?? [],
            baseCount: countBySpace.get(s.id) ?? 0,
          })),
          pagination: page.pagination,
        },
        c.requestId,
      );
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}",
    scope: "org:read",
    summary: "Get a Space's detail.",
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "org:read");
      const [s] = await c.db
        .select({
          id: spaces.id, name: spaces.name, status: spaces.status, spaceType: spaces.spaceType,
          onboardingStep: spaces.onboardingStep, onboardingCompletedAt: spaces.onboardingCompletedAt,
          createdAt: spaces.createdAt,
        })
        .from(spaces)
        .where(eq(spaces.id, spaceId))
        .limit(1);
      const { codesBySpace } = await decorateSpaces(c, [spaceId]);
      return json(
        {
          id: s!.id,
          name: s!.name,
          status: s!.status,
          spaceType: s!.spaceType,
          onboarding: { step: s!.onboardingStep, completedAt: iso(s!.onboardingCompletedAt) },
          connectedPlatforms: codesBySpace.get(spaceId) ?? [],
          createdAt: iso(s!.createdAt),
        },
        c.requestId,
      );
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/platforms",
    scope: "org:read",
    summary: "List a Space's connected Platforms with connection status.",
    handler: async (c) => {
      const { orgId, spaceId } = await requireSpace(c, "org:read");
      const platRows = await c.db
        .select({ platformId: platforms.id, code: platforms.code, name: platforms.name })
        .from(spacePlatforms)
        .innerJoin(platforms, eq(spacePlatforms.platformId, platforms.id))
        .where(eq(spacePlatforms.spaceId, spaceId));
      // org-level connection status per platform (space-scoped connection wins if present).
      const connRows = await c.db
        .select({ platformId: connections.platformId, status: connections.status, scope: connections.scope, spaceId: connections.spaceId, displayName: connections.displayName })
        .from(connections)
        .where(eq(connections.organizationId, orgId));
      const statusFor = (platformId: string) => {
        const forPlatform = connRows.filter((r) => r.platformId === platformId);
        const spaceScoped = forPlatform.find((r) => r.spaceId === spaceId);
        const chosen = spaceScoped ?? forPlatform[0];
        return chosen ? { status: chosen.status, displayName: chosen.displayName ?? null } : { status: "disconnected", displayName: null };
      };
      return json(
        {
          data: platRows.map((p) => ({ code: p.code, name: p.name, connection: statusFor(p.platformId) })),
          pagination: { nextCursor: null },
        },
        c.requestId,
      );
    },
  },
];
