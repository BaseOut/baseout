// Subscriptions dashboard assembly (pure; testable without a DB).
//
// PRD §16.1: "Subscriptions view" — every Organization with its Stripe
// subscription status, per-platform tier, billing period, and trial state.

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
): { rows: OrgSubscriptionView[]; summary: SubscriptionSummary } {
  const subByOrg = new Map(subs.map((s) => [s.organizationId, s]))
  const itemsByOrg = new Map<string, SubItemRow[]>()
  for (const i of items) {
    const list = itemsByOrg.get(i.organizationId) ?? []
    list.push(i)
    itemsByOrg.set(i.organizationId, list)
  }

  const rows = orgs
    .map((o) => {
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
    .sort((a, b) => a.name.localeCompare(b.name))

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

export const SUB_STATUS_BADGE: Record<string, string> = {
  active: 'badge-success',
  trialing: 'badge-info',
  past_due: 'badge-error',
  cancelled: 'badge-neutral',
  incomplete: 'badge-warning',
  incomplete_expired: 'badge-warning',
}

export const TRIAL_STATE_BADGE: Record<TrialState, string> = {
  trialing: 'badge-info',
  trial_expired: 'badge-warning',
  converted: 'badge-success',
  never_trialed: 'badge-ghost',
}
