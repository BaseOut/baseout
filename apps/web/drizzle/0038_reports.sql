CREATE TABLE "baseout"."report_definitions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" text NOT NULL,
	"name" text NOT NULL,
	"sections" jsonb NOT NULL,
	"base_scope" jsonb,
	"window_kind" text DEFAULT 'since_last' NOT NULL,
	"window_days" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"schedule_cadence" text,
	"schedule_day" integer,
	"schedule_time" text,
	"schedule_formats" jsonb DEFAULT '["pdf"]'::jsonb NOT NULL,
	"schedule_recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"schedule_suppress_empty" boolean DEFAULT true NOT NULL,
	"schedule_enabled" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_definitions_window_kind_check" CHECK ("baseout"."report_definitions"."window_kind" IN ('since_last', 'rolling', 'all_time')),
	CONSTRAINT "report_definitions_window_days_check" CHECK (("baseout"."report_definitions"."window_kind" = 'rolling') = ("baseout"."report_definitions"."window_days" IS NOT NULL)),
	CONSTRAINT "report_definitions_schedule_cadence_check" CHECK ("baseout"."report_definitions"."schedule_cadence" IS NULL OR "baseout"."report_definitions"."schedule_cadence" IN ('data_backup', 'schema_backup', 'weekly', 'monthly'))
);
--> statement-breakpoint
CREATE TABLE "baseout"."report_deliveries" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_run_id" text NOT NULL,
	"recipient_email" text NOT NULL,
	"recipient_kind" text NOT NULL,
	"format" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_deliveries_recipient_kind_check" CHECK ("baseout"."report_deliveries"."recipient_kind" IN ('member', 'external')),
	CONSTRAINT "report_deliveries_format_check" CHECK ("baseout"."report_deliveries"."format" IN ('pdf', 'html')),
	CONSTRAINT "report_deliveries_status_check" CHECK ("baseout"."report_deliveries"."status" IN ('pending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "baseout"."report_runs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" text NOT NULL,
	"report_definition_id" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"ad_hoc" boolean DEFAULT false NOT NULL,
	"trigger_kind" text NOT NULL,
	"trigger_by" text,
	"generation_state" text DEFAULT 'running' NOT NULL,
	"status" text,
	"backups_ok" integer DEFAULT 0 NOT NULL,
	"backups_failed" integer DEFAULT 0 NOT NULL,
	"document_location" text,
	"artifact_pdf_location" text,
	"artifact_html_location" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_at" timestamp with time zone,
	CONSTRAINT "report_runs_trigger_kind_check" CHECK ("baseout"."report_runs"."trigger_kind" IN ('scheduled', 'manual')),
	CONSTRAINT "report_runs_generation_state_check" CHECK ("baseout"."report_runs"."generation_state" IN ('running', 'generated', 'failed')),
	CONSTRAINT "report_runs_status_check" CHECK ("baseout"."report_runs"."status" IS NULL OR "baseout"."report_runs"."status" IN ('healthy', 'issues', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "baseout"."report_definitions" ADD CONSTRAINT "report_definitions_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."report_definitions" ADD CONSTRAINT "report_definitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "baseout"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."report_deliveries" ADD CONSTRAINT "report_deliveries_report_run_id_report_runs_id_fk" FOREIGN KEY ("report_run_id") REFERENCES "baseout"."report_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."report_runs" ADD CONSTRAINT "report_runs_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."report_runs" ADD CONSTRAINT "report_runs_report_definition_id_report_definitions_id_fk" FOREIGN KEY ("report_definition_id") REFERENCES "baseout"."report_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_definitions_space_id_idx" ON "baseout"."report_definitions" USING btree ("space_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_definitions_default_uq" ON "baseout"."report_definitions" USING btree ("space_id") WHERE "baseout"."report_definitions"."is_default";--> statement-breakpoint
CREATE INDEX "report_definitions_next_run_idx" ON "baseout"."report_definitions" USING btree ("next_run_at") WHERE "baseout"."report_definitions"."schedule_enabled" AND "baseout"."report_definitions"."next_run_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "report_deliveries_run_id_idx" ON "baseout"."report_deliveries" USING btree ("report_run_id");--> statement-breakpoint
CREATE INDEX "report_runs_definition_window_idx" ON "baseout"."report_runs" USING btree ("report_definition_id","window_end" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "report_runs_one_running_uq" ON "baseout"."report_runs" USING btree ("report_definition_id") WHERE "baseout"."report_runs"."generation_state" = 'running';--> statement-breakpoint
CREATE INDEX "report_runs_space_id_idx" ON "baseout"."report_runs" USING btree ("space_id");--> statement-breakpoint
-- Backfill a non-deletable default "Full <Space> Report" for every existing
-- Space (web-reports-page task 1.2). Idempotent: the NOT EXISTS guard + the
-- partial-unique (space_id) WHERE is_default index keep re-runs clean. The
-- default covers all six sections; empty/new-capture sections render a clean
-- state rather than being omitted (server-reports/design.md).
INSERT INTO "baseout"."report_definitions"
	("space_id", "name", "sections", "window_kind", "is_default")
SELECT
	s."id",
	'Full ' || s."name" || ' Report',
	'["backups","connections","schema","docs","trends","dataHealth"]'::jsonb,
	'since_last',
	true
FROM "baseout"."spaces" s
WHERE NOT EXISTS (
	SELECT 1 FROM "baseout"."report_definitions" d
	WHERE d."space_id" = s."id" AND d."is_default"
);