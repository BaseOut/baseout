import { describe, expect, it, vi } from 'vitest'
import {
  syncOneTimeAddons,
  syncSubscriptionEntitlements,
  type AddonRef,
  type OneTimeAddonDeps,
  type SubscriptionSyncDeps,
} from './webhook-sync'

// A price map that classifies each fabricated price id.
function priceWorld(map: Record<string, { plan?: string; addon?: AddonRef }>) {
  return {
    lookupPlanIdByPriceId: vi.fn(async (p: string) => map[p]?.plan ?? null),
    lookupAddonByPriceId: vi.fn(async (p: string) => map[p]?.addon ?? null),
  }
}

describe('syncSubscriptionEntitlements', () => {
  function makeDeps(map: Parameters<typeof priceWorld>[0]) {
    const w = priceWorld(map)
    const deps: SubscriptionSyncDeps = {
      ...w,
      setSubscriptionItemPlan: vi.fn(async () => {}),
      upsertRecurringAddon: vi.fn(async () => {}),
      deactivateRecurringAddonsNotIn: vi.fn(async () => {}),
    }
    return deps
  }

  it('maintains plan_id for a plan-price subscription item', async () => {
    const deps = makeDeps({ price_core_monthly: { plan: 'plan_core' } })
    const summary = await syncSubscriptionEntitlements(deps, {
      items: [{ stripeItemId: 'si_1', priceId: 'price_core_monthly', quantity: 1 }],
    })
    expect(summary).toEqual({ planItems: 1, recurringAddonItems: 0, unknownItems: 0 })
    expect(deps.setSubscriptionItemPlan).toHaveBeenCalledWith({ stripeItemId: 'si_1', planId: 'plan_core' })
    expect(deps.deactivateRecurringAddonsNotIn).toHaveBeenCalledWith([])
  })

  it('upserts a recurring add-on and marks its item active', async () => {
    const deps = makeDeps({
      price_core_monthly: { plan: 'plan_core' },
      price_addon_spaces: { addon: { addonId: 'addon_spaces', kind: 'recurring' } },
    })
    const summary = await syncSubscriptionEntitlements(deps, {
      items: [
        { stripeItemId: 'si_plan', priceId: 'price_core_monthly', quantity: 1 },
        { stripeItemId: 'si_addon', priceId: 'price_addon_spaces', quantity: 3 },
      ],
    })
    expect(summary).toEqual({ planItems: 1, recurringAddonItems: 1, unknownItems: 0 })
    expect(deps.upsertRecurringAddon).toHaveBeenCalledWith({ stripeItemId: 'si_addon', addonId: 'addon_spaces', quantity: 3 })
    expect(deps.deactivateRecurringAddonsNotIn).toHaveBeenCalledWith(['si_addon'])
  })

  it('deactivates recurring add-ons no longer present (empty item list)', async () => {
    const deps = makeDeps({ price_core_monthly: { plan: 'plan_core' } })
    await syncSubscriptionEntitlements(deps, {
      items: [{ stripeItemId: 'si_plan', priceId: 'price_core_monthly', quantity: 1 }],
    })
    // The add-on that used to be here is not in the active set → deactivate-not-in([]).
    expect(deps.deactivateRecurringAddonsNotIn).toHaveBeenCalledWith([])
    expect(deps.upsertRecurringAddon).not.toHaveBeenCalled()
  })

  it('counts unrecognized prices without writing', async () => {
    const deps = makeDeps({})
    const summary = await syncSubscriptionEntitlements(deps, {
      items: [{ stripeItemId: 'si_x', priceId: 'price_mystery', quantity: 1 }],
    })
    expect(summary).toEqual({ planItems: 0, recurringAddonItems: 0, unknownItems: 1 })
    expect(deps.setSubscriptionItemPlan).not.toHaveBeenCalled()
    expect(deps.upsertRecurringAddon).not.toHaveBeenCalled()
  })

  it('ignores a one-time add-on that appears (wrongly) on a subscription item', async () => {
    const deps = makeDeps({ price_pack: { addon: { addonId: 'addon_credits', kind: 'one_time' } } })
    const summary = await syncSubscriptionEntitlements(deps, {
      items: [{ stripeItemId: 'si_pack', priceId: 'price_pack', quantity: 1 }],
    })
    expect(summary.recurringAddonItems).toBe(0)
    expect(summary.unknownItems).toBe(1)
    expect(deps.upsertRecurringAddon).not.toHaveBeenCalled()
  })
})

describe('syncOneTimeAddons', () => {
  it('records one-time packs with the provided expiry, skipping non-one-time lines', async () => {
    const expiresAt = new Date('2026-09-04T00:00:00Z')
    const deps: OneTimeAddonDeps = {
      lookupAddonByPriceId: vi.fn(async (p: string) =>
        p === 'price_credits_pack' ? ({ addonId: 'addon_credits_pack', kind: 'one_time' } as AddonRef)
        : p === 'price_core_monthly' ? ({ addonId: 'x', kind: 'recurring' } as AddonRef)
        : null,
      ),
      insertOneTimeAddon: vi.fn(async () => {}),
    }
    const count = await syncOneTimeAddons(deps, {
      expiresAt,
      lines: [
        { priceId: 'price_credits_pack', quantity: 2, stripeInvoiceItemId: 'ii_1' },
        { priceId: 'price_core_monthly', quantity: 1, stripeInvoiceItemId: 'ii_2' }, // recurring → skip
        { priceId: 'price_unknown', quantity: 1, stripeInvoiceItemId: 'ii_3' }, // unknown → skip
      ],
    })
    expect(count).toBe(1)
    expect(deps.insertOneTimeAddon).toHaveBeenCalledTimes(1)
    expect(deps.insertOneTimeAddon).toHaveBeenCalledWith({
      addonId: 'addon_credits_pack', quantity: 2, expiresAt, stripeInvoiceItemId: 'ii_1',
    })
  })
})
