-- Migration: db/migrations/0040_org_runtime_env.sql
-- shared-org-runtime-env: tag Organizations so a shared Postgres can hold
-- both staging and local/dev rows while encryption keys stay per-Worker.

ALTER TABLE "baseout"."organizations"
  ADD COLUMN "runtime_env" text NOT NULL DEFAULT 'staging';

ALTER TABLE "baseout"."organizations"
  ADD CONSTRAINT "organizations_runtime_env_check"
  CHECK ("runtime_env" IN ('dev', 'staging', 'production'));
