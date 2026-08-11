// Subscriptions dashboard assembly (pure; testable without a DB).
//
// PRD §16.1: "Subscriptions view" — every Organization with its Stripe
// subscription status, per-platform tier, billing period, and trial state.

import type { BadgeVariant } from './ui'

export interface SubOrgRow {
  id: string
  name: string
  slug: string
  stripeCustomerId: string | null
}

export interface SubRow {
  organizationId: string
  stripeSubscriptionId: string
  status: string
}

export interface SubItemRow {
  organizationId: string
  platformName: string | null
  tier: string
  billingPeriod: string
  trialEndsAt: Date | null
  trialBackupRunUsed: boolean
  trialEverUsed: boolean
  currentPeriodEnd: Date | null
  cancelledAt: Date | null
}

export type TrialState = 'trialing' | 'trial_expired' | 'converted' | 'never_trialed'

export interface ItemView extends SubItemRow {
  trialState: TrialState
  trialDaysLeft: number | null
}

export interface OrgSubscriptionView extends SubOrgRow {
  subscriptionStatus: string | null
  stripeSubscriptionId: string | null
  items: ItemView[]
}

export interface SubscriptionSummary {
  organizations: number
  byStatus: Record<string, number>
  activeTrials: number
  pastDue: number
}

export function deriveTrialState(
  item: SubItemRow,
  subscriptionStatus: string | null,
  now: Date,
): { trialState: TrialState; trialDaysLeft: number | null } {
  if (subscriptionStatus === 'trialing' && item.trialEndsAt && item.trialEndsAt.getTime() > now.getTime()) {
    const daysLeft = Math.ceil((item.trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    return { trialState: 'trialing', trialDaysLeft: daysLeft }
  }
  if (subscriptionStatus === 'active' && item.trialEverUsed) {
    return { trialState: 'converted', trialDaysLeft: null }
  }
  if (item.trialEverUsed || (item.trialEndsAt && item.trialEndsAt.getTime() <= now.getTime())) {
    return { trialState: 'trial_expired', trialDaysLeft: null }
  }
  return { trialState: 'never_trialed', trialDaysLeft: null }
}

export function buildSubscriptionsView(
  orgs: SubOrgRow[],
  subs: SubRow[],
  items: SubItemRow[],
  now: Date,
  // admin-crm-ux: preserveOrder keeps the SQL page order under pagination
  // (design D3) instead of the in-memory name sort. The returned `summary` is
  // then page-local; use summarizeSubscriptionsGlobal for whole-truth stats.
  opts: { preserveOrder?: boolean } = {},
): { rows: OrgSubscriptionView[]; summary: SubscriptionSummary } {
  const subByOrg = new Map(subs.map((s) => [s.organizationId, s]))
  const itemsByOrg = new Map<string, SubItemRow[]>()
  for (const i of items) {
    const list = itemsByOrg.get(i.organizationId) ?? []
    list.push(i)
    itemsByOrg.set(i.organizationId, list)
  }

  const unsorted = orgs.map((o) => {
    const sub = subByOrg.get(o.id) ?? null
    return {
      ...o,
      subscriptionStatus: sub?.status ?? null,
      stripeSubscriptionId: sub?.stripeSubscriptionId ?? null,
      items: (itemsByOrg.get(o.id) ?? []).map((i) => ({
        ...i,
        ...deriveTrialState(i, sub?.status ?? null, now),
      })),
    }
  })
  const rows = opts.preserveOrder
    ? unsorted
    : unsorted.sort((a, b) => a.name.localeCompare(b.name))

  const byStatus: Record<string, number> = {}
  for (const r of rows) {
    const key = r.subscriptionStatus ?? 'none'
    byStatus[key] = (byStatus[key] ?? 0) + 1
  }

  return {
    rows,
    summary: {
      organizations: rows.length,
      byStatus,
      activeTrials: rows.filter((r) => r.items.some((i) => i.trialState === 'trialing')).length,
      pastDue: byStatus['past_due'] ?? 0,
    },
  }
}

/**
 * Whole-truth summary independent of the paginated page (admin-crm-ux D4). The
 * listing paginates orgs in SQL, so the summary tiles are fed from the (bounded)
 * full set of subscriptions + items plus a global organization count rather than
 * the current page. `byStatus['none']` = orgs with no subscription row.
 */
export function summarizeSubscriptionsGlobal(
  organizationCount: number,
  subs: SubRow[],
  items: SubItemRow[],
  now: Date,
): SubscriptionSummary {
  const byStatus: Record<string, number> = {}
  for (const s of subs) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1
  const noneCount = Math.max(0, organizationCount - subs.length)
  if (noneCount > 0) byStatus['none'] = noneCount

  const statusByOrg = new Map(subs.map((s) => [s.organizationId, s.status]))
  const itemsByOrg = new Map<string, SubItemRow[]>()
  for (const i of items) {
    const list = itemsByOrg.get(i.organizationId) ?? []
    list.push(i)
    itemsByOrg.set(i.organizationId, list)
  }
  let activeTrials = 0
  for (const [orgId, orgItems] of itemsByOrg) {
    const status = statusByOrg.get(orgId) ?? null
    if (orgItems.some((i) => deriveTrialState(i, status, now).trialState === 'trialing')) activeTrials++
  }

  return {
    organizations: organizationCount,
    byStatus,
    activeTrials,
    pastDue: byStatus['past_due'] ?? 0,
  }
}

// ————————————————————————————————————————————————————————————————————————
// Estimated MRR — Stripe price amounts are NOT synced to the DB (only tier +
// billing period), so MRR can only be computed from the canonical LIST prices
// in shared/Baseout_Features.md §3 "Pricing Tiers Overview". Cents per month;
// `annual` is the annual-equivalent monthly rate. Enterprise is custom-priced
// → null → counted as unpriceable. ALWAYS present this as "estimated".
// ————————————————————————————————————————————————————————————————————————
export const TIER_MONTHLY_CENTS: Record<string, { monthly: number; annual: number } | null> = {
  starter: { monthly: 2900, annual: 2900 }, // non-public tier — no annual rate published
  launch: { monthly: 4900, annual: 3900 },
  growth: { monthly: 9900, annual: 7900 },
  pro: { monthly: 19900, annual: 15900 },
  business: { monthly: 39900, annual: 31900 },
  enterprise: null, // custom — unpriceable
}

export interface MrrItem {
  tier: string
  billingPeriod: string
  subscriptionStatus: string | null
  cancelledAt: Date | null
}

export interface MrrEstimate {
  totalCents: number
  priced: number
  unpriceable: number // enterprise/unknown tiers on active subs
}

/**
 * Conservative list-price MRR: counts only items whose parent subscription is
 * 'active' (not trialing/past_due/cancelled) and that aren't item-cancelled.
 */
export function estimateMrr(items: MrrItem[]): MrrEstimate {
  let totalCents = 0
  let priced = 0
  let unpriceable = 0
  for (const item of items) {
    if (item.subscriptionStatus !== 'active' || item.cancelledAt !== null) continue
    const price = TIER_MONTHLY_CENTS[item.tier]
    if (!price) {
      unpriceable++
      continue
    }
    totalCents += item.billingPeriod === 'annual' ? price.annual : price.monthly
    priced++
  }
  return { totalCents, priced, unpriceable }
}

export interface OverageRow {
  orgName: string | null
  metric: string
  periodStart: Date
  periodEnd: Date
  includedQuota: number
  usageAmount: number
  overageAmount: number
  totalCostCents: number
  stripeInvoiceItemId: string | null
}

export interface OverageSummary {
  rows: OverageRow[] // newest period first
  totalCents: number
  unbilledCents: number // no stripe_invoice_item_id yet
}

export function summarizeOverages(rows: OverageRow[]): OverageSummary {
  const sorted = [...rows].sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime())
  let totalCents = 0
  let unbilledCents = 0
  for (const r of rows) {
    totalCents += r.totalCostCents
    if (!r.stripeInvoiceItemId) unbilledCents += r.totalCostCents
  }
  return { rows: sorted, totalCents, unbilledCents }
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// null/'' status = no filter; otherwise keep orgs whose subscription status
// matches ('none' selects orgs without a subscription). Summary stats stay
// computed over the unfiltered set — the tabs slice the table, not the truth.
export function filterByStatus(rows: OrgSubscriptionView[], status: string | null): OrgSubscriptionView[] {
  if (!status) return rows
  if (status === 'none') return rows.filter((r) => r.subscriptionStatus === null)
  return rows.filter((r) => r.subscriptionStatus === status)
}

// Stripe dashboard deep links. Production URLs per spec — test-mode objects
// live under dashboard.stripe.com/test/..., and the dashboard prompts a mode
// switch when a live URL names a test object; acceptable dev friction.
export function stripeCustomerUrl(id: string): string {
  return `https://dashboard.stripe.com/customers/${id}`
}
export function stripeSubscriptionUrl(id: string): string {
  return `https://dashboard.stripe.com/subscriptions/${id}`
}

// Shared @web Badge variants (not raw daisyUI classes) — see BadgeVariant.
export const SUB_STATUS_BADGE: Record<string, BadgeVariant> = {
  active: 'success',
  trialing: 'primary',
  past_due: 'error',
  cancelled: 'default',
  incomplete: 'warning',
  incomplete_expired: 'warning',
}

export const TRIAL_STATE_BADGE: Record<TrialState, BadgeVariant> = {
  trialing: 'primary',
  trial_expired: 'warning',
  converted: 'success',
  never_trialed: 'default',
}
