import type { ProvisionDatabaseOptions, SpaceScheduleInput } from './backup-engine'
import type { BackupEngineClient } from './backup-engine'
import type { AppDb } from '../db'
import { backupConfigurations, spaceDatabases } from '../db/schema'
import { resolveCapabilities } from './capabilities/resolve'
import { and, eq } from 'drizzle-orm'
import { kickFirstBackupIfIdle } from './backup-runs/kick-first'

export interface InternalSpaceDatabaseState {
  status: string
  backend: string
  recordsEnabled: boolean
}

export interface EnsureInternalSpaceReadyInput {
  organizationId: string
  spaceId: string
  userId?: string | null
  /** Default true. Set false when the caller is already starting a backup run. */
  kickBackupIfIdle?: boolean
}

export interface EnsureInternalSpaceReadyDeps {
  resolveInternal: (organizationId: string) => Promise<boolean>
  setDynamicMode: (spaceId: string) => Promise<void>
  fetchSpaceDatabase: (spaceId: string) => Promise<InternalSpaceDatabaseState | null>
  enableRecords: (spaceId: string) => Promise<void>
  provisionDatabase: (
    spaceId: string,
    opts: ProvisionDatabaseOptions,
  ) => Promise<unknown>
  armSchedule?: (spaceId: string) => Promise<void>
  kickBackupIfIdle?: (input: {
    organizationId: string
    spaceId: string
  }) => Promise<void>
}

export async function ensureInternalSpaceReady(
  input: EnsureInternalSpaceReadyInput,
  deps: EnsureInternalSpaceReadyDeps,
): Promise<void> {
  const internal = await deps.resolveInternal(input.organizationId)
  if (!internal) return

  await deps.setDynamicMode(input.spaceId)
  try {
    await deps.armSchedule?.(input.spaceId)
  } catch {
    // Best-effort: the config write is load-bearing; schedule arming retries
    // on the next config save or internal readiness pass.
  }

  if (input.kickBackupIfIdle !== false) {
    try {
      await deps.kickBackupIfIdle?.({
        organizationId: input.organizationId,
        spaceId: input.spaceId,
      })
    } catch {
      // Best-effort: an idle Space still has its schedule armed.
    }
  }

  const db = await deps.fetchSpaceDatabase(input.spaceId)
  if (db?.status === 'active' && db.backend === 'managed_pg') {
    if (!db.recordsEnabled) {
      await deps.enableRecords(input.spaceId)
    }
    return
  }

  await deps.provisionDatabase(input.spaceId, {
    backend: 'managed_pg',
    recordsEnabled: true,
    provisionedByUserId: input.userId ?? undefined,
  })
}

export function buildInternalSpaceReadyDeps(
  db: AppDb,
  engine: BackupEngineClient | null,
): EnsureInternalSpaceReadyDeps {
  return {
    resolveInternal: async (organizationId) => {
      const resolved = await resolveCapabilities(db, organizationId, 'airtable')
      return resolved.internal
    },
    setDynamicMode: async (spaceId) => {
      await db
        .insert(backupConfigurations)
        .values({ spaceId, mode: 'dynamic' })
        .onConflictDoUpdate({
          target: backupConfigurations.spaceId,
          set: { mode: 'dynamic', modifiedAt: new Date() },
        })
    },
    armSchedule: async (spaceId) => {
      if (!engine) return
      const [row] = await db
        .select({
          scope: backupConfigurations.scope,
          dataFrequency: backupConfigurations.frequency,
          schemaFrequency: backupConfigurations.schemaFrequency,
        })
        .from(backupConfigurations)
        .where(eq(backupConfigurations.spaceId, spaceId))
        .limit(1)
      if (!row) return
      const schedule: SpaceScheduleInput = {
        scope: row.scope,
        dataFrequency: row.dataFrequency,
        schemaFrequency: row.schemaFrequency,
      }
      await engine.setSpaceFrequency(spaceId, schedule)
    },
    fetchSpaceDatabase: async (spaceId) => {
      const [row] = await db
        .select({
          status: spaceDatabases.status,
          backend: spaceDatabases.backend,
          recordsEnabled: spaceDatabases.recordsEnabled,
        })
        .from(spaceDatabases)
        .where(eq(spaceDatabases.spaceId, spaceId))
        .limit(1)
      return row ?? null
    },
    enableRecords: async (spaceId) => {
      await db
        .update(spaceDatabases)
        .set({ recordsEnabled: true, modifiedAt: new Date() })
        .where(
          and(
            eq(spaceDatabases.spaceId, spaceId),
            eq(spaceDatabases.backend, 'managed_pg'),
            eq(spaceDatabases.status, 'active'),
          ),
        )
    },
    provisionDatabase: async (spaceId, opts) => {
      if (!engine) return
      await engine.provisionDatabase(spaceId, opts)
    },
    kickBackupIfIdle: async (input) => {
      await kickFirstBackupIfIdle(db, engine, input)
    },
  }
}
