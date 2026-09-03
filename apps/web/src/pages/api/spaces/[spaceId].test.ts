import { describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({ env: {} }))

import { handlePatch } from './[spaceId]'
import { SpaceError } from '../../../lib/spaces'
import type { AccountContext } from '../../../lib/account'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'
const ORG_ID = '22222222-2222-2222-2222-222222222222'

function account(): AccountContext {
  return {
    user: { id: 'u_1', name: 'Ada', email: 'ada@example.com', image: null },
    organization: { id: ORG_ID, name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: { id: SPACE_ID, name: 'Growth', status: 'active' },
    spaces: [{ id: SPACE_ID, name: 'Growth', status: 'active' }],
  }
}

describe('PATCH /api/spaces/:spaceId', () => {
  it('renames the Space in the viewer org', async () => {
    const rename = vi.fn(async () => ({ id: SPACE_ID, name: 'Ops' }))
    const res = await handlePatch({
      account: account(),
      spaceId: SPACE_ID,
      body: { name: 'Ops' },
      rename,
      db: {} as never,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, name: 'Ops' })
    expect(rename).toHaveBeenCalledWith(
      {},
      { spaceId: SPACE_ID, organizationId: ORG_ID, name: 'Ops' },
    )
  })

  it('rejects an empty name', async () => {
    const rename = vi.fn(async () => {
      throw new SpaceError({ kind: 'invalid', field: 'name', message: 'Space name is required.' })
    })
    const res = await handlePatch({
      account: account(),
      spaceId: SPACE_ID,
      body: { name: '  ' },
      rename,
      db: {} as never,
    })
    expect(res.status).toBe(400)
  })

  it('hides cross-org Spaces', async () => {
    const rename = vi.fn(async () => {
      throw new SpaceError({ kind: 'forbidden', message: 'That Space is not available.' })
    })
    const res = await handlePatch({
      account: account(),
      spaceId: SPACE_ID,
      body: { name: 'Ops' },
      rename,
      db: {} as never,
    })
    expect(res.status).toBe(403)
  })
})
