ALTER TABLE "baseout"."backup_configurations" ALTER COLUMN "storage_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "baseout"."backup_configurations" ALTER COLUMN "storage_type" DROP NOT NULL;