ALTER TABLE "baseout"."connections" ADD COLUMN "oauth_refresh_claim_id" text;--> statement-breakpoint
ALTER TABLE "baseout"."connections" ADD COLUMN "oauth_refresh_claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "baseout"."connections" ADD COLUMN "oauth_refresh_last_error" text;--> statement-breakpoint
CREATE INDEX "connections_oauth_refresh_claim_idx"
	ON "baseout"."connections" USING btree ("oauth_refresh_claim_id");
