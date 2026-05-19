// MIRROR of apps/web/src/db/schema/core.ts (canonical writer).
// Migration: apps/web/drizzle/<NNNN>_e2e_pending_airtable_bases.sql
//
// Test-only table seeded by apps/web's seed-workspace-rediscovery endpoint
// and read by buildRediscoveryDeps in E2E_TEST_MODE. Empty in prod.
//
// Per CLAUDE.md §5.3 — apps/web owns the migration; apps/server only
// declares the columns it reads.

import { pgSchema, text } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const e2ePendingAirtableBases = baseout.table(
  "e2e_pending_airtable_bases",
  {
    spaceId: text("space_id").notNull(),
    atBaseId: text("at_base_id").notNull(),
    name: text("name").notNull(),
  },
);
