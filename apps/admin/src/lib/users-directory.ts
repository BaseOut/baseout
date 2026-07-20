// Pure assembly for the /users directory (admin-entity-directories D1). Joins
// users + their org memberships + latest session in memory. Search/role filter +
// limit are applied in SQL on the page.

export interface UserInput {
  id: string
  name: string | null
  email: string
  role: string
  emailVerified: boolean
  createdAt: Date
}
export interface MembershipInput {
  userId: string
  organizationId: string
  organizationName: string
  role: string
}
export interface UserLatestSession {
  userId: string
  updatedAt: Date
}

export interface UserRow {
  id: string
  name: string | null
  email: string
  role: string
  emailVerified: boolean
  createdAt: Date
  memberships: { organizationId: string; organizationName: string; role: string }[]
  lastSeenAt: Date | null
}

export function buildUsersDirectory(input: {
  users: UserInput[]
  memberships: MembershipInput[]
  latestSessions: UserLatestSession[]
}): UserRow[] {
  const byUser = new Map<string, MembershipInput[]>()
  for (const m of input.memberships) {
    const list = byUser.get(m.userId) ?? []
    list.push(m)
    byUser.set(m.userId, list)
  }
  const sessions = new Map(input.latestSessions.map((s) => [s.userId, s.updatedAt]))

  return input.users
    .map((u): UserRow => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt,
      memberships: (byUser.get(u.id) ?? [])
        .map((m) => ({ organizationId: m.organizationId, organizationName: m.organizationName, role: m.role }))
        .sort((a, b) => a.organizationName.localeCompare(b.organizationName)),
      lastSeenAt: sessions.get(u.id) ?? null, // null = never signed in
    }))
    .sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''))
}
