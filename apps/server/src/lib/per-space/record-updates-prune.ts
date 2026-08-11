// Retention prune for the per-Space superseded-value log (system-per-space-db
// §6.3). `bo_at_record_updates` grows with every changed cell across runs and is
// what record-history replay reads; trimming rows whose originating run
// completed before the retention cutoff bounds history to the org's window.
// The schema comment marks this table "Prunable by simple DELETE" — this is that
// DELETE, keyset-free (run-scoped).
//
// The cutoff SOURCE (per-org effective record-history retention) is resolved by
// the caller — shared-entitlements §4.4 wires it to resolveEntitlements; a cron
// pass invokes pruneRecordUpdates per active Space. This module stays decoupled
// from the policy source so it's a pure mechanism + one DELETE.

import { sql, type SQL } from 'drizzle-orm'
import type { SpaceTx } from './space-db-pg'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** The prune DELETE, as a parameterized fragment (rendered-SQL unit-tested). */
export function pruneRecordUpdatesSql(cutoffIso: string): SQL {
  return sql`
    delete from bo_at_record_updates
    where run_id in (
      select id from bo_at_base_runs
      where completed_at is not null and completed_at < ${cutoffIso}::timestamptz
    )
  `
}

/**
 * ISO cutoff for a retention window of `retentionDays` back from `now`. Returns
 * `null` for a non-positive/invalid window — a guard so a misconfigured 0-day
 * window can never DELETE the entire history. `Infinity`/unlimited retention is
 * also a no-op (`null`): nothing is old enough to prune.
 */
export function recordUpdatesPruneCutoff(now: Date, retentionDays: number): string | null {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return null
  return new Date(now.getTime() - retentionDays * MS_PER_DAY).toISOString()
}

/**
 * DELETE every `bo_at_record_updates` row whose originating run completed before
 * `cutoffIso`. Runs still in flight (completed_at IS NULL) are never pruned.
 * Returns the number of rows deleted. Caller runs this inside `withSpaceSchema`.
 */
export async function pruneRecordUpdates(tx: SpaceTx, cutoffIso: string): Promise<number> {
  const result = (await tx.execute(sql`
    delete from bo_at_record_updates
    where run_id in (
      select id from bo_at_base_runs
      where completed_at is not null and completed_at < ${cutoffIso}::timestamptz
    )
  `)) as unknown as { count?: number } & Iterable<unknown>
  // postgres-js exposes the affected-row count on `.count`; fall back to 0.
  return typeof result?.count === 'number' ? result.count : 0
}
