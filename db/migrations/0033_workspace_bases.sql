CREATE TABLE "baseout"."space_workspaces" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"workspace_name" text,
	"auto_enroll_future_bases" boolean DEFAULT false NOT NULL,
	"enrolled_via" text DEFAULT 'manual' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "space_workspaces_space_workspace_unique" UNIQUE("space_id","workspace_id"),
	CONSTRAINT "space_workspaces_enrolled_via_check" CHECK ("baseout"."space_workspaces"."enrolled_via" IN ('manual', 'auto'))
);
--> statement-breakpoint
ALTER TABLE "baseout"."at_bases" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "baseout"."at_bases" ADD COLUMN "workspace_name" text;--> statement-breakpoint
ALTER TABLE "baseout"."backup_configurations" ADD COLUMN "auto_enroll_new_workspaces" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "baseout"."space_workspaces" ADD CONSTRAINT "space_workspaces_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "space_workspaces_space_id_idx" ON "baseout"."space_workspaces" USING btree ("space_id");