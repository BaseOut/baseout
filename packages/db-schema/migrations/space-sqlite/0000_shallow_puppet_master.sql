CREATE TABLE `bo_at_attachments` (
	`composite_id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL,
	`field_id` text NOT NULL,
	`record_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`content_hash` text,
	`filename` text,
	`size_bytes` integer,
	`mime_type` text,
	`upload_status` text DEFAULT 'pending' NOT NULL,
	`first_seen_run` text,
	`last_seen_run` text,
	`uploaded_at` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_attachments_record_idx` ON `bo_at_attachments` (`record_id`);--> statement-breakpoint
CREATE INDEX `bo_at_attachments_hash_idx` ON `bo_at_attachments` (`content_hash`);--> statement-breakpoint
CREATE TABLE `bo_at_automations` (
	`id` text PRIMARY KEY NOT NULL,
	`base_id` text NOT NULL,
	`airtable_entity_id` text,
	`name` text,
	`type` text,
	`definition` text,
	`status` text DEFAULT 'active' NOT NULL,
	`submitted_via` text,
	`first_seen_at` text,
	`last_seen_at` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_automations_base_idx` ON `bo_at_automations` (`base_id`);--> statement-breakpoint
CREATE TABLE `bo_at_base_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`backup_run_id` text NOT NULL,
	`base_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`curr_step` text,
	`schema_version_id` text,
	`schema_hash` text,
	`tables_count` integer,
	`records_count` integer,
	`attachments_count` integer,
	`started_at` text,
	`completed_at` text,
	`error_message` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_base_runs_backup_run_idx` ON `bo_at_base_runs` (`backup_run_id`);--> statement-breakpoint
CREATE INDEX `bo_at_base_runs_base_idx` ON `bo_at_base_runs` (`base_id`);--> statement-breakpoint
CREATE TABLE `bo_at_bases` (
	`base_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`ai_description` text,
	`ai_overview` text,
	`description_override` text,
	`status` text DEFAULT 'active' NOT NULL,
	`first_seen_run` text,
	`first_unseen_run` text,
	`last_seen_run` text
);
--> statement-breakpoint
CREATE TABLE `bo_at_document_diagrams` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`name` text,
	`state` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bo_at_document_diagrams_doc_idx` ON `bo_at_document_diagrams` (`document_id`);--> statement-breakpoint
CREATE TABLE `bo_at_document_links` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`name` text,
	`url` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bo_at_document_links_doc_idx` ON `bo_at_document_links` (`document_id`);--> statement-breakpoint
CREATE TABLE `bo_at_document_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`added_via` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_document_tags_doc_idx` ON `bo_at_document_tags` (`document_id`);--> statement-breakpoint
CREATE INDEX `bo_at_document_tags_target_idx` ON `bo_at_document_tags` (`target_type`,`target_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bo_at_document_tags_uq` ON `bo_at_document_tags` (`document_id`,`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `bo_at_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`excerpt` text,
	`created_by_user_id` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `bo_at_fields` (
	`field_id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL,
	`base_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`options` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`description` text,
	`ai_description` text,
	`ai_overview` text,
	`description_override` text,
	`status` text DEFAULT 'active' NOT NULL,
	`first_seen_run` text,
	`first_unseen_run` text,
	`last_seen_run` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_fields_table_idx` ON `bo_at_fields` (`table_id`);--> statement-breakpoint
CREATE TABLE `bo_at_health_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`base_id` text NOT NULL,
	`table_id` text,
	`field_id` text,
	`run_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`severity` text NOT NULL,
	`category` text,
	`message` text NOT NULL,
	`occurrence_count` integer,
	`airtable_deeplink` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_health_issues_base_idx` ON `bo_at_health_issues` (`base_id`);--> statement-breakpoint
CREATE TABLE `bo_at_health_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`base_id` text NOT NULL,
	`run_id` text NOT NULL,
	`score` integer NOT NULL,
	`band` text NOT NULL,
	`categories` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_health_scores_base_idx` ON `bo_at_health_scores` (`base_id`);--> statement-breakpoint
CREATE TABLE `bo_at_interfaces` (
	`id` text PRIMARY KEY NOT NULL,
	`base_id` text NOT NULL,
	`airtable_entity_id` text,
	`name` text,
	`type` text,
	`definition` text,
	`status` text DEFAULT 'active' NOT NULL,
	`submitted_via` text,
	`first_seen_at` text,
	`last_seen_at` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_interfaces_base_idx` ON `bo_at_interfaces` (`base_id`);--> statement-breakpoint
CREATE TABLE `bo_at_meta` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`schema_version` integer NOT NULL,
	`space_id` text NOT NULL,
	`backend` text NOT NULL,
	`platform` text DEFAULT 'airtable' NOT NULL,
	`provisioned_at` text,
	`last_migrated_at` text
);
--> statement-breakpoint
CREATE TABLE `bo_at_record_field_data` (
	`record_id` text NOT NULL,
	`field_id` text NOT NULL,
	`table_id` text NOT NULL,
	`value` text,
	`first_seen_run` text,
	`last_seen_run` text,
	PRIMARY KEY(`record_id`, `field_id`)
);
--> statement-breakpoint
CREATE INDEX `bo_at_rfd_table_field_idx` ON `bo_at_record_field_data` (`table_id`,`field_id`);--> statement-breakpoint
CREATE TABLE `bo_at_record_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`field_id` text NOT NULL,
	`table_id` text NOT NULL,
	`run_id` text NOT NULL,
	`old_value` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_record_updates_cell_idx` ON `bo_at_record_updates` (`record_id`,`field_id`);--> statement-breakpoint
CREATE INDEX `bo_at_record_updates_run_idx` ON `bo_at_record_updates` (`run_id`);--> statement-breakpoint
CREATE TABLE `bo_at_records` (
	`record_id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL,
	`base_id` text NOT NULL,
	`created_time` text,
	`modified_time` text,
	`status` text DEFAULT 'active' NOT NULL,
	`first_seen_run` text,
	`first_unseen_run` text,
	`last_seen_run` text,
	`ai_description` text,
	`ai_overview` text,
	`description_override` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_records_table_idx` ON `bo_at_records` (`table_id`);--> statement-breakpoint
CREATE TABLE `bo_at_schema_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`base_id` text NOT NULL,
	`table_id` text,
	`change_type` text NOT NULL,
	`change_type_name` text,
	`before_value` text,
	`after_value` text,
	`breaks_data` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bo_at_schema_updates_run_idx` ON `bo_at_schema_updates` (`run_id`);--> statement-breakpoint
CREATE INDEX `bo_at_schema_updates_entity_idx` ON `bo_at_schema_updates` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `bo_at_schema_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`base_id` text NOT NULL,
	`schema_hash` text NOT NULL,
	`schema_json` text NOT NULL,
	`first_seen_run` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bo_at_schema_versions_base_hash_uq` ON `bo_at_schema_versions` (`base_id`,`schema_hash`);--> statement-breakpoint
CREATE TABLE `bo_at_tables` (
	`table_id` text PRIMARY KEY NOT NULL,
	`base_id` text NOT NULL,
	`name` text NOT NULL,
	`primary_field_id` text,
	`field_count` integer,
	`record_count` integer,
	`description` text,
	`ai_description` text,
	`ai_overview` text,
	`description_override` text,
	`status` text DEFAULT 'active' NOT NULL,
	`first_seen_run` text,
	`first_unseen_run` text,
	`last_seen_run` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_tables_base_idx` ON `bo_at_tables` (`base_id`);--> statement-breakpoint
CREATE TABLE `bo_at_views` (
	`view_id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL,
	`base_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text,
	`ai_description` text,
	`ai_overview` text,
	`description_override` text,
	`status` text DEFAULT 'active' NOT NULL,
	`first_seen_run` text,
	`first_unseen_run` text,
	`last_seen_run` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_views_table_idx` ON `bo_at_views` (`table_id`);