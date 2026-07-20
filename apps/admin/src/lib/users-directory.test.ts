import { describe, expect, it } from 'vitest'
import { buildUsersDirectory } from './users-directory'

const user = (id: string, email: string, over = {}) => ({ id, name: null, email, role: 'customer', emailVerified: true, createdAt: new Date('2026-01-01'), ...over })

describe('buildUsersDirectory', () => {
  it('groups memberships (org-name sorted) and picks the latest session; sorted by email', () => {
    const rows = buildUsersDirectory({
      users: [user('u2', 'bob@x.com'), user('u1', 'ann@x.com', { role: 'super' })],
      memberships: [
        { userId: 'u1', organizationId: 'o2', organizationName: 'Beta', role: 'member' },
        { userId: 'u1', organizationId: 'o1', organizationName: 'Acme', role: 'admin' },
      ],
      latestSessions: [{ userId: 'u1', updatedAt: new Date('2026-07-10') }],
    })
    expect(rows.map((r) => r.email)).toEqual(['ann@x.com', 'bob@x.com'])
    const ann = rows.find((r) => r.id === 'u1')!
    expect(ann.memberships.map((m) => m.organizationName)).toEqual(['Acme', 'Beta']) // org-name sorted
    expect(ann.lastSeenAt).toEqual(new Date('2026-07-10'))
    expect(ann.role).toBe('super')
  })

  it('marks never-signed-in users (no session) and no-membership users', () => {
    const rows = buildUsersDirectory({ users: [user('u1', 'solo@x.com')], memberships: [], latestSessions: [] })
    expect(rows[0].lastSeenAt).toBeNull()
    expect(rows[0].memberships).toEqual([])
  })
})
