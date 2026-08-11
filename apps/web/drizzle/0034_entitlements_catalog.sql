CREATE TABLE "baseout"."account_feature_overrides" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"feature_id" text NOT NULL,
	"value_bool" boolean,
	"value_numeric" numeric,
	"value_enum" text,
	"reason" text NOT NULL,
	"granted_by_user_id" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_feature_overrides_org_feature_unique" UNIQUE("organization_id","feature_id")
);
--> statement-breakpoint
CREATE TABLE "baseout"."addon_catalog" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"feature_slug" text NOT NULL,
	"unit_quantity" numeric NOT NULL,
	"kind" text NOT NULL,
	"price_cents" integer NOT NULL,
	"stripe_price_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "addon_catalog_slug_unique" UNIQUE("slug"),
	CONSTRAINT "addon_catalog_stripe_price_id_unique" UNIQUE("stripe_price_id"),
	CONSTRAINT "addon_catalog_kind_check" CHECK ("baseout"."addon_catalog"."kind" in ('recurring', 'one_time'))
);
--> statement-breakpoint
CREATE TABLE "baseout"."addon_purchases" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"addon_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"kind" text NOT NULL,
	"stripe_subscription_item_id" text,
	"stripe_invoice_item_id" text,
	"expires_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "addon_purchases_stripe_subscription_item_id_unique" UNIQUE("stripe_subscription_item_id"),
	CONSTRAINT "addon_purchases_stripe_invoice_item_id_unique" UNIQUE("stripe_invoice_item_id"),
	CONSTRAINT "addon_purchases_kind_check" CHECK ("baseout"."addon_purchases"."kind" in ('recurring', 'one_time')),
	CONSTRAINT "addon_purchases_status_check" CHECK ("baseout"."addon_purchases"."status" in ('active', 'cancelled', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "baseout"."feature_groups" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "baseout"."features" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"value_type" text NOT NULL,
	"unit" text,
	"enum_values" jsonb,
	"meterable" boolean DEFAULT false NOT NULL,
	"meter_kind" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "features_slug_unique" UNIQUE("slug"),
	CONSTRAINT "features_value_type_check" CHECK ("baseout"."features"."value_type" in ('boolean', 'limit', 'enum')),
	CONSTRAINT "features_meter_kind_check" CHECK ("baseout"."features"."meter_kind" is null or "baseout"."features"."meter_kind" in ('flow', 'stock', 'creation'))
);
--> statement-breakpoint
CREATE TABLE "baseout"."plan_features" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" text NOT NULL,
	"feature_id" text NOT NULL,
	"value_bool" boolean,
	"value_numeric" numeric,
	"value_enum" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_features_plan_feature_unique" UNIQUE("plan_id","feature_id")
);
--> statement-breakpoint
CREATE TABLE "baseout"."plan_prices" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" text NOT NULL,
	"billing_period" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"stripe_price_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_prices_stripe_price_id_unique" UNIQUE("stripe_price_id"),
	CONSTRAINT "plan_prices_plan_period_unique" UNIQUE("plan_id","billing_period"),
	CONSTRAINT "plan_prices_billing_period_check" CHECK ("baseout"."plan_prices"."billing_period" in ('monthly', 'annual'))
);
--> statement-breakpoint
CREATE TABLE "baseout"."plans" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"stripe_product_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_slug_unique" UNIQUE("slug"),
	CONSTRAINT "plans_stripe_product_id_unique" UNIQUE("stripe_product_id"),
	CONSTRAINT "plans_kind_check" CHECK ("baseout"."plans"."kind" in ('public', 'trial', 'custom', 'legacy')),
	CONSTRAINT "plans_status_check" CHECK ("baseout"."plans"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "baseout"."usage_notification_state" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"feature_slug" text NOT NULL,
	"state" text DEFAULT 'ok' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"last_transition_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_notification_state_org_feature_period_unique" UNIQUE("organization_id","feature_slug","period_start"),
	CONSTRAINT "usage_notification_state_check" CHECK ("baseout"."usage_notification_state"."state" in ('ok', 'warned_90', 'warned_100', 'enforced'))
);
--> statement-breakpoint
CREATE TABLE "baseout"."usage_rollups" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"feature_slug" text NOT NULL,
	"space_id" text,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"used" numeric DEFAULT '0' NOT NULL,
	"meter_kind" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "baseout"."subscription_items" ADD COLUMN "plan_id" text;--> statement-breakpoint
ALTER TABLE "baseout"."account_feature_overrides" ADD CONSTRAINT "account_feature_overrides_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "baseout"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."account_feature_overrides" ADD CONSTRAINT "account_feature_overrides_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "baseout"."features"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."account_feature_overrides" ADD CONSTRAINT "account_feature_overrides_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "baseout"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."addon_purchases" ADD CONSTRAINT "addon_purchases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "baseout"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."addon_purchases" ADD CONSTRAINT "addon_purchases_addon_id_addon_catalog_id_fk" FOREIGN KEY ("addon_id") REFERENCES "baseout"."addon_catalog"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."features" ADD CONSTRAINT "features_group_id_feature_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "baseout"."feature_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."plan_features" ADD CONSTRAINT "plan_features_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "baseout"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."plan_features" ADD CONSTRAINT "plan_features_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "baseout"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."plan_prices" ADD CONSTRAINT "plan_prices_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "baseout"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."usage_notification_state" ADD CONSTRAINT "usage_notification_state_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "baseout"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."usage_rollups" ADD CONSTRAINT "usage_rollups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "baseout"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."usage_rollups" ADD CONSTRAINT "usage_rollups_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_feature_overrides_org_idx" ON "baseout"."account_feature_overrides" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "addon_catalog_feature_slug_idx" ON "baseout"."addon_catalog" USING btree ("feature_slug");--> statement-breakpoint
CREATE INDEX "addon_purchases_org_status_idx" ON "baseout"."addon_purchases" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "features_group_id_idx" ON "baseout"."features" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "plan_features_plan_id_idx" ON "baseout"."plan_features" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "usage_rollups_org_feature_period_idx" ON "baseout"."usage_rollups" USING btree ("organization_id","feature_slug","period_start");--> statement-breakpoint
ALTER TABLE "baseout"."subscription_items" ADD CONSTRAINT "subscription_items_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "baseout"."plans"("id") ON DELETE set null ON UPDATE no action;