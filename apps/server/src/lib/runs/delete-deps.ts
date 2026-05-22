// Production wiring for processRunDelete (Phase C.3 of
// openspec/changes/shared-backup-run-delete) deps.
//
// Mirrors apps/server/src/lib/runs/start-deps.ts. Extracted from the route
// handler so tests (runs-delete.test.ts) can substitute vi.fn() deps
// without touching the masterDb.

import { and, eq, inArray } from "drizzle-orm";
import {
  atBases,
  backupConfigurationBases,
  backupConfigurations,
  backupRuns,
  connections,
} from "../../db/schema";
import { buildRunPrefixes } from "./build-run-prefixes";
import type { ProcessRunDeleteDeps } from "./delete";

type MasterDb = ReturnType<typeof import("../../db/worker").createMasterDb>["db"];

const TERMINAL_STATUSES = [
  "succeeded",
  "failed",
  "cancelled",
  "trial_complete",
  "trial_truncated",
] as const;

export function buildRunDeleteDeps(db: MasterDb): ProcessRunDeleteDeps {
  return {
    fetchRunForDelete: async (id) => {
      const rows = await db
        .select({
          id: backupRuns.id,
          status: backupRuns.status,
        })
        .from(backupRuns)
        .where(eq(backupRuns.id, id))
        .limit(1);
      return rows[0] ?? null;
    },
    computeRunPrefixes: async (runId) => {
      // 1. Re-fetch the run for spaceId, connectionId, startedAt. The
      //    routing-layer fetchRunForDelete only reads (id, status); the
      //    prefix join needs the other columns. Two reads is fine — this
      //    only fires on a deliberate user delete.
      const runRows = await db
        .select({
          spaceId: backupRuns.spaceId,
          connectionId: backupRuns.connectionId,
          startedAt: backupRuns.startedAt,
        })
        .from(backupRuns)
        .where(eq(backupRuns.id, runId))
        .limit(1);
      const run = runRows[0];
      if (!run) {
        // 404 already covered by the pre-CAS fetchRunForDelete gate. If we
        // get here the row vanished between the two reads — treat as
        // empty prefixes (delete the metadata, no files to remove).
        return { prefixes: [], storageType: "r2_managed" };
      }

      // 2. orgId from the connection (β: organizationId is a UUID, not a
      //    slug — matches the run-start convention).
      const connRows = await db
        .select({ organizationId: connections.organizationId })
        .from(connections)
        .where(eq(connections.id, run.connectionId))
        .limit(1);
      const orgId = connRows[0]?.organizationId ?? "";

      // 3. Config row for storage_type + configId.
      const configRows = await db
        .select({
          id: backupConfigurations.id,
          storageType: backupConfigurations.storageType,
        })
        .from(backupConfigurations)
        .where(eq(backupConfigurations.spaceId, run.spaceId))
        .limit(1);
      const config = configRows[0];
      if (!config) {
        // No config means no recorded write paths — metadata-only delete.
        return { prefixes: [], storageType: "r2_managed" };
      }

      // 4. Bases joined to the config — same query shape as
      //    fetchIncludedBases in start-deps. Restrict to is_included=true
      //    so de-selected bases (whose old files DO exist on disk under
      //    the historical prefix) are intentionally skipped. That's a
      //    documented MVP approximation; the orphan-sweep follow-up
      //    handles the long tail.
      const baseRows = await db
        .select({ name: atBases.name })
        .from(backupConfigurationBases)
        .innerJoin(atBases, eq(atBases.id, backupConfigurationBases.atBaseId))
        .where(
          and(
            eq(backupConfigurationBases.backupConfigurationId, config.id),
            eq(backupConfigurationBases.isIncluded, true),
          ),
        );

      const prefixes = buildRunPrefixes(
        baseRows.map((r) => ({
          orgSlug: orgId,
          spaceName: run.spaceId,
          baseName: r.name,
        })),
        run.startedAt ?? new Date(0),
      );
      return { prefixes, storageType: config.storageType };
    },
    markRunDeleting: async (id) => {
      const rows = await db
        .update(backupRuns)
        .set({ status: "deleting", modifiedAt: new Date() })
        .where(
          and(
            eq(backupRuns.id, id),
            inArray(backupRuns.status, [...TERMINAL_STATUSES]),
          ),
        )
        .returning({ id: backupRuns.id });
      return rows.length > 0;
    },
  };
}
