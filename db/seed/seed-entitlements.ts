/**
 * Seed the entitlement catalog (plans, features, plan_features matrix, add-ons)
 * from the locked pricing guide. Idempotent — safe to re-run; inserts-if-absent
 * by slug so it never clobbers admin-entitlements edits.
 *
 * Requires the 0034_entitlements_catalog migration applied (pnpm db:migrate).
 *
 * Usage:  pnpm db:seed:entitlements   (from the repo root)
 */

import { db, sql } from '../../apps/web/src/db/node'
import { seedEntitlements } from '../../apps/web/src/db/seed/seed-entitlements'
import { PRICING_GUIDE_VERSION } from '../../apps/web/src/db/seed/entitlements-catalog'

async function main() {
  console.log(`Seeding entitlement catalog (pricing guide ${PRICING_GUIDE_VERSION})...`)
  await seedEntitlements(db)
  console.log('  Entitlement catalog seeded (idempotent — re-run safe).')
  await sql.end()
}

main().catch(async (err) => {
  console.error('Entitlement seed failed:', err)
  await sql.end()
  process.exit(1)
})
