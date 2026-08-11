/**
 * Tests for handleRelationships (web-relationships-tab read proxy). The guard +
 * error-status mapper are covered in lib/schema-docs/proxy.test.ts; this pins the
 * route glue: 401, missing baseId (400), 503 unconfigured, result mapping,
 * engine error passthrough.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleRelationships } = await import('./relationships')

import type { AccountContext } from '../../../../lib/account'
import type { GetRelationshipsResult } from '../../../../lib/backup-engine'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'
const BASE_ID = 'appABC'

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
  baseId: BASE_ID,
  includeDismissed: false,
  fetchSpace: inOrg,
  resolveLevel: manual,
}

describe('handleRelationships', () => {
  it('401 propagates from the guard when unauthenticated', async () => {
    const res = await handleRelationships({ ...baseInput, account: null, engine: vi.fn() })
    expect(res.status).toBe(401)
  })

  it('400 when baseId is missing', async () => {
    const engine = vi.fn()
    const res = await handleRelationships({ ...baseInput, baseId: null, engine })
    expect(res.status).toBe(400)
    expect(engine).not.toHaveBeenCalled()
  })

  it('503 when the engine binding is unconfigured', async () => {
    const res = await handleRelationships({ ...baseInput, engine: null })
    expect(res.status).toBe(503)
  })

  it('returns the engine derived + syncedViews and forwards includeDismissed', async () => {
    const derived = [{ id: 'linkedRecords:f1', type: 'linkedRecords' }]
    const syncedViews = [{ id: 's1', type: 'syncedViews', inferred: true }]
    const engine = vi.fn(
      async (): Promise<GetRelationshipsResult> => ({ ok: true, derived, syncedViews } as GetRelationshipsResult),
    )
    const res = await handleRelationships({ ...baseInput, includeDismissed: true, engine })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, derived, syncedViews })
    expect(engine).toHaveBeenCalledWith(SPACE_ID, BASE_ID, true)
  })

  it('maps an engine 501 to a 501 with the code', async () => {
    const engine = vi.fn(
      async (): Promise<GetRelationshipsResult> => ({ ok: false, code: 'backend_not_implemented', status: 501 }),
    )
    const res = await handleRelationships({ ...baseInput, engine })
    expect(res.status).toBe(501)
    expect(((await res.json()) as { error: string }).error).toBe('backend_not_implemented')
  })
})
