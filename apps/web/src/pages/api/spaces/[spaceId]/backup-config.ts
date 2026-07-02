/**
 * PATCH /api/spaces/:spaceId/backup-config
 *
 * Updates the backup_configurations row's `frequency` and / or `storageType`
 * for a Space. Validates the body against the org's tier capability per
 * Features §6.1 and the MVP storage rule (only `r2_managed` accepted).
 *
 * Body: `{ frequency?: Frequency; storageType?: 'r2_managed' }`. At least
 * one field required. Unknown keys → 400 invalid_request.
 *
 * Same pattern as backup-runs.ts: a testable handlePatch inner function
 * takes all deps as arguments; the Astro PATCH wrapper wires real Drizzle
 * + cloudflare:workers. Tests import handlePatch directly with vi.fn() deps.
 */

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { and, eq, sql } from 'drizzle-orm'
import {
  backupConfigurations,
  spaces,
} from '../../../../db/schema'
import type { AccountContext } from '../../../../lib/account'
import type { AppDb } from '../../../../db'
import {
  persistBackupConfigPolicy,
  type UpsertConfigInput,
} from '../../../../lib/backup-config/persist-policy'
import { resolveCapabilities } from '../../../../lib/capabilities/resolve'
import type { Tier } from '../../../../lib/capabilities/tier-capabilities'
import { createBackupEngine, type SpaceScheduleInput } from '../../../../lib/backup-engine'
import { promoteSpaceIfSetupIncomplete } from '../../../../lib/spaces'

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
  upsertConfig: (input: UpsertConfigInput) => Promise<void>
  /**
   * Called after a successful upsert when the body touched any schedule field
   * (scope / frequency / schemaFrequency). Forwards the FULL post-upsert
   * schedule (read via `fetchScheduleForSpace`) to the engine's
   * /api/internal/spaces/:spaceId/set-frequency proxy, which drives the
   * per-Space DO's alarm(s) + writes the next-scheduled columns
   * (server-backup-scope). May be null when the engine binding isn't wired —
   * the bootstrap script re-arms on the next run. Best-effort.
   */
  onScheduledFrequencyChange:
    | ((spaceId: string, schedule: SpaceScheduleInput) => Promise<void>)
    | null
  /**
   * Reads the current (post-upsert) schedule so the engine always receives the
   * complete picture even on a partial PATCH. Returns null if no config row
   * exists yet.
   */
  fetchScheduleForSpace: (spaceId: string) => Promise<SpaceScheduleInput | null>
  /**
   * Setup-complete promotion. Called after a successful upsert with the
   * spaceId. Implementation flips spaces.status from 'setup_incomplete'
   * to 'active' (idempotent — no-op if the row is already active). The
   * dashboard reads spaces.status to decide whether to nag the user with
   * "Connect your first base", so without this flip the prompt persists
   * forever even after the user has finished setup. Errors here are
   * swallowed (mirrors onScheduledFrequencyChange): the config is the
   * load-bearing write, the status flip is presentation.
   */
  promoteSpaceIfReady: (spaceId: string) => Promise<void>
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

  const result = await persistBackupConfigPolicy(
    { spaceId: input.spaceId, body: input.body, tier },
    { upsertConfig: input.upsertConfig },
  )

  if (result.ok) {
    // After a successful upsert, hand off to the SpaceDO via the engine proxy
    // when the body touched any schedule field. We send the FULL post-upsert
    // schedule (scope + both cadences) so the engine computes both fires
    // correctly even on a partial PATCH. Engine failures are swallowed — the
    // bootstrap script catches up later (server-backup-scope).
    const touchedSchedule =
      'scope' in input.body ||
      'frequency' in input.body ||
      'schemaFrequency' in input.body
    if (input.onScheduledFrequencyChange && touchedSchedule) {
      try {
        const schedule = await input.fetchScheduleForSpace(input.spaceId)
        if (schedule) {
          await input.onScheduledFrequencyChange(input.spaceId, schedule)
        }
      } catch {
        // Best-effort. The config is already persisted; the alarm can be
        // re-armed by the bootstrap script.
      }
    }
    // Setup-complete promotion. Best-effort: the config save is the
    // load-bearing write, the status flip is dashboard presentation.
    try {
      await input.promoteSpaceIfReady(input.spaceId)
    } catch {
      // Swallow — the flip can be re-attempted on the next save.
    }
    return jsonResponse({ ok: true }, 200)
  }
  switch (result.error) {
    case 'invalid_request':
      return jsonResponse({ error: 'invalid_request' }, 400)
    case 'frequency_not_allowed':
      return jsonResponse({ error: 'frequency_not_allowed' }, 422)
    case 'unsupported_storage_type':
      return jsonResponse({ error: 'unsupported_storage_type' }, 422)
  }
}

// ── Astro APIRoute wrapper ───────────────────────────────────────────────

function buildUpsert(db: AppDb): (input: UpsertConfigInput) => Promise<void> {
  return async (upsert) => {
    const now = new Date()
    // Insert with defaults for missing fields, ON CONFLICT update only the
    // fields actually present in the input. Drizzle's onConflictDoUpdate
    // takes a `set` object — use COALESCE-style fallbacks so absent fields
    // don't blow away previously-stored values.
    const insertValues: typeof backupConfigurations.$inferInsert = {
      spaceId: upsert.spaceId,
    }
    if (upsert.frequency !== undefined) insertValues.frequency = upsert.frequency
    if (upsert.storageType !== undefined) insertValues.storageType = upsert.storageType
    if (upsert.autoAddFutureBases !== undefined) {
      insertValues.autoAddFutureBases = upsert.autoAddFutureBases
    }
    if (upsert.scope !== undefined) insertValues.scope = upsert.scope
    if (upsert.schemaFrequency !== undefined) {
      insertValues.schemaFrequency = upsert.schemaFrequency
    }

    await db
      .insert(backupConfigurations)
      .values(insertValues)
      .onConflictDoUpdate({
        target: backupConfigurations.spaceId,
        set: {
          ...(upsert.frequency !== undefined && { frequency: upsert.frequency }),
          ...(upsert.storageType !== undefined && { storageType: upsert.storageType }),
          ...(upsert.autoAddFutureBases !== undefined && {
            autoAddFutureBases: upsert.autoAddFutureBases,
          }),
          ...(upsert.scope !== undefined && { scope: upsert.scope }),
          ...(upsert.schemaFrequency !== undefined && {
            schemaFrequency: upsert.schemaFrequency,
          }),
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
    upsertConfig: buildUpsert(db),
    onScheduledFrequencyChange: buildScheduledFrequencyHandoff(),
    fetchScheduleForSpace: async (id) => {
      const [row] = await db
        .select({
          scope: backupConfigurations.scope,
          dataFrequency: backupConfigurations.frequency,
          schemaFrequency: backupConfigurations.schemaFrequency,
        })
        .from(backupConfigurations)
        .where(eq(backupConfigurations.spaceId, id))
        .limit(1)
      return row
        ? {
            scope: row.scope,
            dataFrequency: row.dataFrequency,
            schemaFrequency: row.schemaFrequency,
          }
        : null
    },
    promoteSpaceIfReady: (spaceId) => promoteSpaceIfSetupIncomplete(db, spaceId),
  })
}

/**
 * Build the engine-proxy callback that hands new scheduled frequencies
 * off to the SpaceDO. Returns null when the BACKUP_ENGINE binding or
 * INTERNAL_TOKEN is missing — in that environment the schedule won't be
 * armed until the bootstrap script runs.
 */
function buildScheduledFrequencyHandoff():
  | ((spaceId: string, schedule: SpaceScheduleInput) => Promise<void>)
  | null {
  if (!env.BACKUP_ENGINE || !env.BACKUP_ENGINE_INTERNAL_TOKEN) return null
  const engine = createBackupEngine({
    binding: env.BACKUP_ENGINE,
    internalToken: env.BACKUP_ENGINE_INTERNAL_TOKEN,
  })
  return async (spaceId, schedule) => {
    await engine.setSpaceFrequency(spaceId, schedule)
  }
}

export const POST: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const GET: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const PUT: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)
export const DELETE: APIRoute = async () =>
  jsonResponse({ error: 'method_not_allowed' }, 405)

// Quiet TS6133: `and` and `sql` are imports kept for future query helpers
// that the upsert may need (e.g. concurrency-safe updates). Not load-
// bearing today.
void and
void sql
