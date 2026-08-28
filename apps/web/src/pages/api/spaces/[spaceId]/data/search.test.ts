/**
 * Record-search proxy (web-entity-deeplinks 1.3): guard propagation, q gate,
 * 503 without the engine, and engine result mapping.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleDataSearch } = await import('./search')

import type { AccountContext } from '../../../../../lib/account'
import type { DataSearchResult } from '../../../../../lib/backup-engine'

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

const baseInput = {
  account: makeAccount(),
  spaceId: SPACE_ID,
  q: 'acme',
  baseId: null,
  tableId: null,
  fetchSpace: vi.fn(async () => ({ id: SPACE_ID, organizationId: ORG_ID })),
  resolveLevel: vi.fn(async () => 'manual' as const),
}

describe('handleDataSearch', () => {
  it('401 unauthenticated; 400 blank q; 503 without engine', async () => {
    const engine = vi.fn()
    expect((await handleDataSearch({ ...baseInput, account: null, engine })).status).toBe(401)
    expect((await handleDataSearch({ ...baseInput, q: '  ', engine })).status).toBe(400)
    expect((await handleDataSearch({ ...baseInput, engine: null })).status).toBe(503)
    expect(engine).not.toHaveBeenCalled()
  })

  it('forwards q + scopes and returns the grouped result', async () => {
    const groups = [{ baseId: 'b1', baseName: 'B', tables: [] }]
    const engine = vi.fn(async (): Promise<DataSearchResult> => ({ ok: true, groups, partial: false }))
    const res = await handleDataSearch({ ...baseInput, baseId: 'b1', engine })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, groups, partial: false })
    expect(engine).toHaveBeenCalledWith(SPACE_ID, 'acme', { baseId: 'b1', tableId: undefined })
  })

  it('maps engine errors through schemaDocsErrorStatus (501 backend)', async () => {
    const engine = vi.fn(async (): Promise<DataSearchResult> => ({ ok: false, code: 'backend_not_implemented', status: 501 }))
    const res = await handleDataSearch({ ...baseInput, engine })
    expect(res.status).toBe(501)
  })
})
