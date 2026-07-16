// Drizzle wiring for the runAudited helper's deps — shared by every staff
// action route. INSERT-only: this module is the sole writer of
// admin_audit_log, and no update/delete of it may exist anywhere in admin
// (guard-tested).

import { and, count, eq, gt, sql } from 'drizzle-orm'
import { adminAuditLog } from '../db/schema'
import type { AuditDeps } from './audit'

export function buildAuditDeps(db: App.Locals['db']): AuditDeps {
  return {
    insertAuditRow: async (row) => {
      const inserted = await db
        .insert(adminAuditLog)
        .values({
          phase: row.phase,
          intentId: row.intentId ?? null,
          actorUserId: row.actorUserId,
          actorEmail: row.actorEmail,
          action: row.action,
          targetType: row.targetType,
          targetId: row.targetId,
          organizationId: row.organizationId ?? null,
          params: row.params ?? null,
        })
        .returning({ id: adminAuditLog.id })
      return inserted[0].id
    },
    countRecentIntentsByActor: async (actorUserId, windowMs) => {
      const since = new Date(Date.now() - windowMs).toISOString()
      // Date params inside raw sql`` fragments must be ISO strings — a bare
      // Date serializes via toString() and Postgres rejects it.
      const rows = await db
        .select({ n: count() })
        .from(adminAuditLog)
        .where(
          and(
            eq(adminAuditLog.actorUserId, actorUserId),
            eq(adminAuditLog.phase, 'intent'),
            gt(adminAuditLog.createdAt, sql`${since}::timestamptz`),
          ),
        )
      return rows[0]?.n ?? 0
    },
  }
}
