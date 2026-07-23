import { describe, expect, it } from 'vitest'
import { buildUserDetail, type UserDetailInput } from './user-detail'

const base: UserDetailInput = {
  user: { id: 'u1', email: 'ann@x.com', name: 'Ann', role: 'super', emailVerified: true, createdAt: new Date('2026-01-01') },
  memberships: [
    { orgId: 'o2', orgName: 'Beta', role: 'member' },
    { orgId: 'o1', orgName: 'Acme', role: 'owner' },
  ],
  sessions: [{ ipAddress: '1.2.3.4', userAgent: 'Firefox', createdAt: new Date('2026-07-20'), expiresAt: new Date('2026-08-20') }],
  connections: [{ id: 'c1', orgId: 'o1', orgName: 'Acme', status: 'active', displayName: 'Main' }],
  audit: [{ id: 'a1', action: 'force_backup', targetType: 'space', targetId: 's1', phase: 'intent', createdAt: new Date('2026-07-19'), relation: 'actor' }],
}

describe('buildUserDetail', () => {
  it('assembles the model, memberships sorted by org name', () => {
    const v = buildUserDetail(base)
    expect(v.found).toBe(true)
    expect(v.memberships.map((m) => m.orgName)).toEqual(['Acme', 'Beta'])
    expect(v.connections[0].displayName).toBe('Main')
    expect(v.audit[0].action).toBe('force_backup')
  })

  it('signals not-found for a missing user', () => {
    expect(buildUserDetail({ ...base, user: null }).found).toBe(false)
  })

  it('the serialized view model never contains a session token (data boundary)', () => {
    const v = buildUserDetail(base)
    const serialized = JSON.stringify(v)
    expect(serialized.toLowerCase()).not.toContain('token')
    // session rows expose only metadata keys
    expect(Object.keys(v.sessions[0]).sort()).toEqual(['createdAt', 'expiresAt', 'ipAddress', 'userAgent'])
  })

  it('handles a user with no memberships / sessions / connections', () => {
    const v = buildUserDetail({ ...base, memberships: [], sessions: [], connections: [], audit: [] })
    expect(v.found).toBe(true)
    expect(v.sessions).toEqual([])
  })
})
