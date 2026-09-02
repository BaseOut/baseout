-- Migration: db/migrations/0041_user_runtime_env.sql
-- shared-org-runtime-env Phase 5: tag users so magic-link + session login
-- can be gated to the Worker env that created the account (design D3 revised).

ALTER TABLE "baseout"."users"
  ADD COLUMN "runtime_env" text NOT NULL DEFAULT 'staging';

ALTER TABLE "baseout"."users"
  ADD CONSTRAINT "users_runtime_env_check"
    CHECK ("runtime_env" IN ('dev', 'staging', 'production'));
