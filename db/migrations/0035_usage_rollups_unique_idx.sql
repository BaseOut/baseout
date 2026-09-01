-- shared-entitlements 3.1 — usage-rollup upsert key.
-- Enables atomic ON CONFLICT DO UPDATE (used = used + excluded.used) from the
-- engine's per-run usage ingestion. COALESCE(space_id, '') collapses NULL so
-- org-level (Space-less) flow rollups dedupe too — a plain unique constraint
-- would treat every NULL space_id as distinct. Table is empty at this point
-- (metering ingestion not yet live), so the index builds without conflict.
CREATE UNIQUE INDEX "usage_rollups_org_feature_space_period_uq" ON "baseout"."usage_rollups" ("organization_id", "feature_slug", (COALESCE("space_id", '')), "period_start");
