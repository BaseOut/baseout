/**
 * Tests for the testable inner handler (handleHealthOverview) of the Health tab
 * proxy. The guard + error-status mapper are covered in
 * lib/schema-docs/proxy.test.ts; this pins the route glue: 401 from the guard,
 * 400 on missing baseId, 503 when the engine is unconfigured, engine result
 * mapping, and engine error passthrough.
 *
 * cloudflare:workers is mocked because importing the route pulls the static
 * `env` import (we never call buildEngine in tests).
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

const { handleHealthOverview } = await import('./health-overview')

import type { AccountContext } from '../../../../lib/account'
import type { GetHealthOverviewResult } from '../../../../lib/backup-engine'

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
  fetchSpace: inOrg,
  resolveLevel: manual,
}

describe('handleHealthOverview', () => {
  it('401 propagates from the guard when unauthenticated', async () => {
    const res = await handleHealthOverview({
      ...baseInput,
      account: null,
      engine: vi.fn(),
    })
    expect(res.status).toBe(401)
  })

  it('400 when baseId is missing', async () => {
    const engine = vi.fn()
    const res = await handleHealthOverview({ ...baseInput, baseId: null, engine })
    expect(res.status).toBe(400)
    expect(engine).not.toHaveBeenCalled()
  })

  it('503 when the engine binding is unconfigured', async () => {
    const res = await handleHealthOverview({ ...baseInput, engine: null })
    expect(res.status).toBe(503)
    expect(((await res.json()) as { error: string }).error).toBe('server_misconfigured')
  })

  it('returns the engine grade/metrics/issues', async () => {
    const grade = { score: 82, band: 'good' }
    const metrics = [
      { ruleId: 'r1', name: 'Naming', weight: 2, severity: 'warning', entityTier: 'field', score: 70, lastGeneratedAt: null },
    ]
    const issues = [
      { ruleId: 'r1', severity: 'warning', tableId: 'tbl1', fieldId: 'fld1', message: 'Unnamed field', airtableDeeplink: 'https://airtable.com/appABC/tbl1' },
    ]
    const engine = vi.fn(
      async (): Promise<GetHealthOverviewResult> => ({ ok: true, grade, metrics, issues }),
    )
    const res = await handleHealthOverview({ ...baseInput, engine })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, grade, metrics, issues })
    expect(engine).toHaveBeenCalledWith(SPACE_ID, BASE_ID)
  })

  it('maps an engine 501 to a 501 with the code', async () => {
    const engine = vi.fn(
      async (): Promise<GetHealthOverviewResult> => ({ ok: false, code: 'backend_not_implemented', status: 501 }),
    )
    const res = await handleHealthOverview({ ...baseInput, engine })
    expect(res.status).toBe(501)
    expect(((await res.json()) as { error: string }).error).toBe('backend_not_implemented')
  })
})
