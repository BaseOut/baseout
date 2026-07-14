import { describe, it, expect } from 'vitest'
import { buildMigrationView, type MigrationOrgRow } from './migration'

function org(overrides: Partial<MigrationOrgRow>): MigrationOrgRow {
  return {
    id: 'o1',
    name: 'Org',
    slug: 'org',
    hasMigrated: true,
    dynamicLocked: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    subscriptionStatus: 'active',
    ...overrides,
  }
}

describe('buildMigrationView', () => {
  it('counts migrated vs pending and dynamic-locked', () => {
    const view = buildMigrationView([
      org({ id: 'a' }),
      org({ id: 'b', hasMigrated: false, dynamicLocked: true }),
      org({ id: 'c', hasMigrated: false }),
      org({ id: 'd', dynamicLocked: true }),
    ])
    expect(view).toMatchObject({
      total: 4,
      migrated: 2,
      pending: 2,
      pendingPct: 50,
      dynamicLocked: 2,
    })
    expect(view.pendingOrgs.map((o) => o.id)).toEqual(['b', 'c'])
  })

  it('sorts pending orgs oldest-first (longest waiting)', () => {
    const view = buildMigrationView([
      org({ id: 'newer', hasMigrated: false, createdAt: new Date('2026-06-01') }),
      org({ id: 'older', hasMigrated: false, createdAt: new Date('2026-02-01') }),
    ])
    expect(view.pendingOrgs.map((o) => o.id)).toEqual(['older', 'newer'])
  })

  it('handles zero orgs without dividing by zero', () => {
    expect(buildMigrationView([])).toMatchObject({ total: 0, pending: 0, pendingPct: 0 })
  })
})
