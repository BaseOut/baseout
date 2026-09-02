// Production wiring for the report generation orchestrator — server-reports
// task 3. Binds the pure generateReport() to the master-DB store, the section-
// data fetch, R2 document storage, and the Trigger.dev render enqueue.

import { and, asc, desc, eq, gte, inArray, isNull, min } from "drizzle-orm";
import type { AppDb } from "../../db/worker";
import type { Env } from "../../env";
import { backupRuns, backupRunBases, reportRuns } from "../../db/schema";
import { enqueueRenderReport } from "../trigger-client";
import type { AssemblePriorCounts } from "./assemble";
import type { DefinitionForGen, GenerateDeps } from "./generate";
import { fetchSectionData } from "./section-data";
import { putDocument } from "./report-storage";
import { sendReportEmail } from "./email";
import type { DeliverDeps } from "./delivery";
import { spaceMatchesWorkerEnv } from "../assert-organization-runtime-env";
import {
  getDefinition,
  getRunById,
  insertDeliveries,
  insertRunningRun,
  markDelivery,
  markRunFailed,
  recordDocument,
} from "./store";
import type { PriorRun } from "./window";
import type { ReportSectionKey, ReportWindowKind } from "./types";

async function fetchFirstBackupStart(
  db: AppDb,
  spaceId: string,
  baseScope: string[] | null,
): Promise<Date | null> {
  if (baseScope && baseScope.length > 0) {
    const [row] = await db
      .select({ first: min(backupRuns.startedAt) })
      .from(backupRuns)
      .innerJoin(backupRunBases, eq(backupRunBases.runId, backupRuns.id))
      .where(
        and(
          eq(backupRuns.spaceId, spaceId),
          isNull(backupRuns.deletedAt),
          inArray(backupRunBases.atBaseId, baseScope),
        ),
      );
    return row?.first ?? null;
  }
  const [row] = await db
    .select({ first: min(backupRuns.startedAt) })
    .from(backupRuns)
    .where(and(eq(backupRuns.spaceId, spaceId), isNull(backupRuns.deletedAt)));
  return row?.first ?? null;
}

async function fetchPriorRuns(db: AppDb, defId: string): Promise<PriorRun[]> {
  const rows = await db
    .select({
      windowEnd: reportRuns.windowEnd,
      adHoc: reportRuns.adHoc,
      generationState: reportRuns.generationState,
    })
    .from(reportRuns)
    .where(eq(reportRuns.reportDefinitionId, defId))
    .orderBy(asc(reportRuns.windowEnd));
  return rows.map((r) => ({
    windowEnd: r.windowEnd,
    adHoc: r.adHoc,
    generationState: r.generationState as PriorRun["generationState"],
  }));
}

async function fetchPriorCounts(
  db: AppDb,
  defId: string,
): Promise<AssemblePriorCounts | null> {
  const [row] = await db
    .select({ backupsOk: reportRuns.backupsOk, backupsFailed: reportRuns.backupsFailed })
    .from(reportRuns)
    .where(and(eq(reportRuns.reportDefinitionId, defId), eq(reportRuns.generationState, "generated")))
    .orderBy(desc(reportRuns.windowEnd))
    .limit(1);
  if (!row) return null;
  return { backupsOk: row.backupsOk, backupsFailed: row.backupsFailed };
}

export function productionGenerateDeps(env: Env, db: AppDb): GenerateDeps {
  return {
    fetchDefinition: async (spaceId, defId) => {
      const row = await getDefinition(db, spaceId, defId);
      if (!row) return null;
      const def: DefinitionForGen = {
        id: row.id,
        spaceId: row.spaceId,
        name: row.name,
        sections: row.sections as ReportSectionKey[],
        baseScope: row.baseScope ?? null,
        windowKind: row.windowKind as ReportWindowKind,
        windowDays: row.windowDays,
        scheduleFormats: row.scheduleFormats,
      };
      return def;
    },
    fetchPriorRuns: (defId) => fetchPriorRuns(db, defId),
    fetchFirstBackupStart: (spaceId, baseScope) =>
      fetchFirstBackupStart(db, spaceId, baseScope),
    fetchSectionData: (args) => fetchSectionData(db, args),
    fetchPriorCounts: (defId) => fetchPriorCounts(db, defId),
    insertRunningRun: (row) => insertRunningRun(db, row),
    persistDocument: async (runId, doc) => {
      const run = await getRunById(db, runId);
      const spaceId = run?.spaceId ?? "unknown";
      const location = await putDocument(env.BACKUPS_R2, spaceId, runId, doc);
      await recordDocument(db, runId, location, doc);
    },
    enqueueRender: async ({ runId, spaceId, document, formats, reportName }) => {
      await enqueueRenderReport(env, {
        runId,
        spaceId,
        document,
        formats: formats.filter((f): f is "pdf" | "html" => f === "pdf" || f === "html"),
        appBaseUrl: env.PUBLIC_APP_URL,
        reportName,
      });
    },
    markFailed: (runId, error) => markRunFailed(db, runId, error),
    assertSpaceRuntimeEnv: (spaceId) => spaceMatchesWorkerEnv(db, env, spaceId),
  };
}

/** Production wiring for report delivery (the render callback + resend). */
export function productionDeliverDeps(env: Env, db: AppDb): DeliverDeps {
  return {
    insertDeliveries: (runId, rows) => insertDeliveries(db, runId, rows),
    sendEmail: (msg) => sendReportEmail(env, msg),
    markDelivery: (id, status, input) => markDelivery(db, id, status, input),
    now: () => new Date(),
  };
}
