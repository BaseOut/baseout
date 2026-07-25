import { describe, expect, it } from 'vitest'
import { summarizeBackupRun, summarizeConnection, summarizeOrg, summarizeSpace, summarizeUser, type PeekSummary } from './peek'

const samples: PeekSummary[] = [
  summarizeOrg({ id: 'o1', name: 'Acme', slug: 'acme', createdAt: new Date('2026-01-01'), spaceCount: 3, memberCount: 2 }),
  summarizeSpace({ id: 's1', name: 'Prod', status: 'error', orgName: 'Acme', baseCount: 5 }),
  summarizeUser({ id: 'u1', email: 'ann@x.com', name: 'Ann', role: 'super', lastSeenAt: null }),
  summarizeConnection({ id: 'c1', displayName: 'Main', status: 'invalid', orgName: 'Acme' }),
  summarizeBackupRun({ id: 'r1', status: 'succeeded', kind: 'full', recordCount: 100, completedAt: new Date('2026-07-20'), spaceName: 'Prod' }),
]

describe('peek summarizers', () => {
  it('every summary has the closed shape + a correct href', () => {
    for (const s of samples) {
      expect(s).toMatchObject({ title: expect.any(String), href: expect.stringMatching(/^\//) })
      expect(Array.isArray(s.badges)).toBe(true)
      expect(Array.isArray(s.stats)).toBe(true)
    }
    expect(samples[0].href).toBe('/organizations/o1')
    expect(samples[1].href).toBe('/spaces/s1')
    expect(samples[3].href).toBe('/connections#c1')
  })

  it('surfaces status as a badge with the right tone', () => {
    expect(samples[1].badges[0]).toEqual({ label: 'error', tone: 'error' })
    expect(samples[3].badges[0]).toEqual({ label: 'invalid', tone: 'error' })
    expect(samples[4].badges[0]).toEqual({ label: 'succeeded', tone: 'success' })
  })

  it('never leaks a token/secret key in the serialized output (metadata only)', () => {
    const s = JSON.stringify(samples).toLowerCase()
    for (const forbidden of ['token', '_enc', 'secret', 'password', 'access_token']) {
      expect(s).not.toContain(forbidden)
    }
  })

  it('never-seen user reads "never"', () => {
    expect(samples[2].stats.find((x) => x.label === 'Last seen')!.value).toBe('never')
  })
})
