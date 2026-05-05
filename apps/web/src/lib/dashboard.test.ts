import { describe, it, expect } from 'vitest'
import { buildDashboardModel } from './dashboard'
import type { AccountContext } from './account'

const baseUser: AccountContext['user'] = {
  id: 'u_1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  image: null,
}

function account(overrides: Partial<AccountContext> = {}): AccountContext {
  return {
    user: baseUser,
    organization: { id: 'o_1', name: 'Acme', slug: 'acme' },
    membership: { role: 'owner', isDefault: true },
    space: { id: 's_1', name: 'Acme', status: 'setup_incomplete' },
    spaces: [{ id: 's_1', name: 'Acme', status: 'setup_incomplete' }],
    ...overrides,
  }
}

describe('buildDashboardModel', () => {
  it('returns the signed-out shell when account is null', () => {
    expect(buildDashboardModel(null)).toEqual({
      state: 'signed-out',
      greeting: 'Welcome',
      orgName: null,
      spaceName: null,
      spaceStatusLabel: null,
      nextStep: null,
    })
  })

  it('greets by first name when the user has a full name', () => {
    expect(buildDashboardModel(account()).greeting).toBe('Welcome, Ada')
  })

  it('falls back to a generic greeting when the user name is empty', () => {
    const model = buildDashboardModel(
      account({ user: { ...baseUser, name: '' } }),
    )
    expect(model.greeting).toBe('Welcome')
  })

  it('surfaces org and space names from the account', () => {
    const model = buildDashboardModel(account())
    expect(model.orgName).toBe('Acme')
    expect(model.spaceName).toBe('Acme')
  })

  it('labels setup_incomplete spaces as "Setup in progress"', () => {
    const model = buildDashboardModel(account())
    expect(model.state).toBe('setup-incomplete')
    expect(model.spaceStatusLabel).toBe('Setup in progress')
    expect(model.nextStep).toEqual({
      label: 'Connect your first Airtable base',
      href: '/integrations',
      icon: 'link',
    })
  })

  it('labels active spaces as "Active" with no next-step CTA', () => {
    const model = buildDashboardModel(
      account({ space: { id: 's_1', name: 'Acme', status: 'active' } }),
    )
    expect(model.state).toBe('active')
    expect(model.spaceStatusLabel).toBe('Active')
    expect(model.nextStep).toBeNull()
  })

  it('labels unknown statuses verbatim (capitalized) so new states fail safe', () => {
    const model = buildDashboardModel(
      account({
        space: { id: 's_1', name: 'Acme', status: 'paused' },
      }),
    )
    expect(model.spaceStatusLabel).toBe('Paused')
    expect(model.state).toBe('other')
    expect(model.nextStep).toBeNull()
  })

  it('handles an account with no space (edge case)', () => {
    const model = buildDashboardModel(account({ space: null }))
    expect(model.state).toBe('no-space')
    expect(model.spaceName).toBeNull()
    expect(model.spaceStatusLabel).toBeNull()
    expect(model.nextStep).toBeNull()
  })
})
