/**
 * Per-Space DB DDL — Postgres dialect, as an executable string.
 *
 * The per-Space DB provisioner runs inside the engine Cloudflare Worker
 * (workerd, no filesystem), so it cannot read the .sql migration at runtime —
 * it needs the DDL bundled. This module is the bundled copy.
 *
 * GENERATED FROM migrations/space-pg/0000_luxuriant_silver_surfer.sql by scripts/gen-space-pg-ddl.mjs — DO NOT HAND-EDIT.
 * tests/space-pg-ddl-parity.test.ts asserts this stays in lockstep with that
 * migration (drift fails CI). Regenerate after a per-Space schema change:
 *   node packages/db-schema/scripts/gen-space-pg-ddl.mjs
 *
 * No imports on purpose — the engine bundle gets the string with zero drizzle
 * weight. Statements are separated by drizzle's `--> statement-breakpoint`.
 */

export const SPACE_PG_DDL = `CREATE TABLE "bo_at_attachments" (
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
	"ai_description" text,
	"ai_overview" text,
	"description_override" text,
	"status" text DEFAULT 'active' NOT NULL,
	"first_seen_run" uuid,
	"first_unseen_run" uuid,
	"last_seen_run" uuid
);
--> statement-breakpoint
CREATE TABLE "bo_at_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'complete' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bo_at_chat_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'New chat' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"scope" jsonb,
	"attached_doc_ids" jsonb,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bo_at_document_diagrams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"name" text,
	"state" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bo_at_document_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"name" text,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bo_at_document_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"added_via" text
);
--> statement-breakpoint
CREATE TABLE "bo_at_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" jsonb,
	"excerpt" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone,
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
	"ai_description" text,
	"ai_overview" text,
	"description_override" text,
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
CREATE TABLE "bo_at_health_metric_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"prompt" text NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bo_at_health_metric_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" text NOT NULL,
	"prompt" text NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bo_at_health_metric_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" text NOT NULL,
	"rule_id" text NOT NULL,
	"run_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"last_generated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bo_at_health_metric_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" text NOT NULL,
	"rule_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
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
CREATE TABLE "bo_at_meta" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"schema_version" integer NOT NULL,
	"space_id" uuid NOT NULL,
	"backend" text NOT NULL,
	"platform" text DEFAULT 'airtable' NOT NULL,
	"provisioned_at" timestamp with time zone,
	"last_migrated_at" timestamp with time zone
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
	"last_seen_run" uuid,
	"ai_description" text,
	"ai_overview" text,
	"description_override" text
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
CREATE TABLE "bo_at_synced_view_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_id" text NOT NULL,
	"source_table_id" text NOT NULL,
	"dest_table_id" text NOT NULL,
	"status" text DEFAULT 'inferred' NOT NULL,
	"origin" text DEFAULT 'inferred' NOT NULL,
	"match_score" integer,
	"matched_pairs" jsonb,
	"first_seen_run" uuid,
	"last_seen_run" uuid,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
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
	"ai_description" text,
	"ai_overview" text,
	"description_override" text,
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
	"ai_description" text,
	"ai_overview" text,
	"description_override" text,
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
CREATE INDEX "bo_at_chat_messages_thread_idx" ON "bo_at_chat_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "bo_at_document_diagrams_doc_idx" ON "bo_at_document_diagrams" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "bo_at_document_links_doc_idx" ON "bo_at_document_links" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "bo_at_document_tags_doc_idx" ON "bo_at_document_tags" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "bo_at_document_tags_target_idx" ON "bo_at_document_tags" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bo_at_document_tags_uq" ON "bo_at_document_tags" USING btree ("document_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "bo_at_fields_table_idx" ON "bo_at_fields" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "bo_at_health_issues_base_idx" ON "bo_at_health_issues" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX "bo_at_health_metric_overrides_rule_idx" ON "bo_at_health_metric_overrides" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "bo_at_health_metric_prompts_rule_idx" ON "bo_at_health_metric_prompts" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "bo_at_health_metric_scores_base_idx" ON "bo_at_health_metric_scores" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX "bo_at_health_metric_state_base_idx" ON "bo_at_health_metric_state" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX "bo_at_health_scores_base_idx" ON "bo_at_health_scores" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX "bo_at_interfaces_base_idx" ON "bo_at_interfaces" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX "bo_at_rfd_table_field_idx" ON "bo_at_record_field_data" USING btree ("table_id","field_id");--> statement-breakpoint
CREATE INDEX "bo_at_record_updates_cell_idx" ON "bo_at_record_updates" USING btree ("record_id","field_id");--> statement-breakpoint
CREATE INDEX "bo_at_record_updates_run_idx" ON "bo_at_record_updates" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "bo_at_records_table_idx" ON "bo_at_records" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "bo_at_schema_updates_run_idx" ON "bo_at_schema_updates" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "bo_at_schema_updates_entity_idx" ON "bo_at_schema_updates" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bo_at_schema_versions_base_hash_uq" ON "bo_at_schema_versions" USING btree ("base_id","schema_hash");--> statement-breakpoint
CREATE INDEX "bo_at_synced_view_candidates_base_idx" ON "bo_at_synced_view_candidates" USING btree ("base_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bo_at_synced_view_candidates_pair_uq" ON "bo_at_synced_view_candidates" USING btree ("base_id","source_table_id","dest_table_id");--> statement-breakpoint
CREATE INDEX "bo_at_tables_base_idx" ON "bo_at_tables" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX "bo_at_views_table_idx" ON "bo_at_views" USING btree ("table_id");`;

/** Split SPACE_PG_DDL into individual executable statements. */
export function spacePgDdlStatements(): string[] {
  return SPACE_PG_DDL.split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
