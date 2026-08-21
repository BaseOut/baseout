import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleReport } = await import('./[reportId]')

import type { AccountContext } from '../../../../../lib/account'
import type { DeleteReportResult, GetReportResult } from '../../../../../lib/backup-engine'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const DEF_ID = '22222222-2222-2222-2222-222222222222'
const ORG_ID = 'org_1'

function makeAccount(orgId: string | null = ORG_ID): AccountContext {
  return { organization: orgId ? { id: orgId, name: 'Org', slug: 'org' } : null } as AccountContext
}

const base = {
  spaceId: SPACE_ID,
  reportId: DEF_ID,
  parseBody: async () => ({}),
  fetchSpace: vi.fn(async () => ({ id: SPACE_ID, organizationId: ORG_ID })),
}

describe('handleReport', () => {
  it('GET returns the definition + runs (passthrough)', async () => {
    const getReportDefinition = vi.fn(
      async (): Promise<GetReportResult> =>
        ({ ok: true, definition: { id: DEF_ID }, runs: [] } as unknown as GetReportResult),
    )
    const res = await handleReport({
      ...base,
      account: makeAccount(),
      method: 'GET',
      engine: { getReportDefinition, updateReportDefinition: vi.fn(), deleteReportDefinition: vi.fn() },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, runs: [] })
  })

  it('DELETE of the default report is rejected with 403', async () => {
    const deleteReportDefinition = vi.fn(
      async (): Promise<DeleteReportResult> =>
        ({ ok: false, code: 'default_report_protected', status: 403 } as DeleteReportResult),
    )
    const res = await handleReport({
      ...base,
      account: makeAccount(),
      method: 'DELETE',
      engine: { getReportDefinition: vi.fn(), updateReportDefinition: vi.fn(), deleteReportDefinition },
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'default_report_protected' })
  })

  it('400 when reportId is not a UUID', async () => {
    const res = await handleReport({
      ...base,
      reportId: 'not-a-uuid',
      account: makeAccount(),
      method: 'GET',
      engine: { getReportDefinition: vi.fn(), updateReportDefinition: vi.fn(), deleteReportDefinition: vi.fn() },
    })
    expect(res.status).toBe(400)
  })
})
