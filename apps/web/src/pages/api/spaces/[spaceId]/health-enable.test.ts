/** Tests for handleHealthEnable + handleHealthPrompt (web-health-tab Pro+). */
import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))
const { handleHealthEnable } = await import('./health-enable')
const { handleHealthPrompt } = await import('./health-prompt')

import type { AccountContext } from '../../../../lib/account'
import type { HealthMutationResult } from '../../../../lib/backup-engine'

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
const ok = vi.fn(async (): Promise<HealthMutationResult> => ({ ok: true }))

const enableBase = {
  account: makeAccount(),
  spaceId: SPACE_ID,
  parseBody: async () => ({ baseId: 'appX', ruleId: 'r1', enabled: false }) as Record<string, unknown>,
  fetchSpace: inOrg,
  resolveLevel: proAi,
  engine: ok,
}

describe('handleHealthEnable', () => {
  it('403 when not Pro+', async () => {
    expect((await handleHealthEnable({ ...enableBase, resolveLevel: manualOnly })).status).toBe(403)
  })
  it('400 when enabled is not boolean', async () => {
    const res = await handleHealthEnable({ ...enableBase, parseBody: async () => ({ baseId: 'appX', ruleId: 'r1', enabled: 'no' }) })
    expect(res.status).toBe(400)
  })
  it('forwards the toggle', async () => {
    const res = await handleHealthEnable(enableBase)
    expect(res.status).toBe(200)
    expect(ok).toHaveBeenCalledWith(SPACE_ID, { baseId: 'appX', ruleId: 'r1', enabled: false })
  })
})

const promptBase = {
  account: makeAccount(),
  spaceId: SPACE_ID,
  parseBody: async () => ({ ruleId: 'r1', level: 'space', prompt: 'Rate naming' }) as Record<string, unknown>,
  fetchSpace: inOrg,
  resolveLevel: proAi,
  engine: vi.fn(async (): Promise<HealthMutationResult> => ({ ok: true })),
}

describe('handleHealthPrompt', () => {
  it('403 when not Pro+', async () => {
    expect((await handleHealthPrompt({ ...promptBase, resolveLevel: manualOnly })).status).toBe(403)
  })
  it('400 on an unknown level', async () => {
    const res = await handleHealthPrompt({ ...promptBase, parseBody: async () => ({ ruleId: 'r1', level: 'bogus' }) })
    expect(res.status).toBe(400)
  })
  it('forwards the prompt edit', async () => {
    const res = await handleHealthPrompt(promptBase)
    expect(res.status).toBe(200)
    expect(promptBase.engine).toHaveBeenCalledWith(SPACE_ID, { ruleId: 'r1', level: 'space', prompt: 'Rate naming' })
  })
})
