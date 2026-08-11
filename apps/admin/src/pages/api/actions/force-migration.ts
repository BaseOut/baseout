/**
 * POST /api/actions/force-migration — staff marks a pending On2Air org
 * migrated (`organizations.has_migrated = true`). Per the parent `admin`
 * change's tasks 4.8 this is a plain master-DB UPDATE — the server's
 * migrate-schema endpoint is the unrelated per-Space schema upgrade.
 * `dynamic_locked` (the org's pricing lock) is deliberately untouched.
 *
 * Auth: middleware already gates to role='super' and provides locals.db +
 * locals.user. CSRF: same-origin check + SameSite=Lax cookie. Audit:
 * intent row before the UPDATE, result row after (runAudited).
 */

import type { APIRoute } from 'astro'
import { eq } from 'drizzle-orm'
import { organizations } from '../../../db/schema'
import { runAudited, type AuditDeps } from '../../../lib/audit'
import { buildAuditDeps } from '../../../lib/audit-db'
import { checkOrigin } from '../../../lib/origin'
import { json, mapAuditFailure, methodNotAllowed, UUID_RE } from '../../../lib/actions/http'

export interface HandleForceMigrationInput {
  origin: string | null
  selfOrigin: string
  body: unknown
  actor: { id: string; email: string }
}

export interface HandleForceMigrationDeps {
  fetchOrgById: (
    organizationId: string,
  ) => Promise<{ id: string; slug: string; hasMigrated: boolean } | null>
  markMigrated: (organizationId: string) => Promise<void>
  audit: AuditDeps
}

export async function handlePost(
  input: HandleForceMigrationInput,
  deps: HandleForceMigrationDeps,
): Promise<Response> {
  if (!checkOrigin(input.origin, input.selfOrigin)) return json(403, { error: 'bad_origin' })

  const organizationId = (input.body as { organizationId?: unknown } | null)?.organizationId
  if (typeof organizationId !== 'string' || !UUID_RE.test(organizationId)) {
    return json(400, { error: 'invalid_request' })
  }

  // Preconditions before auditing — rejections don't pollute the trail.
  const org = await deps.fetchOrgById(organizationId)
  if (!org) return json(404, { error: 'org_not_found' })
  if (org.hasMigrated) return json(409, { error: 'already_migrated' })

  const audited = await runAudited(
    {
      actor: input.actor,
      action: 'force_migration',
      targetType: 'organization',
      targetId: organizationId,
      organizationId,
      params: { orgSlug: org.slug },
    },
    async () => {
      await deps.markMigrated(organizationId)
      return { ok: true as const }
    },
    deps.audit,
  )

  const failure = mapAuditFailure(audited)
  if (failure) return failure

  return json(200, { ok: true })
}

function buildDeps(locals: App.Locals): HandleForceMigrationDeps {
  const db = locals.db
  return {
    fetchOrgById: async (organizationId) => {
      const rows = await db
        .select({
          id: organizations.id,
          slug: organizations.slug,
          hasMigrated: organizations.hasMigrated,
        })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1)
      return rows[0] ?? null
    },
    markMigrated: async (organizationId) => {
      await db
        .update(organizations)
        .set({ hasMigrated: true })
        .where(eq(organizations.id, organizationId))
    },
    audit: buildAuditDeps(db),
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'invalid_request' })
  }
  return handlePost(
    {
      origin: request.headers.get('origin'),
      selfOrigin: new URL(request.url).origin,
      body,
      actor: { id: locals.user!.id, email: locals.user!.email },
    },
    buildDeps(locals),
  )
}

export const GET: APIRoute = () => methodNotAllowed()
export const PUT: APIRoute = () => methodNotAllowed()
export const PATCH: APIRoute = () => methodNotAllowed()
export const DELETE: APIRoute = () => methodNotAllowed()
