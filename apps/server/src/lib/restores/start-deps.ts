// Production wiring for processRestoreStart (server-restore Phase B.4) deps.
//
// Mirrors apps/server/src/lib/runs/start-deps.ts. Extracted so future callers
// (e.g. a SpaceDO restore-alarm) can share the same dep factory without
// going through an additional self-binding fetch hop.
//
// The deps shape is owned by src/lib/restores/start.ts — ProcessRestoreStartDeps.

import { and, eq } from "drizzle-orm";
import {
  restoreRuns,
  connections,
  storageDestinations,
  backupConfigurations,
  backupRuns,
  atBases,
  type RestoreRunRow,
  type ConnectionRow,
  type StorageDestinationRow,
} from "../../db/schema";
import { resolveTypeFilter } from "../storage/resolve-destination-type";
import { enqueueRestoreBase } from "../trigger-client";
import type { Env } from "../../env";
import type { ProcessRestoreStartDeps, SourceRunInfo } from "./start";

type MasterDb = ReturnType<typeof import("../../db/worker").createMasterDb>["db"];

export function buildRestoreStartDeps(db: MasterDb, env: Env): ProcessRestoreStartDeps {
  return {
    fetchRestoreRunById: async (id) => {
      const rows = await db
        .select()
        .from(restoreRuns)
        .where(eq(restoreRuns.id, id))
        .limit(1);
      return (rows[0] ?? null) as RestoreRunRow | null;
    },
    fetchConnectionById: async (id) => {
      const rows = await db
        .select()
        .from(connections)
        .where(eq(connections.id, id))
        .limit(1);
      return (rows[0] ?? null) as ConnectionRow | null;
    },
    fetchStorageDestinationBySpace: async (spaceId) => {
      // Multi-destination: a Space holds one row per provider type. Resolve
      // the PRIMARY (backup_configurations.storage_type); legacy single-row
      // lookup when there's no config or it's row-less r2_managed.
      const [config] = await db
        .select({ storageType: backupConfigurations.storageType })
        .from(backupConfigurations)
        .where(eq(backupConfigurations.spaceId, spaceId))
        .limit(1);
      const typeFilter = resolveTypeFilter(null, config?.storageType ?? null);
      const rows = await db
        .select()
        .from(storageDestinations)
        .where(
          typeFilter === null
            ? eq(storageDestinations.spaceId, spaceId)
            : and(
                eq(storageDestinations.spaceId, spaceId),
                eq(storageDestinations.type, typeFilter),
              ),
        )
        .limit(1);
      return (rows[0] ?? null) as StorageDestinationRow | null;
    },
    fetchSourceRun: async (sourceRunId) => {
      const rows = await db
        .select({
          id: backupRuns.id,
          spaceId: backupRuns.spaceId,
          status: backupRuns.status,
          startedAt: backupRuns.startedAt,
        })
        .from(backupRuns)
        .where(eq(backupRuns.id, sourceRunId))
        .limit(1);
      return (rows[0] ?? null) as SourceRunInfo | null;
    },
    fetchBaseName: async (atBaseId) => {
      // atBaseId here is the Airtable base ID (e.g. "appXXXXXX") from
      // restore_runs.scope_target.baseId — matches at_bases.at_base_id.
      const rows = await db
        .select({ name: atBases.name })
        .from(atBases)
        .where(eq(atBases.atBaseId, atBaseId))
        .limit(1);
      return rows[0]?.name ?? null;
    },
    updateRestoreRunStarted: async (id, startedAt) => {
      await db
        .update(restoreRuns)
        .set({ status: "running", startedAt, modifiedAt: startedAt })
        .where(eq(restoreRuns.id, id));
    },
    updateRestoreRunTriggerIds: async (id, triggerRunIds) => {
      await db
        .update(restoreRuns)
        .set({ triggerRunIds, modifiedAt: new Date() })
        .where(eq(restoreRuns.id, id));
    },
    enqueueRestoreBase: (payload) => enqueueRestoreBase(env, payload),
  };
}
