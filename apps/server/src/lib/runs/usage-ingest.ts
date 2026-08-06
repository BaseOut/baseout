// Per-run usage ingestion (shared-entitlements 3.1).
//
// A per-base snapshot backup completion carries the base's record count and
// file bytes; this maps those onto the owning Space's stock meters
// (`records_under_management`, `file_storage_gb`) and increments the current
// monthly-anniversary rollup in the master DB. Design D5: measure at the Space,
// record authoritatively in master. Design D6: stock meters are period-bucketed
// levels keyed to the subscription's monthly anniversary.
//
// These callbacks are fire-and-forget and best-effort — the reconciliation
// sweep (task 3.5) is the AUTHORITY that re-derives exact levels from durable
// rows, so a lost callback (under-count) or a re-backup (over-count) is bounded
// drift the sweep heals. The caller swallows failures so a metering hiccup
// never turns a recorded completion into a wire error.
//
// The pure mapping (`buildUsageSamples`) and DI'd orchestration
// (`ingestRunUsage`) are unit-tested; the Drizzle upsert wiring lives in the
// run-complete route.

import { currentMonthlyPeriod } from "@baseout/db-schema";

/** Decimal GB — matches the `file_storage_gb` feature's `gb` unit. */
export const BYTES_PER_GB = 1_000_000_000;

export interface UsageSample {
  featureSlug: string;
  meterKind: "stock";
  /** Amount this run adds to the current period's level. */
  delta: number;
}

/**
 * Map a snapshot completion's measured counts to Space stock-meter samples.
 * Zero-delta meters are dropped (nothing to write). Only the two meters a
 * backup task measures are produced here — `bases_under_management` is a
 * creation cap counted live at resolution time (D5/D6), not rolled up.
 */
export function buildUsageSamples(input: {
  recordsProcessed: number;
  fileBytesProcessed: number;
}): UsageSample[] {
  const samples: UsageSample[] = [];
  if (input.recordsProcessed > 0) {
    samples.push({
      featureSlug: "records_under_management",
      meterKind: "stock",
      delta: input.recordsProcessed,
    });
  }
  if (input.fileBytesProcessed > 0) {
    samples.push({
      featureSlug: "file_storage_gb",
      meterKind: "stock",
      delta: input.fileBytesProcessed / BYTES_PER_GB,
    });
  }
  return samples;
}

export interface UsageRollupDelta {
  organizationId: string;
  spaceId: string;
  featureSlug: string;
  meterKind: string;
  periodStart: Date;
  periodEnd: Date;
  /** Amount to add to `used` (upsert: insert this, or `used = used + delta`). */
  delta: number;
}

export interface UsageIngestDeps {
  /**
   * Resolve the run's owning Organization and its monthly-anniversary anchor
   * (the subscription start). `null` = the Space has no resolvable org/sub
   * (e.g. mid-teardown) → ingestion is skipped rather than mis-attributed.
   */
  resolveOrgAnchor: (
    spaceId: string,
  ) => Promise<{ organizationId: string; anchor: Date } | null>;
  /** Atomically add `delta` to the Space-scoped rollup for one meter+period. */
  upsertRollupDelta: (row: UsageRollupDelta) => Promise<void>;
}

/**
 * Ingest a snapshot completion's usage into Space-attributed stock rollups for
 * the current monthly period. Returns how many meters were written. Does the
 * org lookup only when there is something to meter.
 */
export async function ingestRunUsage(
  input: {
    spaceId: string;
    recordsProcessed: number;
    fileBytesProcessed: number;
    now: Date;
  },
  deps: UsageIngestDeps,
): Promise<{ ingested: number }> {
  const samples = buildUsageSamples(input);
  if (samples.length === 0) return { ingested: 0 };

  const resolved = await deps.resolveOrgAnchor(input.spaceId);
  if (!resolved) return { ingested: 0 };

  const { start, end } = currentMonthlyPeriod(resolved.anchor, input.now);
  for (const sample of samples) {
    await deps.upsertRollupDelta({
      organizationId: resolved.organizationId,
      spaceId: input.spaceId,
      featureSlug: sample.featureSlug,
      meterKind: sample.meterKind,
      periodStart: start,
      periodEnd: end,
      delta: sample.delta,
    });
  }
  return { ingested: samples.length };
}
