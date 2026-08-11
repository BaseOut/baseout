// Pure view model for /spaces/[id] (admin-entity-linking D2). The page runs the
// Drizzle queries (keyed on one space id) and passes flat row arrays + now in;
// this shapes the typed view model with explicit empty states + a not-found
// signal. No DB, no UI — testable like org-detail.

export interface SpaceRow { id: string; name: string; status: string; spaceType: string | null; organizationId: string | null; organizationName: string | null; createdAt: Date }
export interface MemberRow { userId: string; email: string; name: string | null; role: string }
export interface ConnRow { id: string; displayName: string | null; status: string; scope: string }
export interface ConfigRow { frequency: string; scope: string; mode: string; storageType: string; autoAddFutureBases: boolean; nextScheduledAt: Date | null }
export interface RetentionRow { policyTier: string; keepLastN: number | null; dailyWindowDays: number | null; weeklyWindowDays: number | null; monthlyIndefinite: boolean }
export interface BaseRow { atBaseId: string; name: string; included: boolean; autoDiscovered: boolean }
export interface RunRow { id: string; status: string; kind: string; startedAt: Date | null; completedAt: Date | null; recordCount: number | null }
export interface DbRow { backend: string; status: string; schemaVersion: number | null }
export interface StorageRow { type: string; email: string | null; connectedAt: Date | null }

export interface SpaceDetailView {
  found: boolean
  space: SpaceRow | null
  members: MemberRow[]
  connections: ConnRow[]
  config: ConfigRow | null
  retention: RetentionRow | null
  bases: BaseRow[]
  runs: RunRow[]
  databases: DbRow[]
  storage: StorageRow[]
}

export interface SpaceDetailInput {
  space: SpaceRow | null
  members: MemberRow[]
  connections: ConnRow[]
  config: ConfigRow | null
  retention: RetentionRow | null
  bases: BaseRow[]
  runs: RunRow[]
  databases: DbRow[]
  storage: StorageRow[]
}

export function buildSpaceDetail(input: SpaceDetailInput): SpaceDetailView {
  if (!input.space) {
    return { found: false, space: null, members: [], connections: [], config: null, retention: null, bases: [], runs: [], databases: [], storage: [] }
  }
  return {
    found: true,
    space: input.space,
    members: [...input.members].sort((a, b) => a.email.localeCompare(b.email)),
    connections: input.connections,
    config: input.config,
    retention: input.retention,
    bases: [...input.bases].sort((a, b) => a.name.localeCompare(b.name)),
    runs: input.runs, // caller orders newest-first (limit 25)
    databases: input.databases,
    storage: input.storage,
  }
}
