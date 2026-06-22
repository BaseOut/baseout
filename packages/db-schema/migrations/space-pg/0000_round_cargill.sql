CREATE TABLE "bo_at_attachments" (
	"composite_id" text PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"field_id" text NOT NULL,
	"record_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_hash" text,
	"filename" text,
	"size_bytes" bigint,
	"mime_type" text,
	"upload_status" text DEFAULT 'pending' NOT NULL,
	"first_seen_run" uuid,
	"last_seen_run" uuid,
	"uploaded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bo_at_automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" text NOT NULL,
	"airtable_entity_id" text,
	"name" text,
	"type" text,
	"definition" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"submitted_via" text,
	"first_seen_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bo_at_base_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"backup_run_id" uuid NOT NULL,
	"base_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"curr_step" text,
	"schema_version_id" uuid,
	"schema_hash" text,
	"tables_count" integer,
	"records_count" integer,
	"attachments_count" integer,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "bo_at_bases" (
	"base_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"first_seen_run" uuid,
	"first_unseen_run" uuid,
	"last_seen_run" uuid
);
--> statement-breakpoint
CREATE TABLE "bo_at_documentation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"description" text,
	"source" text NOT NULL,
	"edited_by_user_id" uuid,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bo_at_fields" (
	"field_id" text PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"base_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"options" jsonb,
	"is_primary" boolean DEFAULT false NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"first_seen_run" uuid,
	"first_unseen_run" uuid,
	"last_seen_run" uuid
);
--> statement-breakpoint
CREATE TABLE "bo_at_health_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" text NOT NULL,
	"table_id" text,
	"field_id" text,
	"run_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"severity" text NOT NULL,
	"category" text,
	"message" text NOT NULL,
	"occurrence_count" integer,
	"airtable_deeplink" text
);
--> statement-breakpoint
CREATE TABLE "bo_at_health_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" text NOT NULL,
	"run_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"band" text NOT NULL,
	"categories" jsonb
);
--> statement-breakpoint
CREATE TABLE "bo_at_interfaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" text NOT NULL,
	"airtable_entity_id" text,
	"name" text,
	"type" text,
	"definition" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"submitted_via" text,
	"first_seen_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bo_at_record_field_data" (
	"record_id" text NOT NULL,
	"field_id" text NOT NULL,
	"table_id" text NOT NULL,
	"value" text,
	"first_seen_run" uuid,
	"last_seen_run" uuid,
	CONSTRAINT "bo_at_record_field_data_record_id_field_id_pk" PRIMARY KEY("record_id","field_id")
);
--> statement-breakpoint
CREATE TABLE "bo_at_record_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" text NOT NULL,
	"field_id" text NOT NULL,
	"table_id" text NOT NULL,
	"run_id" uuid NOT NULL,
	"old_value" text
);
--> statement-breakpoint
CREATE TABLE "bo_at_records" (
	"record_id" text PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"base_id" text NOT NULL,
	"created_time" timestamp with time zone,
	"modified_time" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"first_seen_run" uuid,
	"first_unseen_run" uuid,
	"last_seen_run" uuid
);
--> statement-breakpoint
CREATE TABLE "bo_at_schema_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"base_id" text NOT NULL,
	"table_id" text,
	"change_type" text NOT NULL,
	"change_type_name" text,
	"before_value" jsonb,
	"after_value" jsonb,
	"breaks_data" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bo_at_schema_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" text NOT NULL,
	"schema_hash" text NOT NULL,
	"schema_json" jsonb NOT NULL,
	"first_seen_run" uuid
);
--> statement-breakpoint
CREATE TABLE "bo_at_tables" (
	"table_id" text PRIMARY KEY NOT NULL,
	"base_id" text NOT NULL,
	"name" text NOT NULL,
	"primary_field_id" text,
	"field_count" integer,
	"record_count" integer,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"first_seen_run" uuid,
	"first_unseen_run" uuid,
	"last_seen_run" uuid
);
--> statement-breakpoint
CREATE TABLE "bo_at_views" (
	"view_id" text PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"base_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"status" text DEFAULT 'active' NOT NULL,
	"first_seen_run" uuid,
	"first_unseen_run" uuid,
	"last_seen_run" uuid
);
--> statement-breakpoint
CREATE INDEX "bo_at_attachments_record_idx" ON "bo_at_attachments" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "bo_at_attachments_hash_idx" ON "bo_at_attachments" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "bo_at_automations_base_idx" ON "bo_at_automations" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX "bo_at_base_runs_backup_run_idx" ON "bo_at_base_runs" USING btree ("backup_run_id");--> statement-breakpoint
CREATE INDEX "bo_at_base_runs_base_idx" ON "bo_at_base_runs" USING btree ("base_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bo_at_documentation_target_uq" ON "bo_at_documentation" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "bo_at_fields_table_idx" ON "bo_at_fields" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "bo_at_health_issues_base_idx" ON "bo_at_health_issues" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX "bo_at_health_scores_base_idx" ON "bo_at_health_scores" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX "bo_at_interfaces_base_idx" ON "bo_at_interfaces" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX "bo_at_rfd_table_field_idx" ON "bo_at_record_field_data" USING btree ("table_id","field_id");--> statement-breakpoint
CREATE INDEX "bo_at_record_updates_cell_idx" ON "bo_at_record_updates" USING btree ("record_id","field_id");--> statement-breakpoint
CREATE INDEX "bo_at_record_updates_run_idx" ON "bo_at_record_updates" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "bo_at_records_table_idx" ON "bo_at_records" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "bo_at_schema_updates_run_idx" ON "bo_at_schema_updates" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "bo_at_schema_updates_entity_idx" ON "bo_at_schema_updates" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bo_at_schema_versions_base_hash_uq" ON "bo_at_schema_versions" USING btree ("base_id","schema_hash");--> statement-breakpoint
CREATE INDEX "bo_at_tables_base_idx" ON "bo_at_tables" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX "bo_at_views_table_idx" ON "bo_at_views" USING btree ("table_id");