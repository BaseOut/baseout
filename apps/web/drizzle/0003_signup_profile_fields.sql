ALTER TABLE "baseout"."users" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "baseout"."users" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "baseout"."users" ADD COLUMN "job_title" text;--> statement-breakpoint
ALTER TABLE "baseout"."users" ADD COLUMN "marketing_opt_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "baseout"."organizations" ADD COLUMN "referral_source" text;--> statement-breakpoint
ALTER TABLE "baseout"."organizations" ADD COLUMN "referral_code" text;