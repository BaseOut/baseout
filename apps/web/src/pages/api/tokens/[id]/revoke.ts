/**
 * POST /api/tokens/:id/revoke — soft-revoke an API token
 * (openspec/changes/web-api-tokens, design D1/D2/D4).
 *
 * Owner/admin only. Org-scoped lookup: a token id that exists but belongs to
 * another Organization 404s (no cross-tenant existence leak). Revoke flips
 * is_active=false and stamps modified_at — the row stays as the customer's
 * trail (name/prefix/last_used_at); apps/api rejects inactive tokens on the
 * next lookup, so revocation is effective with zero cross-app work.
 * Idempotent: re-revoking returns 200 without a second update or event.
 */

import type { APIRoute } from 'astro'
import { and, eq } from 'drizzle-orm'
import { apiTokens } from '../../../../db/schema'
import { logEvent } from '../../../../lib/log'
import type { AccountContext } from '../../../../lib/account'
import type { AppDb } from '../../../../db'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface HandlePostDeps {
  fetchTokenForOrg: (
    tokenId: string,
    organizationId: string,
  ) => Promise<{ id: string; isActive: boolean } | null>
  revokeToken: (tokenId: string) => Promise<void>
  logEvent: (event: string, fields: Record<string, unknown>) => void
}

export interface HandlePostInput {
  account: AccountContext | null
  tokenId: string | undefined
  deps: HandlePostDeps
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function handlePost(input: HandlePostInput): Promise<Response> {
  const orgId = input.account?.organization?.id
  const userId = input.account?.user?.id
  if (!orgId || !userId) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  const role = input.account?.membership?.role
  if (role !== 'owner' && role !== 'admin') {
    return jsonResponse({ error: 'forbidden' }, 403)
  }
  if (!input.tokenId || !UUID_RE.test(input.tokenId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }

  const token = await input.deps.fetchTokenForOrg(input.tokenId, orgId)
  if (!token) {
    return jsonResponse({ error: 'token_not_found' }, 404)
  }
  if (!token.isActive) {
    return jsonResponse({ ok: true, alreadyRevoked: true }, 200)
  }

  await input.deps.revokeToken(token.id)
  input.deps.logEvent('api_token.revoked', {
    organizationId: orgId,
    tokenId: token.id,
    actingUserId: userId,
  })
  return jsonResponse({ ok: true }, 200)
}

// ── Astro APIRoute wrapper ──────────────────────────────────────────────

function buildDeps(db: AppDb): HandlePostDeps {
  return {
    fetchTokenForOrg: async (tokenId, organizationId) => {
      const [row] = await db
        .select({ id: apiTokens.id, isActive: apiTokens.isActive })
        .from(apiTokens)
        .where(
          and(eq(apiTokens.id, tokenId), eq(apiTokens.organizationId, organizationId)),
        )
        .limit(1)
      return row ?? null
    },
    revokeToken: async (tokenId) => {
      await db
        .update(apiTokens)
        .set({ isActive: false, modifiedAt: new Date() })
        .where(eq(apiTokens.id, tokenId))
    },
    logEvent,
  }
}

export const POST: APIRoute = async ({ locals, params }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)
  return handlePost({
    account: locals.account ?? null,
    tokenId: params.id,
    deps: buildDeps(db),
  })
}

export const GET: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const PUT: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const PATCH: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const DELETE: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
