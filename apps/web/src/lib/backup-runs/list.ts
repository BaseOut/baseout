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
 * reads. Mirrors apps/web/src/db/schema/core.ts:322 — keep in sync if
 * either side adds a column the summary surfaces.
 */
export interface BackupRunRowLike {
  id: string;
  status: string;
  isTrial: boolean;
  recordCount: number | null;
  tableCount: number | null;
  attachmentCount: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  triggerRunIds: string[] | null;
  createdAt: Date;
}

export interface ListRecentRunsDeps {
  fetchRuns: (
    spaceId: string,
    limit: number,
  ) => Promise<BackupRunRowLike[]>;
}

export async function listRecentRuns(
  spaceId: string,
  limit: number,
  deps: ListRecentRunsDeps,
): Promise<BackupRunSummary[]> {
  const rows = await deps.fetchRuns(spaceId, limit);
  return rows.map(rowToSummary);
}

function rowToSummary(row: BackupRunRowLike): BackupRunSummary {
  return {
    id: row.id,
    status: row.status,
    isTrial: row.isTrial,
    recordCount: row.recordCount,
    tableCount: row.tableCount,
    attachmentCount: row.attachmentCount,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    errorMessage: row.errorMessage,
    triggerRunIds: row.triggerRunIds,
    createdAt: row.createdAt.toISOString(),
  };
}
