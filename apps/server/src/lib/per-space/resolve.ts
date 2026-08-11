// Resolve a Space's per-Space DB control row (master DB) for the write path.

import { eq } from "drizzle-orm";
import { spaceDatabases } from "../../db/schema";
import type { AppDb } from "../../db/worker";

export interface ResolvedSpaceDb {
  backend: string; // 'd1' | 'managed_pg' | 'byodb'
  pgLocator: string | null;
  recordsEnabled: boolean;
  status: string; // 'pending' | 'provisioning' | 'active' | 'migrating' | 'error'
  /** Applied per-Space schema version; drives the lazy upgrade (system-per-space-upgrade). */
  schemaVersion: number | null;
}

export async function resolveSpaceDb(
  db: AppDb,
  spaceId: string,
): Promise<ResolvedSpaceDb | null> {
  const [row] = await db
    .select({
      backend: spaceDatabases.backend,
      pgLocator: spaceDatabases.pgLocator,
      recordsEnabled: spaceDatabases.recordsEnabled,
      status: spaceDatabases.status,
      schemaVersion: spaceDatabases.schemaVersion,
    })
    .from(spaceDatabases)
    .where(eq(spaceDatabases.spaceId, spaceId))
    .limit(1);
  return row ?? null;
}
