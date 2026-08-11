/**
 * POST /api/tokens — create an API token for the current Organization
 * (openspec/changes/web-api-tokens, design D1/D2/D3/D7).
 *
 * The Organization comes from the session (getAccountContext via locals) —
 * never from the body. Owner/admin only (first customer-facing role gate in
 * web; members get 403). The plaintext token is minted by
 * @baseout/shared/api-tokens and crosses the wire exactly once, in this
 * route's 201 response — only its SHA-256 hash and display prefix persist
 * (PRD §21.3). Structured api_token.created event carries ids only, never
 * token material (design D5 — audit-table follow-up tracked in
 * questions-2026-07-20 item 12).
 *
 * Pattern matches backup-runs delete.ts: testable inner handlePost(input)
 * with injected deps + a thin Astro APIRoute wrapper.
 */

import type { APIRoute } from 'astro'
import { and, eq } from 'drizzle-orm'
import { generateApiToken } from '@baseout/shared/api-tokens'
import { apiTokens, spaces } from '../../../db/schema'
import { logEvent } from '../../../lib/log'
import type { AccountContext } from '../../../lib/account'
import type { AppDb } from '../../../db'

export const ALLOWED_SCOPES = ['org:read', 'backups:read', 'schema:read'] as const
export const EXPIRY_PRESET_DAYS = [30, 90, 365] as const

const MAX_NAME_LENGTH = 100

export interface TokenRowView {
  id: string
  name: string
  tokenPrefix: string
  scopes: string[]
  spaceId: string | null
  status: 'active'
  expiresAt: string | null
  createdAt: string | null
}

export interface InsertTokenValues {
  organizationId: string
  spaceId: string | null
  name: string
  scopes: string[]
  tokenPrefix: string
  tokenHash: string
  expiresAt: Date | null
  createdByUserId: string
}

export interface InsertedTokenRow {
  id: string
  name: string
  tokenPrefix: string
  scopes: string[]
  spaceId: string | null
  isActive: boolean
  expiresAt: Date | null
  lastUsedAt: Date | null
  createdAt: Date | null
}

export interface HandlePostDeps {
  mint: () => Promise<{ token: string; tokenPrefix: string; tokenHash: string }>
  fetchSpaceForOrg: (spaceId: string, organizationId: string) => Promise<{ id: string } | null>
  insertToken: (values: InsertTokenValues) => Promise<InsertedTokenRow>
  logEvent: (event: string, fields: Record<string, unknown>) => void
  now: () => Date
}

export interface HandlePostInput {
  account: AccountContext | null
  body: unknown
  deps: HandlePostDeps
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function handlePost(input: HandlePostInput): Promise<Response> {
  // 1. Auth.
  const orgId = input.account?.organization?.id
  const userId = input.account?.user?.id
  if (!orgId || !userId) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  // 2. Role gate (D2): minting grants org-wide read — org-administration act.
  const role = input.account?.membership?.role
  if (role !== 'owner' && role !== 'admin') {
    return jsonResponse({ error: 'forbidden' }, 403)
  }

  // 3. Validation (D7).
  if (typeof input.body !== 'object' || input.body === null || Array.isArray(input.body)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  const body = input.body as Record<string, unknown>

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > MAX_NAME_LENGTH) {
    return jsonResponse({ error: 'invalid_name' }, 400)
  }

  const scopes = body.scopes
  if (
    !Array.isArray(scopes) ||
    scopes.length === 0 ||
    !scopes.every((s) => (ALLOWED_SCOPES as readonly string[]).includes(s as string))
  ) {
    return jsonResponse({ error: 'invalid_scopes' }, 400)
  }

  let spaceId: string | null = null
  if (body.spaceId != null && body.spaceId !== '') {
    if (typeof body.spaceId !== 'string') {
      return jsonResponse({ error: 'invalid_space' }, 400)
    }
    const space = await input.deps.fetchSpaceForOrg(body.spaceId, orgId)
    if (!space) {
      return jsonResponse({ error: 'invalid_space' }, 400)
    }
    spaceId = space.id
  }

  let expiresAt: Date | null = null
  if (body.expiresInDays != null) {
    const days = body.expiresInDays
    if (
      typeof days !== 'number' ||
      !(EXPIRY_PRESET_DAYS as readonly number[]).includes(days)
    ) {
      return jsonResponse({ error: 'invalid_expiry' }, 400)
    }
    expiresAt = new Date(input.deps.now().getTime() + days * 24 * 60 * 60 * 1000)
  }

  // 4. Mint + persist (hash + prefix only — the plaintext never touches the DB).
  const minted = await input.deps.mint()
  const row = await input.deps.insertToken({
    organizationId: orgId,
    spaceId,
    name,
    scopes: [...new Set(scopes as string[])],
    tokenPrefix: minted.tokenPrefix,
    tokenHash: minted.tokenHash,
    expiresAt,
    createdByUserId: userId,
  })

  input.deps.logEvent('api_token.created', {
    organizationId: orgId,
    tokenId: row.id,
    spaceId,
    scopes: row.scopes,
    actingUserId: userId,
  })

  const view: TokenRowView = {
    id: row.id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    scopes: row.scopes,
    spaceId: row.spaceId,
    status: 'active',
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  }
  // The ONLY place the plaintext ever appears (D3).
  return jsonResponse({ token: minted.token, row: view }, 201)
}

// ── Astro APIRoute wrapper ──────────────────────────────────────────────

function buildDeps(db: AppDb): HandlePostDeps {
  return {
    mint: generateApiToken,
    fetchSpaceForOrg: async (spaceId, organizationId) => {
      const [row] = await db
        .select({ id: spaces.id })
        .from(spaces)
        .where(and(eq(spaces.id, spaceId), eq(spaces.organizationId, organizationId)))
        .limit(1)
      return row ?? null
    },
    insertToken: async (values) => {
      const [row] = await db
        .insert(apiTokens)
        .values(values)
        .returning({
          id: apiTokens.id,
          name: apiTokens.name,
          tokenPrefix: apiTokens.tokenPrefix,
          scopes: apiTokens.scopes,
          spaceId: apiTokens.spaceId,
          isActive: apiTokens.isActive,
          expiresAt: apiTokens.expiresAt,
          lastUsedAt: apiTokens.lastUsedAt,
          createdAt: apiTokens.createdAt,
        })
      return row!
    },
    logEvent,
    now: () => new Date(),
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  return handlePost({ account: locals.account ?? null, body, deps: buildDeps(db) })
}

export const GET: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const PUT: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const PATCH: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const DELETE: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
