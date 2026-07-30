// Webhook-application deltas (system-per-space-db task 1.6, consumed by
// workflows-instant-webhook): incremental runs are distinguishable
// (bo_at_base_runs.run_type) and webhook-derived changes carry attribution
// (action_source + actor on bo_at_schema_updates / bo_at_record_updates,
// nullable — backup-derived writes leave them NULL). Both dialects.
import { describe, expect, test } from "vitest";
import { getTableColumns } from "drizzle-orm";

import { SPACE_SCHEMA_VERSION } from "../src/space";
import * as pg from "../src/space/pg";
import * as sqlite from "../src/space/sqlite";

describe("SPACE_SCHEMA_VERSION", () => {
  test("at 12 (v10 media index, v11 comment attachments, v12 base collaborators)", () => {
    expect(SPACE_SCHEMA_VERSION).toBe(12);
  });
});

for (const [dialect, mod] of [
  ["pg", pg],
  ["sqlite", sqlite],
] as const) {
  describe(`${dialect} webhook-application columns`, () => {
    test("bo_at_base_runs.run_type — full|incremental, defaults to full", () => {
      const cols = getTableColumns(mod.baseRuns);
      expect(cols.runType).toBeDefined();
      expect(cols.runType.notNull).toBe(true);
      expect(cols.runType.hasDefault).toBe(true);
    });

    test("bo_at_schema_updates carries nullable action_source + actor", () => {
      const cols = getTableColumns(mod.schemaUpdates);
      expect(cols.actionSource).toBeDefined();
      expect(cols.actionSource.notNull).toBe(false);
      expect(cols.actor).toBeDefined();
      expect(cols.actor.notNull).toBe(false);
    });

    test("bo_at_record_updates carries nullable action_source + actor", () => {
      const cols = getTableColumns(mod.recordUpdates);
      expect(cols.actionSource).toBeDefined();
      expect(cols.actionSource.notNull).toBe(false);
      expect(cols.actor).toBeDefined();
      expect(cols.actor.notNull).toBe(false);
    });
  });
}
