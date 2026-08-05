import { describe, it, expect } from 'vitest'
import {
  deriveTrialState,
  buildSubscriptionsView,
  summarizeSubscriptionsGlobal,
  estimateMrr,
  filterByStatus,
  formatCents,
  stripeCustomerUrl,
  stripeSubscriptionUrl,
  summarizeOverages,
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

describe('filterByStatus', () => {
  const views = [
    { subscriptionStatus: 'active' },
    { subscriptionStatus: 'trialing' },
    { subscriptionStatus: null },
  ] as Parameters<typeof filterByStatus>[0]

  it('passes everything through with no filter', () => {
    expect(filterByStatus(views, null)).toHaveLength(3)
    expect(filterByStatus(views, '')).toHaveLength(3)
  })

  it('filters by subscription status', () => {
    expect(filterByStatus(views, 'active')).toHaveLength(1)
    expect(filterByStatus(views, 'past_due')).toHaveLength(0)
  })

  it("selects no-subscription orgs via 'none'", () => {
    const none = filterByStatus(views, 'none')
    expect(none).toHaveLength(1)
    expect(none[0].subscriptionStatus).toBeNull()
  })
})

describe('stripe dashboard urls', () => {
  it('builds customer + subscription deep links', () => {
    expect(stripeCustomerUrl('cus_123')).toBe('https://dashboard.stripe.com/customers/cus_123')
    expect(stripeSubscriptionUrl('sub_456')).toBe('https://dashboard.stripe.com/subscriptions/sub_456')
  })
})

describe('estimateMrr', () => {
  const active = { subscriptionStatus: 'active', cancelledAt: null }

  it('sums list prices for active items, annual at the annual-equivalent rate', () => {
    const mrr = estimateMrr([
      { tier: 'launch', billingPeriod: 'monthly', ...active },   // 4900
      { tier: 'growth', billingPeriod: 'annual', ...active },    // 7900
    ])
    expect(mrr).toEqual({ totalCents: 12800, priced: 2, unpriceable: 0 })
  })

  it('skips non-active and cancelled items entirely', () => {
    const mrr = estimateMrr([
      { tier: 'pro', billingPeriod: 'monthly', subscriptionStatus: 'trialing', cancelledAt: null },
      { tier: 'pro', billingPeriod: 'monthly', subscriptionStatus: 'past_due', cancelledAt: null },
      { tier: 'pro', billingPeriod: 'monthly', subscriptionStatus: null, cancelledAt: null },
      { tier: 'pro', billingPeriod: 'monthly', subscriptionStatus: 'active', cancelledAt: new Date() },
    ])
    expect(mrr).toEqual({ totalCents: 0, priced: 0, unpriceable: 0 })
  })

  it('counts enterprise and unknown tiers as unpriceable', () => {
    const mrr = estimateMrr([
      { tier: 'enterprise', billingPeriod: 'monthly', ...active },
      { tier: 'on2air_bridge', billingPeriod: 'monthly', ...active },
      { tier: 'business', billingPeriod: 'monthly', ...active },  // 39900
    ])
    expect(mrr).toEqual({ totalCents: 39900, priced: 1, unpriceable: 2 })
  })
})

describe('summarizeOverages', () => {
  const base = {
    orgName: 'Acme',
    metric: 'records',
    periodEnd: new Date('2026-07-31'),
    includedQuota: 100,
    usageAmount: 150,
    overageAmount: 50,
  }

  it('sorts newest period first and totals billed vs unbilled', () => {
    const summary = summarizeOverages([
      { ...base, periodStart: new Date('2026-06-01'), totalCostCents: 100, stripeInvoiceItemId: 'ii_1' },
      { ...base, periodStart: new Date('2026-07-01'), totalCostCents: 250, stripeInvoiceItemId: null },
    ])
    expect(summary.rows[0].periodStart).toEqual(new Date('2026-07-01'))
    expect(summary.totalCents).toBe(350)
    expect(summary.unbilledCents).toBe(250)
  })

  it('handles empty input', () => {
    expect(summarizeOverages([])).toEqual({ rows: [], totalCents: 0, unbilledCents: 0 })
  })
})

describe('formatCents', () => {
  it('formats dollars with two decimals', () => {
    expect(formatCents(0)).toBe('$0.00')
    expect(formatCents(12800)).toBe('$128.00')
    expect(formatCents(2599)).toBe('$25.99')
  })
})

describe('buildSubscriptionsView preserveOrder', () => {
  it('keeps the input (SQL page) order instead of sorting by name', () => {
    const orgs = [
      { id: 'o1', name: 'Zeta', slug: 'zeta', stripeCustomerId: null },
      { id: 'o2', name: 'Alpha', slug: 'alpha', stripeCustomerId: null },
    ]
    const { rows } = buildSubscriptionsView(orgs, [], [], NOW, { preserveOrder: true })
    expect(rows.map((r) => r.id)).toEqual(['o1', 'o2'])
  })
})

describe('summarizeSubscriptionsGlobal', () => {
  it('tallies statuses, derives none from the org count, and counts active trials', () => {
    const subs = [
      { organizationId: 'o1', stripeSubscriptionId: 's1', status: 'active' },
      { organizationId: 'o2', stripeSubscriptionId: 's2', status: 'trialing' },
      { organizationId: 'o3', stripeSubscriptionId: 's3', status: 'past_due' },
    ]
    const items = [
      item({ organizationId: 'o2', trialEndsAt: daysFromNow(5) }), // trialing → active trial
      item({ organizationId: 'o1', trialEverUsed: true }),
    ]
    // 5 orgs total, 3 have subscriptions → 2 with none
    const summary = summarizeSubscriptionsGlobal(5, subs, items, NOW)
    expect(summary.organizations).toBe(5)
    expect(summary.byStatus).toEqual({ active: 1, trialing: 1, past_due: 1, none: 2 })
    expect(summary.pastDue).toBe(1)
    expect(summary.activeTrials).toBe(1)
  })

  it('omits none when every org has a subscription', () => {
    const subs = [{ organizationId: 'o1', stripeSubscriptionId: 's1', status: 'active' }]
    const summary = summarizeSubscriptionsGlobal(1, subs, [], NOW)
    expect(summary.byStatus).toEqual({ active: 1 })
  })
})
