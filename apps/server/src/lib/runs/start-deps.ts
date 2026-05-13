// Production wiring for processRunStart (Phase 8a) deps.
//
// Extracted from src/pages/api/internal/runs/start.ts so the SpaceDO
// scheduler (Phase B of baseout-backup-schedule-and-cancel) can drive
// the same code path without going through a self-binding fetch hop.
//
// The deps shape itself is owned by src/lib/runs/start.ts —
// `ProcessRunStartDeps` — and the two callers (route handler + DO
// alarm) share this factory so future changes land in one place.

import { and, eq } from "drizzle-orm";
import {
  atBases,
  backupConfigurationBases,
  backupConfigurations,
  backupRuns,
  connections,
  type BackupConfigurationRow,
  type BackupRunRow,
  type ConnectionRow,
} from "../../db/schema";
import { enqueueBackupBase } from "../trigger-client";
import type { Env } from "../../env";
import type { ProcessRunStartDeps, IncludedBase } from "./start";

type MasterDb = ReturnType<typeof import("../../db/worker").createMasterDb>["db"];

export function buildRunStartDeps(db: MasterDb, env: Env): ProcessRunStartDeps {
  return {
    fetchRunById: async (id) => {
      const rows = await db
        .select()
        .from(backupRuns)
        .where(eq(backupRuns.id, id))
        .limit(1);
      return (rows[0] ?? null) as BackupRunRow | null;
    },
    fetchConnectionById: async (id) => {
      const rows = await db
        .select()
        .from(connections)
        .where(eq(connections.id, id))
        .limit(1);
      return (rows[0] ?? null) as ConnectionRow | null;
    },
    fetchConfigBySpace: async (spaceId) => {
      const rows = await db
        .select()
        .from(backupConfigurations)
        .where(eq(backupConfigurations.spaceId, spaceId))
        .limit(1);
      return (rows[0] ?? null) as BackupConfigurationRow | null;
    },
    fetchIncludedBases: async (configId) => {
      // backup_configuration_bases.at_base_id is a FK to at_bases.id (UUID),
      // NOT to at_bases.at_base_id (the Airtable identifier "appXXX..."). The
      // column name is misleading — see apps/web/src/db/schema/core.ts.
      const rows = await db
        .select({
          atBaseId: atBases.atBaseId,
          name: atBases.name,
        })
        .from(backupConfigurationBases)
        .innerJoin(
          atBases,
          eq(atBases.id, backupConfigurationBases.atBaseId),
        )
        .where(
          and(
            eq(backupConfigurationBases.backupConfigurationId, configId),
            eq(backupConfigurationBases.isIncluded, true),
          ),
        );
      return rows as IncludedBase[];
    },
    updateRunStarted: async (id, startedAt) => {
      await db
        .update(backupRuns)
        .set({ status: "running", startedAt, modifiedAt: startedAt })
        .where(eq(backupRuns.id, id));
    },
    updateRunTriggerIds: async (id, triggerRunIds) => {
      await db
        .update(backupRuns)
        .set({ triggerRunIds, modifiedAt: new Date() })
        .where(eq(backupRuns.id, id));
    },
    enqueueBackupBase: (payload) => enqueueBackupBase(env, payload),
  };
}
