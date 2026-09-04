/**
 * /api/spaces/:spaceId/workspaces  (web-workspace-bases tasks 3.1 + 3.2)
 *
 * GET — the connection's workspace list for picker grouping headers,
 * proxied from the engine's internal
 * GET /api/internal/connections/:connectionId/workspaces (short-TTL cache
 * engine-side; server-mcp-workspaces), merged with this Space's enrollment
 * rows. ANY engine failure — binding missing, transport error, 404 while
 * the engine half is unbuilt, `degraded:true` payload — degrades to the
 * ungrouped response `{ ok: false, degraded: true, workspaces: [] }` with
 * HTTP 200 (design Decision 4: grouping is a progressive enhancement,
 * never an error page).
 *
 * PUT — enrollment upsert/remove: `{ workspaces: [{ workspaceId,
 * workspaceName?, autoEnrollFutureBases? }], remove?: [workspaceId],
 * autoEnrollNewWorkspaces?: boolean }`. Server-side validation; the first
 * save materializes rows, after which the legacy autoAddFutureBases flag
 * is inert for the Space (design Decision 3 — reads here never touch it).
 *
 * Middleware-gated + IDOR-checked like the sibling space routes.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  backupConfigurations,
  connections,
  platforms,
  spaces,
  spaceWorkspaces,
} from '../../../../db/schema'
import type { AccountContext } from '../../../../lib/account'
import {
  createBackupEngine,
  type EngineListWorkspacesResult,
} from '../../../../lib/backup-engine'
import { resolveWorkspaceAutoAddPolicy } from '../../../../lib/backup-config/workspace-precedence'
import type { AppDb } from '../../../../db'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_WORKSPACES = 200
const MAX_ID_LENGTH = 100
const MAX_NAME_LENGTH = 500

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** The contract-pinned degraded (ungrouped) response — HTTP 200. */
export const DEGRADED_RESPONSE_BODY = {
  ok: false,
  degraded: true,
  workspaces: [],
} as const

export interface SpaceRowSlim {
  id: string
  organizationId: string
}

export interface EnrollmentRowView {
  workspaceId: string
  workspaceName: string | null
  autoEnrollFutureBases: boolean
  enrolledVia: string
  lastCheckedAt: string | null
}

export interface EnrollmentState {
  rows: EnrollmentRowView[]
  autoEnrollNewWorkspaces: boolean
  legacyAutoAddFutureBases: boolean
}

// ── GET ─────────────────────────────────────────────────────────────────────

export interface HandleGetInput {
  account: AccountContext | null
  spaceId: string | undefined
  fetchSpaceById: (spaceId: string) => Promise<SpaceRowSlim | null>
  loadEnrollment: (spaceId: string) => Promise<EnrollmentState>
  /** null = engine binding or Airtable connection unavailable → degraded. */
  listWorkspaces: (() => Promise<EngineListWorkspacesResult>) | null
}

export async function handleGet(input: HandleGetInput): Promise<Response> {
  if (!input.account?.organization?.id) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  if (!input.spaceId || !UUID_RE.test(input.spaceId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  const space = await input.fetchSpaceById(input.spaceId)
  if (!space) return jsonResponse({ error: 'space_not_found' }, 403)
  if (space.organizationId !== input.account.organization.id) {
    return jsonResponse({ error: 'space_org_mismatch' }, 403)
  }

  const listing = input.listWorkspaces ? await input.listWorkspaces() : null
  if (!listing || !listing.ok) {
    return jsonResponse(DEGRADED_RESPONSE_BODY, 200)
  }

  const enrollment = await input.loadEnrollment(input.spaceId)
  const byId = new Map(enrollment.rows.map((r) => [r.workspaceId, r]))
  const policy = resolveWorkspaceAutoAddPolicy({
    legacyAutoAddFutureBases: enrollment.legacyAutoAddFutureBases,
    autoEnrollNewWorkspaces: enrollment.autoEnrollNewWorkspaces,
    rows: enrollment.rows,
  })

  const seen = new Set<string>()
  const workspaces = listing.workspaces.map((w) => {
    seen.add(w.id)
    const row = byId.get(w.id)
    return {
      id: w.id,
      name: w.name,
      permissionLevel: w.permissionLevel,
      enrolled: !!row,
      autoEnrollFutureBases: row?.autoEnrollFutureBases ?? false,
      enrolledVia: row?.enrolledVia ?? null,
      lastCheckedAt: row?.lastCheckedAt ?? null,
    }
  })
  // Enrolled workspaces no longer present in the listing (removed on the
  // Airtable side, or listing is partial) stay visible for un-enrollment.
  for (const row of enrollment.rows) {
    if (seen.has(row.workspaceId)) continue
    workspaces.push({
      id: row.workspaceId,
      name: row.workspaceName ?? row.workspaceId,
      permissionLevel: undefined,
      enrolled: true,
      autoEnrollFutureBases: row.autoEnrollFutureBases,
      enrolledVia: row.enrolledVia,
      lastCheckedAt: row.lastCheckedAt,
    })
  }

  return jsonResponse(
    {
      ok: true,
      workspaces,
      autoEnrollNewWorkspaces: enrollment.autoEnrollNewWorkspaces,
      policySource: policy.source,
      capturedAt: listing.capturedAt,
    },
    200,
  )
}

// ── PUT ─────────────────────────────────────────────────────────────────────

export interface EnrollmentUpsert {
  workspaceId: string
  workspaceName: string | null
  autoEnrollFutureBases: boolean
}

export interface ValidatedEnrollmentBody {
  workspaces: EnrollmentUpsert[]
  remove: string[]
  autoEnrollNewWorkspaces: boolean | null
}

/** Server-side validation for the PUT body (pure — unit-tested). */
export function parseEnrollmentBody(
  body: unknown,
): { ok: true; value: ValidatedEnrollmentBody } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'invalid_body' }
  }
  const raw = body as Record<string, unknown>

  const workspaces: EnrollmentUpsert[] = []
  if (raw.workspaces !== undefined) {
    if (!Array.isArray(raw.workspaces)) {
      return { ok: false, error: 'workspaces_must_be_array' }
    }
    if (raw.workspaces.length > MAX_WORKSPACES) {
      return { ok: false, error: 'too_many_workspaces' }
    }
    for (const entry of raw.workspaces) {
      if (typeof entry !== 'object' || entry === null) {
        return { ok: false, error: 'invalid_workspace_entry' }
      }
      const e = entry as Record<string, unknown>
      if (
        typeof e.workspaceId !== 'string' ||
        !e.workspaceId.trim() ||
        e.workspaceId.length > MAX_ID_LENGTH
      ) {
        return { ok: false, error: 'invalid_workspace_id' }
      }
      let workspaceName: string | null = null
      if (e.workspaceName !== undefined && e.workspaceName !== null) {
        if (
          typeof e.workspaceName !== 'string' ||
          e.workspaceName.length > MAX_NAME_LENGTH
        ) {
          return { ok: false, error: 'invalid_workspace_name' }
        }
        workspaceName = e.workspaceName
      }
      if (
        e.autoEnrollFutureBases !== undefined &&
        typeof e.autoEnrollFutureBases !== 'boolean'
      ) {
        return { ok: false, error: 'invalid_auto_enroll_flag' }
      }
      workspaces.push({
        workspaceId: e.workspaceId.trim(),
        workspaceName,
        autoEnrollFutureBases: e.autoEnrollFutureBases === true,
      })
    }
  }

  let remove: string[] = []
  if (raw.remove !== undefined) {
    if (
      !Array.isArray(raw.remove) ||
      raw.remove.some(
        (v) => typeof v !== 'string' || !v.trim() || v.length > MAX_ID_LENGTH,
      )
    ) {
      return { ok: false, error: 'invalid_remove_list' }
    }
    remove = (raw.remove as string[]).map((v) => v.trim())
  }

  let autoEnrollNewWorkspaces: boolean | null = null
  if (raw.autoEnrollNewWorkspaces !== undefined) {
    if (typeof raw.autoEnrollNewWorkspaces !== 'boolean') {
      return { ok: false, error: 'invalid_auto_enroll_new_workspaces' }
    }
    autoEnrollNewWorkspaces = raw.autoEnrollNewWorkspaces
  }

  if (workspaces.length === 0 && remove.length === 0 && autoEnrollNewWorkspaces === null) {
    return { ok: false, error: 'empty_request' }
  }

  const upsertIds = new Set(workspaces.map((w) => w.workspaceId))
  if (remove.some((id) => upsertIds.has(id))) {
    return { ok: false, error: 'workspace_in_both_lists' }
  }

  return { ok: true, value: { workspaces, remove, autoEnrollNewWorkspaces } }
}

export interface HandlePutInput {
  account: AccountContext | null
  spaceId: string | undefined
  body: unknown
  fetchSpaceById: (spaceId: string) => Promise<SpaceRowSlim | null>
  applyEnrollment: (
    value: ValidatedEnrollmentBody,
  ) => Promise<{ enrolled: number; removed: number }>
}

export async function handlePut(input: HandlePutInput): Promise<Response> {
  if (!input.account?.organization?.id) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  if (!input.spaceId || !UUID_RE.test(input.spaceId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  const space = await input.fetchSpaceById(input.spaceId)
  if (!space) return jsonResponse({ error: 'space_not_found' }, 403)
  if (space.organizationId !== input.account.organization.id) {
    return jsonResponse({ error: 'space_org_mismatch' }, 403)
  }

  const parsed = parseEnrollmentBody(input.body)
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, 400)

  const result = await input.applyEnrollment(parsed.value)
  return jsonResponse({ ok: true, ...result }, 200)
}

// ── DB + engine wiring ──────────────────────────────────────────────────────

async function fetchSpaceById(
  db: AppDb,
  id: string,
): Promise<SpaceRowSlim | null> {
  const [row] = await db
    .select({ id: spaces.id, organizationId: spaces.organizationId })
    .from(spaces)
    .where(eq(spaces.id, id))
    .limit(1)
  return row ?? null
}

async function loadEnrollment(
  db: AppDb,
  spaceId: string,
): Promise<EnrollmentState> {
  const [rows, configRows] = await Promise.all([
    db
      .select({
        workspaceId: spaceWorkspaces.workspaceId,
        workspaceName: spaceWorkspaces.workspaceName,
        autoEnrollFutureBases: spaceWorkspaces.autoEnrollFutureBases,
        enrolledVia: spaceWorkspaces.enrolledVia,
        lastCheckedAt: spaceWorkspaces.lastCheckedAt,
      })
      .from(spaceWorkspaces)
      .where(eq(spaceWorkspaces.spaceId, spaceId)),
    db
      .select({
        autoEnrollNewWorkspaces: backupConfigurations.autoEnrollNewWorkspaces,
        autoAddFutureBases: backupConfigurations.autoAddFutureBases,
      })
      .from(backupConfigurations)
      .where(eq(backupConfigurations.spaceId, spaceId))
      .limit(1),
  ])
  return {
    rows: rows.map((r) => ({
      workspaceId: r.workspaceId,
      workspaceName: r.workspaceName,
      autoEnrollFutureBases: r.autoEnrollFutureBases,
      enrolledVia: r.enrolledVia,
      lastCheckedAt: r.lastCheckedAt ? r.lastCheckedAt.toISOString() : null,
    })),
    autoEnrollNewWorkspaces: configRows[0]?.autoEnrollNewWorkspaces ?? false,
    legacyAutoAddFutureBases: configRows[0]?.autoAddFutureBases ?? false,
  }
}

/** The Space's org's Airtable connection (active preferred, newest first). */
async function resolveConnectionId(
  db: AppDb,
  organizationId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: connections.id, status: connections.status, modifiedAt: connections.modifiedAt })
    .from(connections)
    .innerJoin(platforms, eq(platforms.id, connections.platformId))
    .where(
      and(
        eq(connections.organizationId, organizationId),
        eq(platforms.slug, 'airtable'),
      ),
    )
    .orderBy(desc(connections.modifiedAt))
  const active = rows.find((r) => r.status === 'active')
  return (active ?? rows[0])?.id ?? null
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
    const connectionId = await resolveConnectionId(db, organizationId)
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

async function applyEnrollment(
  db: AppDb,
  spaceId: string,
  value: ValidatedEnrollmentBody,
): Promise<{ enrolled: number; removed: number }> {
  const now = new Date()
  if (value.workspaces.length > 0) {
    await db
      .insert(spaceWorkspaces)
      .values(
        value.workspaces.map((w) => ({
          spaceId,
          workspaceId: w.workspaceId,
          workspaceName: w.workspaceName,
          autoEnrollFutureBases: w.autoEnrollFutureBases,
          enrolledVia: 'manual',
        })),
      )
      .onConflictDoUpdate({
        target: [spaceWorkspaces.spaceId, spaceWorkspaces.workspaceId],
        set: {
          // Keep a previously stamped name when the client omits it.
          workspaceName: sql`coalesce(excluded.workspace_name, ${spaceWorkspaces}.workspace_name)`,
          autoEnrollFutureBases: sql`excluded.auto_enroll_future_bases`,
          // enrolledVia deliberately NOT updated — an 'auto' row a user
          // edits keeps its provenance (design Decision 2b).
          modifiedAt: now,
        },
      })
  }

  let removed = 0
  if (value.remove.length > 0) {
    const deleted = await db
      .delete(spaceWorkspaces)
      .where(
        and(
          eq(spaceWorkspaces.spaceId, spaceId),
          inArray(spaceWorkspaces.workspaceId, value.remove),
        ),
      )
      .returning({ id: spaceWorkspaces.id })
    removed = deleted.length
  }

  if (value.autoEnrollNewWorkspaces !== null) {
    await db
      .update(backupConfigurations)
      .set({
        autoEnrollNewWorkspaces: value.autoEnrollNewWorkspaces,
        modifiedAt: now,
      })
      .where(eq(backupConfigurations.spaceId, spaceId))
  }

  return { enrolled: value.workspaces.length, removed }
}

// ── Astro APIRoute wrappers ─────────────────────────────────────────────────

export const GET: APIRoute = async ({ locals, params }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  const orgId = locals.account?.organization?.id
  return handleGet({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    fetchSpaceById: (id) => fetchSpaceById(db, id),
    loadEnrollment: (id) => loadEnrollment(db, id),
    listWorkspaces: orgId ? buildListWorkspaces(db, orgId) : null,
  })
}

export const PUT: APIRoute = async ({ request, locals, params }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'invalid_body' }, 400)
  }

  return handlePut({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    body,
    fetchSpaceById: (id) => fetchSpaceById(db, id),
    applyEnrollment: (value) => applyEnrollment(db, params.spaceId!, value),
  })
}

export const POST: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const DELETE: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
