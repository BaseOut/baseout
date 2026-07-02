CREATE TABLE "baseout"."backup_retention_policies" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" text NOT NULL,
	"policy_tier" text NOT NULL,
	"keep_last_n" integer,
	"daily_window_days" integer,
	"weekly_window_days" integer,
	"monthly_indefinite" boolean DEFAULT false NOT NULL,
	"custom_rules" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "backup_retention_policies_space_id_unique" UNIQUE("space_id"),
	CONSTRAINT "backup_retention_policies_policy_tier_check" CHECK ("baseout"."backup_retention_policies"."policy_tier" IN ('basic','time_based','two_tier','three_tier','custom'))
);
--> statement-breakpoint
ALTER TABLE "baseout"."backup_runs" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "baseout"."backup_retention_policies" ADD CONSTRAINT "backup_retention_policies_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "backup_runs_undeleted_idx" ON "baseout"."backup_runs" USING btree ("space_id","started_at" DESC NULLS LAST) WHERE "baseout"."backup_runs"."deleted_at" IS NULL;