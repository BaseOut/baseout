// Per-Space database-size measurement + rollup ingestion (shared-entitlements
// 3.2). Backend dispatch + the GB level write are unit-tested here with DI; the
// real schema-size query (managed_pg) and CF REST call (D1) are thin I/O
// wrappers in the run-complete route, validated in the 9.4 smoke.

import { describe, expect, it } from "vitest";
import {
  DB_SIZE_SLUG,
  ingestSpaceDbSize,
  measureSpaceDbSizeBytes,
  type DbSizeIngestDeps,
  type DbSizeMeasurers,
  type SpaceDbDescriptor,
} from "../../src/lib/runs/db-size";

const active = (over: Partial<SpaceDbDescriptor>): SpaceDbDescriptor => ({
  backend: "managed_pg",
  status: "active",
  pgLocator: "bo_space_abc",
  d1DatabaseId: null,
  ...over,
});

describe("measureSpaceDbSizeBytes", () => {
  function measurers(over?: Partial<DbSizeMeasurers>): {
    m: DbSizeMeasurers;
    pgArgs: string[];
    d1Args: string[];
  } {
    const pgArgs: string[] = [];
    const d1Args: string[] = [];
    const m: DbSizeMeasurers = {
      measurePgSchemaBytes: async (schema) => {
        pgArgs.push(schema);
        return 3 * 1_000_000_000;
      },
      measureD1Bytes: async (id) => {
        d1Args.push(id);
        return 2 * 1_000_000_000;
      },
      ...over,
    };
    return { m, pgArgs, d1Args };
  }

  it("measures a managed_pg Space via its schema (pgLocator)", async () => {
    const { m, pgArgs, d1Args } = measurers();
    const bytes = await measureSpaceDbSizeBytes(active({}), m);
    expect(bytes).toBe(3_000_000_000);
    expect(pgArgs).toEqual(["bo_space_abc"]);
    expect(d1Args).toEqual([]);
  });

  it("measures a d1 Space via the CF REST measurer", async () => {
    const { m, pgArgs, d1Args } = measurers();
    const bytes = await measureSpaceDbSizeBytes(
      active({ backend: "d1", pgLocator: null, d1DatabaseId: "d1-xyz" }),
      m,
    );
    expect(bytes).toBe(2_000_000_000);
    expect(d1Args).toEqual(["d1-xyz"]);
    expect(pgArgs).toEqual([]);
  });

  it("does not measure byodb here (its own connection is deferred)", async () => {
    const { m } = measurers();
    expect(await measureSpaceDbSizeBytes(active({ backend: "byodb" }), m)).toBeNull();
  });

  it("skips a Space DB that is not active", async () => {
    const { m } = measurers();
    expect(await measureSpaceDbSizeBytes(active({ status: "provisioning" }), m)).toBeNull();
  });

  it("skips when the backend locator is missing", async () => {
    const { m } = measurers();
    expect(await measureSpaceDbSizeBytes(active({ pgLocator: null }), m)).toBeNull();
    expect(
      await measureSpaceDbSizeBytes(active({ backend: "d1", d1DatabaseId: null }), m),
    ).toBeNull();
  });

  it("propagates a null measurement (unconfigured D1 token)", async () => {
    const { m } = measurers({ measureD1Bytes: async () => null });
    expect(
      await measureSpaceDbSizeBytes(active({ backend: "d1", d1DatabaseId: "d1-x" }), m),
    ).toBeNull();
  });
});

describe("ingestSpaceDbSize", () => {
  const anchor = new Date(Date.UTC(2025, 0, 15));
  const now = new Date(Date.UTC(2025, 2, 20)); // → cycle [Mar 15, Apr 15)

  type Level = Parameters<DbSizeIngestDeps["upsertRollupLevel"]>[0];

  function deps(over: Partial<DbSizeIngestDeps>): {
    deps: DbSizeIngestDeps;
    levels: Level[];
  } {
    const levels: Level[] = [];
    const base: DbSizeIngestDeps = {
      getSpaceDb: async () => active({}),
      measurers: {
        measurePgSchemaBytes: async () => 5 * 1_000_000_000,
        measureD1Bytes: async () => null,
      },
      resolveOrgAnchor: async () => ({ organizationId: "org-1", anchor }),
      upsertRollupLevel: async (row) => {
        levels.push(row);
      },
    };
    return { deps: { ...base, ...over }, levels };
  }

  it("writes the Space's measured size as a stock LEVEL for the current period", async () => {
    const { deps: d, levels } = deps({});
    const res = await ingestSpaceDbSize({ spaceId: "space-1", now }, d);
    expect(res).toEqual({ measured: true });
    expect(levels).toHaveLength(1);
    expect(levels[0]).toEqual({
      organizationId: "org-1",
      spaceId: "space-1",
      featureSlug: DB_SIZE_SLUG,
      meterKind: "stock",
      periodStart: new Date(Date.UTC(2025, 2, 15)),
      periodEnd: new Date(Date.UTC(2025, 3, 15)),
      used: 5,
    });
  });

  it("skips when the Space has no per-Space DB row", async () => {
    const { deps: d, levels } = deps({ getSpaceDb: async () => null });
    expect(await ingestSpaceDbSize({ spaceId: "s", now }, d)).toEqual({ measured: false });
    expect(levels).toHaveLength(0);
  });

  it("skips when the size can't be measured", async () => {
    const { deps: d, levels } = deps({
      measurers: {
        measurePgSchemaBytes: async () => null,
        measureD1Bytes: async () => null,
      },
    });
    expect(await ingestSpaceDbSize({ spaceId: "s", now }, d)).toEqual({ measured: false });
    expect(levels).toHaveLength(0);
  });

  it("skips when the org can't be resolved", async () => {
    const { deps: d, levels } = deps({ resolveOrgAnchor: async () => null });
    expect(await ingestSpaceDbSize({ spaceId: "s", now }, d)).toEqual({ measured: false });
    expect(levels).toHaveLength(0);
  });
});
