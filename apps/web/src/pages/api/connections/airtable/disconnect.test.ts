/**
 * Tests for the testable inner handler (handlePost) in disconnect.ts.
 * Mirrors the rescan-bases.test.ts pattern: the Astro APIRoute wrapper wires
 * real Drizzle at runtime; the inner handler takes deps as arguments.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handlePost } = await import('./disconnect')

import type { AccountContext } from '../../../../lib/account'

const ORG_ID = '22222222-2222-2222-2222-222222222222'

function makeAccount(overrides: Partial<AccountContext> = {}): AccountContext {
  return {
    user: { id: 'u_1', name: 'Ada', email: 'ada@example.com', image: null },
    organization: { id: ORG_ID, name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: { id: 's_1', name: 'Acme', status: 'active' },
    spaces: [{ id: 's_1', name: 'Acme', status: 'active' }],
    ...overrides,
  } as AccountContext
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

describe('handlePost — Airtable disconnect', () => {
  it('401 when no account', async () => {
    const res = await handlePost({ account: null, disconnect: vi.fn() })
    expect(res.status).toBe(401)
  })

  it('401 when account has no organization', async () => {
    const res = await handlePost({
      account: makeAccount({ organization: undefined } as never),
      disconnect: vi.fn(),
    })
    expect(res.status).toBe(401)
  })

  it('disconnects the org Airtable connection and reports the count', async () => {
    const disconnect = vi.fn(async () => ({ disconnected: 1 }))
    const res = await handlePost({ account: makeAccount(), disconnect })
    expect(res.status).toBe(200)
    expect(await readJson(res)).toEqual({ ok: true, disconnected: 1 })
    expect(disconnect).toHaveBeenCalledWith(ORG_ID)
  })

  it('404 when the org has no active Airtable connection', async () => {
    const disconnect = vi.fn(async () => ({ disconnected: 0 }))
    const res = await handlePost({ account: makeAccount(), disconnect })
    expect(res.status).toBe(404)
    expect(await readJson(res)).toEqual({ error: 'no_airtable_connection' })
  })

  it('502 with a stable error body when the disconnect write throws', async () => {
    const disconnect = vi.fn(async () => {
      throw new Error('pg down')
    })
    const res = await handlePost({ account: makeAccount(), disconnect })
    expect(res.status).toBe(502)
    expect(await readJson(res)).toEqual({ error: 'disconnect_failed' })
  })
})
