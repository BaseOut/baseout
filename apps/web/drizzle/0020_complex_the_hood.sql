CREATE TABLE "baseout"."backup_run_bases" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"at_base_id" text NOT NULL,
	"base_name" text NOT NULL,
	"status" text NOT NULL,
	"tables_count" integer DEFAULT 0 NOT NULL,
	"records_count" integer DEFAULT 0 NOT NULL,
	"attachments_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "baseout"."backup_run_tables" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_base_id" text NOT NULL,
	"table_id" text NOT NULL,
	"table_name" text NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"field_count" integer DEFAULT 0 NOT NULL,
	"attachment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "baseout"."backup_run_bases" ADD CONSTRAINT "backup_run_bases_run_id_backup_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "baseout"."backup_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."backup_run_tables" ADD CONSTRAINT "backup_run_tables_run_base_id_backup_run_bases_id_fk" FOREIGN KEY ("run_base_id") REFERENCES "baseout"."backup_run_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "backup_run_bases_run_id_idx" ON "baseout"."backup_run_bases" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "backup_run_tables_run_base_id_idx" ON "baseout"."backup_run_tables" USING btree ("run_base_id");