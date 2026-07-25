CREATE TABLE "baseout"."admin_error_acks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase" text DEFAULT 'ack' NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"target_state" text,
	"organization_id" text,
	"acked_by_user_id" text NOT NULL,
	"acked_by_email" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"db_user" text DEFAULT current_user NOT NULL,
	"application_name" text DEFAULT current_setting('application_name', true),
	"txid" bigint DEFAULT txid_current() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "admin_error_acks_target_idx" ON "baseout"."admin_error_acks" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_error_acks_org_idx" ON "baseout"."admin_error_acks" USING btree ("organization_id","created_at");