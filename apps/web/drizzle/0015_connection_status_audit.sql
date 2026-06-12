CREATE TABLE "baseout"."connection_status_audit" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" text NOT NULL,
	"organization_id" text,
	"platform_id" text,
	"old_status" text,
	"new_status" text NOT NULL,
	"old_invalidated_at" timestamp with time zone,
	"new_invalidated_at" timestamp with time zone,
	"old_token_expires_at" timestamp with time zone,
	"new_token_expires_at" timestamp with time zone,
	"old_modified_at" timestamp with time zone,
	"new_modified_at" timestamp with time zone,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"db_user" text DEFAULT current_user NOT NULL,
	"application_name" text DEFAULT current_setting('application_name', true),
	"txid" bigint DEFAULT txid_current() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "baseout"."connection_status_audit"
	ADD CONSTRAINT "connection_status_audit_connection_id_connections_id_fk"
	FOREIGN KEY ("connection_id")
	REFERENCES "baseout"."connections"("id")
	ON DELETE cascade
	ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "connection_status_audit_connection_idx"
	ON "baseout"."connection_status_audit" USING btree ("connection_id","changed_at");
--> statement-breakpoint
CREATE INDEX "connection_status_audit_changed_idx"
	ON "baseout"."connection_status_audit" USING btree ("changed_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "baseout"."record_connection_status_change"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF (
		OLD.status IS DISTINCT FROM NEW.status
		OR OLD.invalidated_at IS DISTINCT FROM NEW.invalidated_at
		OR OLD.token_expires_at IS DISTINCT FROM NEW.token_expires_at
	) THEN
		INSERT INTO "baseout"."connection_status_audit" (
			connection_id,
			organization_id,
			platform_id,
			old_status,
			new_status,
			old_invalidated_at,
			new_invalidated_at,
			old_token_expires_at,
			new_token_expires_at,
			old_modified_at,
			new_modified_at
		)
		VALUES (
			NEW.id,
			NEW.organization_id,
			NEW.platform_id,
			OLD.status,
			NEW.status,
			OLD.invalidated_at,
			NEW.invalidated_at,
			OLD.token_expires_at,
			NEW.token_expires_at,
			OLD.modified_at,
			NEW.modified_at
		);
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "connections_status_audit_trigger" ON "baseout"."connections";
--> statement-breakpoint
CREATE TRIGGER "connections_status_audit_trigger"
AFTER UPDATE OF status, invalidated_at, token_expires_at ON "baseout"."connections"
FOR EACH ROW
EXECUTE FUNCTION "baseout"."record_connection_status_change"();
