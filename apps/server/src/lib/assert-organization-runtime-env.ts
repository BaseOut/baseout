import { and, eq } from "drizzle-orm";
import { connections, organizations, spaces } from "../db/schema";
import { resolveRuntimeEnv } from "./runtime-env";

type MasterDb = ReturnType<typeof import("../db/worker").createMasterDb>["db"];

type EnvVars = { BASEOUT_ENV?: string; BASEOUT_DEV?: string };

export async function organizationMatchesWorkerEnv(
  db: MasterDb,
  env: EnvVars,
  organizationId: string,
): Promise<boolean> {
  const runtimeEnv = resolveRuntimeEnv({
    BASEOUT_ENV: env.BASEOUT_ENV,
    BASEOUT_DEV: env.BASEOUT_DEV,
  });
  if (!runtimeEnv) return false;
  const rows = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(
      and(
        eq(organizations.id, organizationId),
        eq(organizations.runtimeEnv, runtimeEnv),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function connectionMatchesWorkerEnv(
  db: MasterDb,
  env: EnvVars,
  connectionId: string,
): Promise<boolean> {
  const runtimeEnv = resolveRuntimeEnv({
    BASEOUT_ENV: env.BASEOUT_ENV,
    BASEOUT_DEV: env.BASEOUT_DEV,
  });
  if (!runtimeEnv) return false;
  const rows = await db
    .select({ id: connections.id })
    .from(connections)
    .innerJoin(organizations, eq(organizations.id, connections.organizationId))
    .where(
      and(
        eq(connections.id, connectionId),
        eq(organizations.runtimeEnv, runtimeEnv),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function spaceMatchesWorkerEnv(
  db: MasterDb,
  env: EnvVars,
  spaceId: string,
): Promise<boolean> {
  const runtimeEnv = resolveRuntimeEnv({
    BASEOUT_ENV: env.BASEOUT_ENV,
    BASEOUT_DEV: env.BASEOUT_DEV,
  });
  if (!runtimeEnv) return false;
  const rows = await db
    .select({ id: spaces.id })
    .from(spaces)
    .innerJoin(organizations, eq(organizations.id, spaces.organizationId))
    .where(and(eq(spaces.id, spaceId), eq(organizations.runtimeEnv, runtimeEnv)))
    .limit(1);
  return rows.length > 0;
}
