CREATE TABLE "baseout"."ai_provider_keys" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"key_enc" text NOT NULL,
	"key_fingerprint" text NOT NULL,
	"last_four" text NOT NULL,
	"label" text,
	"model_default" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by_user_id" text,
	"last_validated_at" timestamp with time zone,
	"validation_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_provider_keys_provider_check" CHECK ("baseout"."ai_provider_keys"."provider" in ('anthropic', 'openai', 'cloudflare')),
	CONSTRAINT "ai_provider_keys_status_check" CHECK ("baseout"."ai_provider_keys"."status" in ('active', 'invalid', 'disabled'))
);
--> statement-breakpoint
ALTER TABLE "baseout"."ai_provider_keys" ADD CONSTRAINT "ai_provider_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "baseout"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."ai_provider_keys" ADD CONSTRAINT "ai_provider_keys_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "baseout"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_provider_keys_org_provider_active_uq" ON "baseout"."ai_provider_keys" USING btree ("organization_id","provider") WHERE "baseout"."ai_provider_keys"."status" = 'active';--> statement-breakpoint
CREATE INDEX "ai_provider_keys_org_idx" ON "baseout"."ai_provider_keys" USING btree ("organization_id");