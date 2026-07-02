/** Tests for handleHealthConfig (web-health-tab Pro+ editor) incl. the gate. */
import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))
const { handleHealthConfig } = await import('./health-config')

import type { AccountContext } from '../../../../lib/account'
import type { GetHealthConfigResult } from '../../../../lib/backup-engine'

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
const engine = vi.fn(async (): Promise<GetHealthConfigResult> => ({ ok: true, metrics: [] }))

const base = {
  account: makeAccount(),
  spaceId: SPACE_ID,
  baseId: 'appX',
  fetchSpace: inOrg,
  resolveLevel: proAi,
  engine,
}

describe('handleHealthConfig', () => {
  it('401 unauthenticated', async () => {
    expect((await handleHealthConfig({ ...base, account: null })).status).toBe(401)
  })
  it('403 when not Pro+ (manual only)', async () => {
    const res = await handleHealthConfig({ ...base, resolveLevel: manualOnly })
    expect(res.status).toBe(403)
    expect(((await res.json()) as { error: string }).error).toBe('health_editor_not_entitled')
  })
  it('400 when baseId missing', async () => {
    expect((await handleHealthConfig({ ...base, baseId: null })).status).toBe(400)
  })
  it('503 when engine unconfigured', async () => {
    expect((await handleHealthConfig({ ...base, engine: null })).status).toBe(503)
  })
  it('returns the metric config', async () => {
    const res = await handleHealthConfig(base)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, metrics: [] })
    expect(engine).toHaveBeenCalledWith(SPACE_ID, 'appX')
  })
})
