CREATE SCHEMA IF NOT EXISTS "baseout";
--> statement-breakpoint
CREATE TABLE "baseout"."accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "baseout"."sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "baseout"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "baseout"."verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "baseout"."at_bases" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" text NOT NULL,
	"at_base_id" text NOT NULL,
	"name" text NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "at_bases_space_base_unique" UNIQUE("space_id","at_base_id")
);
--> statement-breakpoint
CREATE TABLE "baseout"."connection_sessions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" text NOT NULL,
	"locked_by" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "baseout"."connections" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"platform_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"scope" text DEFAULT 'organization' NOT NULL,
	"space_id" text,
	"display_name" text,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text,
	"token_expires_at" timestamp with time zone,
	"scopes" text,
	"platform_config" jsonb,
	"status" text NOT NULL,
	"max_concurrent_sessions" integer DEFAULT 3 NOT NULL,
	"invalidated_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "baseout"."organization_members" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"invited_by_user_id" text,
	"invited_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_org_user_unique" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "baseout"."organizations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"stripe_customer_id" text,
	"has_migrated" boolean DEFAULT true NOT NULL,
	"dynamic_locked" boolean DEFAULT false NOT NULL,
	"overage_mode" text DEFAULT 'cap' NOT NULL,
	"monthly_overage_cap" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organizations_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "baseout"."overage_records" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"subscription_item_id" text NOT NULL,
	"metric" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"included_quota" integer NOT NULL,
	"usage_amount" integer NOT NULL,
	"overage_amount" integer NOT NULL,
	"unit_cost_cents" integer NOT NULL,
	"total_cost_cents" integer NOT NULL,
	"stripe_invoice_item_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "baseout"."platforms" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"icon_url" text,
	"website_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platforms_slug_unique" UNIQUE("slug"),
	CONSTRAINT "platforms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "baseout"."space_platforms" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" text NOT NULL,
	"platform_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "space_platforms_space_platform_unique" UNIQUE("space_id","platform_id")
);
--> statement-breakpoint
CREATE TABLE "baseout"."spaces" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"space_type" text DEFAULT 'single_platform' NOT NULL,
	"status" text DEFAULT 'setup_incomplete' NOT NULL,
	"onboarding_step" integer DEFAULT 1 NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "baseout"."subscription_items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" text NOT NULL,
	"platform_id" text NOT NULL,
	"stripe_subscription_item_id" text NOT NULL,
	"stripe_product_id" text NOT NULL,
	"stripe_price_id" text NOT NULL,
	"tier" text NOT NULL,
	"billing_period" text NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"trial_backup_run_used" boolean DEFAULT false NOT NULL,
	"trial_ever_used" boolean DEFAULT false NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_items_stripe_subscription_item_id_unique" UNIQUE("stripe_subscription_item_id"),
	CONSTRAINT "subscription_items_sub_platform_unique" UNIQUE("subscription_id","platform_id")
);
--> statement-breakpoint
CREATE TABLE "baseout"."subscriptions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id"),
	CONSTRAINT "subscriptions_organization_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "baseout"."user_preferences" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"active_space_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "baseout"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "baseout"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "baseout"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."at_bases" ADD CONSTRAINT "at_bases_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."connection_sessions" ADD CONSTRAINT "connection_sessions_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "baseout"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."connections" ADD CONSTRAINT "connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "baseout"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."connections" ADD CONSTRAINT "connections_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "baseout"."platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."connections" ADD CONSTRAINT "connections_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "baseout"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."connections" ADD CONSTRAINT "connections_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "baseout"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "baseout"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."organization_members" ADD CONSTRAINT "organization_members_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "baseout"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."overage_records" ADD CONSTRAINT "overage_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "baseout"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."overage_records" ADD CONSTRAINT "overage_records_subscription_item_id_subscription_items_id_fk" FOREIGN KEY ("subscription_item_id") REFERENCES "baseout"."subscription_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."space_platforms" ADD CONSTRAINT "space_platforms_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."space_platforms" ADD CONSTRAINT "space_platforms_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "baseout"."platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."spaces" ADD CONSTRAINT "spaces_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "baseout"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."subscription_items" ADD CONSTRAINT "subscription_items_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "baseout"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."subscription_items" ADD CONSTRAINT "subscription_items_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "baseout"."platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "baseout"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "baseout"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."user_preferences" ADD CONSTRAINT "user_preferences_active_organization_id_organizations_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "baseout"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."user_preferences" ADD CONSTRAINT "user_preferences_active_space_id_spaces_id_fk" FOREIGN KEY ("active_space_id") REFERENCES "baseout"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "baseout"."accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "baseout"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "at_bases_space_id_idx" ON "baseout"."at_bases" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "connection_sessions_connection_id_idx" ON "baseout"."connection_sessions" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "connection_sessions_expires_at_idx" ON "baseout"."connection_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "connections_org_platform_idx" ON "baseout"."connections" USING btree ("organization_id","platform_id");--> statement-breakpoint
CREATE INDEX "connections_created_by_idx" ON "baseout"."connections" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_id_idx" ON "baseout"."organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "overage_records_org_period_idx" ON "baseout"."overage_records" USING btree ("organization_id","period_start");--> statement-breakpoint
CREATE INDEX "overage_records_sub_item_metric_idx" ON "baseout"."overage_records" USING btree ("subscription_item_id","metric");--> statement-breakpoint
CREATE INDEX "space_platforms_space_id_idx" ON "baseout"."space_platforms" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "spaces_organization_id_idx" ON "baseout"."spaces" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "subscription_items_sub_platform_idx" ON "baseout"."subscription_items" USING btree ("subscription_id","platform_id");