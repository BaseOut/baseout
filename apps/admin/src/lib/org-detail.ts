// Org drill-in assembly (pure; testable without a DB).
//
// The umbrella `admin` spec's "per-Org drill-in": one support view per
// Organization — members, spaces (with their database + storage destinations),
// subscription, connections, recent runs, recent audit entries. This module
// holds the ordering/grouping logic; the page stays a thin query shell.

export interface MemberRow {
  userId: string
  name: string | null
  email: string | null
  role: string // 'owner' | 'admin' | 'member'
  acceptedAt: Date | null
}

const MEMBER_ROLE_RANK: Record<string, number> = { owner: 0, admin: 1, member: 2 }

/** Owner → admin → member, alphabetical by email within a role. */
export function orderMembers(members: MemberRow[]): MemberRow[] {
  return [...members].sort(
    (a, b) =>
      (MEMBER_ROLE_RANK[a.role] ?? 9) - (MEMBER_ROLE_RANK[b.role] ?? 9) ||
      (a.email ?? '').localeCompare(b.email ?? ''),
  )
}

/**
 * Human label for the org's overage posture (organizations.overage_mode +
 * monthly_overage_cap, cents).
 */
export function overageLabel(mode: string, capCents: number | null): string {
  if (mode === 'cap') return 'cap (no overages)'
  if (mode === 'auto') {
    return capCents === null
      ? 'auto · uncapped'
      : `auto · $${(capCents / 100).toFixed(2)}/mo cap`
  }
  return mode
}

export interface SpaceAssetRow {
  spaceId: string
}

export interface SpaceBasics {
  id: string
  name: string
  status: string
  platformName: string | null
}

export interface SpaceWithAssets<Db extends SpaceAssetRow, Dest extends SpaceAssetRow>
  extends SpaceBasics {
  database: Db | null
  destinations: Dest[]
}

/** Attach each space's database row and storage destinations by spaceId. */
export function spacesWithAssets<Db extends SpaceAssetRow, Dest extends SpaceAssetRow>(
  spaces: SpaceBasics[],
  databases: Db[],
  destinations: Dest[],
): SpaceWithAssets<Db, Dest>[] {
  const dbBySpace = new Map(databases.map((d) => [d.spaceId, d]))
  const destsBySpace = new Map<string, Dest[]>()
  for (const d of destinations) {
    const list = destsBySpace.get(d.spaceId) ?? []
    list.push(d)
    destsBySpace.set(d.spaceId, list)
  }
  return spaces.map((s) => ({
    ...s,
    database: dbBySpace.get(s.id) ?? null,
    destinations: destsBySpace.get(s.id) ?? [],
  }))
}
