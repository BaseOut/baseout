ALTER TABLE "baseout"."users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "baseout"."users" ADD CONSTRAINT "users_email_runtime_env_unique" UNIQUE("email","runtime_env");
-- (prepended context) shared-org-runtime-env, design D3 second amendment:
-- the same email exists as a separate user row per environment; auth lookups
-- are env-scoped in apps/web/src/lib/auth-env-scope.ts.
