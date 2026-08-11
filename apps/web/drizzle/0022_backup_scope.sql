ALTER TABLE "baseout"."backup_configurations" ADD COLUMN "scope" text DEFAULT 'schema_and_data' NOT NULL;--> statement-breakpoint
ALTER TABLE "baseout"."backup_configurations" ADD COLUMN "schema_frequency" text;--> statement-breakpoint
ALTER TABLE "baseout"."backup_configurations" ADD COLUMN "schema_next_scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "baseout"."backup_runs" ADD COLUMN "kind" text DEFAULT 'full' NOT NULL;