CREATE TABLE "baseout"."two_factors" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "baseout"."two_factors" ADD CONSTRAINT "two_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "baseout"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "two_factors_user_id_idx" ON "baseout"."two_factors" USING btree ("user_id");--> statement-breakpoint
-- better-auth twoFactor plugin user flag (web-auth-2fa). Hand-added: the
-- canonical users drizzle table lives in @baseout/db-schema (not modified
-- here — mirror rule); the adapter-side mapping is the extended users table
-- in apps/web/src/lib/two-factor/adapter-schema.ts.
ALTER TABLE "baseout"."users" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;
