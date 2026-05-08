// POST /api/internal/runs/:runId/start
//
// Routing + DB-and-Trigger.dev wiring on top of the pure processRunStart()
// function in src/lib/runs/start.ts. apps/web's POST /api/spaces/:spaceId/
// backup-runs (Phase 9) calls this via the BACKUP_ENGINE service binding
// once it has INSERTed a backup_runs row in 'queued' state.
//
// Token gate is applied by middleware (path begins /api/internal/). This
// handler validates URL shape (UUID), then delegates to processRunStart
// which reads the run + connection + config + included bases from the
// master DB, fans out one Trigger.dev backup-base task per base, and
// returns the list of trigger run IDs.
//
// Result-code → HTTP-status mapping:
//   ok                          → 202  { runId, triggerRunIds }
//   run_not_found               → 404
//   run_already_started         → 409
//   connection_not_found        → 404
//   invalid_connection          → 409
//   config_not_found            → 404
//   unsupported_storage_type    → 422
//   no_bases_selected           → 422

import { and, eq } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import {
  atBases,
  backupConfigurationBases,
  backupConfigurations,
  backupRuns,
  connections,
  type BackupConfigurationRow,
  type BackupRunRow,
  type ConnectionRow,
} from "../../../../db/schema";
import { enqueueBackupBase } from "../../../../lib/trigger-client";
import {
  processRunStart,
  type IncludedBase,
  type ProcessRunStartResult,
} from "../../../../lib/runs/start";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function statusFor(result: ProcessRunStartResult): number {
  if (result.ok) return 202;
  switch (result.error) {
    case "run_not_found":
    case "connection_not_found":
    case "config_not_found":
      return 404;
    case "run_already_started":
    case "invalid_connection":
      return 409;
    case "unsupported_storage_type":
    case "no_bases_selected":
      return 422;
  }
}

export async function runsStartHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  runId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(runId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  // The pure function takes injected DB queries. Production wiring uses the
  // per-request masterDb; tests substitute vi.fn() deps and call
  // processRunStart directly (see runs-start.test.ts).
  const { db } = locals.getMasterDb();

  const result = await processRunStart(
    { runId },
    {
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
        const rows = await db
          .select({
            atBaseId: atBases.atBaseId,
            name: atBases.name,
          })
          .from(backupConfigurationBases)
          .innerJoin(
            atBases,
            eq(atBases.atBaseId, backupConfigurationBases.atBaseId),
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
    },
  );

  if (result.ok) {
    return jsonResponse(
      { runId: result.runId, triggerRunIds: result.triggerRunIds },
      statusFor(result),
    );
  }
  return jsonResponse({ error: result.error }, statusFor(result));
}
