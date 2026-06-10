ALTER TABLE "baseout"."attachment_dedup" ADD COLUMN "filename" text;--> statement-breakpoint
ALTER TABLE "baseout"."attachment_dedup" ADD COLUMN "upload_status" text DEFAULT 'uploaded' NOT NULL;--> statement-breakpoint
ALTER TABLE "baseout"."attachment_dedup" ADD COLUMN "uploaded_at" timestamp with time zone;
