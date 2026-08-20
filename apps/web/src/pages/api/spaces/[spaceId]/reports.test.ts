import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleReports } = await import('./reports')

import type { AccountContext } from '../../../../lib/account'
import type { ListReportsResult, MutateReportResult } from '../../../../lib/backup-engine'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = 'org_1'

function makeAccount(orgId: string | null = ORG_ID): AccountContext {
  return { organization: orgId ? { id: orgId, name: 'Org', slug: 'org' } : null } as AccountContext
}

const baseInput = {
  spaceId: SPACE_ID,
  parseBody: async () => ({}),
  fetchSpace: vi.fn(async () => ({ id: SPACE_ID, organizationId: ORG_ID })),
  checkCreate: vi.fn(async () => ({ allowed: true, used: 1, limit: 5, addonSlug: 'reports_5' })),
}

describe('handleReports — auth + membership', () => {
  it('401 when unauthenticated', async () => {
    const res = await handleReports({
      ...baseInput,
      account: makeAccount(null),
      method: 'GET',
      engine: { listReportDefinitions: vi.fn(), createReportDefinition: vi.fn() },
    })
    expect(res.status).toBe(401)
  })

  it('403 when the Space belongs to another org', async () => {
    const res = await handleReports({
      ...baseInput,
      account: makeAccount('org_other'),
      method: 'GET',
      engine: { listReportDefinitions: vi.fn(), createReportDefinition: vi.fn() },
    })
    expect(res.status).toBe(403)
  })
})

describe('handleReports — GET list', () => {
  it('passes the engine definitions through (200)', async () => {
    const definitions = [{ definition: { id: 'd1' }, latestRun: null }]
    const listReportDefinitions = vi.fn(
      async (): Promise<ListReportsResult> => ({ ok: true, definitions } as ListReportsResult),
    )
    const res = await handleReports({
      ...baseInput,
      account: makeAccount(),
      method: 'GET',
      engine: { listReportDefinitions, createReportDefinition: vi.fn() },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, definitions })
    expect(listReportDefinitions).toHaveBeenCalledWith(SPACE_ID)
  })
})

describe('handleReports — POST create', () => {
  it('403 limit_reached when the creation cap is exceeded (before hitting the engine)', async () => {
    const createReportDefinition = vi.fn()
    const res = await handleReports({
      ...baseInput,
      account: makeAccount(),
      method: 'POST',
      checkCreate: vi.fn(async () => ({ allowed: false, used: 5, limit: 5, addonSlug: 'reports_5' })),
      engine: { listReportDefinitions: vi.fn(), createReportDefinition },
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'limit_reached', addon: 'reports_5', limit: 5 })
    expect(createReportDefinition).not.toHaveBeenCalled()
  })

  it('201 on create passthrough', async () => {
    const definition = { id: 'd2', name: 'Sales' }
    const createReportDefinition = vi.fn(
      async (): Promise<MutateReportResult> => ({ ok: true, definition } as MutateReportResult),
    )
    const res = await handleReports({
      ...baseInput,
      account: makeAccount(),
      method: 'POST',
      parseBody: async () => ({ name: 'Sales', sections: ['backups'], windowKind: 'since_last' }),
      engine: { listReportDefinitions: vi.fn(), createReportDefinition },
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true, definition })
  })

  it('400 when the engine rejects invalid recipients', async () => {
    const createReportDefinition = vi.fn(
      async (): Promise<MutateReportResult> =>
        ({ ok: false, code: 'invalid_request', status: 400, message: 'invalid recipient email' } as MutateReportResult),
    )
    const res = await handleReports({
      ...baseInput,
      account: makeAccount(),
      method: 'POST',
      parseBody: async () => ({ name: 'x', sections: ['backups'], windowKind: 'since_last', scheduleRecipients: [{ kind: 'member', email: 'bad' }] }),
      engine: { listReportDefinitions: vi.fn(), createReportDefinition },
    })
    expect(res.status).toBe(400)
  })
})
