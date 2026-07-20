// Pure assembly for the /customers directory (admin-entity-directories D1).
// Joins flat query-result arrays in memory (house style — testable without a
// DB); reuses estimateMrr from subscriptions.ts. Search + limit are applied in
// SQL on the page; the derived subscription-status filter is applied here since
// status isn't a column on organizations.

import { estimateMrr, type MrrEstimate, type MrrItem } from './subscriptions'

export interface CustomerOrgInput {
  id: string
  name: string
  slug: string
  hasMigrated: boolean
  createdAt: Date
}
export interface OrgCount {
  organizationId: string
  count: number
}
export interface CustomerSubItem extends MrrItem {
  organizationId: string
}
export interface OrgLatestRun {
  organizationId: string
  lastRunAt: Date
}

export interface CustomerRow {
  id: string
  name: string
  slug: string
  hasMigrated: boolean
  createdAt: Date
  spaceCount: number
  memberCount: number
  tiers: string[]
  subscriptionStatus: string // 'active' | 'trialing' | … | 'none'
  mrr: MrrEstimate
  lastActivityAt: Date | null
}

function countMap(rows: OrgCount[]): Map<string, number> {
  return new Map(rows.map((r) => [r.organizationId, r.count]))
}

export function buildCustomersDirectory(
  input: {
    orgs: CustomerOrgInput[]
    spaceCounts: OrgCount[]
    memberCounts: OrgCount[]
    subItems: CustomerSubItem[]
    latestRuns: OrgLatestRun[]
  },
  opts: { status?: string | null } = {},
): CustomerRow[] {
  const spaces = countMap(input.spaceCounts)
  const members = countMap(input.memberCounts)
  const runs = new Map(input.latestRuns.map((r) => [r.organizationId, r.lastRunAt]))
  const itemsByOrg = new Map<string, CustomerSubItem[]>()
  for (const it of input.subItems) {
    const list = itemsByOrg.get(it.organizationId) ?? []
    list.push(it)
    itemsByOrg.set(it.organizationId, list)
  }

  const rows = input.orgs.map((o): CustomerRow => {
    const items = itemsByOrg.get(o.id) ?? []
    // Distinct tiers on active items; subscription status from any active item, else the first item's, else 'none'.
    const active = items.filter((i) => i.subscriptionStatus === 'active' && i.cancelledAt === null)
    const tiers = [...new Set((active.length ? active : items).map((i) => i.tier))].sort()
    const subscriptionStatus = items.find((i) => i.subscriptionStatus)?.subscriptionStatus ?? 'none'
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      hasMigrated: o.hasMigrated,
      createdAt: o.createdAt,
      spaceCount: spaces.get(o.id) ?? 0,
      memberCount: members.get(o.id) ?? 0,
      tiers,
      subscriptionStatus,
      mrr: estimateMrr(items),
      lastActivityAt: runs.get(o.id) ?? null,
    }
  })

  const filtered = opts.status ? rows.filter((r) => r.subscriptionStatus === opts.status) : rows
  return filtered.sort((a, b) => a.name.localeCompare(b.name))
}
