import { count, eq } from "drizzle-orm";
import type { createMasterDb } from "../db/worker";
import { organizations } from "../db/schema";
import { productionLockoutEvent, resolveRuntimeEnv } from "./runtime-env";

type MasterDb = ReturnType<typeof createMasterDb>["db"];

export async function maybeLogProductionLockout(
  db: MasterDb,
  env: { BASEOUT_ENV?: string; BASEOUT_DEV?: string },
): Promise<void> {
  const resolvedEnv = resolveRuntimeEnv({
    BASEOUT_ENV: env.BASEOUT_ENV,
    BASEOUT_DEV: env.BASEOUT_DEV,
  });
  if (resolvedEnv !== "production") return;
  const [total] = await db.select({ n: count() }).from(organizations);
  const [prod] = await db
    .select({ n: count() })
    .from(organizations)
    .where(eq(organizations.runtimeEnv, "production"));
  const event = productionLockoutEvent({
    resolvedEnv,
    organizationCount: Number(total?.n ?? 0),
    productionTaggedCount: Number(prod?.n ?? 0),
  });
  if (!event) return;
  // eslint-disable-next-line no-console -- design D7: loud structured tripwire; must not be a silent filter
  console.error(JSON.stringify(event));
}
