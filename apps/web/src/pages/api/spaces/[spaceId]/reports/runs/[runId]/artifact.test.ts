import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleArtifact } = await import('./artifact')

import type { AccountContext } from '../../../../../../../lib/account'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const RUN_ID = '33333333-3333-3333-3333-333333333333'
const ORG_ID = 'org_1'

function makeAccount(orgId: string | null = ORG_ID): AccountContext {
  return { organization: orgId ? { id: orgId, name: 'Org', slug: 'org' } : null } as AccountContext
}

const base = {
  spaceId: SPACE_ID,
  runId: RUN_ID,
  format: 'pdf' as string | null,
  fetchSpace: vi.fn(async () => ({ id: SPACE_ID, organizationId: ORG_ID })),
}

describe('handleArtifact', () => {
  it('requires org membership (403 on mismatch, engine never called)', async () => {
    const getReportArtifact = vi.fn()
    const res = await handleArtifact({
      ...base,
      account: makeAccount('org_other'),
      engine: { getReportArtifact },
    })
    expect(res.status).toBe(403)
    expect(getReportArtifact).not.toHaveBeenCalled()
  })

  it('400 when format is missing/invalid', async () => {
    const res = await handleArtifact({
      ...base,
      format: null,
      account: makeAccount(),
      engine: { getReportArtifact: vi.fn() },
    })
    expect(res.status).toBe(400)
  })

  it('streams the engine artifact through with its content-type', async () => {
    const getReportArtifact = vi.fn(
      async () =>
        new Response('%PDF-1.7', { status: 200, headers: { 'content-type': 'application/pdf' } }),
    )
    const res = await handleArtifact({
      ...base,
      account: makeAccount(),
      engine: { getReportArtifact },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(getReportArtifact).toHaveBeenCalledWith(SPACE_ID, RUN_ID, 'pdf')
  })
})
