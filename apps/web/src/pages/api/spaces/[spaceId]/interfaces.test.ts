/**
 * Tests for handleInterfaces (interfaces proxy).
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleInterfaces } = await import('./interfaces')

import type { AccountContext } from '../../../../lib/account'
import type { GetInterfacesResult, MutateInterfaceResult } from '../../../../lib/backup-engine'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'

function makeAccount(): AccountContext {
  return {
    user: { id: 'u_1', name: 'Ada', email: 'ada@example.com', image: null },
    organization: { id: ORG_ID, name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: { id: SPACE_ID, name: 'Acme', status: 'active' },
    spaces: [{ id: SPACE_ID, name: 'Acme', status: 'active' }],
  } as AccountContext
}

const inOrg = vi.fn(async () => ({ id: SPACE_ID, organizationId: ORG_ID }))
const manual = vi.fn(async () => 'manual' as const)

const baseInput = {
  account: makeAccount(),
  spaceId: SPACE_ID,
  baseId: null as string | null,
  includeRemoved: false,
  parseBody: async () => ({}),
  fetchSpace: inOrg,
  resolveLevel: manual,
}

describe('handleInterfaces', () => {
  it('401 when unauthenticated', async () => {
    const res = await handleInterfaces({
      ...baseInput,
      account: null,
      method: 'GET',
      getEngine: vi.fn(),
      mutateEngine: vi.fn(),
    })
    expect(res.status).toBe(401)
  })

  it('503 when the engine binding is unconfigured', async () => {
    const res = await handleInterfaces({
      ...baseInput,
      method: 'GET',
      getEngine: null,
      mutateEngine: null,
    })
    expect(res.status).toBe(503)
  })

  it('GET returns interfaces', async () => {
    const interfaces = [{ id: 'i1', type: 'interface', name: 'App' }]
    const getEngine = vi.fn(
      async (): Promise<GetInterfacesResult> =>
        ({ ok: true, interfaces }) as GetInterfacesResult,
    )
    const res = await handleInterfaces({
      ...baseInput,
      method: 'GET',
      getEngine,
      mutateEngine: null,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, interfaces })
  })

  it('POST type=page without parentId → 400 invalid_parent', async () => {
    const mutateEngine = vi.fn()
    const res = await handleInterfaces({
      ...baseInput,
      method: 'POST',
      parseBody: async () => ({ baseId: 'appX', type: 'page', name: 'P' }),
      getEngine: null,
      mutateEngine,
    })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe('invalid_parent')
    expect(mutateEngine).not.toHaveBeenCalled()
  })

  it('POST type=page with parentId forwards create', async () => {
    const mutateEngine = vi.fn(
      async (): Promise<MutateInterfaceResult> =>
        ({ ok: true, interface: { id: 'p1' } }) as MutateInterfaceResult,
    )
    const res = await handleInterfaces({
      ...baseInput,
      method: 'POST',
      parseBody: async () => ({
        baseId: 'appX',
        type: 'page',
        parentId: 'pbdApp',
        name: 'Overview',
      }),
      getEngine: null,
      mutateEngine,
    })
    expect(res.status).toBe(200)
    expect(mutateEngine).toHaveBeenCalledWith(
      SPACE_ID,
      expect.objectContaining({ action: 'create', type: 'page', parentId: 'pbdApp' }),
    )
  })

  it('maps engine not_found to 404', async () => {
    const mutateEngine = vi.fn(
      async (): Promise<MutateInterfaceResult> => ({
        ok: false,
        code: 'not_found',
        status: 404,
      }),
    )
    const res = await handleInterfaces({
      ...baseInput,
      method: 'DELETE',
      parseBody: async () => ({ id: 'missing' }),
      getEngine: null,
      mutateEngine,
    })
    expect(res.status).toBe(404)
  })
})
