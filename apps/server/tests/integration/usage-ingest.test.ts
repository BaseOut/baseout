// Pure usage-ingestion mapping + orchestration (shared-entitlements 3.1).
// The DB upsert itself is exercised by the run-complete route test; here we
// pin the meter mapping (slugs, byte→GB, zero-filtering) and the DI'd
// orchestration (period resolution, org attribution, skip-on-unresolved).

import { describe, expect, it } from "vitest";
import {
  BYTES_PER_GB,
  buildUsageSamples,
  ingestRunUsage,
  type UsageIngestDeps,
} from "../../src/lib/runs/usage-ingest";

describe("buildUsageSamples", () => {
  it("maps records + file bytes to the two stock meters", () => {
    const samples = buildUsageSamples({
      recordsProcessed: 1200,
      fileBytesProcessed: 5 * BYTES_PER_GB,
    });
    expect(samples).toEqual([
      { featureSlug: "records_under_management", meterKind: "stock", delta: 1200 },
      { featureSlug: "file_storage_gb", meterKind: "stock", delta: 5 },
    ]);
  });

  it("converts bytes to decimal GB", () => {
    const [sample] = buildUsageSamples({ recordsProcessed: 0, fileBytesProcessed: 250_000_000 });
    expect(sample).toEqual({ featureSlug: "file_storage_gb", meterKind: "stock", delta: 0.25 });
  });

  it("drops zero-delta meters", () => {
    expect(buildUsageSamples({ recordsProcessed: 0, fileBytesProcessed: 0 })).toEqual([]);
    expect(buildUsageSamples({ recordsProcessed: 10, fileBytesProcessed: 0 })).toEqual([
      { featureSlug: "records_under_management", meterKind: "stock", delta: 10 },
    ]);
  });
});

describe("ingestRunUsage", () => {
  const anchor = new Date(Date.UTC(2025, 0, 15));
  const now = new Date(Date.UTC(2025, 2, 20)); // → cycle [Mar 15, Apr 15)

  type Upsert = Parameters<UsageIngestDeps["upsertRollupDelta"]>[0];

  function recorder(orgAnchor: { organizationId: string; anchor: Date } | null) {
    const upserts: Upsert[] = [];
    let resolveCalls = 0;
    const deps: UsageIngestDeps = {
      resolveOrgAnchor: async () => {
        resolveCalls += 1;
        return orgAnchor;
      },
      upsertRollupDelta: async (row) => {
        upserts.push(row);
      },
    };
    return { deps, upserts, resolveCalls: () => resolveCalls };
  }

  it("upserts Space-attributed rollups for the current monthly period", async () => {
    const { deps, upserts } = recorder({ organizationId: "org-1", anchor });
    const res = await ingestRunUsage(
      { spaceId: "space-1", recordsProcessed: 300, fileBytesProcessed: BYTES_PER_GB, now },
      deps,
    );

    expect(res).toEqual({ ingested: 2 });
    expect(upserts).toHaveLength(2);
    expect(upserts[0]).toMatchObject({
      organizationId: "org-1",
      spaceId: "space-1",
      featureSlug: "records_under_management",
      meterKind: "stock",
      delta: 300,
      periodStart: new Date(Date.UTC(2025, 2, 15)),
      periodEnd: new Date(Date.UTC(2025, 3, 15)),
    });
    expect(upserts[1]).toMatchObject({ featureSlug: "file_storage_gb", delta: 1 });
  });

  it("skips ingestion when the run's org can't be resolved", async () => {
    const { deps, upserts } = recorder(null);
    const res = await ingestRunUsage(
      { spaceId: "space-x", recordsProcessed: 300, fileBytesProcessed: 0, now },
      deps,
    );
    expect(res).toEqual({ ingested: 0 });
    expect(upserts).toHaveLength(0);
  });

  it("does no work (and no org lookup) when there is nothing to meter", async () => {
    const { deps, upserts, resolveCalls } = recorder({ organizationId: "org-1", anchor });
    const res = await ingestRunUsage(
      { spaceId: "space-1", recordsProcessed: 0, fileBytesProcessed: 0, now },
      deps,
    );
    expect(res).toEqual({ ingested: 0 });
    expect(upserts).toHaveLength(0);
    expect(resolveCalls()).toBe(0);
  });
});
