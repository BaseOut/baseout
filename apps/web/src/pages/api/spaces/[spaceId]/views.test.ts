/**
 * Tests for the testable inner handlers of the saved-views proxies
 * (web-saved-views D4). The guard + error-status mapper are covered in
 * lib/schema-docs/proxy.test.ts; this pins the route glue: 503 when the engine
 * is unconfigured, body validation, attribution, and engine result mapping
 * incl. the table_locked passthrough.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleViews } = await import('./views')
const { handleViewItem } = await import('./views/[viewId]')

import type { AccountContext } from '../../../../lib/account'
import type { ListSavedViewsResult, SavedViewResult } from '../../../../lib/backup-engine'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const VIEW_ID = '33333333-3333-3333-3333-333333333333'
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
const config = { tableId: 'tbl1', hiddenCols: [], filterTree: { kind: 'group', conjunction: 'and', children: [] } }
const row = { id: VIEW_ID, name: 'n', tableId: 'tbl1', config, pinned: false, sortOrder: 0, createdByUserId: 'u_1', createdAt: null, updatedAt: null }

const baseInput = {
  account: makeAccount(),
  spaceId: SPACE_ID,
  parseBody: async () => ({}),
  userId: 'u_1',
  fetchSpace: inOrg,
  resolveLevel: manual,
}

describe('handleViews (collection)', () => {
  it('401 from the guard; 503 when the engine is unconfigured', async () => {
    const engine = { listSavedViews: vi.fn(), createSavedView: vi.fn() }
    expect((await handleViews({ ...baseInput, account: null, method: 'GET', engine })).status).toBe(401)
    expect((await handleViews({ ...baseInput, method: 'GET', engine: null })).status).toBe(503)
  })

  it('GET returns the engine view list', async () => {
    const listSavedViews = vi.fn(async (): Promise<ListSavedViewsResult> => ({ ok: true, views: [row] }))
    const res = await handleViews({ ...baseInput, method: 'GET', engine: { listSavedViews, createSavedView: vi.fn() } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, views: [row] })
  })

  it('POST validates name/tableId/config before calling the engine', async () => {
    const createSavedView = vi.fn()
    for (const body of [{}, { name: 'n' }, { name: 'n', tableId: 't' }, { name: 'n', tableId: 't', config: [] }]) {
      const res = await handleViews({
        ...baseInput, method: 'POST', parseBody: async () => body,
        engine: { listSavedViews: vi.fn(), createSavedView },
      })
      expect(res.status, JSON.stringify(body)).toBe(400)
    }
    expect(createSavedView).not.toHaveBeenCalled()
  })

  it('POST threads the session user as createdByUserId and returns 201', async () => {
    const createSavedView = vi.fn(async (_spaceId: string, _input: unknown): Promise<SavedViewResult> => ({ ok: true, view: row }))
    const res = await handleViews({
      ...baseInput, method: 'POST', parseBody: async () => ({ name: 'n', tableId: 'tbl1', config }),
      engine: { listSavedViews: vi.fn(), createSavedView },
    })
    expect(res.status).toBe(201)
    expect(createSavedView.mock.calls[0]![1]).toMatchObject({ name: 'n', createdByUserId: 'u_1' })
  })
})

describe('handleViewItem', () => {
  const engine = () => ({
    getSavedView: vi.fn(async (): Promise<SavedViewResult> => ({ ok: true, view: row })),
    updateSavedView: vi.fn(async (): Promise<SavedViewResult> => ({ ok: true, view: row })),
    deleteSavedView: vi.fn(async () => ({ ok: true }) as const),
  })

  it('400 on a non-UUID view id', async () => {
    const res = await handleViewItem({ ...baseInput, viewId: 'nope', method: 'GET', engine: engine() })
    expect(res.status).toBe(400)
  })

  it('GET/PATCH/DELETE map engine results', async () => {
    const e = engine()
    expect((await handleViewItem({ ...baseInput, viewId: VIEW_ID, method: 'GET', engine: e })).status).toBe(200)
    expect((await handleViewItem({ ...baseInput, viewId: VIEW_ID, method: 'PATCH', parseBody: async () => ({ name: 'x' }), engine: e })).status).toBe(200)
    expect((await handleViewItem({ ...baseInput, viewId: VIEW_ID, method: 'DELETE', engine: e })).status).toBe(200)
  })

  it('table_locked from the engine maps to 400 with the code intact', async () => {
    const e = engine()
    e.updateSavedView = vi.fn(async (): Promise<SavedViewResult> => ({ ok: false, code: 'table_locked', status: 400 }))
    const res = await handleViewItem({ ...baseInput, viewId: VIEW_ID, method: 'PATCH', parseBody: async () => ({ tableId: 't2' }), engine: e })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe('table_locked')
  })

  it('view_not_found maps to 404', async () => {
    const e = engine()
    e.getSavedView = vi.fn(async (): Promise<SavedViewResult> => ({ ok: false, code: 'view_not_found', status: 404 }))
    const res = await handleViewItem({ ...baseInput, viewId: VIEW_ID, method: 'GET', engine: e })
    expect(res.status).toBe(404)
  })
})
