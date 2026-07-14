import { describe, it, expect } from 'vitest'
import {
  deriveTrialState,
  buildSubscriptionsView,
  type SubItemRow,
} from './subscriptions'

const NOW = new Date('2026-07-13T12:00:00Z')
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 24 * 60 * 60 * 1000)

function item(overrides: Partial<SubItemRow>): SubItemRow {
  return {
    organizationId: 'org1',
    platformName: 'Airtable',
    tier: 'starter',
    billingPeriod: 'monthly',
    trialEndsAt: null,
    trialBackupRunUsed: false,
    trialEverUsed: false,
    currentPeriodEnd: null,
    cancelledAt: null,
    ...overrides,
  }
}

describe('deriveTrialState', () => {
  it('trialing with days left while the sub is trialing and trial_ends_at is future', () => {
    const r = deriveTrialState(item({ trialEndsAt: daysFromNow(3) }), 'trialing', NOW)
    expect(r).toEqual({ trialState: 'trialing', trialDaysLeft: 3 })
  })

  it('converted when active after having used the trial', () => {
    const r = deriveTrialState(item({ trialEverUsed: true }), 'active', NOW)
    expect(r.trialState).toBe('converted')
  })

  it('trial_expired when the trial window passed without converting', () => {
    const r = deriveTrialState(item({ trialEndsAt: daysFromNow(-1), trialEverUsed: true }), 'trialing', NOW)
    expect(r.trialState).toBe('trial_expired')
  })

  it('never_trialed otherwise', () => {
    expect(deriveTrialState(item({}), 'active', NOW).trialState).toBe('never_trialed')
    expect(deriveTrialState(item({}), null, NOW).trialState).toBe('never_trialed')
  })
})

describe('buildSubscriptionsView', () => {
  const orgs = [
    { id: 'org1', name: 'Beta Corp', slug: 'beta', stripeCustomerId: 'cus_1' },
    { id: 'org2', name: 'Acme', slug: 'acme', stripeCustomerId: null },
  ]

  it('joins subs + items per org, sorted by name, orgs without subs included', () => {
    const { rows, summary } = buildSubscriptionsView(
      orgs,
      [{ organizationId: 'org1', stripeSubscriptionId: 'sub_1', status: 'trialing' }],
      [item({ organizationId: 'org1', trialEndsAt: daysFromNow(5) })],
      NOW,
    )
    expect(rows.map((r) => r.name)).toEqual(['Acme', 'Beta Corp'])
    expect(rows[0].subscriptionStatus).toBeNull()
    expect(rows[1].items[0].trialState).toBe('trialing')
    expect(summary).toEqual({
      organizations: 2,
      byStatus: { none: 1, trialing: 1 },
      activeTrials: 1,
      pastDue: 0,
    })
  })

  it('counts past_due orgs', () => {
    const { summary } = buildSubscriptionsView(
      orgs,
      [
        { organizationId: 'org1', stripeSubscriptionId: 'sub_1', status: 'past_due' },
        { organizationId: 'org2', stripeSubscriptionId: 'sub_2', status: 'active' },
      ],
      [],
      NOW,
    )
    expect(summary.pastDue).toBe(1)
    expect(summary.byStatus).toEqual({ past_due: 1, active: 1 })
  })

  it('handles empty inputs', () => {
    const { rows, summary } = buildSubscriptionsView([], [], [], NOW)
    expect(rows).toEqual([])
    expect(summary.organizations).toBe(0)
  })
})
