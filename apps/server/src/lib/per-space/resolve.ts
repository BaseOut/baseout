// Resolve a Space's per-Space DB control row (master DB) for the write path.

import { eq } from "drizzle-orm";
import { spaceDatabases } from "../../db/schema";
import type { AppDb } from "../../db/worker";

export interface ResolvedSpaceDb {
  backend: string; // 'd1' | 'managed_pg' | 'byodb'
  pgLocator: string | null;
  recordsEnabled: boolean;
  status: string; // 'pending' | 'provisioning' | 'active' | 'migrating' | 'error'
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
    })
    .from(spaceDatabases)
    .where(eq(spaceDatabases.spaceId, spaceId))
    .limit(1);
  return row ?? null;
}
