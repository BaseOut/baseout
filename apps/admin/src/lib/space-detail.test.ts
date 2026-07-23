import { describe, expect, it } from 'vitest'
import { buildSpaceDetail, type SpaceDetailInput } from './space-detail'

const base: SpaceDetailInput = {
  space: { id: 's1', name: 'Prod', status: 'active', spaceType: 'single_platform', organizationId: 'o1', organizationName: 'Acme', createdAt: new Date('2026-01-01') },
  members: [
    { userId: 'u2', email: 'bob@x.com', name: null, role: 'member' },
    { userId: 'u1', email: 'ann@x.com', name: 'Ann', role: 'owner' },
  ],
  connections: [{ id: 'c1', displayName: 'Main', status: 'active', scope: 'organization' }],
  config: { frequency: 'daily', scope: 'schema_and_data', mode: 'static', storageType: 'r2_managed', autoAddFutureBases: true, nextScheduledAt: new Date('2026-07-24') },
  retention: { policyTier: 'standard', keepLastN: 30, dailyWindowDays: 7, weeklyWindowDays: 30, monthlyIndefinite: true },
  bases: [
    { atBaseId: 'appZ', name: 'Zoo', included: true, autoDiscovered: false },
    { atBaseId: 'appA', name: 'Alpha', included: false, autoDiscovered: true },
  ],
  runs: [{ id: 'r1', status: 'succeeded', kind: 'full', startedAt: new Date('2026-07-20'), completedAt: new Date('2026-07-20'), recordCount: 100 }],
  databases: [{ backend: 'managed_pg', status: 'active', schemaVersion: 7 }],
  storage: [{ type: 'r2_managed', email: null, connectedAt: new Date('2026-01-02') }],
}

describe('buildSpaceDetail', () => {
  it('assembles the view model, sorting members by email + bases by name', () => {
    const v = buildSpaceDetail(base)
    expect(v.found).toBe(true)
    expect(v.space!.organizationName).toBe('Acme')
    expect(v.members.map((m) => m.email)).toEqual(['ann@x.com', 'bob@x.com'])
    expect(v.bases.map((b) => b.name)).toEqual(['Alpha', 'Zoo'])
    expect(v.bases.find((b) => b.atBaseId === 'appA')!.included).toBe(false)
    expect(v.config!.frequency).toBe('daily')
    expect(v.retention!.policyTier).toBe('standard')
  })

  it('signals not-found when the space row is absent', () => {
    const v = buildSpaceDetail({ ...base, space: null })
    expect(v.found).toBe(false)
    expect(v.members).toEqual([])
  })

  it('tolerates empty config / retention / bases / runs (fresh space)', () => {
    const v = buildSpaceDetail({ ...base, config: null, retention: null, bases: [], runs: [], connections: [] })
    expect(v.found).toBe(true)
    expect(v.config).toBeNull()
    expect(v.retention).toBeNull()
    expect(v.bases).toEqual([])
  })
})
