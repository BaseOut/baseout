// Organizations → Spaces tracker assembly (pure; testable without a DB).
//
// PRD §5.4 (Database Admin Area) / §16.1: "identify which databases belong to
// which Organizations." In the V1 tier model each Space corresponds to one
// provisioned database, so the tracker lists every Org with its Spaces + tier.

export interface OrgRow {
  id: string
  name: string
  slug: string
  hasMigrated: boolean
}

export interface SpaceRow {
  id: string
  organizationId: string
  name: string
  status: string
  platformName: string | null
}

export interface TierRow {
  organizationId: string
  tier: string
}

export interface OrgWithSpaces extends OrgRow {
  tiers: string[]
  spaces: SpaceRow[]
}

// Groups flat query rows into one entry per Organization, sorted by name.
// Orgs with no Spaces and no subscription items still appear (empty arrays).
export function buildTracker(
  orgs: OrgRow[],
  spaces: SpaceRow[],
  tiers: TierRow[],
): OrgWithSpaces[] {
  const spacesByOrg = new Map<string, SpaceRow[]>()
  for (const s of spaces) {
    const list = spacesByOrg.get(s.organizationId) ?? []
    list.push(s)
    spacesByOrg.set(s.organizationId, list)
  }

  const tiersByOrg = new Map<string, string[]>()
  for (const t of tiers) {
    const list = tiersByOrg.get(t.organizationId) ?? []
    if (!list.includes(t.tier)) list.push(t.tier)
    tiersByOrg.set(t.organizationId, list)
  }

  return orgs
    .map((o) => ({
      ...o,
      tiers: tiersByOrg.get(o.id) ?? [],
      spaces: spacesByOrg.get(o.id) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
