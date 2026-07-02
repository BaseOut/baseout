/**
 * PATCH /api/spaces/:spaceId/retention-policy
 *
 * Persists the Space's backup retention policy (server-retention-and-cleanup
 * Phase E). Validates the incoming knobs against the org's tier capability via
 * parseRetentionPolicy (rejects edits that exceed the tier's min/max), then
 * UPSERTs the backup_retention_policies row the cleanup engine prunes against.
 *
 * Same pattern as backup-config.ts: a testable handlePatch(input) inner function
 * takes all deps as arguments; the Astro PATCH wrapper wires real Drizzle. Tests
 * import handlePatch directly with vi.fn() deps. No engine binding needed — this
 * is a pure control-plane write.
 *
 * Wire shapes:
 *   200 { ok: true, policy }
 *   400 { error: 'invalid_request' } | { error: 'knob_out_of_range', field }
 *   401 { error: 'Not authenticated' }
 *   403 { error: 'space_not_found' | 'space_org_mismatch' }
 */

import type { APIRoute } from 'astro'
import { eq } from 'drizzle-orm'
import { backupRetentionPolicies, spaces } from '../../../../db/schema'
import type { AccountContext } from '../../../../lib/account'
import type { AppDb } from '../../../../db'
import type { Tier } from '../../../../lib/capabilities/tier-capabilities'
import { resolveCapabilities } from '../../../../lib/capabilities/resolve'
import {
  parseRetentionPatchPayload,
  type RetentionPolicyValues,
} from '../../../../lib/capabilities/retention'

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

export interface HandlePatchInput {
  account: AccountContext | null
  spaceId: string | undefined
  body: Record<string, unknown> | null
  fetchSpaceById: (spaceId: string) => Promise<SpaceRowSlim | null>
  resolveTier: (organizationId: string) => Promise<Tier | null>
  upsertPolicy: (
    values: RetentionPolicyValues & { spaceId: string },
  ) => Promise<void>
}

export async function handlePatch(input: HandlePatchInput): Promise<Response> {
  if (!input.account?.organization?.id || !input.account?.user?.id) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  if (!input.spaceId || !UUID_RE.test(input.spaceId)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }
  if (!input.body || typeof input.body !== 'object' || Array.isArray(input.body)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }

  const space = await input.fetchSpaceById(input.spaceId)
  if (!space) {
    return jsonResponse({ error: 'space_not_found' }, 403)
  }
  if (space.organizationId !== input.account.organization.id) {
    return jsonResponse({ error: 'space_org_mismatch' }, 403)
  }

  const tier = await input.resolveTier(input.account.organization.id)
  const parsed = parseRetentionPatchPayload(tier, input.body)
  if (!parsed.ok) {
    return jsonResponse({ error: 'knob_out_of_range', field: parsed.field }, 400)
  }

  await input.upsertPolicy({ spaceId: input.spaceId, ...parsed.values })
  return jsonResponse({ ok: true, policy: parsed.values }, 200)
}

// ── Astro APIRoute wrapper ───────────────────────────────────────────────

function buildUpsert(
  db: AppDb,
): (values: RetentionPolicyValues & { spaceId: string }) => Promise<void> {
  return async ({ spaceId, ...values }) => {
    const now = new Date()
    await db
      .insert(backupRetentionPolicies)
      .values({
        spaceId,
        policyTier: values.tier,
        keepLastN: values.keepLastN ?? null,
        dailyWindowDays: values.dailyWindowDays ?? null,
        weeklyWindowDays: values.weeklyWindowDays ?? null,
        monthlyIndefinite: values.monthlyIndefinite ?? false,
        customRules: values.customRules ?? null,
      })
      .onConflictDoUpdate({
        target: backupRetentionPolicies.spaceId,
        set: {
          policyTier: values.tier,
          keepLastN: values.keepLastN ?? null,
          dailyWindowDays: values.dailyWindowDays ?? null,
          weeklyWindowDays: values.weeklyWindowDays ?? null,
          monthlyIndefinite: values.monthlyIndefinite ?? false,
          customRules: values.customRules ?? null,
          modifiedAt: now,
        },
      })
  }
}

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const db = locals.db
  if (!db) return jsonResponse({ error: 'Database not initialized' }, 500)

  let body: Record<string, unknown> | null = null
  try {
    const text = await request.text()
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  return handlePatch({
    account: locals.account ?? null,
    spaceId: params.spaceId,
    body,
    fetchSpaceById: async (id) => {
      const [row] = await db
        .select({ id: spaces.id, organizationId: spaces.organizationId })
        .from(spaces)
        .where(eq(spaces.id, id))
        .limit(1)
      return (row as SpaceRowSlim | undefined) ?? null
    },
    resolveTier: async (orgId) => {
      const resolved = await resolveCapabilities(db, orgId, 'airtable')
      return resolved.tier
    },
    upsertPolicy: buildUpsert(db),
  })
}

export const GET: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const POST: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const PUT: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const DELETE: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
