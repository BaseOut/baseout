import { count, eq } from 'drizzle-orm'
import type { AppDb } from '../db'
import { organizations } from '../db/schema'
import { productionLockoutEvent, type OrgRuntimeEnv } from './runtime-env'

let tripwireLogged = false

export async function maybeLogProductionLockout(
  db: AppDb,
  resolvedEnv: OrgRuntimeEnv | null,
): Promise<void> {
  if (resolvedEnv !== 'production' || tripwireLogged) return
  const [total] = await db.select({ n: count() }).from(organizations)
  const [prod] = await db
    .select({ n: count() })
    .from(organizations)
    .where(eq(organizations.runtimeEnv, 'production'))
  const event = productionLockoutEvent({
    resolvedEnv,
    organizationCount: Number(total?.n ?? 0),
    productionTaggedCount: Number(prod?.n ?? 0),
  })
  if (!event) return
  tripwireLogged = true
  // eslint-disable-next-line no-console -- design D7: loud structured tripwire; must not be a silent filter
  console.error(JSON.stringify(event))
}
