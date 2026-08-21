/**
 * Tests for handleDataRecords — Data ▸ Records proxy (Slice A Task 3).
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleDataRecords } = await import('./records')

import type { AccountContext } from '../../../../../lib/account'
import type { GetDataRecordsResult } from '../../../../../lib/backup-engine'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'
const TABLE_ID = 'tblDeals'

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

const base = {
  account: makeAccount(),
  spaceId: SPACE_ID,
  tableId: TABLE_ID,
  query: {},
  fetchSpace: inOrg,
  resolveLevel: manual,
}

describe('handleDataRecords', () => {
  it('401 when unauthenticated', async () => {
    const res = await handleDataRecords({ ...base, account: null, engine: vi.fn() })
    expect(res.status).toBe(401)
  })

  it('400 when tableId is missing', async () => {
    const res = await handleDataRecords({ ...base, tableId: null, engine: vi.fn() })
    expect(res.status).toBe(400)
  })

  it('503 when engine is unconfigured', async () => {
    const res = await handleDataRecords({ ...base, engine: null })
    expect(res.status).toBe(503)
  })

  it('200 passthrough of the records page', async () => {
    const page: GetDataRecordsResult = {
      ok: true,
      records: [{ recordId: 'rec1', createdTime: null, modifiedTime: null, status: 'active', fields: {} }],
      nextCursor: null,
      total: 1,
      approximate: false,
      filterErrors: [],
    }
    const engine = vi.fn(async () => page)
    const res = await handleDataRecords({ ...base, engine })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      records: page.records,
      nextCursor: null,
      total: 1,
      approximate: false,
      filterErrors: [],
    })
    expect(engine).toHaveBeenCalledWith(SPACE_ID, TABLE_ID, {})
  })

  it('501 when engine reports backend_not_implemented', async () => {
    const engine = vi.fn(async (): Promise<GetDataRecordsResult> => ({
      ok: false,
      code: 'backend_not_implemented',
      status: 501,
    }))
    const res = await handleDataRecords({ ...base, engine })
    expect(res.status).toBe(501)
    expect(((await res.json()) as { error: string }).error).toBe('backend_not_implemented')
  })
})
