/**
 * Idempotent, env-scoped Stripe setup for the entitlement catalog
 * (shared-entitlements task 1.4).
 *
 * Ensures the 4 public plan products (× monthly/annual prices) and the add-on
 * SKUs exist in the Stripe account behind STRIPE_SECRET_KEY, then persists the
 * resulting product/price ids back into plans / plan_prices / addon_catalog.
 * Safe to re-run per environment (deterministic product ids + price lookup keys).
 *
 * Order:  pnpm db:migrate  →  pnpm db:seed:entitlements  →  this script.
 * Usage:  STRIPE_SECRET_KEY=sk_test_… pnpm --filter @baseout/web setup:stripe:entitlements
 */

import { and, eq } from 'drizzle-orm'
import { db, sql } from '../src/db/node'
import { addonCatalog, planPrices, plans } from '../src/db/schema'
import { createStripeClient } from '../src/lib/stripe'
import {
  reconcileStripeCatalog,
  type StripeCatalogClient,
} from '../src/lib/stripe/entitlement-catalog-sync'

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not set')

  const stripe = createStripeClient(secretKey)
  // Adapt the SDK to the reconciler's minimal surface (explicit = typechecked).
  const client: StripeCatalogClient = {
    products: {
      retrieve: (id) => stripe.products.retrieve(id),
      create: (params) => stripe.products.create(params),
    },
    prices: {
      list: (params) => stripe.prices.list(params),
      create: (params) => stripe.prices.create(params),
    },
  }

  console.log('Reconciling Stripe catalog (idempotent)...')
  const result = await reconcileStripeCatalog(client)
  console.log(`  Stripe: +${result.created.products} products, +${result.created.prices} prices (0/0 on a re-run).`)

  // Persist ids into the catalog (plans / plan_prices / addon_catalog by slug).
  for (const [slug, productId] of Object.entries(result.planProductIds)) {
    await db.update(plans).set({ stripeProductId: productId }).where(eq(plans.slug, slug))
  }
  for (const [key, priceId] of Object.entries(result.planPriceIds)) {
    const [slug, period] = key.split(':')
    const [plan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.slug, slug)).limit(1)
    if (!plan) continue
    await db
      .update(planPrices)
      .set({ stripePriceId: priceId })
      .where(and(eq(planPrices.planId, plan.id), eq(planPrices.billingPeriod, period)))
  }
  for (const [slug, priceId] of Object.entries(result.addonPriceIds)) {
    await db.update(addonCatalog).set({ stripePriceId: priceId }).where(eq(addonCatalog.slug, slug))
  }

  console.log('  Catalog updated with Stripe product/price ids.')
  await sql.end()
}

main().catch(async (err) => {
  console.error('Stripe entitlement setup failed:', err)
  await sql.end()
  process.exit(1)
})
