// On2Air migration status assembly (pure; testable without a DB).
//
// PRD §16.1: "On2Air migration status — completed vs pending user counts."
// organizations.has_migrated = false marks a pending On2Air migrant;
// dynamic_locked = true marks an On2Air-origin org (dynamic features shown as
// upgrade CTAs).

export interface MigrationOrgRow {
  id: string
  name: string
  slug: string
  hasMigrated: boolean
  dynamicLocked: boolean
  createdAt: Date
  subscriptionStatus: string | null
}

export interface MigrationView {
  total: number
  migrated: number
  pending: number
  pendingPct: number // 0–100, rounded
  dynamicLocked: number
  pendingOrgs: MigrationOrgRow[]
}

export function buildMigrationView(orgs: MigrationOrgRow[]): MigrationView {
  const pendingOrgs = orgs
    .filter((o) => !o.hasMigrated)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()) // oldest waiting first
  const pending = pendingOrgs.length
  return {
    total: orgs.length,
    migrated: orgs.length - pending,
    pending,
    pendingPct: orgs.length === 0 ? 0 : Math.round((pending / orgs.length) * 100),
    dynamicLocked: orgs.filter((o) => o.dynamicLocked).length,
    pendingOrgs,
  }
}
