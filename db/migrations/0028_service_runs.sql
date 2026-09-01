CREATE TABLE "baseout"."service_runs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service" text NOT NULL,
	"status" text DEFAULT 'started' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"counts" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "service_runs_service_started_idx" ON "baseout"."service_runs" USING btree ("service","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "service_runs_status_idx" ON "baseout"."service_runs" USING btree ("status");