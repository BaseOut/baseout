/**
 * Stripe ⇄ entitlement-catalog sync — shared-entitlements task 1.4.
 *
 * Builds the Stripe products + prices the pricing model requires (4 public plan
 * products × monthly/annual, plus the add-on SKUs from guide §6) and reconciles
 * them idempotently, so the setup script is safe to re-run per environment.
 *
 * Idempotency without external state:
 *   - Products use a DETERMINISTIC id (`baseout_plan_<slug>` / `baseout_addon_<slug>`)
 *     — retrieve-or-create.
 *   - Prices use a Stripe LOOKUP KEY (unique per account) — list-by-lookup-key or create.
 *
 * `buildStripeCatalogSpec()` is pure (derives the desired shape from the seeded
 * catalog) so amounts/metadata are unit-tested without touching Stripe. The
 * reconciler drives a minimal Stripe surface, so a fake verifies idempotency.
 * The setup script persists the returned ids into plans / plan_prices /
 * addon_catalog. Stripe carries money + identity only (design D1); the catalog
 * remains the source of capability values.
 */

import { ADDONS, PLANS, FEATURES } from '../../db/seed/entitlements-catalog'

export const CURRENCY = 'usd'

export const planProductId = (slug: string) => `baseout_plan_${slug}`
export const addonProductId = (slug: string) => `baseout_addon_${slug}`
export const planPriceLookupKey = (slug: string, period: 'monthly' | 'annual') =>
  `baseout_plan_${slug}_${period}`
export const addonPriceLookupKey = (slug: string) => `baseout_addon_${slug}`

export interface PlanPriceSpec {
  billingPeriod: 'monthly' | 'annual'
  unitAmountCents: number
  lookupKey: string
}

export interface PlanProductSpec {
  planSlug: string
  productId: string
  name: string
  metadata: { plan_slug: string }
  prices: PlanPriceSpec[]
}

export interface AddonPriceSpec {
  addonSlug: string
  productId: string
  name: string
  metadata: { addon_slug: string; feature_slug: string }
  unitAmountCents: number
  recurring: boolean
  lookupKey: string
}

export interface StripeCatalogSpec {
  plans: PlanProductSpec[]
  addons: AddonPriceSpec[]
}

/** Pure: the products/prices Stripe must hold, derived from the seeded catalog. */
export function buildStripeCatalogSpec(): StripeCatalogSpec {
  const plans: PlanProductSpec[] = PLANS.filter((p) => p.kind === 'public').map((p) => {
    const prices: PlanPriceSpec[] = []
    if (p.monthlyCents !== null) {
      prices.push({ billingPeriod: 'monthly', unitAmountCents: p.monthlyCents, lookupKey: planPriceLookupKey(p.slug, 'monthly') })
    }
    if (p.annualCents !== null) {
      prices.push({ billingPeriod: 'annual', unitAmountCents: p.annualCents, lookupKey: planPriceLookupKey(p.slug, 'annual') })
    }
    return {
      planSlug: p.slug,
      productId: planProductId(p.slug),
      name: `Baseout — ${p.name}`,
      metadata: { plan_slug: p.slug },
      prices,
    }
  })

  const addons: AddonPriceSpec[] = ADDONS.map((a) => ({
    addonSlug: a.slug,
    productId: addonProductId(a.slug),
    name: `Baseout add-on — ${a.name}`,
    metadata: { addon_slug: a.slug, feature_slug: a.featureSlug },
    unitAmountCents: a.priceCents,
    recurring: a.kind === 'recurring',
    lookupKey: addonPriceLookupKey(a.slug),
  }))

  // Guardrail: every add-on must extend a real feature (mirrors the seed test,
  // caught here too since this is the Stripe-facing entry point).
  const featureSlugs = new Set(FEATURES.map((f) => f.slug))
  for (const a of addons) {
    if (!featureSlugs.has(a.metadata.feature_slug)) {
      throw new Error(`add-on ${a.addonSlug} references unknown feature ${a.metadata.feature_slug}`)
    }
  }

  return { plans, addons }
}

// ── Minimal Stripe surface used by the reconciler (real SDK + fake both satisfy) ──
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface StripeCatalogClient {
  products: {
    retrieve: (id: string) => Promise<{ id: string }>
    create: (params: any) => Promise<{ id: string }>
  }
  prices: {
    list: (params: any) => Promise<{ data: Array<{ id: string; lookup_key?: string | null }> }>
    create: (params: any) => Promise<{ id: string }>
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface ReconcileResult {
  planProductIds: Record<string, string> // planSlug → product id
  planPriceIds: Record<string, string> // `${planSlug}:${period}` → price id
  addonPriceIds: Record<string, string> // addonSlug → price id
  created: { products: number; prices: number }
}

/** Retrieve-or-create a product with a deterministic id. */
async function ensureProduct(
  stripe: StripeCatalogClient,
  id: string,
  name: string,
  metadata: Record<string, string>,
  createdCounter: { products: number },
): Promise<string> {
  try {
    const existing = await stripe.products.retrieve(id)
    return existing.id
  } catch {
    const created = await stripe.products.create({ id, name, metadata })
    createdCounter.products++
    return created.id
  }
}

/** List-by-lookup-key or create a price. */
async function ensurePrice(
  stripe: StripeCatalogClient,
  params: {
    product: string
    unitAmountCents: number
    lookupKey: string
    recurringInterval: 'month' | 'year' | null
    metadata: Record<string, string>
  },
  createdCounter: { prices: number },
): Promise<string> {
  const existing = await stripe.prices.list({ lookup_keys: [params.lookupKey], limit: 1 })
  if (existing.data.length > 0) return existing.data[0].id
  const created = await stripe.prices.create({
    product: params.product,
    unit_amount: params.unitAmountCents,
    currency: CURRENCY,
    ...(params.recurringInterval ? { recurring: { interval: params.recurringInterval } } : {}),
    lookup_key: params.lookupKey,
    transfer_lookup_key: true,
    metadata: params.metadata,
  })
  createdCounter.prices++
  return created.id
}

/** Idempotently ensure every plan/add-on product + price exists; returns the id maps. */
export async function reconcileStripeCatalog(
  stripe: StripeCatalogClient,
  spec: StripeCatalogSpec = buildStripeCatalogSpec(),
): Promise<ReconcileResult> {
  const created = { products: 0, prices: 0 }
  const planProductIds: Record<string, string> = {}
  const planPriceIds: Record<string, string> = {}
  const addonPriceIds: Record<string, string> = {}

  for (const plan of spec.plans) {
    const productId = await ensureProduct(stripe, plan.productId, plan.name, plan.metadata, created)
    planProductIds[plan.planSlug] = productId
    for (const price of plan.prices) {
      const priceId = await ensurePrice(
        stripe,
        {
          product: productId,
          unitAmountCents: price.unitAmountCents,
          lookupKey: price.lookupKey,
          // Map billing period → Stripe recurring interval (annual = yearly).
          recurringInterval: price.billingPeriod === 'annual' ? 'year' : 'month',
          metadata: { plan_slug: plan.planSlug, billing_period: price.billingPeriod },
        },
        created,
      )
      planPriceIds[`${plan.planSlug}:${price.billingPeriod}`] = priceId
    }
  }

  for (const addon of spec.addons) {
    const productId = await ensureProduct(stripe, addon.productId, addon.name, addon.metadata, created)
    const priceId = await ensurePrice(
      stripe,
      {
        product: productId,
        unitAmountCents: addon.unitAmountCents,
        lookupKey: addon.lookupKey,
        recurringInterval: addon.recurring ? 'month' : null,
        metadata: addon.metadata,
      },
      created,
    )
    addonPriceIds[addon.addonSlug] = priceId
  }

  return { planProductIds, planPriceIds, addonPriceIds, created }
}
