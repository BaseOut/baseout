/**
 * system-test-harness-spike — the one scenario no existing test can express:
 *
 *   Node test ──fetch──▶ spike-consumer Worker (real createBackupEngine client)
 *                         └─SERVER service binding (harness-wired)──▶
 *                           apps/server Worker (SERVER_INTERNAL_TOKEN middleware,
 *                           real Postgres read, ConnectionDO /token decrypt)
 *                             └─outbound fetch api.airtable.com──▶ MSW mock
 *
 * Everything on that path is production code: the web-side client
 * (src/lib/backup-engine.ts), the server entry (apps/server/src/index.ts),
 * its middleware, the whoami handler, and ConnectionDO. Only the consumer
 * Worker shell and the Airtable response are fixtures.
 *
 * Postgres: uses the Docker test DB when it's already on 5432
 * (`pnpm --filter @baseout/web test:db:up`); otherwise globalSetup boots a
 * disposable embedded PostgreSQL 16. Migrations apply either way.
 *
 * Findings + adoption recommendation:
 * openspec/changes/system-test-harness-spike/README.md
 */

import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createTestHarness } from 'wrangler'
import { createDb } from '../../src/db'
import { connections, organizations, platforms, users } from '../../src/db/schema'
import { eq } from 'drizzle-orm'

const DB_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/baseout_test'

// Must match spike-consumer.wrangler.jsonc's SERVER_INTERNAL_TOKEN.
const SERVER_INTERNAL_TOKEN = 'test-only-internal-token-min-32-chars-aaaa'

// Test-only 32-byte AES key, base64 (0x07 repeated). The server Worker gets
// the same key, so ciphertext seeded here decrypts in ConnectionDO.
const ENC_KEY = Buffer.alloc(32, 7).toString('base64')

const AIRTABLE_USER_ID = 'usrSpikeHarness'

/**
 * AES-256-GCM `base64(iv(12) || ciphertext+tag)` — byte-for-byte the format
 * of apps/server/src/lib/crypto.ts `encryptToken` / apps/web/src/lib/crypto.ts
 * (canonical writers). Inlined because those modules target workerd globals
 * in their apps' tsconfigs; Web Crypto is identical in Node ≥ 20.
 */
async function encryptToken(plaintext: string, keyB64: string): Promise<string> {
  const raw = Buffer.from(keyB64, 'base64')
  const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
  ])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)),
  )
  const blob = new Uint8Array(iv.length + cipher.length)
  blob.set(iv, 0)
  blob.set(cipher, iv.length)
  return Buffer.from(blob).toString('base64')
}

// MSW intercepts the server Worker's outbound fetch — the harness proxies
// Workers' outbound requests through this Node process's dispatcher, so
// plain msw/node works with no harness-specific wiring.
const network = setupServer(
  http.get('https://api.airtable.com/v0/meta/whoami', ({ request }) => {
    const auth = request.headers.get('authorization')
    if (auth !== 'Bearer spike-access-token') {
      return HttpResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }
    return HttpResponse.json({
      id: AIRTABLE_USER_ID,
      scopes: ['data.records:read', 'schema.bases:read'],
      email: 'spike@example.invalid',
    })
  }),
)

const server = createTestHarness({
  workers: [
    // First worker = primary → harness.fetch() dispatches here.
    { configPath: new URL('./fixtures/spike-consumer.wrangler.jsonc', import.meta.url) },
    {
      configPath: new URL('../../../server/wrangler.test.jsonc', import.meta.url),
      // `vars` override the config; `secrets` additionally override anything
      // loaded from apps/server/.dev.vars, so a developer's real local
      // secrets can never leak into (or break) this test.
      vars: {
        SERVER_INTERNAL_TOKEN,
        DATABASE_URL: DB_URL,
        BASEOUT_ENCRYPTION_KEY: ENC_KEY,
        TRIGGER_SECRET_KEY: 'tr_dev_test_unused',
        TRIGGER_PROJECT_REF: 'proj_test_unused',
        AIRTABLE_OAUTH_CLIENT_ID: 'test-airtable-client-id',
        AIRTABLE_OAUTH_CLIENT_SECRET: 'test-airtable-client-secret',
        // Force the ConnectionDO /token legacy decrypt path (no refresh).
        AIRTABLE_ON_DEMAND_REFRESH_ENABLED: '0',
      },
      secrets: {
        SERVER_INTERNAL_TOKEN,
        DATABASE_URL: DB_URL,
        BASEOUT_ENCRYPTION_KEY: ENC_KEY,
        AIRTABLE_ON_DEMAND_REFRESH_ENABLED: '0',
      },
    },
  ],
})

const { db, sql } = createDb(DB_URL)

async function seedActiveConnection(): Promise<{ connectionId: string }> {
  const userId = randomUUID()
  const organizationId = randomUUID()
  const now = new Date()
  await db.insert(users).values({
    id: userId,
    name: 'Harness Spike User',
    email: `harness-spike-${userId}@example.invalid`,
    emailVerified: true,
    termsAcceptedAt: now,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert(organizations).values({
    id: organizationId,
    name: 'Harness Spike Org',
    slug: `harness-spike-${organizationId.slice(0, 8)}`,
    runtimeEnv: 'dev',
  })
  // platforms.slug is unique and other suites truncate/seed it — reuse if present.
  const existing = await db
    .select({ id: platforms.id })
    .from(platforms)
    .where(eq(platforms.slug, 'airtable'))
    .limit(1)
  let platformId = existing[0]?.id
  if (!platformId) {
    platformId = randomUUID()
    await db.insert(platforms).values({
      id: platformId,
      slug: 'airtable',
      code: 'at',
      name: 'Airtable',
      websiteUrl: 'https://airtable.com',
    })
  }
  const connectionId = randomUUID()
  await db.insert(connections).values({
    id: connectionId,
    organizationId,
    platformId,
    createdByUserId: userId,
    scope: 'organization',
    accessTokenEnc: await encryptToken('spike-access-token', ENC_KEY),
    status: 'active',
  })
  return { connectionId }
}

// ——— SPIKE FINDING (wrangler 4.112.0, see change README §limitations) ———
// The harness's outbound proxy calls `globalThis.fetch(request.url, request)`
// with a Request built by miniflare's bundled undici. Headers survive a
// native `new Request(url, foreignRequest)` conversion, but MSW's fetch
// interceptor normalizes the foreign init to `{}` — every outbound header
// (including `authorization`) reaches handlers as empty. This shim, installed
// AFTER `network.listen()` patches fetch, re-wraps the foreign Request into a
// native one so MSW sees the real headers. Remove once fixed upstream.
let unshimFetch: (() => void) | null = null
function shimForeignRequestFetch(): void {
  const mswFetch = globalThis.fetch
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (init && !(init instanceof Request) && init.constructor?.name === '_Request') {
      return mswFetch(new Request(String(input), init))
    }
    return mswFetch(input, init)
  }) as typeof fetch
  unshimFetch = () => {
    globalThis.fetch = mswFetch
  }
}

beforeAll(async () => {
  network.listen()
  shimForeignRequestFetch()
  await server.listen()
})

afterAll(async () => {
  unshimFetch?.()
  network.close()
  await server.close()
  await sql.end({ timeout: 5 })
})

describe('createTestHarness spike: web client → SERVER binding → server → MSW Airtable', () => {
  it('resolves whoami end-to-end through the real service binding', async () => {
    const { connectionId } = await seedActiveConnection()

    const res = await server.fetch(`/spike/whoami/${connectionId}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      connectionId?: string
      airtable?: { id: string; scopes: string[]; email?: string }
    }
    expect(body).toMatchObject({
      ok: true,
      connectionId,
      airtable: { id: AIRTABLE_USER_ID, email: 'spike@example.invalid' },
    })
  })

  it('maps a missing connection to connection_not_found across the binding', async () => {
    const res = await server.fetch(`/spike/whoami/${randomUUID()}`)
    expect(res.status).toBe(200) // consumer always answers 200; result carries the error
    const body = (await res.json()) as { ok: boolean; code?: string; status?: number }
    expect(body).toMatchObject({ ok: false, code: 'connection_not_found', status: 404 })
  })

  it('captures Workers runtime logs', () => {
    // Smoke-check the observability surface exists at runtime.
    expect(Array.isArray(server.getLogs())).toBe(true)
  })
})
