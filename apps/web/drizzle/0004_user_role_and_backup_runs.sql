CREATE TABLE "baseout"."backup_runs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"triggered_by" text NOT NULL,
	"is_trial" boolean DEFAULT false NOT NULL,
	"record_count" integer,
	"table_count" integer,
	"attachment_count" integer,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "baseout"."users" ADD COLUMN "role" text DEFAULT 'customer' NOT NULL;--> statement-breakpoint
ALTER TABLE "baseout"."backup_runs" ADD CONSTRAINT "backup_runs_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."backup_runs" ADD CONSTRAINT "backup_runs_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "baseout"."connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "backup_runs_space_id_idx" ON "baseout"."backup_runs" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "backup_runs_connection_id_idx" ON "baseout"."backup_runs" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "backup_runs_status_idx" ON "baseout"."backup_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "backup_runs_created_at_idx" ON "baseout"."backup_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "baseout"."users" USING btree ("role");