/**
 * Tests for the testable inner handler (handlePost) in rescan-bases.ts.
 * The Astro APIRoute wrapper (POST) wires real Drizzle + cloudflare:workers
 * env at runtime; the inner handler takes all deps as arguments so vitest
 * can run them in plain Node with vi.fn() stubs.
 *
 * `cloudflare:workers` is mocked here because importing the route file
 * pulls the static `env` import. We never invoke buildEngine() in tests.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handlePost } = await import('./rescan-bases')

import type { AccountContext } from '../../../../lib/account'
import type { EngineRescanBasesResult } from '../../../../lib/backup-engine'
import type { SpaceRowSlim } from './rescan-bases'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'

function makeAccount(overrides: Partial<AccountContext> = {}): AccountContext {
  return {
    user: {
      id: 'u_1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      image: null,
    },
    organization: { id: ORG_ID, name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: { id: SPACE_ID, name: 'Acme', status: 'active' },
    spaces: [{ id: SPACE_ID, name: 'Acme', status: 'active' }],
    ...overrides,
  } as AccountContext
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

describe('handlePost — auth + IDOR guards', () => {
  it('returns 401 when no account', async () => {
    const res = await handlePost({
      account: null,
      spaceId: SPACE_ID,
      fetchSpaceById: vi.fn(),
      engineRescan: vi.fn(),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 for non-UUID spaceId', async () => {
    const res = await handlePost({
      account: makeAccount(),
      spaceId: 'not-a-uuid',
      fetchSpaceById: vi.fn(),
      engineRescan: vi.fn(),
    })
    expect(res.status).toBe(400)
    expect((await readJson(res)).error).toBe('invalid_request')
  })

  it('returns 403 space_not_found when the Space row is missing', async () => {
    const fetchSpaceById = vi.fn(async () => null)
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      fetchSpaceById,
      engineRescan: vi.fn(),
    })
    expect(res.status).toBe(403)
    expect((await readJson(res)).error).toBe('space_not_found')
  })

  it('returns 403 space_org_mismatch when the Space is in another org', async () => {
    const fetchSpaceById = vi.fn(async () => ({
      id: SPACE_ID,
      organizationId: 'someone-elses-org',
    }))
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      fetchSpaceById,
      engineRescan: vi.fn(),
    })
    expect(res.status).toBe(403)
    expect((await readJson(res)).error).toBe('space_org_mismatch')
  })
})

describe('handlePost — engine forwarding', () => {
  function setupOk(): {
    fetchSpaceById: ((spaceId: string) => Promise<SpaceRowSlim | null>) & {
      mock: ReturnType<typeof vi.fn>['mock']
    }
    engineRescan: ((spaceId: string) => Promise<EngineRescanBasesResult>) & {
      mock: ReturnType<typeof vi.fn>['mock']
    }
  } {
    return {
      fetchSpaceById: vi.fn(async () => ({
        id: SPACE_ID,
        organizationId: ORG_ID,
      })),
      engineRescan: vi.fn(
        async (): Promise<EngineRescanBasesResult> => ({
          ok: true,
          discovered: 3,
          autoAdded: 2,
          blockedByTier: 1,
        }),
      ),
    }
  }

  it('200s with the engine result body on success', async () => {
    const { fetchSpaceById, engineRescan } = setupOk()
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      fetchSpaceById,
      engineRescan,
    })
    expect(res.status).toBe(200)
    expect(await readJson(res)).toEqual({
      ok: true,
      discovered: 3,
      autoAdded: 2,
      blockedByTier: 1,
    })
    expect(engineRescan).toHaveBeenCalledWith(SPACE_ID)
  })

  it('returns 503 when the engine binding is not configured (engineRescan=null)', async () => {
    const fetchSpaceById = vi.fn(async () => ({
      id: SPACE_ID,
      organizationId: ORG_ID,
    }))
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      fetchSpaceById,
      engineRescan: null,
    })
    expect(res.status).toBe(503)
    expect((await readJson(res)).error).toBe('server_misconfigured')
  })

  it('passes engine error codes through with mapped HTTP status', async () => {
    const fetchSpaceById = vi.fn(async () => ({
      id: SPACE_ID,
      organizationId: ORG_ID,
    }))
    const engineRescan = vi.fn(
      async (): Promise<EngineRescanBasesResult> => ({
        ok: false,
        code: 'connection_not_found',
        status: 409,
      }),
    )
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      fetchSpaceById,
      engineRescan,
    })
    expect(res.status).toBe(409)
    expect((await readJson(res)).error).toBe('connection_not_found')
  })

  it('reports engine_unreachable as 502', async () => {
    const fetchSpaceById = vi.fn(async () => ({
      id: SPACE_ID,
      organizationId: ORG_ID,
    }))
    const engineRescan = vi.fn(
      async (): Promise<EngineRescanBasesResult> => ({
        ok: false,
        code: 'engine_unreachable',
        status: 0,
      }),
    )
    const res = await handlePost({
      account: makeAccount(),
      spaceId: SPACE_ID,
      fetchSpaceById,
      engineRescan,
    })
    expect(res.status).toBe(502)
    expect((await readJson(res)).error).toBe('engine_unreachable')
  })
})
