// Production section-data fetch — server-reports task 2.3 (data sources).
//
// Backups + connections come from the master DB (backup_runs / backup_run_bases
// / connections). Schema + docs live in the PER-SPACE database (bo_at_* tables);
// wiring those reads is deferred — until then those sections fall back to their
// clean state (the builders emit the clean line for empty input). Trends and
// dataHealth are stubbed (task 6). This keeps the pipeline honest: a section
// with no wired source renders "nothing this period", never fabricated data.

import { and, eq, gte, lt, isNull, inArray } from "drizzle-orm";
import type { AppDb } from "../../db/worker";
import {
  backupRuns,
  backupRunBases,
  connections,
  spaces,
} from "../../db/schema";
import type { SectionData } from "./generate";
import type { ReportSectionKey } from "./types";
import type { BackupBaseOutcome, ConnectionSnapshot } from "./sections";

function mapBackupOutcome(status: string): "ok" | "failed" | "partial" {
  if (status === "succeeded") return "ok";
  if (status === "trial_complete" || status === "trial_truncated") return "partial";
  return "failed";
}

function mapConnectionStatus(status: string): "connected" | "auth_failed" | "broken" {
  if (status === "active") return "connected";
  if (status === "invalid" || status === "pending_reauth") return "auth_failed";
  return "broken";
}

async function fetchBackups(
  db: AppDb,
  spaceId: string,
  baseScope: string[] | null,
  window: { start: Date; end: Date },
): Promise<BackupBaseOutcome[]> {
  const conds = [
    eq(backupRuns.spaceId, spaceId),
    isNull(backupRuns.deletedAt),
    gte(backupRuns.startedAt, window.start),
    lt(backupRuns.startedAt, window.end),
  ];
  if (baseScope && baseScope.length > 0) {
    conds.push(inArray(backupRunBases.atBaseId, baseScope));
  }
  const rows = await db
    .select({
      baseName: backupRunBases.baseName,
      status: backupRunBases.status,
      tablesCount: backupRunBases.tablesCount,
      recordsCount: backupRunBases.recordsCount,
      runId: backupRunBases.runId,
      errorMessage: backupRunBases.errorMessage,
    })
    .from(backupRunBases)
    .innerJoin(backupRuns, eq(backupRunBases.runId, backupRuns.id))
    .where(and(...conds));

  return rows.map((r) => ({
    baseName: r.baseName,
    outcome: mapBackupOutcome(r.status),
    tables: r.tablesCount,
    records: r.recordsCount,
    // Per-base byte volume is not captured today — shows "0 B" until it is.
    volumeBytes: 0,
    runId: r.runId,
    error: r.errorMessage ?? undefined,
  }));
}

async function fetchConnections(
  db: AppDb,
  spaceId: string,
): Promise<ConnectionSnapshot[]> {
  const [space] = await db
    .select({ organizationId: spaces.organizationId })
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);
  if (!space) return [];

  const rows = await db
    .select({
      id: connections.id,
      displayName: connections.displayName,
      status: connections.status,
    })
    .from(connections)
    .where(eq(connections.organizationId, space.organizationId));

  return rows.map((r) => ({
    name: r.displayName ?? "Airtable",
    kind: "source" as const,
    status: mapConnectionStatus(r.status),
    connectionId: r.id,
  }));
}

/**
 * Fetch data for exactly the requested sections. Sections without a wired source
 * (schema, docs) are omitted so the assembler renders their clean state.
 */
export async function fetchSectionData(
  db: AppDb,
  args: {
    spaceId: string;
    sections: ReportSectionKey[];
    baseScope: string[] | null;
    window: { start: Date; end: Date };
  },
): Promise<SectionData> {
  const wants = new Set(args.sections);
  const data: SectionData = {};

  if (wants.has("backups")) {
    data.backups = await fetchBackups(db, args.spaceId, args.baseScope, args.window);
  }
  if (wants.has("connections")) {
    const conns = await fetchConnections(db, args.spaceId);
    // Transition-history audit isn't wired yet — flag the gap honestly.
    data.connections = { connections: conns, historyThin: true };
  }
  // schema + docs: per-space DB reads deferred → clean-state fallback.
  return data;
}
