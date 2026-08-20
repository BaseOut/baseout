CREATE TABLE `bo_at_asset_refs` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`airtable_attachment_id` text NOT NULL,
	`base_id` text NOT NULL,
	`table_id` text NOT NULL,
	`record_id` text NOT NULL,
	`field_id` text NOT NULL,
	`filename` text,
	`status` text DEFAULT 'active' NOT NULL,
	`first_seen_run` text,
	`last_seen_run` text,
	`first_seen_at` text,
	`last_seen_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bo_at_asset_refs_attachment_uq` ON `bo_at_asset_refs` (`airtable_attachment_id`);--> statement-breakpoint
CREATE INDEX `bo_at_asset_refs_asset_idx` ON `bo_at_asset_refs` (`asset_id`);--> statement-breakpoint
CREATE INDEX `bo_at_asset_refs_record_idx` ON `bo_at_asset_refs` (`record_id`);--> statement-breakpoint
CREATE INDEX `bo_at_asset_refs_base_idx` ON `bo_at_asset_refs` (`base_id`);--> statement-breakpoint
CREATE TABLE `bo_at_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`checksum` text NOT NULL,
	`content_type` text,
	`content_class` text DEFAULT 'other' NOT NULL,
	`size_bytes` integer,
	`storage_kind` text,
	`storage_provider` text,
	`storage_ref` text,
	`thumbnail_status` text DEFAULT 'none' NOT NULL,
	`thumbnail_key` text,
	`zero_ref_since` text,
	`first_seen_run` text,
	`last_seen_run` text,
	`first_seen_at` text,
	`last_seen_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bo_at_assets_checksum_uq` ON `bo_at_assets` (`checksum`);--> statement-breakpoint
CREATE INDEX `bo_at_assets_class_idx` ON `bo_at_assets` (`content_class`);--> statement-breakpoint
CREATE INDEX `bo_at_assets_keyset_idx` ON `bo_at_assets` (`first_seen_at`,`id`);--> statement-breakpoint
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
	`run_type` text DEFAULT 'full' NOT NULL,
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
CREATE TABLE `bo_at_chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'complete' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_chat_messages_thread_idx` ON `bo_at_chat_messages` (`thread_id`);--> statement-breakpoint
CREATE TABLE `bo_at_chat_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT 'New chat' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`scope` text,
	`attached_doc_ids` text,
	`created_by_user_id` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `bo_at_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`airtable_comment_id` text NOT NULL,
	`base_id` text NOT NULL,
	`airtable_table_id` text NOT NULL,
	`airtable_record_id` text NOT NULL,
	`author` text,
	`text` text,
	`airtable_created_at` text,
	`airtable_last_updated_at` text,
	`raw` text,
	`status` text DEFAULT 'active' NOT NULL,
	`first_seen_run` text,
	`last_seen_run` text,
	`first_seen_at` text,
	`last_seen_at` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_comments_record_idx` ON `bo_at_comments` (`airtable_record_id`);--> statement-breakpoint
CREATE INDEX `bo_at_comments_base_idx` ON `bo_at_comments` (`base_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bo_at_comments_comment_uq` ON `bo_at_comments` (`airtable_comment_id`);--> statement-breakpoint
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
CREATE TABLE `bo_at_form_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`base_id` text NOT NULL,
	`form_id` text NOT NULL,
	`table_id` text NOT NULL,
	`field_id` text NOT NULL,
	`is_editable` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`first_seen_run` text,
	`first_unseen_run` text,
	`last_seen_run` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_form_fields_form_idx` ON `bo_at_form_fields` (`form_id`);--> statement-breakpoint
CREATE INDEX `bo_at_form_fields_field_idx` ON `bo_at_form_fields` (`field_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bo_at_form_fields_uq` ON `bo_at_form_fields` (`form_id`,`field_id`);--> statement-breakpoint
CREATE TABLE `bo_at_forms` (
	`id` text PRIMARY KEY NOT NULL,
	`base_id` text NOT NULL,
	`airtable_entity_id` text,
	`interface_id` text,
	`name` text,
	`source_table_id` text,
	`definition` text,
	`submitted_via` text,
	`status` text DEFAULT 'active' NOT NULL,
	`first_seen_run` text,
	`first_unseen_run` text,
	`last_seen_run` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_forms_base_idx` ON `bo_at_forms` (`base_id`);--> statement-breakpoint
CREATE INDEX `bo_at_forms_interface_idx` ON `bo_at_forms` (`interface_id`);--> statement-breakpoint
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
CREATE TABLE `bo_at_health_metric_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`prompt` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_health_metric_overrides_rule_idx` ON `bo_at_health_metric_overrides` (`rule_id`);--> statement-breakpoint
CREATE TABLE `bo_at_health_metric_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_id` text NOT NULL,
	`prompt` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_health_metric_prompts_rule_idx` ON `bo_at_health_metric_prompts` (`rule_id`);--> statement-breakpoint
CREATE TABLE `bo_at_health_metric_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`base_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`run_id` text NOT NULL,
	`score` integer NOT NULL,
	`last_generated_at` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_health_metric_scores_base_idx` ON `bo_at_health_metric_scores` (`base_id`);--> statement-breakpoint
CREATE TABLE `bo_at_health_metric_state` (
	`id` text PRIMARY KEY NOT NULL,
	`base_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bo_at_health_metric_state_base_idx` ON `bo_at_health_metric_state` (`base_id`);--> statement-breakpoint
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
CREATE TABLE `bo_at_inbox_mutes` (
	`base_id` text PRIMARY KEY NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `bo_at_inbox_state` (
	`item_id` text PRIMARY KEY NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`snoozed_until` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `bo_at_interfaces` (
	`id` text PRIMARY KEY NOT NULL,
	`base_id` text NOT NULL,
	`airtable_entity_id` text,
	`name` text,
	`definition` text,
	`submitted_via` text,
	`status` text DEFAULT 'active' NOT NULL,
	`first_seen_run` text,
	`first_unseen_run` text,
	`last_seen_run` text
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
CREATE TABLE `bo_at_page_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`base_id` text NOT NULL,
	`page_id` text NOT NULL,
	`table_id` text NOT NULL,
	`field_id` text NOT NULL,
	`is_editable` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`first_seen_run` text,
	`first_unseen_run` text,
	`last_seen_run` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_page_fields_page_idx` ON `bo_at_page_fields` (`page_id`);--> statement-breakpoint
CREATE INDEX `bo_at_page_fields_field_idx` ON `bo_at_page_fields` (`field_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bo_at_page_fields_uq` ON `bo_at_page_fields` (`page_id`,`field_id`);--> statement-breakpoint
CREATE TABLE `bo_at_page_tables` (
	`id` text PRIMARY KEY NOT NULL,
	`base_id` text NOT NULL,
	`page_id` text NOT NULL,
	`table_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`first_seen_run` text,
	`first_unseen_run` text,
	`last_seen_run` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_page_tables_page_idx` ON `bo_at_page_tables` (`page_id`);--> statement-breakpoint
CREATE INDEX `bo_at_page_tables_table_idx` ON `bo_at_page_tables` (`table_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bo_at_page_tables_uq` ON `bo_at_page_tables` (`page_id`,`table_id`);--> statement-breakpoint
CREATE TABLE `bo_at_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`base_id` text NOT NULL,
	`airtable_entity_id` text,
	`interface_id` text,
	`name` text,
	`page_type` text,
	`source_table_id` text,
	`definition` text,
	`submitted_via` text,
	`status` text DEFAULT 'active' NOT NULL,
	`first_seen_run` text,
	`first_unseen_run` text,
	`last_seen_run` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_pages_base_idx` ON `bo_at_pages` (`base_id`);--> statement-breakpoint
CREATE INDEX `bo_at_pages_interface_idx` ON `bo_at_pages` (`interface_id`);--> statement-breakpoint
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
	`old_value` text,
	`action_source` text,
	`actor` text
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
	`breaks_data` integer DEFAULT false NOT NULL,
	`action_source` text,
	`actor` text
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
CREATE TABLE `bo_at_synced_view_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`base_id` text NOT NULL,
	`source_table_id` text NOT NULL,
	`dest_table_id` text NOT NULL,
	`status` text DEFAULT 'inferred' NOT NULL,
	`origin` text DEFAULT 'inferred' NOT NULL,
	`match_score` integer,
	`matched_pairs` text,
	`first_seen_run` text,
	`last_seen_run` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_synced_view_candidates_base_idx` ON `bo_at_synced_view_candidates` (`base_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bo_at_synced_view_candidates_pair_uq` ON `bo_at_synced_view_candidates` (`base_id`,`source_table_id`,`dest_table_id`);--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `bo_at_base_access` (
	`id` text PRIMARY KEY NOT NULL,
	`principal_id` text NOT NULL,
	`base_id` text NOT NULL,
	`interface_id` text DEFAULT '' NOT NULL,
	`scope` text NOT NULL,
	`permission_level` text,
	`granted_by_user_id` text,
	`airtable_created_time` text,
	`status` text DEFAULT 'active' NOT NULL,
	`first_seen_run` text,
	`last_seen_run` text,
	`first_seen_at` text,
	`last_seen_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bo_at_base_access_uq` ON `bo_at_base_access` (`base_id`,`interface_id`,`scope`,`principal_id`);--> statement-breakpoint
CREATE INDEX `bo_at_base_access_principal_idx` ON `bo_at_base_access` (`principal_id`);--> statement-breakpoint
CREATE INDEX `bo_at_base_access_base_idx` ON `bo_at_base_access` (`base_id`);--> statement-breakpoint
CREATE TABLE `bo_at_base_collab_meta` (
	`base_id` text PRIMARY KEY NOT NULL,
	`packages` text,
	`raw` text,
	`last_seen_run` text,
	`last_seen_at` text
);
--> statement-breakpoint
CREATE TABLE `bo_at_comment_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`airtable_comment_id` text NOT NULL,
	`airtable_attachment_id` text NOT NULL,
	`base_id` text NOT NULL,
	`airtable_table_id` text NOT NULL,
	`airtable_record_id` text NOT NULL,
	`url` text,
	`filename` text,
	`size_bytes` integer,
	`mime_type` text,
	`content_hash` text,
	`storage_key` text,
	`upload_status` text DEFAULT 'pending' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`first_seen_run` text,
	`last_seen_run` text,
	`first_seen_at` text,
	`last_seen_at` text,
	`uploaded_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bo_at_comment_attachments_uq` ON `bo_at_comment_attachments` (`airtable_comment_id`,`airtable_attachment_id`);--> statement-breakpoint
CREATE INDEX `bo_at_comment_attachments_comment_idx` ON `bo_at_comment_attachments` (`airtable_comment_id`);--> statement-breakpoint
CREATE INDEX `bo_at_comment_attachments_record_idx` ON `bo_at_comment_attachments` (`airtable_record_id`);--> statement-breakpoint
CREATE INDEX `bo_at_comment_attachments_status_idx` ON `bo_at_comment_attachments` (`status`,`upload_status`);--> statement-breakpoint
CREATE TABLE `bo_at_entity_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_kind` text NOT NULL,
	`entity_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`added_at` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_entity_tags_entity_idx` ON `bo_at_entity_tags` (`entity_kind`,`entity_id`);--> statement-breakpoint
CREATE INDEX `bo_at_entity_tags_target_idx` ON `bo_at_entity_tags` (`target_type`,`target_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bo_at_entity_tags_uq` ON `bo_at_entity_tags` (`entity_kind`,`entity_id`,`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `bo_at_export_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`format` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`output_location` text,
	`row_count` integer,
	`error` text,
	`created_at` text,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `bo_at_export_jobs_status_idx` ON `bo_at_export_jobs` (`status`);--> statement-breakpoint
CREATE TABLE `bo_at_invite_links` (
	`id` text PRIMARY KEY NOT NULL,
	`airtable_invite_id` text NOT NULL,
	`base_id` text NOT NULL,
	`interface_id` text DEFAULT '' NOT NULL,
	`link_scope` text NOT NULL,
	`invited_email` text,
	`permission_level` text,
	`referred_by_user_id` text,
	`restricted_to_email_domains` text,
	`type` text,
	`airtable_created_time` text,
	`status` text DEFAULT 'active' NOT NULL,
	`first_seen_run` text,
	`last_seen_run` text,
	`first_seen_at` text,
	`last_seen_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bo_at_invite_links_uq` ON `bo_at_invite_links` (`base_id`,`interface_id`,`link_scope`,`airtable_invite_id`);--> statement-breakpoint
CREATE INDEX `bo_at_invite_links_base_idx` ON `bo_at_invite_links` (`base_id`);--> statement-breakpoint
CREATE TABLE `bo_at_principals` (
	`id` text PRIMARY KEY NOT NULL,
	`principal_id` text NOT NULL,
	`kind` text NOT NULL,
	`email` text,
	`name` text,
	`first_seen_run` text,
	`last_seen_run` text,
	`first_seen_at` text,
	`last_seen_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bo_at_principals_uq` ON `bo_at_principals` (`principal_id`);--> statement-breakpoint
ALTER TABLE `bo_at_bases` ADD `workspace_id` text;--> statement-breakpoint
ALTER TABLE `bo_at_bases` ADD `airtable_created_time` text;--> statement-breakpoint
ALTER TABLE `bo_at_bases` ADD `own_permission_level` text;--> statement-breakpoint
CREATE UNIQUE INDEX `bo_at_automations_base_entity_uq` ON `bo_at_automations` (`base_id`,`airtable_entity_id`) WHERE "bo_at_automations"."airtable_entity_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `bo_at_interfaces_base_entity_uq` ON `bo_at_interfaces` (`base_id`,`airtable_entity_id`) WHERE "bo_at_interfaces"."airtable_entity_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `bo_at_pages_base_entity_uq` ON `bo_at_pages` (`base_id`,`airtable_entity_id`) WHERE "bo_at_pages"."airtable_entity_id" IS NOT NULL;
