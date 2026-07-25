import { describe, expect, it } from 'vitest'
import { buildCustomersDirectory, type CustomerSubItem } from './customers'

const org = (id: string, name: string, over = {}) => ({ id, name, slug: name.toLowerCase(), hasMigrated: true, createdAt: new Date('2026-01-01'), ...over })
const item = (organizationId: string, over: Partial<CustomerSubItem> = {}): CustomerSubItem => ({
  organizationId, tier: 'growth', billingPeriod: 'monthly', subscriptionStatus: 'active', cancelledAt: null, ...over,
})

describe('buildCustomersDirectory', () => {
  it('assembles counts, tiers, MRR, migration flag, last activity; sorted by name', () => {
    const rows = buildCustomersDirectory({
      orgs: [org('o2', 'Beta'), org('o1', 'Acme', { hasMigrated: false })],
      spaceCounts: [{ organizationId: 'o1', count: 3 }],
      memberCounts: [{ organizationId: 'o1', count: 2 }],
      subItems: [item('o1', { tier: 'pro' })],
      latestRuns: [{ organizationId: 'o1', lastRunAt: new Date('2026-07-01') }],
    })
    expect(rows.map((r) => r.name)).toEqual(['Acme', 'Beta']) // sorted
    const acme = rows.find((r) => r.id === 'o1')!
    expect(acme.spaceCount).toBe(3)
    expect(acme.memberCount).toBe(2)
    expect(acme.tiers).toEqual(['pro'])
    expect(acme.hasMigrated).toBe(false)
    expect(acme.mrr.totalCents).toBe(19900) // pro monthly
    expect(acme.lastActivityAt).toEqual(new Date('2026-07-01'))
  })

  it('handles orgs with no subs / spaces / members / runs', () => {
    const rows = buildCustomersDirectory({ orgs: [org('o1', 'Solo')], spaceCounts: [], memberCounts: [], subItems: [], latestRuns: [] })
    expect(rows[0]).toMatchObject({ spaceCount: 0, memberCount: 0, tiers: [], subscriptionStatus: 'none', lastActivityAt: null })
    expect(rows[0].mrr.totalCents).toBe(0)
  })

  it('MRR counts only active, non-cancelled items (enterprise is unpriceable)', () => {
    const rows = buildCustomersDirectory({
      orgs: [org('o1', 'Ent')],
      spaceCounts: [], memberCounts: [], latestRuns: [],
      subItems: [item('o1', { tier: 'enterprise' }), item('o1', { tier: 'growth', subscriptionStatus: 'past_due' })],
    })
    expect(rows[0].mrr.totalCents).toBe(0)
    expect(rows[0].mrr.unpriceable).toBe(1) // enterprise on an active sub
  })

  it('applies the derived subscription-status filter', () => {
    const rows = buildCustomersDirectory(
      {
        orgs: [org('o1', 'Active'), org('o2', 'Trial')],
        spaceCounts: [], memberCounts: [], latestRuns: [],
        subItems: [item('o1', { subscriptionStatus: 'active' }), item('o2', { subscriptionStatus: 'trialing' })],
      },
      { status: 'trialing' },
    )
    expect(rows.map((r) => r.id)).toEqual(['o2'])
  })
})
