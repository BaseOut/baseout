CREATE TABLE "baseout"."auth_audit_log" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"actor_user_id" text,
	"actor_email" text,
	"organization_id" text,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"db_user" text DEFAULT current_user NOT NULL,
	"application_name" text DEFAULT current_setting('application_name', true),
	"txid" bigint DEFAULT txid_current() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "baseout"."organization_domains" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"domain" text NOT NULL,
	"mode" text NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_domains_org_domain_unique" UNIQUE("organization_id","domain"),
	CONSTRAINT "organization_domains_mode_check" CHECK ("baseout"."organization_domains"."mode" IN ('add', 'suppress'))
);
--> statement-breakpoint
CREATE TABLE "baseout"."organization_join_requests" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"requester_user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"domain" text,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by_user_id" text,
	"decline_cooldown_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_join_requests_status_check" CHECK ("baseout"."organization_join_requests"."status" IN ('pending', 'approved', 'declined', 'expired'))
);
--> statement-breakpoint
ALTER TABLE "baseout"."organization_domains" ADD CONSTRAINT "organization_domains_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "baseout"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."organization_domains" ADD CONSTRAINT "organization_domains_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "baseout"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."organization_join_requests" ADD CONSTRAINT "organization_join_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "baseout"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."organization_join_requests" ADD CONSTRAINT "organization_join_requests_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "baseout"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."organization_join_requests" ADD CONSTRAINT "organization_join_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "baseout"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_audit_log_kind_created_idx" ON "baseout"."auth_audit_log" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "auth_audit_log_actor_idx" ON "baseout"."auth_audit_log" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "auth_audit_log_org_idx" ON "baseout"."auth_audit_log" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "organization_domains_domain_idx" ON "baseout"."organization_domains" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_join_requests_open_unique" ON "baseout"."organization_join_requests" USING btree ("organization_id","requester_user_id") WHERE "baseout"."organization_join_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "organization_join_requests_org_status_idx" ON "baseout"."organization_join_requests" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "organization_join_requests_requester_idx" ON "baseout"."organization_join_requests" USING btree ("requester_user_id");