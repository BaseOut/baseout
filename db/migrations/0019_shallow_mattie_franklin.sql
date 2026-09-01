CREATE TABLE "baseout"."restore_runs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"source_run_id" text NOT NULL,
	"status" text NOT NULL,
	"scope" text NOT NULL,
	"scope_target" jsonb NOT NULL,
	"tables_restored" integer DEFAULT 0 NOT NULL,
	"records_restored" integer DEFAULT 0 NOT NULL,
	"attachments_restored" integer DEFAULT 0 NOT NULL,
	"trigger_run_ids" text[] DEFAULT '{}' NOT NULL,
	"triggered_by" text NOT NULL,
	"is_trial" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "baseout"."restore_runs" ADD CONSTRAINT "restore_runs_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."restore_runs" ADD CONSTRAINT "restore_runs_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "baseout"."connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."restore_runs" ADD CONSTRAINT "restore_runs_source_run_id_backup_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "baseout"."backup_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_restore_runs_space_status" ON "baseout"."restore_runs" USING btree ("space_id","status");--> statement-breakpoint
CREATE INDEX "idx_restore_runs_source" ON "baseout"."restore_runs" USING btree ("source_run_id");