// Pure view model for /users/[id] (admin-entity-linking D2). The page runs the
// queries; this shapes the typed model. Session rows carry ONLY metadata
// (ip/user-agent/expiry) — never the token (data boundary; asserted in the test).

export interface UserRow { id: string; email: string; name: string | null; role: string; emailVerified: boolean; createdAt: Date }
export interface MembershipRow { orgId: string; orgName: string; role: string }
export interface SessionRow { ipAddress: string | null; userAgent: string | null; createdAt: Date; expiresAt: Date }
export interface CreatedConnRow { id: string; orgId: string | null; orgName: string | null; status: string; displayName: string | null }
export interface AuditEntryRow { id: string; action: string; targetType: string; targetId: string; phase: string; createdAt: Date; relation: 'actor' | 'target' }

export interface UserDetailView {
  found: boolean
  user: UserRow | null
  memberships: MembershipRow[]
  sessions: SessionRow[]
  connections: CreatedConnRow[]
  audit: AuditEntryRow[]
}

export interface UserDetailInput {
  user: UserRow | null
  memberships: MembershipRow[]
  sessions: SessionRow[]
  connections: CreatedConnRow[]
  audit: AuditEntryRow[]
}

export function buildUserDetail(input: UserDetailInput): UserDetailView {
  if (!input.user) {
    return { found: false, user: null, memberships: [], sessions: [], connections: [], audit: [] }
  }
  return {
    found: true,
    user: input.user,
    memberships: [...input.memberships].sort((a, b) => a.orgName.localeCompare(b.orgName)),
    sessions: input.sessions, // caller orders newest-first (limit 10)
    connections: input.connections,
    audit: input.audit, // caller orders newest-first (limit 50)
  }
}
