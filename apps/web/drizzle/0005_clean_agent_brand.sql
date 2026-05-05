CREATE TABLE "baseout"."backup_configuration_bases" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"backup_configuration_id" text NOT NULL,
	"at_base_id" text NOT NULL,
	"is_included" boolean DEFAULT true NOT NULL,
	"is_auto_discovered" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "backup_configuration_bases_config_base_unique" UNIQUE("backup_configuration_id","at_base_id")
);
--> statement-breakpoint
CREATE TABLE "baseout"."backup_configurations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" text NOT NULL,
	"frequency" text DEFAULT 'monthly' NOT NULL,
	"mode" text DEFAULT 'static' NOT NULL,
	"storage_type" text DEFAULT 'r2_managed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "backup_configurations_space_unique" UNIQUE("space_id")
);
--> statement-breakpoint
ALTER TABLE "baseout"."backup_configuration_bases" ADD CONSTRAINT "backup_configuration_bases_backup_configuration_id_backup_configurations_id_fk" FOREIGN KEY ("backup_configuration_id") REFERENCES "baseout"."backup_configurations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."backup_configuration_bases" ADD CONSTRAINT "backup_configuration_bases_at_base_id_at_bases_id_fk" FOREIGN KEY ("at_base_id") REFERENCES "baseout"."at_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseout"."backup_configurations" ADD CONSTRAINT "backup_configurations_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "backup_configuration_bases_config_id_idx" ON "baseout"."backup_configuration_bases" USING btree ("backup_configuration_id");