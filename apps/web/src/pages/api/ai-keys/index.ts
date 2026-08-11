/**
 * BYOK provider-key management API (shared-ai-byok 2.1/2.2).
 *
 *   GET    /api/ai-keys           list the org's keys (display-only)
 *   POST   /api/ai-keys           add or rotate a key   { provider, key, label?, modelDefault? }
 *   DELETE /api/ai-keys           revoke a provider's active key   { provider }
 *
 * Plus+-gated on the `byo_ai_key` entitlement (resolved via resolveEntitlements —
 * never a tier-name string). The plaintext key is accepted on POST, encrypted by
 * `persistProviderKey` (AES-256-GCM), and NEVER returned or listed — responses
 * carry display-only fields (provider, last_four, status, …). Auth via middleware.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { and, eq } from 'drizzle-orm'
import { getBool } from '@baseout/db-schema'
import type { AccountContext } from '../../../lib/account'
import { aiProviderKeys } from '../../../db/schema'
import {
  persistProviderKey,
  type PersistProviderKeyInputs,
  type PersistProviderKeyResult,
} from '../../../lib/ai/persist-provider-key'
import { resolveEntitlements } from '../../../lib/entitlements/resolve'

export const PROVIDERS = ['anthropic', 'openai', 'cloudflare'] as const
type Provider = (typeof PROVIDERS)[number]

const JSON_HEADERS = { 'Content-Type': 'application/json' }
function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

/** One key as surfaced to the customer — no key material by construction. */
export interface AiKeyView {
  provider: string
  label: string | null
  modelDefault: string | null
  lastFour: string
  status: string
  lastValidatedAt: Date | string | null
}

export interface HandleDeps {
  listKeys: (organizationId: string) => Promise<AiKeyView[]>
  isByokEntitled: (organizationId: string) => Promise<boolean>
  persist: (inputs: PersistProviderKeyInputs) => Promise<PersistProviderKeyResult>
  revoke: (organizationId: string, provider: string) => Promise<boolean>
}

function isProvider(v: unknown): v is Provider {
  return typeof v === 'string' && (PROVIDERS as readonly string[]).includes(v)
}
/** Key management is a credential surface — mutations are owner/admin-only. */
function canManage(account: AccountContext): boolean {
  const role = account.membership?.role
  return role === 'owner' || role === 'admin'
}
function asRecord(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
}

export async function handleGet(input: {
  account: AccountContext | null
  deps: HandleDeps
}): Promise<Response> {
  const orgId = input.account?.organization?.id
  if (!input.account?.user) return jsonResponse({ error: 'Not authenticated' }, 401)
  if (!orgId) return jsonResponse({ error: 'No active organization' }, 403)
  const keys = await input.deps.listKeys(orgId)
  return jsonResponse({ keys }, 200)
}

export async function handlePost(input: {
  account: AccountContext | null
  body: unknown
  deps: HandleDeps
}): Promise<Response> {
  const orgId = input.account?.organization?.id
  if (!input.account?.user) return jsonResponse({ error: 'Not authenticated' }, 401)
  if (!orgId) return jsonResponse({ error: 'No active organization' }, 403)
  if (!canManage(input.account)) {
    return jsonResponse({ error: 'Owner/admin only', code: 'forbidden' }, 403)
  }

  const body = asRecord(input.body)
  if (!isProvider(body.provider)) {
    return jsonResponse({ error: 'Unknown provider', code: 'invalid_provider' }, 400)
  }
  const key = typeof body.key === 'string' ? body.key.trim() : ''
  if (!key) {
    return jsonResponse({ error: 'Key is required', code: 'invalid_key' }, 400)
  }

  if (!(await input.deps.isByokEntitled(orgId))) {
    return jsonResponse(
      { error: 'Bring-your-own-key is available on Plus and above.', code: 'not_entitled' },
      403,
    )
  }

  const result = await input.deps.persist({
    organizationId: orgId,
    provider: body.provider,
    plaintextKey: key,
    label: typeof body.label === 'string' ? body.label : null,
    modelDefault: typeof body.modelDefault === 'string' ? body.modelDefault : null,
    createdByUserId: input.account.user.id,
  })

  return jsonResponse(
    { ok: true, key: { provider: result.provider, lastFour: result.lastFour, status: result.status } },
    200,
  )
}

export async function handleDelete(input: {
  account: AccountContext | null
  body: unknown
  deps: HandleDeps
}): Promise<Response> {
  const orgId = input.account?.organization?.id
  if (!input.account?.user) return jsonResponse({ error: 'Not authenticated' }, 401)
  if (!orgId) return jsonResponse({ error: 'No active organization' }, 403)
  if (!canManage(input.account)) {
    return jsonResponse({ error: 'Owner/admin only', code: 'forbidden' }, 403)
  }

  const body = asRecord(input.body)
  if (!isProvider(body.provider)) {
    return jsonResponse({ error: 'Unknown provider', code: 'invalid_provider' }, 400)
  }
  const revoked = await input.deps.revoke(orgId, body.provider)
  return jsonResponse({ ok: true, revoked }, 200)
}

// ── Real-deps assembly ──────────────────────────────────────────────────────

function buildDeps(locals: App.Locals): HandleDeps {
  const db = locals.db
  const encryptionKey =
    (env as unknown as { BASEOUT_ENCRYPTION_KEY?: string }).BASEOUT_ENCRYPTION_KEY ?? ''
  return {
    listKeys: async (organizationId) =>
      db
        .select({
          provider: aiProviderKeys.provider,
          label: aiProviderKeys.label,
          modelDefault: aiProviderKeys.modelDefault,
          lastFour: aiProviderKeys.lastFour,
          status: aiProviderKeys.status,
          lastValidatedAt: aiProviderKeys.lastValidatedAt,
        })
        .from(aiProviderKeys)
        .where(eq(aiProviderKeys.organizationId, organizationId))
        .orderBy(aiProviderKeys.provider),
    isByokEntitled: async (organizationId) => {
      const resolution = await resolveEntitlements(db, organizationId)
      if (!resolution) return false
      try {
        return getBool(resolution.entitlements, 'byo_ai_key')
      } catch {
        return false
      }
    },
    persist: (inputs) => persistProviderKey(db, encryptionKey, inputs),
    revoke: async (organizationId, provider) => {
      const updated = await db
        .update(aiProviderKeys)
        .set({ status: 'disabled', modifiedAt: new Date() })
        .where(
          and(
            eq(aiProviderKeys.organizationId, organizationId),
            eq(aiProviderKeys.provider, provider),
            eq(aiProviderKeys.status, 'active'),
          ),
        )
        .returning({ id: aiProviderKeys.id })
      return updated.length > 0
    },
  }
}

export const GET: APIRoute = async ({ locals }) =>
  handleGet({ account: locals.account, deps: buildDeps(locals) })

export const POST: APIRoute = async ({ locals, request }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  return handlePost({ account: locals.account, body, deps: buildDeps(locals) })
}

export const DELETE: APIRoute = async ({ locals, request }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  return handleDelete({ account: locals.account, body, deps: buildDeps(locals) })
}
