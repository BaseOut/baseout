CREATE TABLE "baseout"."oauth_states" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL,
	"space_id" text NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_states_state_unique" UNIQUE("state"),
	CONSTRAINT "oauth_states_provider_check" CHECK ("baseout"."oauth_states"."provider" IN ('google_drive','dropbox'))
);
--> statement-breakpoint
ALTER TABLE "baseout"."oauth_states" ADD CONSTRAINT "oauth_states_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."oauth_states" ADD CONSTRAINT "oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "baseout"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_states_created_at_idx" ON "baseout"."oauth_states" USING btree ("created_at");