// GET /api/peek/[type]/[id] — JSON summary for the peek sidebar
// (admin-entity-linking D4). One route, a switch over the five summarizers.
// role='super' gated by middleware (covers /api/*). GET-only, always fresh.
import type { APIRoute } from 'astro'
import { and, count, desc, eq, max } from 'drizzle-orm'
import { users, sessions } from '@baseout/db-schema'
import { atBases, backupRuns, connections, organizations, organizationMembers, spaces } from '../../../../db/schema'
import { summarizeBackupRun, summarizeConnection, summarizeOrg, summarizeSpace, summarizeUser, type PeekType } from '../../../../lib/peek'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
const TYPES: PeekType[] = ['org', 'space', 'user', 'connection', 'backup_run']

export const GET: APIRoute = async ({ params, locals }) => {
  const type = params.type as PeekType
  const id = params.id!
  if (!TYPES.includes(type)) return json(400, { error: 'unknown_type' })
  const { db } = locals

  if (type === 'org') {
    const [row] = await db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug, createdAt: organizations.createdAt }).from(organizations).where(eq(organizations.id, id)).limit(1)
    if (!row) return json(404, { error: 'not_found' })
    const [[sc], [mc]] = await Promise.all([
      db.select({ n: count() }).from(spaces).where(eq(spaces.organizationId, id)),
      db.select({ n: count() }).from(organizationMembers).where(eq(organizationMembers.organizationId, id)),
    ])
    return json(200, summarizeOrg({ ...row, spaceCount: Number(sc?.n ?? 0), memberCount: Number(mc?.n ?? 0) }))
  }

  if (type === 'space') {
    const [row] = await db.select({ id: spaces.id, name: spaces.name, status: spaces.status, orgName: organizations.name }).from(spaces).leftJoin(organizations, eq(spaces.organizationId, organizations.id)).where(eq(spaces.id, id)).limit(1)
    if (!row) return json(404, { error: 'not_found' })
    const [bc] = await db.select({ n: count() }).from(atBases).where(eq(atBases.spaceId, id))
    return json(200, summarizeSpace({ ...row, baseCount: Number(bc?.n ?? 0) }))
  }

  if (type === 'user') {
    const [row] = await db.select({ id: users.id, email: users.email, name: users.name, role: users.role }).from(users).where(eq(users.id, id)).limit(1)
    if (!row) return json(404, { error: 'not_found' })
    const [ls] = await db.select({ at: max(sessions.updatedAt) }).from(sessions).where(eq(sessions.userId, id))
    return json(200, summarizeUser({ ...row, lastSeenAt: ls?.at ?? null }))
  }

  if (type === 'connection') {
    const [row] = await db.select({ id: connections.id, displayName: connections.displayName, status: connections.status, orgName: organizations.name }).from(connections).leftJoin(organizations, eq(connections.organizationId, organizations.id)).where(eq(connections.id, id)).limit(1)
    if (!row) return json(404, { error: 'not_found' })
    return json(200, summarizeConnection(row))
  }

  // backup_run
  const [row] = await db.select({ id: backupRuns.id, status: backupRuns.status, kind: backupRuns.kind, recordCount: backupRuns.recordCount, completedAt: backupRuns.completedAt, spaceName: spaces.name }).from(backupRuns).leftJoin(spaces, eq(backupRuns.spaceId, spaces.id)).where(eq(backupRuns.id, id)).limit(1)
  if (!row) return json(404, { error: 'not_found' })
  return json(200, summarizeBackupRun(row))
}
