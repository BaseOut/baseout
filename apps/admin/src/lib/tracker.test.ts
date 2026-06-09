import { describe, it, expect } from 'vitest'
import { buildTracker, type OrgRow, type SpaceRow, type TierRow } from './tracker'

describe('buildTracker', () => {
  const orgs: OrgRow[] = [
    { id: 'o1', name: 'Acme', slug: 'acme', hasMigrated: true },
    { id: 'o2', name: 'Globex', slug: 'globex', hasMigrated: false },
  ]
  const spaces: SpaceRow[] = [
    { id: 's1', organizationId: 'o1', name: 'Sales', status: 'active', platformName: 'Airtable' },
    { id: 's2', organizationId: 'o1', name: 'Ops', status: 'paused', platformName: 'Airtable' },
  ]
  const tiers: TierRow[] = [{ organizationId: 'o1', tier: 'pro' }]

  it('nests each org’s spaces under it', () => {
    const result = buildTracker(orgs, spaces, tiers)
    const acme = result.find((o) => o.id === 'o1')!
    expect(acme.spaces.map((s) => s.id)).toEqual(['s1', 's2'])
  })

  it('includes the org tier(s)', () => {
    const result = buildTracker(orgs, spaces, tiers)
    expect(result.find((o) => o.id === 'o1')!.tiers).toEqual(['pro'])
  })

  it('renders an org with no spaces as an empty list (no crash)', () => {
    const result = buildTracker(orgs, spaces, tiers)
    const globex = result.find((o) => o.id === 'o2')!
    expect(globex.spaces).toEqual([])
    expect(globex.tiers).toEqual([])
  })

  it('keeps orgs sorted by name', () => {
    const result = buildTracker(orgs, spaces, tiers)
    expect(result.map((o) => o.name)).toEqual(['Acme', 'Globex'])
  })
})
