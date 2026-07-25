// Pure assembly for the /spaces directory (admin-entity-directories D1/D2).
// Joins spaces + org name + platforms + backup config + DB posture + latest run
// in memory, then applies attention-first ordering (failed run / space error /
// DB error sort to the top). Search/status filter + limit applied in SQL.

export interface SpaceInput {
  id: string
  name: string
  status: string
  organizationId: string | null
  organizationName: string | null
}
export interface SpacePlatformInput {
  spaceId: string
  code: string
}
export interface SpaceConfigInput {
  spaceId: string
  frequency: string
  scope: string
  mode: string
}
export interface SpaceDbInput {
  spaceId: string
  backend: string | null
  status: string | null // provisioning status; null = not provisioned
}
export interface SpaceLatestRun {
  spaceId: string
  status: string
  errorMessage: string | null
  createdAt: Date
}

export interface SpaceRow {
  id: string
  name: string
  status: string
  organizationId: string | null
  organizationName: string | null
  platformCodes: string[]
  config: { frequency: string; scope: string; mode: string } | null // null = not configured
  db: { backend: string | null; status: string } // status 'not_provisioned' when absent
  lastRun: { status: string; errorMessage: string | null; at: Date } | null
  attention: boolean
}

export function buildSpacesDirectory(input: {
  spaces: SpaceInput[]
  platforms: SpacePlatformInput[]
  configs: SpaceConfigInput[]
  dbs: SpaceDbInput[]
  latestRuns: SpaceLatestRun[]
}): SpaceRow[] {
  const platBySpace = new Map<string, string[]>()
  for (const p of input.platforms) {
    const list = platBySpace.get(p.spaceId) ?? []
    list.push(p.code)
    platBySpace.set(p.spaceId, list)
  }
  const configBySpace = new Map(input.configs.map((c) => [c.spaceId, c]))
  const dbBySpace = new Map(input.dbs.map((d) => [d.spaceId, d]))
  const runBySpace = new Map(input.latestRuns.map((r) => [r.spaceId, r]))

  const rows = input.spaces.map((s): SpaceRow => {
    const cfg = configBySpace.get(s.id)
    const db = dbBySpace.get(s.id)
    const run = runBySpace.get(s.id)
    const attention =
      (run?.status === 'failed') || s.status === 'error' || (db?.status === 'error')
    return {
      id: s.id,
      name: s.name,
      status: s.status,
      organizationId: s.organizationId,
      organizationName: s.organizationName,
      platformCodes: (platBySpace.get(s.id) ?? []).sort(),
      config: cfg ? { frequency: cfg.frequency, scope: cfg.scope, mode: cfg.mode } : null,
      db: { backend: db?.backend ?? null, status: db?.status ?? 'not_provisioned' },
      lastRun: run ? { status: run.status, errorMessage: run.errorMessage, at: run.createdAt } : null,
      attention,
    }
  })

  // Attention-first (D2): rank 0 = needs attention, then by name.
  return rows.sort((a, b) => {
    const ra = a.attention ? 0 : 1
    const rb = b.attention ? 0 : 1
    if (ra !== rb) return ra - rb
    return a.name.localeCompare(b.name)
  })
}
