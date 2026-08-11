import { describe, expect, it } from 'vitest'
import { orderMembers, overageLabel, spacesWithAssets, type MemberRow } from './org-detail'

function member(overrides: Partial<MemberRow> = {}): MemberRow {
  return {
    userId: 'u1',
    name: 'A',
    email: 'a@example.com',
    role: 'member',
    acceptedAt: null,
    ...overrides,
  }
}

describe('orderMembers', () => {
  it('orders owner → admin → member, then by email', () => {
    const ordered = orderMembers([
      member({ userId: 'u1', role: 'member', email: 'zed@example.com' }),
      member({ userId: 'u2', role: 'owner', email: 'own@example.com' }),
      member({ userId: 'u3', role: 'admin', email: 'adm@example.com' }),
      member({ userId: 'u4', role: 'member', email: 'abe@example.com' }),
    ])
    expect(ordered.map((m) => m.userId)).toEqual(['u2', 'u3', 'u4', 'u1'])
  })

  it('sinks unknown roles last and does not mutate the input', () => {
    const input = [member({ userId: 'u1', role: 'mystery' }), member({ userId: 'u2', role: 'owner' })]
    const ordered = orderMembers(input)
    expect(ordered.map((m) => m.userId)).toEqual(['u2', 'u1'])
    expect(input.map((m) => m.userId)).toEqual(['u1', 'u2'])
  })
})

describe('overageLabel', () => {
  it('labels the cap and auto modes', () => {
    expect(overageLabel('cap', null)).toBe('cap (no overages)')
    expect(overageLabel('auto', null)).toBe('auto · uncapped')
    expect(overageLabel('auto', 2500)).toBe('auto · $25.00/mo cap')
  })

  it('passes unknown modes through', () => {
    expect(overageLabel('mystery', null)).toBe('mystery')
  })
})

describe('spacesWithAssets', () => {
  const spaces = [
    { id: 's1', name: 'prod', status: 'active', platformName: 'Airtable' },
    { id: 's2', name: 'dev', status: 'paused', platformName: null },
  ]

  it('attaches the database and destinations per space', () => {
    const detail = spacesWithAssets(
      spaces,
      [{ spaceId: 's1', backend: 'managed_pg' }],
      [
        { spaceId: 's1', type: 'google_drive' },
        { spaceId: 's1', type: 'local_fs' },
      ],
    )
    expect(detail[0].database).toEqual({ spaceId: 's1', backend: 'managed_pg' })
    expect(detail[0].destinations.map((d) => d.type)).toEqual(['google_drive', 'local_fs'])
    expect(detail[1].database).toBeNull()
    expect(detail[1].destinations).toEqual([])
  })
})
