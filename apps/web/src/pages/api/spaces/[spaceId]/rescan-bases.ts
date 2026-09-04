/**
 * POST /api/spaces/:spaceId/rescan-bases
 *
 * Triggers a manual workspace rediscovery for the given Space. The web
 * route is the authenticated, IDOR-checked entry point; it forwards to
 * @baseout/server's POST /api/internal/spaces/:spaceId/rescan-bases via
 * the SERVER service binding. The engine is the single writer for
 * rediscovery so the alarm and manual paths share the same policy
 * (auto-add toggle, tier-cap split, space_events insert).
 *
 * The testable inner `handlePost` takes all deps as arguments so vitest
 * can run it in plain Node with vi.fn() stubs. The Astro APIRoute wraps
 * it with real Drizzle + a real BackupEngineClient.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { and, desc, eq, inArray } from 'drizzle-orm'
import {
  connections,
  platforms,
  spaces,
  spaceWorkspaces,
} from '../../../../db/schema'
import type { AccountContext } from '../../../../lib/account'
import {
  createBackupEngine,
  type EngineListWorkspacesResult,
  type EngineRescanBasesResult,
  type EngineWorkspaceSummary,
} from '../../../../lib/backup-engine'
import type { AppDb } from '../../../../db'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface SpaceRowSlim {
  id: string
  organizationId: string
}

export interface HandlePostInput {
  account: AccountContext | null
  spaceId: string | undefined
  fetchSpaceById: (spaceId: string) => Promise<SpaceRowSlim | null>
  /**
   * Engine proxy. When null, the SERVER binding or SERVER_INTERNAL_TOKEN
   * is not configured — the route returns 503. Otherwise calls the engine
   * and surfaces the typed result.
   */
  engineRescan:
    | ((spaceId: string) => Promise<EngineRescanBasesResult>)
    | null
  /**
   * Best-effort workspace listing refresh (web-workspace-bases task 2.2):
   * after a successful rescan, fetch the connection's workspace listing
   * from the engine (server-mcp-workspaces internal route) and stamp
   * space_workspaces.last_checked_at for enrolled workspaces still present.
   * ANY failure — null dep, engine 404 while unbuilt, degraded payload,
   * throw — means "no workspace data": the rescan response is unchanged.
   */
  listWorkspaces?: (() => Promise<EngineListWorkspacesResult>) | null
  stampWorkspaceChecks?: (workspaces: EngineWorkspaceSummary[]) => Promise<void>
}

function statusForEngineError(code: string): number {
  switch (code) {
    case 'unauthorized':
      return 401
    case 'invalid_request':
      return 400
    case 'space_not_found':
    case 'config_not_found':
      return 404
    case 'connection_not_found':
      return 409
    case 'airtable_error':
    case 'engine_unreachable':
      return 502
    default:
      return 500
  }
}

export async function handlePost(input: HandlePostInput): Promise<Response> {
  if (!input.account?.organization?.id) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  if (!input.spaceId || !UUID_RE.test(input.spaceId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }

  const space = await input.fetchSpaceById(input.spaceId)
  if (!space) {
    return jsonResponse({ error: 'space_not_found' }, 403)
  }
  if (space.organizationId !== input.account.organization.id) {
    return jsonResponse({ error: 'space_org_mismatch' }, 403)
  }

  if (!input.engineRescan) {
    return jsonResponse(
      {
        error: 'server_misconfigured',
        message:
          'Backup engine binding or token is not configured. Contact support.',
      },
      503,
    )
  }

  const result = await input.engineRescan(input.spaceId)
  if (result.ok) {
    // Progressive enhancement: refresh workspace data alongside the rescan;
    // failure of ANY kind degrades to the plain rescan response.
    let workspaces: EngineWorkspaceSummary[] | undefined
    if (input.listWorkspaces) {
      try {
        const listing = await input.listWorkspaces()
        if (listing.ok) {
          workspaces = listing.workspaces
          await input.stampWorkspaceChecks?.(listing.workspaces)
        }
      } catch {
        // proceed without workspace data (design Decision 5)
      }
    }
    return jsonResponse(
      {
        ok: true,
        discovered: result.discovered,
        autoAdded: result.autoAdded,
        blockedByTier: result.blockedByTier,
        ...(workspaces ? { workspaces } : {}),
      },
      200,
    )
  }
  return jsonResponse({ error: result.code }, statusForEngineError(result.code))
}

// ── Astro APIRoute wrapper ───────────────────────────────────────────────

export const POST: APIRoute = async ({ locals, params }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)

  const organizationId = locals.account?.organization?.id ?? null
  return handlePost({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    fetchSpaceById: async (id) => {
      const [row] = await db
        .select({ id: spaces.id, organizationId: spaces.organizationId })
        .from(spaces)
        .where(eq(spaces.id, id))
        .limit(1)
      return (row as SpaceRowSlim | undefined) ?? null
    },
    engineRescan: buildEngineRescan(),
    listWorkspaces: organizationId
      ? buildListWorkspaces(db, organizationId)
      : null,
    stampWorkspaceChecks: async (workspaces) => {
      if (!params.spaceId || workspaces.length === 0) return
      await db
        .update(spaceWorkspaces)
        .set({ lastCheckedAt: new Date(), modifiedAt: new Date() })
        .where(
          and(
            eq(spaceWorkspaces.spaceId, params.spaceId),
            inArray(
              spaceWorkspaces.workspaceId,
              workspaces.map((w) => w.id),
            ),
          ),
        )
    },
  })
}

function buildEngineRescan():
  | ((spaceId: string) => Promise<EngineRescanBasesResult>)
  | null {
  if (!env.SERVER || !env.SERVER_INTERNAL_TOKEN) return null
  const engine = createBackupEngine({
    binding: env.SERVER,
    internalToken: env.SERVER_INTERNAL_TOKEN,
  })
  return (spaceId) => engine.rescanBases(spaceId)
}

function buildListWorkspaces(
  db: AppDb,
  organizationId: string,
): (() => Promise<EngineListWorkspacesResult>) | null {
  if (!env.SERVER || !env.SERVER_INTERNAL_TOKEN) return null
  const engine = createBackupEngine({
    binding: env.SERVER,
    internalToken: env.SERVER_INTERNAL_TOKEN,
  })
  return async () => {
    const rows = await db
      .select({ id: connections.id, status: connections.status })
      .from(connections)
      .innerJoin(platforms, eq(platforms.id, connections.platformId))
      .where(
        and(
          eq(connections.organizationId, organizationId),
          eq(platforms.slug, 'airtable'),
        ),
      )
      .orderBy(desc(connections.modifiedAt))
    const connectionId =
      (rows.find((r) => r.status === 'active') ?? rows[0])?.id ?? null
    if (!connectionId) {
      return {
        ok: false,
        degraded: true,
        reason: 'connection_not_found',
        status: 0,
      }
    }
    return engine.listConnectionWorkspaces(connectionId)
  }
}

export const GET: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const PATCH: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const PUT: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const DELETE: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
