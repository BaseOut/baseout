import { describe, expect, it } from 'vitest'
import {
  buildStripeCatalogSpec,
  planPriceLookupKey,
  planProductId,
  reconcileStripeCatalog,
  type StripeCatalogClient,
} from './entitlement-catalog-sync'
import { ADDONS } from '../../db/seed/entitlements-catalog'

describe('buildStripeCatalogSpec', () => {
  const spec = buildStripeCatalogSpec()

  it('produces one product for each of the 4 public plans, monthly + annual', () => {
    expect(spec.plans.map((p) => p.planSlug).sort()).toEqual(['core', 'lite', 'max', 'plus'])
    for (const p of spec.plans) {
      expect(p.prices.map((pr) => pr.billingPeriod).sort()).toEqual(['annual', 'monthly'])
      expect(p.metadata).toEqual({ plan_slug: p.planSlug })
      expect(p.productId).toBe(planProductId(p.planSlug))
    }
  })

  it('carries the guide amounts and lookup keys', () => {
    const lite = spec.plans.find((p) => p.planSlug === 'lite')!
    expect(lite.prices.find((pr) => pr.billingPeriod === 'monthly')).toMatchObject({
      unitAmountCents: 4900,
      lookupKey: planPriceLookupKey('lite', 'monthly'),
    })
    expect(lite.prices.find((pr) => pr.billingPeriod === 'annual')?.unitAmountCents).toBe(49900)
    expect(spec.plans.find((p) => p.planSlug === 'max')!.prices.find((pr) => pr.billingPeriod === 'monthly')?.unitAmountCents).toBe(39900)
  })

  it('produces an add-on SKU per catalog add-on with feature metadata', () => {
    expect(spec.addons).toHaveLength(ADDONS.length)
    const records = spec.addons.find((a) => a.addonSlug === 'records_100k')!
    expect(records).toMatchObject({ unitAmountCents: 1000, recurring: true })
    expect(records.metadata).toEqual({ addon_slug: 'records_100k', feature_slug: 'records_under_management' })
    const pack = spec.addons.find((a) => a.addonSlug === 'ai_credits_1000_pack')!
    expect(pack).toMatchObject({ unitAmountCents: 1200, recurring: false })
  })
})

describe('reconcileStripeCatalog is idempotent', () => {
  function makeFakeStripe() {
    const products = new Map<string, { id: string }>()
    const prices: Array<{ id: string; lookup_key?: string | null; product: string; recurring?: unknown }> = []
    let priceSeq = 0
    const stripe: StripeCatalogClient = {
      products: {
        retrieve: (id) => {
          const p = products.get(id)
          if (!p) return Promise.reject(new Error('No such product'))
          return Promise.resolve(p)
        },
        create: (params) => {
          products.set(params.id, { id: params.id })
          return Promise.resolve({ id: params.id })
        },
      },
      prices: {
        list: (params) => {
          const keys: string[] = params.lookup_keys ?? []
          return Promise.resolve({ data: prices.filter((pr) => pr.lookup_key && keys.includes(pr.lookup_key)) })
        },
        create: (params) => {
          const id = `price_${++priceSeq}`
          prices.push({ id, lookup_key: params.lookup_key, product: params.product, recurring: params.recurring })
          return Promise.resolve({ id })
        },
      },
    }
    return { stripe, products, prices }
  }

  it('creates everything on the first run and nothing on the second', async () => {
    const { stripe, products, prices } = makeFakeStripe()

    const first = await reconcileStripeCatalog(stripe)
    // 4 plan products + 15 add-on products = 19; 8 plan prices + 15 add-on prices = 23.
    expect(first.created).toEqual({ products: 19, prices: 23 })
    expect(products.size).toBe(19)
    expect(prices).toHaveLength(23)
    expect(first.planPriceIds['lite:monthly']).toBeDefined()
    expect(first.planPriceIds['max:annual']).toBeDefined()
    expect(Object.keys(first.addonPriceIds)).toHaveLength(ADDONS.length)

    const second = await reconcileStripeCatalog(stripe)
    expect(second.created).toEqual({ products: 0, prices: 0 })
    // Same ids resolved the second time.
    expect(second.planProductIds).toEqual(first.planProductIds)
    expect(second.planPriceIds).toEqual(first.planPriceIds)
    expect(second.addonPriceIds).toEqual(first.addonPriceIds)
    // No duplicates accumulated.
    expect(products.size).toBe(19)
    expect(prices).toHaveLength(23)
  })

  it('sets the correct recurring interval per billing period', async () => {
    const { stripe, prices } = makeFakeStripe()
    await reconcileStripeCatalog(stripe)
    const liteMonthly = prices.find((p) => p.lookup_key === planPriceLookupKey('lite', 'monthly'))
    const liteAnnual = prices.find((p) => p.lookup_key === planPriceLookupKey('lite', 'annual'))
    expect(liteMonthly?.recurring).toEqual({ interval: 'month' })
    expect(liteAnnual?.recurring).toEqual({ interval: 'year' })
  })
})
