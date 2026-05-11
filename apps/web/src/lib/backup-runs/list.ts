/**
 * Pure helper for GET /api/spaces/:spaceId/backup-runs.
 *
 * The route owns the Drizzle SELECT (`.from(backupRuns).where(...).orderBy(
 * desc(backupRuns.createdAt)).limit(...)`) and passes the rows in via the
 * `fetchRuns` dep. This helper does the per-row mapping — Date → ISO
 * string, null preservation — so the BackupHistoryWidget can render
 * across SSR/hydrated/polled fetches without per-call shape variance.
 *
 * Why a slim BackupRunRowLike instead of importing typeof backupRuns
 * .$inferSelect: keeps tests independent of the wider Drizzle table
 * surface and matches the start.ts SpaceRow / ConnectionRow pattern.
 */

import type { BackupRunSummary } from "./types";

/**
 * Slim shape covering the subset of `backup_runs` columns the helper
 * reads, plus the LEFT-JOIN-derived connection + configuration fields.
 * Mirrors apps/web/src/db/schema/core.ts:322 — keep in sync if either
 * side adds a column the summary surfaces.
 */
export interface BackupRunRowLike {
  id: string;
  status: string;
  isTrial: boolean;
  triggeredBy: string;
  recordCount: number | null;
  tableCount: number | null;
  attachmentCount: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  triggerRunIds: string[] | null;
  createdAt: Date;
  /** FK on backup_runs — non-null in schema; may not resolve under LEFT JOIN. */
  connectionId: string;
  /** LEFT JOIN result — null when the connection was deleted. */
  connectionDisplayName: string | null;
  /** LEFT JOIN result — null when no configuration row exists for the Space. */
  configStorageType: string | null;
  /** LEFT JOIN result — null when no configuration row exists for the Space. */
  configMode: string | null;
}

/**
 * Per-Space included-bases list (one round-trip per GET, not per run).
 * Reflects current `backup_configuration_bases` selection — not a per-run
 * snapshot. Stamped onto every BackupRunSummary so the widget detail
 * panel can render without a second fetch.
 */
export interface IncludedBase {
  id: string;
  name: string;
}

export interface ListRecentRunsDeps {
  fetchRuns: (
    spaceId: string,
    limit: number,
  ) => Promise<BackupRunRowLike[]>;
  fetchIncludedBases: (spaceId: string) => Promise<IncludedBase[]>;
}

export async function listRecentRuns(
  spaceId: string,
  limit: number,
  deps: ListRecentRunsDeps,
): Promise<BackupRunSummary[]> {
  const [rows, includedBases] = await Promise.all([
    deps.fetchRuns(spaceId, limit),
    deps.fetchIncludedBases(spaceId),
  ]);
  return rows.map((row) => rowToSummary(row, includedBases));
}

function rowToSummary(
  row: BackupRunRowLike,
  includedBases: IncludedBase[],
): BackupRunSummary {
  const connection =
    row.connectionDisplayName === null && row.connectionId === ""
      ? null
      : { id: row.connectionId, displayName: row.connectionDisplayName };
  const configuration =
    row.configStorageType !== null && row.configMode !== null
      ? { storageType: row.configStorageType, mode: row.configMode }
      : null;
  return {
    id: row.id,
    status: row.status,
    isTrial: row.isTrial,
    triggeredBy: row.triggeredBy,
    recordCount: row.recordCount,
    tableCount: row.tableCount,
    attachmentCount: row.attachmentCount,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    errorMessage: row.errorMessage,
    triggerRunIds: row.triggerRunIds,
    createdAt: row.createdAt.toISOString(),
    connection,
    configuration,
    includedBases,
  };
}
