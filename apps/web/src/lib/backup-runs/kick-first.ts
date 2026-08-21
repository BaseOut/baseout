import { and, desc, eq, sql } from 'drizzle-orm'
import type { AppDb } from '../../db'
import {
  backupConfigurationBases,
  backupConfigurations,
  backupRuns,
  connections,
  platforms,
  spaces,
} from '../../db/schema'
import type { BackupEngineClient } from '../backup-engine'
import { startBackupRun } from './start'
import type { ConnectionRow, SpaceRow } from './start'

/**
 * If this Space has never captured a run, start one. Used by internal-space-ready
 * so @openside.com Spaces get Airtable data without waiting for the first cron.
 * No-ops when a run already exists, the engine is unbound, or startBackupRun
 * rejects (no connection / no bases).
 */
export async function kickFirstBackupIfIdle(
  db: AppDb,
  engine: BackupEngineClient | null,
  input: { organizationId: string; spaceId: string },
): Promise<void> {
  if (!engine) return

  const [existing] = await db
    .select({ id: backupRuns.id })
    .from(backupRuns)
    .where(eq(backupRuns.spaceId, input.spaceId))
    .limit(1)
  if (existing) return

  await startBackupRun(
    { spaceId: input.spaceId, organizationId: input.organizationId },
    {
      fetchSpaceById: async (id) => {
        const [row] = await db
          .select({ id: spaces.id, organizationId: spaces.organizationId })
          .from(spaces)
          .where(eq(spaces.id, id))
          .limit(1)
        return (row as SpaceRow | undefined) ?? null
      },
      fetchAirtableConnection: async (orgId) => {
        const [row] = await db
          .select({
            id: connections.id,
            organizationId: connections.organizationId,
            status: connections.status,
          })
          .from(connections)
          .innerJoin(platforms, eq(platforms.id, connections.platformId))
          .where(
            and(
              eq(connections.organizationId, orgId),
              eq(platforms.slug, 'airtable'),
            ),
          )
          .orderBy(desc(connections.createdAt))
          .limit(1)
        return (row as ConnectionRow | undefined) ?? null
      },
      countIncludedBases: async (sid) => {
        const rows = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(backupConfigurationBases)
          .innerJoin(
            backupConfigurations,
            eq(
              backupConfigurations.id,
              backupConfigurationBases.backupConfigurationId,
            ),
          )
          .where(
            and(
              eq(backupConfigurations.spaceId, sid),
              eq(backupConfigurationBases.isIncluded, true),
            ),
          )
        return Number(rows[0]?.count ?? 0)
      },
      insertBackupRun: async (insert) => {
        const [row] = await db
          .insert(backupRuns)
          .values({
            spaceId: insert.spaceId,
            connectionId: insert.connectionId,
            status: 'queued',
            triggeredBy: 'scheduled',
            isTrial: insert.isTrial,
          })
          .returning({ id: backupRuns.id })
        if (!row) throw new Error('insert_backup_run_returned_no_row')
        return row.id
      },
      deleteBackupRun: async (id) => {
        await db.delete(backupRuns).where(eq(backupRuns.id, id))
      },
      engineStartRun: (id) => engine.startRun(id),
    },
  )
}
