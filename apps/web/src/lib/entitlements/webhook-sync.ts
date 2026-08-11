/**
 * Stripe webhook → entitlement sync (shared-entitlements task 2.2).
 *
 * The pure, dependency-injected sync logic a Stripe webhook receiver dispatches
 * to. Kept apart from the HTTP/signature/idempotency layer so the business rules
 * — which subscription items are plans vs add-ons, how add-on lifecycle maps —
 * are unit-tested with fabricated events, no network. A price id identifies its
 * kind by lookup: `plan_prices` → a plan item (maintain subscription_items.plan_id,
 * design D1); `addon_catalog` → an add-on (maintain addon_purchases, D8).
 *
 * Recurring add-ons ride subscription items (this module); one-time packs ride
 * invoice line items (syncOneTimeAddons). Idempotency is the receiver's job
 * (keyed on the Stripe event id) — these handlers are naturally re-runnable
 * (upserts + deactivate-not-in), so a duplicated delivery is harmless.
 */

// ── Subscription items → plan_id + recurring add-ons ─────────────────────────

export interface StripeSubItem {
  stripeItemId: string
  priceId: string
  quantity: number
}

export interface SubscriptionSyncEvent {
  items: StripeSubItem[]
}

export interface AddonRef {
  addonId: string
  kind: 'recurring' | 'one_time'
}

export interface SubscriptionSyncDeps {
  lookupPlanIdByPriceId: (priceId: string) => Promise<string | null>
  lookupAddonByPriceId: (priceId: string) => Promise<AddonRef | null>
  setSubscriptionItemPlan: (a: { stripeItemId: string; planId: string }) => Promise<void>
  upsertRecurringAddon: (a: { stripeItemId: string; addonId: string; quantity: number }) => Promise<void>
  /** Cancel recurring add-ons whose subscription item is no longer present. */
  deactivateRecurringAddonsNotIn: (activeStripeItemIds: string[]) => Promise<void>
}

export interface SubscriptionSyncSummary {
  planItems: number
  recurringAddonItems: number
  unknownItems: number
}

export async function syncSubscriptionEntitlements(
  deps: SubscriptionSyncDeps,
  event: SubscriptionSyncEvent,
): Promise<SubscriptionSyncSummary> {
  const activeAddonItemIds: string[] = []
  const summary: SubscriptionSyncSummary = { planItems: 0, recurringAddonItems: 0, unknownItems: 0 }

  for (const item of event.items) {
    const planId = await deps.lookupPlanIdByPriceId(item.priceId)
    if (planId) {
      await deps.setSubscriptionItemPlan({ stripeItemId: item.stripeItemId, planId })
      summary.planItems++
      continue
    }

    const addon = await deps.lookupAddonByPriceId(item.priceId)
    if (addon && addon.kind === 'recurring') {
      await deps.upsertRecurringAddon({
        stripeItemId: item.stripeItemId,
        addonId: addon.addonId,
        quantity: item.quantity,
      })
      activeAddonItemIds.push(item.stripeItemId)
      summary.recurringAddonItems++
      continue
    }

    // A one-time add-on price on a subscription item would be a mistake, and an
    // unrecognized price is nothing we entitle — count it so the receiver can log.
    summary.unknownItems++
  }

  // Reconcile removals: any recurring add-on no longer on the subscription is cancelled.
  await deps.deactivateRecurringAddonsNotIn(activeAddonItemIds)
  return summary
}

// ── Invoice line items → one-time add-on packs ───────────────────────────────

export interface InvoiceLine {
  priceId: string
  quantity: number
  stripeInvoiceItemId: string
}

export interface OneTimeAddonEvent {
  lines: InvoiceLine[]
  /**
   * When the pack lapses. Per design D6 this is the current monthly-anniversary
   * boundary (this cycle only), which the receiver computes from the org's
   * subscription anchor — passed in so this handler stays pure.
   */
  expiresAt: Date
}

export interface OneTimeAddonDeps {
  lookupAddonByPriceId: (priceId: string) => Promise<AddonRef | null>
  insertOneTimeAddon: (a: {
    addonId: string
    quantity: number
    expiresAt: Date
    stripeInvoiceItemId: string
  }) => Promise<void>
}

/** Record one-time add-on packs from a paid invoice; returns how many landed. */
export async function syncOneTimeAddons(
  deps: OneTimeAddonDeps,
  event: OneTimeAddonEvent,
): Promise<number> {
  let count = 0
  for (const line of event.lines) {
    const addon = await deps.lookupAddonByPriceId(line.priceId)
    if (addon && addon.kind === 'one_time') {
      await deps.insertOneTimeAddon({
        addonId: addon.addonId,
        quantity: line.quantity,
        expiresAt: event.expiresAt,
        stripeInvoiceItemId: line.stripeInvoiceItemId,
      })
      count++
    }
  }
  return count
}
