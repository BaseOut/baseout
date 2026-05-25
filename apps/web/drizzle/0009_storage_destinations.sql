CREATE TABLE "baseout"."storage_destinations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" text NOT NULL,
	"type" text NOT NULL,
	"oauth_access_token_enc" text,
	"oauth_refresh_token_enc" text,
	"oauth_expires_at" timestamp with time zone,
	"oauth_scope" text,
	"oauth_account_email" text,
	"provider_folder_id" text,
	"provider_account_id" text,
	"connected_by_user_id" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_validated_at" timestamp with time zone,
	CONSTRAINT "storage_destinations_space_id_unique" UNIQUE("space_id"),
	CONSTRAINT "storage_destinations_type_check" CHECK ("baseout"."storage_destinations"."type" IN ('local_fs', 'google_drive'))
);
--> statement-breakpoint
ALTER TABLE "baseout"."storage_destinations" ADD CONSTRAINT "storage_destinations_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."storage_destinations" ADD CONSTRAINT "storage_destinations_connected_by_user_id_users_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "baseout"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "storage_destinations_type_idx" ON "baseout"."storage_destinations" USING btree ("type");