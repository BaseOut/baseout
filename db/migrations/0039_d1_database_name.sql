-- server-d1-backend: dashboard-legible D1 name alongside the UUID locator.
ALTER TABLE "baseout"."space_databases" ADD COLUMN "d1_database_name" text;
