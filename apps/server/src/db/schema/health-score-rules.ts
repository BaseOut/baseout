// MIRROR of apps/web/src/db/schema/core.ts health_score_rules (canonical writer).
// Migrations: apps/web/drizzle/0023_health_metric_prompt.sql (adds prompt +
//             entity_tier on top of the system-per-space-db catalog).
//
// apps/web owns the org-scoped Health metric catalog. apps/server READS it to
// weight the base grade (weight), label the per-metric breakdown (name /
// category / severity / entity_tier), and resolve effective prompts
// (server-schema-health-scoring). Read-only — never migrate from here.
//
// Columns intentionally omitted: description, config, createdAt, modifiedAt —
// the engine doesn't read them. Per CLAUDE.md §5.3.

import { boolean, integer, pgSchema, text } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const healthScoreRules = baseout.table("health_score_rules", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  category: text("category"),
  severity: text("severity").notNull(),
  weight: integer("weight").notNull(),
  enabled: boolean("enabled").notNull(),
  prompt: text("prompt"),
  entityTier: text("entity_tier"),
});

export type HealthScoreRuleRow = typeof healthScoreRules.$inferSelect;
