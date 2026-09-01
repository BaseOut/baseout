CREATE TABLE "baseout"."db_clusters" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"owner_org_id" text,
	"connection_ref" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "db_clusters_kind_check" CHECK ("baseout"."db_clusters"."kind" IN ('shared', 'dedicated')),
	CONSTRAINT "db_clusters_status_check" CHECK ("baseout"."db_clusters"."status" IN ('provisioning', 'active', 'draining', 'retired'))
);
--> statement-breakpoint
ALTER TABLE "baseout"."space_databases" ADD COLUMN "isolation_class" text;--> statement-breakpoint
ALTER TABLE "baseout"."space_databases" ADD COLUMN "cluster_id" text;--> statement-breakpoint
ALTER TABLE "baseout"."db_clusters" ADD CONSTRAINT "db_clusters_owner_org_id_organizations_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "baseout"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "db_clusters_owner_org_idx" ON "baseout"."db_clusters" USING btree ("owner_org_id");--> statement-breakpoint
ALTER TABLE "baseout"."space_databases" ADD CONSTRAINT "space_databases_cluster_id_db_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "baseout"."db_clusters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."space_databases" ADD CONSTRAINT "space_databases_isolation_class_check" CHECK ("baseout"."space_databases"."isolation_class" IS NULL OR "baseout"."space_databases"."isolation_class" IN ('d1', 'shared_cluster', 'dedicated_cluster', 'byodb'));--> statement-breakpoint
-- Backfill the tier-facing isolation_class from the existing backend
-- (d1 -> d1, managed_pg -> shared_cluster, byodb -> byodb). shared-db-isolation-ladder L1.
UPDATE "baseout"."space_databases" SET "isolation_class" = CASE "backend"
	WHEN 'd1' THEN 'd1'
	WHEN 'managed_pg' THEN 'shared_cluster'
	WHEN 'byodb' THEN 'byodb'
END WHERE "isolation_class" IS NULL;