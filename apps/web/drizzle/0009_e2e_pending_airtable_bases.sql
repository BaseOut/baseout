CREATE TABLE "baseout"."e2e_pending_airtable_bases" (
	"space_id" text NOT NULL,
	"at_base_id" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "e2e_pending_airtable_bases_pk" UNIQUE("space_id","at_base_id")
);
--> statement-breakpoint
ALTER TABLE "baseout"."e2e_pending_airtable_bases" ADD CONSTRAINT "e2e_pending_airtable_bases_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "baseout"."spaces"("id") ON DELETE cascade ON UPDATE no action;