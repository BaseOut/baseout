/**
 * Tests for handleAutomations (automations proxy). Guard coverage lives in
 * lib/schema-docs/proxy.test.ts; this pins route glue: 401, 503, GET/POST/
 * PATCH/DELETE mapping, engine error passthrough.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleAutomations } = await import('./automations')

import type { AccountContext } from '../../../../lib/account'
import type { GetAutomationsResult, MutateAutomationResult } from '../../../../lib/backup-engine'

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

describe('handleAutomations', () => {
  it('401 when unauthenticated', async () => {
    const res = await handleAutomations({
      ...baseInput,
      account: null,
      method: 'GET',
      getEngine: vi.fn(),
      mutateEngine: vi.fn(),
    })
    expect(res.status).toBe(401)
  })

  it('503 when the engine binding is unconfigured (GET)', async () => {
    const res = await handleAutomations({
      ...baseInput,
      method: 'GET',
      getEngine: null,
      mutateEngine: null,
    })
    expect(res.status).toBe(503)
  })

  it('GET returns automations and forwards includeRemoved', async () => {
    const automations = [{ id: 'a1', name: 'On create' }]
    const getEngine = vi.fn(
      async (): Promise<GetAutomationsResult> =>
        ({ ok: true, automations }) as GetAutomationsResult,
    )
    const res = await handleAutomations({
      ...baseInput,
      method: 'GET',
      baseId: 'appX',
      includeRemoved: true,
      getEngine,
      mutateEngine: null,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, automations })
    expect(getEngine).toHaveBeenCalledWith(SPACE_ID, 'appX', true)
  })

  it('POST create maps to mutateEngine action=create', async () => {
    const mutateEngine = vi.fn(
      async (): Promise<MutateAutomationResult> =>
        ({ ok: true, automation: { id: 'a1' } }) as MutateAutomationResult,
    )
    const res = await handleAutomations({
      ...baseInput,
      method: 'POST',
      parseBody: async () => ({ baseId: 'appX', name: 'N', airtableEntityId: 'aut1' }),
      getEngine: null,
      mutateEngine,
    })
    expect(res.status).toBe(200)
    expect(mutateEngine).toHaveBeenCalledWith(
      SPACE_ID,
      expect.objectContaining({ action: 'create', baseId: 'appX' }),
    )
  })

  it('POST without baseId → 400', async () => {
    const mutateEngine = vi.fn()
    const res = await handleAutomations({
      ...baseInput,
      method: 'POST',
      parseBody: async () => ({ name: 'N' }),
      getEngine: null,
      mutateEngine,
    })
    expect(res.status).toBe(400)
    expect(mutateEngine).not.toHaveBeenCalled()
  })

  it('PATCH / DELETE require id', async () => {
    const mutateEngine = vi.fn()
    const patch = await handleAutomations({
      ...baseInput,
      method: 'PATCH',
      parseBody: async () => ({ name: 'x' }),
      getEngine: null,
      mutateEngine,
    })
    expect(patch.status).toBe(400)

    const del = await handleAutomations({
      ...baseInput,
      method: 'DELETE',
      parseBody: async () => ({}),
      getEngine: null,
      mutateEngine,
    })
    expect(del.status).toBe(400)
  })

  it('maps engine duplicate_entity to 409', async () => {
    const mutateEngine = vi.fn(
      async (): Promise<MutateAutomationResult> => ({
        ok: false,
        code: 'duplicate_entity',
        status: 409,
      }),
    )
    const res = await handleAutomations({
      ...baseInput,
      method: 'POST',
      parseBody: async () => ({ baseId: 'appX', airtableEntityId: 'aut1' }),
      getEngine: null,
      mutateEngine,
    })
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toBe('duplicate_entity')
  })
})
