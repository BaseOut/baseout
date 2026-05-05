import { describe, it, expect } from 'vitest'
import { getPageContext } from './config'
import type { AccountContext } from './account'

type LocalsSubset = {
  user: App.Locals['user']
  account: App.Locals['account']
}

function buildLocals(overrides: Partial<LocalsSubset> = {}): App.Locals {
  return {
    user: null,
    account: null,
    ...overrides,
  } as unknown as App.Locals
}

const account: AccountContext = {
  user: {
    id: 'u_1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    image: null,
  },
  organization: { id: 'o_1', name: 'Acme', slug: 'acme' },
  membership: { role: 'owner', isDefault: true },
  space: { id: 's_1', name: 'Acme', status: 'setup_incomplete' },
  spaces: [
    { id: 's_1', name: 'Acme', status: 'setup_incomplete' },
    { id: 's_2', name: 'Staging', status: 'setup_incomplete' },
  ],
}

describe('getPageContext', () => {
  it('returns the Guest user and no account context when signed out', () => {
    const ctx = getPageContext(buildLocals())
    expect(ctx.user).toEqual({ name: 'Guest', email: '' })
    expect(ctx.organization).toBeNull()
    expect(ctx.currentSpace).toBeNull()
    expect(ctx.spaces).toEqual([])
  })

  it('returns the real user and account shape when signed in + onboarded', () => {
    const ctx = getPageContext(
      buildLocals({
        user: {
          id: 'u_1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          image: null,
          termsAcceptedAt: new Date(),
        },
        account,
      }),
    )
    expect(ctx.user).toEqual({ name: 'Ada Lovelace', email: 'ada@example.com' })
    expect(ctx.organization).toEqual({ id: 'o_1', name: 'Acme', slug: 'acme' })
    expect(ctx.currentSpace).toBe('Acme')
    expect(ctx.spaces).toEqual([
      { id: 's_1', name: 'Acme', status: 'setup_incomplete' },
      { id: 's_2', name: 'Staging', status: 'setup_incomplete' },
    ])
  })

  it('returns the pre-onboarding shape when user is authed but has no account', () => {
    const ctx = getPageContext(
      buildLocals({
        user: {
          id: 'u_1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          image: null,
          termsAcceptedAt: null,
        },
        account: null,
      }),
    )
    expect(ctx.user).toEqual({ name: 'Ada Lovelace', email: 'ada@example.com' })
    expect(ctx.organization).toBeNull()
    expect(ctx.currentSpace).toBeNull()
    expect(ctx.spaces).toEqual([])
  })

  it('still surfaces nav + product metadata', () => {
    const ctx = getPageContext(buildLocals())
    expect(typeof ctx.productName).toBe('string')
    expect(ctx.productName.length).toBeGreaterThan(0)
    expect(Array.isArray(ctx.navItems)).toBe(true)
    expect(ctx.navItems.length).toBeGreaterThan(0)
  })
})
