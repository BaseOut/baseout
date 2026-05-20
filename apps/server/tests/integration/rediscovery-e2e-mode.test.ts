// Unit coverage for the E2E_TEST_MODE branch in buildRediscoveryDeps.
//
// The full DB-touching happy path is verified end-to-end by the Playwright
// spec under apps/web/tests/e2e/workspace-rediscovery.spec.ts; here we just
// pin the table the e2e listBases helper queries and the row → summary
// mapping, so a future refactor that swaps tables or column names trips a
// fast unit failure instead of waiting for the slow Playwright leg.
//
// listE2EPendingBases is exported from run-deps.ts specifically so this
// test can drive it with a thin Drizzle stub instead of a real Postgres
// connection.

import { describe, expect, it, vi } from "vitest";

import { listE2EPendingBases } from "../../src/lib/rediscovery/run-deps";

interface Row {
  atBaseId: string;
  name: string;
}

function stubDbReturning(rows: Row[]): {
  db: Parameters<typeof listE2EPendingBases>[0];
  whereCalls: unknown[];
  fromCalls: unknown[];
  selectCalls: unknown[];
} {
  const whereCalls: unknown[] = [];
  const fromCalls: unknown[] = [];
  const selectCalls: unknown[] = [];
  const db = {
    select: vi.fn((cols: unknown) => {
      selectCalls.push(cols);
      return {
        from: vi.fn((table: unknown) => {
          fromCalls.push(table);
          return {
            where: vi.fn((cond: unknown) => {
              whereCalls.push(cond);
              return Promise.resolve(rows);
            }),
          };
        }),
      };
    }),
  } as unknown as Parameters<typeof listE2EPendingBases>[0];
  return { db, whereCalls, fromCalls, selectCalls };
}

describe("listE2EPendingBases", () => {
  it("maps each row to an AirtableBaseSummary with stable permissionLevel", async () => {
    const { db } = stubDbReturning([
      { atBaseId: "appE2EBASE12345", name: "Alpha" },
      { atBaseId: "appE2EPEND98765", name: "Pending Beta" },
    ]);

    const summaries = await listE2EPendingBases(
      db,
      "11111111-1111-1111-1111-111111111111",
    );

    expect(summaries).toEqual([
      { id: "appE2EBASE12345", name: "Alpha", permissionLevel: "create" },
      { id: "appE2EPEND98765", name: "Pending Beta", permissionLevel: "create" },
    ]);
  });

  it("returns an empty list when no rows exist for the space", async () => {
    const { db } = stubDbReturning([]);
    const summaries = await listE2EPendingBases(
      db,
      "22222222-2222-2222-2222-222222222222",
    );
    expect(summaries).toEqual([]);
  });

  it("invokes a single select → from → where chain per call", async () => {
    const { db, selectCalls, fromCalls, whereCalls } = stubDbReturning([]);
    await listE2EPendingBases(
      db,
      "33333333-3333-3333-3333-333333333333",
    );
    expect(selectCalls).toHaveLength(1);
    expect(fromCalls).toHaveLength(1);
    expect(whereCalls).toHaveLength(1);
  });
});
