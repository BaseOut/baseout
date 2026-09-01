CREATE TABLE "baseout"."attachment_dedup" (
	"composite_id" text PRIMARY KEY NOT NULL,
	"space_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_hash" text,
	"size_bytes" bigint,
	"mime_type" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "baseout"."attachment_dedup" ADD CONSTRAINT "attachment_dedup_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachment_dedup_space_composite_idx" ON "baseout"."attachment_dedup" USING btree ("space_id","composite_id");