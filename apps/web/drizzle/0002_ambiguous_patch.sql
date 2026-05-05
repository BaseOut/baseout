ALTER TABLE "baseout"."users" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "baseout"."accounts" DROP COLUMN "password";