CREATE TABLE "baseout"."airtable_webhook_subscriptions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" text NOT NULL,
	"space_id" text NOT NULL,
	"payload_cursor" bigint DEFAULT 1 NOT NULL,
	"last_polled_at" timestamp with time zone,
	"last_reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airtable_webhook_subscriptions_webhook_space_unique" UNIQUE("webhook_id","space_id")
);
--> statement-breakpoint
CREATE TABLE "baseout"."airtable_webhooks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"base_id" text NOT NULL,
	"airtable_webhook_id" text NOT NULL,
	"mac_secret_base64_enc" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"last_ping_at" timestamp with time zone,
	"last_ping_source_ip" text,
	"last_renewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airtable_webhooks_airtable_webhook_id_unique" UNIQUE("airtable_webhook_id"),
	CONSTRAINT "airtable_webhooks_org_base_unique" UNIQUE("organization_id","base_id")
);
--> statement-breakpoint
ALTER TABLE "baseout"."backup_configurations" ADD COLUMN "webhook_poll_interval_seconds" integer DEFAULT 900 NOT NULL;--> statement-breakpoint
ALTER TABLE "baseout"."airtable_webhook_subscriptions" ADD CONSTRAINT "airtable_webhook_subscriptions_webhook_id_airtable_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "baseout"."airtable_webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."airtable_webhook_subscriptions" ADD CONSTRAINT "airtable_webhook_subscriptions_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."airtable_webhooks" ADD CONSTRAINT "airtable_webhooks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "baseout"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."airtable_webhooks" ADD CONSTRAINT "airtable_webhooks_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "baseout"."connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "airtable_webhook_subscriptions_space_idx" ON "baseout"."airtable_webhook_subscriptions" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "airtable_webhooks_last_ping_idx" ON "baseout"."airtable_webhooks" USING btree ("last_ping_at");--> statement-breakpoint
CREATE INDEX "airtable_webhooks_expiry_idx" ON "baseout"."airtable_webhooks" USING btree ("expires_at") WHERE "baseout"."airtable_webhooks"."status" = 'active';