/**
 * Backfill subscription_items.plan_id from the legacy `tier` text
 * (shared-entitlements task 2.3). Idempotent — only touches rows where plan_id
 * is still null. Unknown tiers are skipped + reported (never mis-assigned).
 *
 * Requires the catalog seeded (plans exist). Run after db:seed:entitlements.
 * Usage:  pnpm --filter @baseout/web db:backfill:plan-id
 */

import { eq, isNull } from 'drizzle-orm'
import { db, sql } from '../src/db/node'
import { plans, subscriptionItems } from '../src/db/schema'
import { legacyTierToPlanSlug } from '../src/lib/entitlements/legacy-tier-map'

async function main() {
  const planRows = await db.select({ id: plans.id, slug: plans.slug }).from(plans)
  const planIdBySlug = new Map(planRows.map((r) => [r.slug, r.id]))
  if (planIdBySlug.size === 0) {
    throw new Error('No plans found — run db:seed:entitlements first.')
  }

  const items = await db
    .select({ id: subscriptionItems.id, tier: subscriptionItems.tier })
    .from(subscriptionItems)
    .where(isNull(subscriptionItems.planId))

  let updated = 0
  let skipped = 0
  for (const item of items) {
    const slug = legacyTierToPlanSlug(item.tier)
    const planId = slug ? planIdBySlug.get(slug) : undefined
    if (!planId) {
      skipped++
      console.warn(`  skip subscription_item ${item.id}: tier="${item.tier}" → no plan mapping`)
      continue
    }
    await db.update(subscriptionItems).set({ planId }).where(eq(subscriptionItems.id, item.id))
    updated++
  }

  console.log(`Backfill complete: ${updated} updated, ${skipped} skipped, ${items.length} candidates.`)
  await sql.end()
}

main().catch(async (err) => {
  console.error('Backfill failed:', err)
  await sql.end()
  process.exit(1)
})
