/**
 * Tests for handleRelationshipMutate (web-relationships-tab confirm/dismiss/
 * create proxy). Pins the route glue: 401, 503 unconfigured, action validation,
 * required-field validation, result mapping, engine error passthrough.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleRelationshipMutate } = await import('./relationship-mutate')

import type { AccountContext } from '../../../../lib/account'
import type { MutateRelationshipResult } from '../../../../lib/backup-engine'

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
  parseBody: async () => ({ action: 'confirm', id: 'cand1' }) as Record<string, unknown>,
  fetchSpace: inOrg,
  resolveLevel: manual,
}

describe('handleRelationshipMutate', () => {
  it('401 propagates from the guard when unauthenticated', async () => {
    const res = await handleRelationshipMutate({ ...baseInput, account: null, engine: vi.fn() })
    expect(res.status).toBe(401)
  })

  it('503 when the engine binding is unconfigured', async () => {
    const res = await handleRelationshipMutate({ ...baseInput, engine: null })
    expect(res.status).toBe(503)
  })

  it('400 on an unknown action', async () => {
    const engine = vi.fn()
    const res = await handleRelationshipMutate({
      ...baseInput,
      parseBody: async () => ({ action: 'frobnicate' }),
      engine,
    })
    expect(res.status).toBe(400)
    expect(engine).not.toHaveBeenCalled()
  })

  it('400 when confirm is missing an id', async () => {
    const engine = vi.fn()
    const res = await handleRelationshipMutate({
      ...baseInput,
      parseBody: async () => ({ action: 'confirm' }),
      engine,
    })
    expect(res.status).toBe(400)
    expect(engine).not.toHaveBeenCalled()
  })

  it('confirms and returns ok', async () => {
    const engine = vi.fn(async (): Promise<MutateRelationshipResult> => ({ ok: true }))
    const res = await handleRelationshipMutate({ ...baseInput, engine })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(engine).toHaveBeenCalledWith(SPACE_ID, { action: 'confirm', id: 'cand1' })
  })

  it('creates a user synced view and returns the id', async () => {
    const engine = vi.fn(async (): Promise<MutateRelationshipResult> => ({ ok: true, id: 'new1' }))
    const res = await handleRelationshipMutate({
      ...baseInput,
      parseBody: async () => ({ action: 'create', baseId: 'appX', sourceTableId: 'tA', destTableId: 'tB' }),
      engine,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, id: 'new1' })
  })

  it('maps an engine 404 to a 404 with the code', async () => {
    const engine = vi.fn(
      async (): Promise<MutateRelationshipResult> => ({ ok: false, code: 'document_not_found', status: 404 }),
    )
    const res = await handleRelationshipMutate({ ...baseInput, engine })
    expect(res.status).toBe(404)
  })
})
