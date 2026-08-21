/**
 * ssr-map — the pure mapping between the master-DB rows and the restore view models.
 *
 * The `/restore` page reads real rows (`backup_runs` + `backup_run_bases` for the snapshot list,
 * `restore_runs` for the history log) and has to shape them into the `RestoreSnapshot` /
 * `RestoreRunMeta` models the promoted views render. That mapping carries the only genuinely
 * non-trivial decisions on the SSR side — which backup statuses are restorable, how a snapshot
 * decides which bases it actually holds, and how a restore run's status becomes an outcome — so it
 * lives here under `tsc --strict` + Vitest rather than inline in the `.astro` frontmatter (which is
 * type-checked but not unit-tested). Formatting (timezone, locale) stays in `lib/time.ts`; nothing
 * here touches a clock.
 */
import type { SnapshotStatus } from './request';

/** restore_runs.status | backup_runs.status → RestoreRunMeta['outcome'] the history row renders. */
export type RestoreOutcomeKind = 'complete' | 'partial' | 'none' | 'running';

/**
 * A backup run's DB status → the snapshot health grade the picker shows. Only `succeeded` /
 * `trial_succeeded` runs are OFFERED as snapshots (they are the ones the restore API accepts — see
 * RESTORABLE_STATUSES in the POST route), so in practice this returns 'succeeded'; the broader
 * vocabulary is mapped for completeness and for the history/failed paths.
 */
export function toSnapshotStatus(dbStatus: string): SnapshotStatus {
  switch (dbStatus) {
    case 'succeeded':
    case 'trial_succeeded':
    case 'trial_complete':
      return 'succeeded';
    case 'trial_truncated':
    case 'partial':
      return 'partial';
    case 'failed':
      return 'failed';
    case 'cancelled':
    case 'cancelling':
      return 'cancelled';
    default:
      return 'succeeded';
  }
}

/** The backup statuses a restore may start from — mirrors RESTORABLE_STATUSES in the POST route. */
export const RESTORABLE_BACKUP_STATUSES = ['succeeded', 'trial_succeeded'] as const;

/** restore_runs.status → the History table's statusMeta key (succeeded|running|queued|failed|cancelled). */
export function toHistoryStatus(dbStatus: string): string {
  switch (dbStatus) {
    case 'succeeded':
      return 'succeeded';
    case 'running':
      return 'running';
    case 'queued':
      return 'queued';
    case 'failed':
      return 'failed';
    case 'cancelled':
    case 'cancelling':
      return 'cancelled';
    default:
      return 'cancelled';
  }
}

/**
 * restore_runs.status (+ what actually landed) → the outcome verb the audit row states.
 * A restore still in flight is `running`; a finished-clean one is `complete`; a stopped one is
 * `partial` when it wrote something and `none` when it wrote nothing — `status` alone cannot say
 * which (D04's rule), so `recordsRestored` decides.
 */
export function toRestoreOutcome(dbStatus: string, recordsRestored: number): RestoreOutcomeKind {
  switch (dbStatus) {
    case 'succeeded':
      return 'complete';
    case 'running':
    case 'queued':
    case 'cancelling':
      return 'running';
    case 'failed':
    case 'cancelled':
      return recordsRestored > 0 ? 'partial' : 'none';
    default:
      return 'none';
  }
}

/** One row of the per-base breakdown a backup run wrote (backup_run_bases). */
export interface RunBaseRow {
  /** Airtable base id — matches RestoreBaseDef.id / .atBaseId on the schema side. */
  atBaseId: string;
  baseName: string;
  status: string;
}

const BASE_CAPTURED = new Set(['succeeded', 'trial_complete', 'trial_succeeded']);

/**
 * Which bases a snapshot actually holds, and which it was asked for and missed — derived from the
 * run's per-base breakdown.
 *
 *  · With per-base rows: `baseIds` are the ones that captured cleanly; `missedBaseNames` are the
 *    ones whose per-base row failed. This is the honest, per-run answer.
 *  · WITHOUT per-base rows (legacy completions that predate backup_run_bases): a run that succeeded
 *    is assumed to hold every base currently in scope (`allBaseIds`), so the snapshot is still
 *    offered rather than silently dropping out of the picker. Best-effort, and the only branch that
 *    infers rather than reads — flagged so a richer per-run capture can replace it later.
 */
export function deriveSnapshotBases(
  perBase: RunBaseRow[],
  allBaseIds: string[],
): { baseIds: string[]; missedBaseNames: string[] } {
  if (perBase.length === 0) {
    return { baseIds: [...allBaseIds], missedBaseNames: [] };
  }
  const baseIds: string[] = [];
  const missedBaseNames: string[] = [];
  for (const row of perBase) {
    if (BASE_CAPTURED.has(row.status)) baseIds.push(row.atBaseId);
    else missedBaseNames.push(row.baseName);
  }
  return { baseIds, missedBaseNames };
}

/** ISO date component (YYYY-MM-DD) of a timestamp — the date half of a generated restore-base name. */
export function isoDateOnly(value: Date | string | null | undefined): string {
  if (value == null) return '';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}
