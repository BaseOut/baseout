/** Tests for handleHealthRerun (web-health-tab Pro+ re-score) incl. the gate. */
import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))
const { handleHealthRerun } = await import('./health-rerun')

import type { AccountContext } from '../../../../lib/account'
import type { RerunHealthResult } from '../../../../lib/backup-engine'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'

function makeAccount(): AccountContext {
  return {
    user: { id: 'u_1', name: 'Ada', email: 'a@e.com', image: null },
    organization: { id: ORG_ID, name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: { id: SPACE_ID, name: 'Acme', status: 'active' },
    spaces: [{ id: SPACE_ID, name: 'Acme', status: 'active' }],
  } as AccountContext
}

const inOrg = vi.fn(async () => ({ id: SPACE_ID, organizationId: ORG_ID }))
const proAi = vi.fn(async () => 'manual_ai' as const)
const manualOnly = vi.fn(async () => 'manual' as const)

const base = {
  account: makeAccount(),
  spaceId: SPACE_ID,
  parseBody: async () => ({ baseId: 'appX' }) as Record<string, unknown>,
  fetchSpace: inOrg,
  resolveLevel: proAi,
  engine: vi.fn(async (): Promise<RerunHealthResult> => ({ ok: true, enqueued: true, runId: 'r1', metricCount: 3 })),
}

describe('handleHealthRerun', () => {
  it('403 when not Pro+', async () => {
    expect((await handleHealthRerun({ ...base, resolveLevel: manualOnly })).status).toBe(403)
  })
  it('400 when baseId missing', async () => {
    const engine = vi.fn()
    const res = await handleHealthRerun({ ...base, parseBody: async () => ({}), engine })
    expect(res.status).toBe(400)
    expect(engine).not.toHaveBeenCalled()
  })
  it('enqueues and returns the run info', async () => {
    const res = await handleHealthRerun(base)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, enqueued: true, runId: 'r1', metricCount: 3 })
    expect(base.engine).toHaveBeenCalledWith(SPACE_ID, 'appX')
  })
})
