CREATE TABLE "baseout"."space_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dismissed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "baseout"."at_bases" ADD COLUMN "discovered_via" text DEFAULT 'oauth_callback' NOT NULL;--> statement-breakpoint
ALTER TABLE "baseout"."at_bases" ADD COLUMN "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "baseout"."backup_configurations" ADD COLUMN "auto_add_future_bases" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "baseout"."space_events" ADD CONSTRAINT "space_events_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "space_events_space_id_active_idx" ON "baseout"."space_events" USING btree ("space_id") WHERE "baseout"."space_events"."dismissed_at" IS NULL;