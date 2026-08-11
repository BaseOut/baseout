CREATE TABLE "baseout"."health_score_rules" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"severity" text DEFAULT 'medium' NOT NULL,
	"weight" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "health_score_rules_org_code_unique" UNIQUE("organization_id","code"),
	CONSTRAINT "health_score_rules_severity_check" CHECK ("baseout"."health_score_rules"."severity" IN ('high', 'medium', 'low'))
);
--> statement-breakpoint
CREATE TABLE "baseout"."space_databases" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" text NOT NULL,
	"backend" text NOT NULL,
	"records_enabled" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"d1_database_id" text,
	"pg_locator" text,
	"byodb_connection_string_enc" text,
	"schema_version" integer,
	"last_schema_sync_at" timestamp with time zone,
	"last_records_sync_at" timestamp with time zone,
	"provisioned_by_user_id" text,
	"provisioned_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "space_databases_space_id_unique" UNIQUE("space_id"),
	CONSTRAINT "space_databases_backend_check" CHECK ("baseout"."space_databases"."backend" IN ('d1', 'managed_pg', 'byodb')),
	CONSTRAINT "space_databases_status_check" CHECK ("baseout"."space_databases"."status" IN ('pending', 'provisioning', 'active', 'migrating', 'error')),
	CONSTRAINT "space_databases_sovereign_requires_records" CHECK ("baseout"."space_databases"."backend" <> 'byodb' OR "baseout"."space_databases"."records_enabled" = true)
);
--> statement-breakpoint
ALTER TABLE "baseout"."health_score_rules" ADD CONSTRAINT "health_score_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "baseout"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."space_databases" ADD CONSTRAINT "space_databases_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."space_databases" ADD CONSTRAINT "space_databases_provisioned_by_user_id_users_id_fk" FOREIGN KEY ("provisioned_by_user_id") REFERENCES "baseout"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "health_score_rules_organization_id_idx" ON "baseout"."health_score_rules" USING btree ("organization_id");
