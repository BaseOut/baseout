// Ordered D1 provision statements: sqlite dialect DDL + bo_at_meta stamp
// (server-d1-backend task 1.2). Pure; no I/O.

import { SPACE_SCHEMA_VERSION } from "@baseout/db-schema/space";
import { spaceSqliteDdlStatements } from "@baseout/db-schema/space/sqlite-ddl";

export interface D1SqlStatement {
  sql: string;
  params?: unknown[];
}

export function spaceD1ProvisionStatements(input: {
  spaceId: string;
  schemaVersion?: number;
}): D1SqlStatement[] {
  const version = input.schemaVersion ?? SPACE_SCHEMA_VERSION;
  const ddl: D1SqlStatement[] = spaceSqliteDdlStatements().map((sql) => ({ sql }));
  ddl.push({
    sql: `INSERT INTO bo_at_meta (id, schema_version, space_id, backend, platform, provisioned_at)
VALUES ('singleton', ?, ?, 'd1', 'airtable', datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  schema_version = excluded.schema_version,
  space_id = excluded.space_id,
  backend = excluded.backend,
  last_migrated_at = datetime('now')`,
    params: [version, input.spaceId],
  });
  return ddl;
}
