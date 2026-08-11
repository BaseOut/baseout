/**
 * Shared guard + status mapping for the Schema Docs proxy routes
 * (openspec/changes/shared-schema-docs §4). Each `/api/spaces/[spaceId]/*`
 * Schema Docs route runs this guard — authenticate, IDOR-check the Space
 * against the session org, and enforce the tier gate — BEFORE forwarding to
 * the engine via the BACKUP_ENGINE binding. The browser never reaches the
 * per-Space DB directly.
 *
 * Pure (takes deps as args) so vitest runs it in plain Node with vi.fn() stubs,
 * mirroring rescan-bases.ts.
 */

import { eq } from 'drizzle-orm'
import type { AppDb } from '../../db'
import { spaces } from '../../db/schema'
import type { AccountContext } from '../account'
import { resolveCapabilities } from '../capabilities/resolve'
import type { SchemaDocsLevel } from '../capabilities/tier-capabilities'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface SpaceRowForDocs {
  id: string
  organizationId: string
}

export interface GuardInput {
  account: AccountContext | null
  spaceId: string | undefined
  fetchSpace: (spaceId: string) => Promise<SpaceRowForDocs | null>
  /** Resolve the org's Schema Docs entitlement level (platform bound inside). */
  resolveLevel: (organizationId: string) => Promise<SchemaDocsLevel>
}

export type GuardResult =
  | { ok: false; response: Response }
  | { ok: true; space: SpaceRowForDocs; level: Exclude<SchemaDocsLevel, 'none'> }

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function guardSchemaDocsRequest(input: GuardInput): Promise<GuardResult> {
  if (!input.account?.organization?.id) {
    return { ok: false, response: jsonResponse({ error: 'Not authenticated' }, 401) }
  }
  if (!input.spaceId || !UUID_RE.test(input.spaceId)) {
    return { ok: false, response: jsonResponse({ error: 'invalid_request' }, 400) }
  }
  const space = await input.fetchSpace(input.spaceId)
  if (!space) {
    return { ok: false, response: jsonResponse({ error: 'space_not_found' }, 403) }
  }
  if (space.organizationId !== input.account.organization.id) {
    return { ok: false, response: jsonResponse({ error: 'space_org_mismatch' }, 403) }
  }
  const level = await input.resolveLevel(space.organizationId)
  if (level === 'none') {
    return { ok: false, response: jsonResponse({ error: 'schema_docs_not_entitled' }, 403) }
  }
  return { ok: true, space, level }
}

// ── Astro-wrapper deps (real Drizzle; no cloudflare:workers import here, so the
//    guard stays unit-testable in plain Node) ──────────────────────────────

/** Look up a Space's slim row for the IDOR check. */
export async function fetchSpaceById(
  db: AppDb,
  spaceId: string,
): Promise<SpaceRowForDocs | null> {
  const [row] = await db
    .select({ id: spaces.id, organizationId: spaces.organizationId })
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1)
  return (row as SpaceRowForDocs | undefined) ?? null
}

/**
 * Resolve the org's Schema Docs entitlement. V1 Spaces are Airtable-only, so
 * the gate resolves against the `airtable` platform (Features §7).
 */
export async function resolveSchemaDocsLevel(
  db: AppDb,
  organizationId: string,
): Promise<SchemaDocsLevel> {
  const { capabilities } = await resolveCapabilities(db, organizationId, 'airtable')
  return capabilities.schemaDocs
}

/** Map an engine error code to the HTTP status the proxy should return. */
export function schemaDocsErrorStatus(code: string): number {
  switch (code) {
    case 'unauthorized':
      return 401
    case 'invalid_request':
      return 400
    case 'document_not_found':
      return 404
    case 'space_db_not_ready':
      return 409
    case 'backend_not_implemented':
      return 501
    case 'engine_unreachable':
      return 502
    default:
      return 500
  }
}
