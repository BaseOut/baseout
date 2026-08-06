// Per-Space database-size measurement + rollup ingestion (shared-entitlements
// 3.2). At run finalization the engine measures the owning Space's per-Space DB
// size and records it as the `database_size_gb` stock meter (D5/D6). The meter
// is org-wide (the limit is per Organization), but rows are written per-Space so
// the org total is their SUM and Space-level utilization stays displayable.
//
// Backend dispatch (per system-per-space-db's space_databases descriptor):
//   - managed_pg: the Space is a SCHEMA (`bo_space_<id>`, = pgLocator) in the
//     shared managed cluster, so its size is the SUM of relation sizes in that
//     schema — NOT `pg_database_size()` (which is the whole cluster DB). The
//     task text said pg_database_size(); the actual schema-per-Space topology
//     (space-db-pg.ts `withSpaceSchema`) makes schema-size the correct measure.
//   - d1: the CF REST API's database `file_size` (PRAGMAs unsupported; verified
//     2026-08-03). Gated on a Cloudflare API token that isn't provisioned in
//     dev yet — the measurer returns null until it lands.
//   - byodb: measured against the customer's own connection — deferred with the
//     byodb backend (not active in dev); skipped here.
//
// Unlike the per-base record/file counters (3.1, best-effort increments), DB
// size is an ABSOLUTE measurement, so its rollup is SET (a level), not added.
// The reconciliation sweep (3.5) re-derives across all Spaces.

import { currentMonthlyPeriod } from "@baseout/db-schema";
import { BYTES_PER_GB } from "./usage-ingest";

/** The seeded DB-size meter slug (org-wide, stock). */
export const DB_SIZE_SLUG = "database_size_gb";

/** The subset of a `space_databases` row this measurement needs. */
export interface SpaceDbDescriptor {
  backend: string; // 'managed_pg' | 'byodb' | 'd1'
  status: string;
  pgLocator: string | null; // schema name for the PG backends
  d1DatabaseId: string | null;
}

export interface DbSizeMeasurers {
  /** SUM of relation sizes in a per-Space PG schema (managed_pg). */
  measurePgSchemaBytes: (schemaName: string) => Promise<number | null>;
  /** D1 database `file_size` via the Cloudflare REST API; null when the API
   *  token isn't configured. */
  measureD1Bytes: (databaseId: string) => Promise<number | null>;
}

/**
 * Dispatch DB-size measurement by backend. Returns bytes, or `null` when the
 * Space isn't measurable here (inactive, missing locator, byodb, or a null
 * measurement e.g. unconfigured D1 token).
 */
export async function measureSpaceDbSizeBytes(
  db: SpaceDbDescriptor,
  m: DbSizeMeasurers,
): Promise<number | null> {
  if (db.status !== "active") return null;
  if (db.backend === "managed_pg") {
    return db.pgLocator ? m.measurePgSchemaBytes(db.pgLocator) : null;
  }
  if (db.backend === "d1") {
    return db.d1DatabaseId ? m.measureD1Bytes(db.d1DatabaseId) : null;
  }
  // byodb (customer connection) is deferred with that backend.
  return null;
}

/** Convert measured bytes to decimal GB (matches the `gb` feature unit). */
export function databaseSizeGb(bytes: number): number {
  return bytes / BYTES_PER_GB;
}

export interface DbSizeRollupLevel {
  organizationId: string;
  spaceId: string;
  featureSlug: string;
  meterKind: string;
  periodStart: Date;
  periodEnd: Date;
  /** The measured level (SET, not added). */
  used: number;
}

export interface DbSizeIngestDeps {
  /** The run's Space DB descriptor, or null if the Space has none. */
  getSpaceDb: (spaceId: string) => Promise<SpaceDbDescriptor | null>;
  measurers: DbSizeMeasurers;
  /** Resolve the Space's org + monthly-anniversary anchor (shared with 3.1). */
  resolveOrgAnchor: (
    spaceId: string,
  ) => Promise<{ organizationId: string; anchor: Date } | null>;
  /** SET the Space-scoped rollup to the measured level for one meter+period. */
  upsertRollupLevel: (row: DbSizeRollupLevel) => Promise<void>;
}

/**
 * Measure the run's Space DB size and record it as the `database_size_gb` stock
 * level for the current monthly period. Best-effort — every unresolvable step
 * (no per-Space DB, unmeasurable backend, unresolved org) simply skips.
 */
export async function ingestSpaceDbSize(
  input: { spaceId: string; now: Date },
  deps: DbSizeIngestDeps,
): Promise<{ measured: boolean }> {
  const descriptor = await deps.getSpaceDb(input.spaceId);
  if (!descriptor) return { measured: false };

  const bytes = await measureSpaceDbSizeBytes(descriptor, deps.measurers);
  if (bytes === null) return { measured: false };

  const resolved = await deps.resolveOrgAnchor(input.spaceId);
  if (!resolved) return { measured: false };

  const { start, end } = currentMonthlyPeriod(resolved.anchor, input.now);
  await deps.upsertRollupLevel({
    organizationId: resolved.organizationId,
    spaceId: input.spaceId,
    featureSlug: DB_SIZE_SLUG,
    meterKind: "stock",
    periodStart: start,
    periodEnd: end,
    used: databaseSizeGb(bytes),
  });
  return { measured: true };
}
