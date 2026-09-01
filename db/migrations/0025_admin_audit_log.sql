CREATE TABLE "baseout"."admin_audit_log" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase" text DEFAULT 'intent' NOT NULL,
	"intent_id" text,
	"actor_user_id" text NOT NULL,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"organization_id" text,
	"params" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"db_user" text DEFAULT current_user NOT NULL,
	"application_name" text DEFAULT current_setting('application_name', true),
	"txid" bigint DEFAULT txid_current() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "admin_audit_log_created_idx" ON "baseout"."admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_log_target_idx" ON "baseout"."admin_audit_log" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_log_actor_idx" ON "baseout"."admin_audit_log" USING btree ("actor_user_id","created_at");