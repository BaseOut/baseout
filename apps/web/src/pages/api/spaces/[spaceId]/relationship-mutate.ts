/**
 * POST /api/spaces/:spaceId/relationship-mutate — confirm/dismiss an inferred
 * synced view, or create a user-authored one (web-relationships-tab). The engine
 * validates the action discriminator + canonicalizes the table pair.
 * Authenticated + IDOR- and tier-gated (Schema Docs level).
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createBackupEngine, type MutateRelationshipResult } from '../../../../lib/backup-engine'
import type { AccountContext } from '../../../../lib/account'
import {
  fetchSpaceById,
  guardSchemaDocsRequest,
  resolveSchemaDocsLevel,
  schemaDocsErrorStatus,
  type SpaceRowForDocs,
} from '../../../../lib/schema-docs/proxy'
import type { SchemaDocsLevel } from '../../../../lib/capabilities/tier-capabilities'

type MutateBody =
  | { action: 'confirm' | 'dismiss'; id: string }
  | { action: 'create'; baseId: string; sourceTableId: string; destTableId: string }

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface RelationshipMutateRouteInput {
  account: AccountContext | null
  spaceId: string | undefined
  parseBody: () => Promise<Record<string, unknown>>
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
  engine: ((spaceId: string, body: MutateBody) => Promise<MutateRelationshipResult>) | null
}

export async function handleRelationshipMutate(
  input: RelationshipMutateRouteInput,
): Promise<Response> {
  const guard = await guardSchemaDocsRequest({
    account: input.account,
    spaceId: input.spaceId,
    fetchSpace: input.fetchSpace,
    resolveLevel: input.resolveLevel,
  })
  if (!guard.ok) return guard.response

  if (!input.engine) {
    return jsonResponse(
      { error: 'server_misconfigured', message: 'Backup engine binding or token is not configured.' },
      503,
    )
  }

  const body = await input.parseBody()
  const action = body.action
  if (action !== 'confirm' && action !== 'dismiss' && action !== 'create') {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  // Shallow validation; the engine does the authoritative checks.
  if ((action === 'confirm' || action === 'dismiss') && typeof body.id !== 'string') {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  if (
    action === 'create' &&
    (typeof body.baseId !== 'string' ||
      typeof body.sourceTableId !== 'string' ||
      typeof body.destTableId !== 'string')
  ) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }

  const r = await input.engine(guard.space.id, body as MutateBody)
  return r.ok
    ? jsonResponse({ ok: true, id: r.id }, 200)
    : jsonResponse({ error: r.code }, schemaDocsErrorStatus(r.code))
}

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let engine: RelationshipMutateRouteInput['engine'] = null
  if (env.BACKUP_ENGINE && env.BACKUP_ENGINE_INTERNAL_TOKEN) {
    const e = createBackupEngine({
      binding: env.BACKUP_ENGINE,
      internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
    })
    engine = (spaceId, body) => e.mutateRelationship(spaceId, body)
  }
  return handleRelationshipMutate({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    parseBody: async () => {
      try {
        return (await request.json()) as Record<string, unknown>
      } catch {
        return {}
      }
    },
    fetchSpace: (id) => fetchSpaceById(db, id),
    resolveLevel: (orgId) => resolveSchemaDocsLevel(db, orgId),
    engine,
  })
}
