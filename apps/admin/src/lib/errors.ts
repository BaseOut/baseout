// Pure error-triage classifier (admin-error-triage D1/D2). The /errors page issues
// five bounded, indexed queries (one per source, org/space names joined) and this
// module normalizes them into one ErrorItem shape, applies acknowledgements, and
// groups/sorts — testable without a DB (house style). Ack state = the latest
// `phase` per (targetType, targetId[, connection fingerprint]); connections are
// the only source whose row mutates, so an ack only suppresses while the
// fingerprint matches (a differently-broken connection resurfaces).

export type ErrorType = 'backup_run' | 'backup_run_base' | 'restore_run' | 'connection' | 'space_database'

export interface ErrorItem {
  type: ErrorType
  targetId: string
  orgId: string | null
  orgName: string | null
  spaceId: string | null
  spaceName: string | null
  label: string // e.g. base name / space name — the human anchor
  message: string
  occurredAt: Date
  stateFingerprint: string | null // connection only
  acked: boolean
  ackedByEmail: string | null
  ackedAt: Date | null
}

// ── source input rows (post-query) ──
export interface BackupRunErr { id: string; spaceId: string | null; spaceName: string | null; orgId: string | null; orgName: string | null; errorMessage: string | null; completedAt: Date | null; createdAt: Date }
export interface BackupRunBaseErr { id: string; spaceId: string | null; spaceName: string | null; orgId: string | null; orgName: string | null; baseName: string; errorMessage: string | null; completedAt: Date | null; runCreatedAt: Date | null }
export interface RestoreRunErr { id: string; spaceId: string | null; spaceName: string | null; orgId: string | null; orgName: string | null; errorMessage: string | null; completedAt: Date | null; createdAt: Date }
export interface ConnectionErr { id: string; orgId: string | null; orgName: string | null; status: string; oauthRefreshLastError: string | null; invalidatedAt: Date | null; pendingReauthAt: Date | null; modifiedAt: Date | null }
export interface SpaceDbErr { id: string; spaceId: string | null; spaceName: string | null; orgId: string | null; orgName: string | null; status: string; errorMessage: string | null; modifiedAt: Date | null }

export interface AckRow { targetType: string; targetId: string; targetState: string | null; phase: string; createdAt: Date; ackedByEmail: string }

export interface ErrorSources {
  backupRuns: BackupRunErr[]
  backupRunBases: BackupRunBaseErr[]
  restoreRuns: RestoreRunErr[]
  connections: ConnectionErr[]
  spaceDatabases: SpaceDbErr[]
}

const EPOCH = new Date(0)

function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** Connection state fingerprint: an ack only suppresses while this matches. */
export function connectionFingerprint(c: Pick<ConnectionErr, 'status' | 'oauthRefreshLastError'>): string {
  if (c.status === 'invalid') return 'invalid'
  if (c.status === 'pending_reauth') return 'pending_reauth'
  return `err:${fnv1a(c.oauthRefreshLastError ?? '')}`
}

function normalize(sources: ErrorSources): Omit<ErrorItem, 'acked' | 'ackedByEmail' | 'ackedAt'>[] {
  const items: Omit<ErrorItem, 'acked' | 'ackedByEmail' | 'ackedAt'>[] = []

  for (const r of sources.backupRuns) {
    items.push({ type: 'backup_run', targetId: r.id, orgId: r.orgId, orgName: r.orgName, spaceId: r.spaceId, spaceName: r.spaceName, label: r.spaceName ?? 'Space', message: r.errorMessage ?? 'Backup run failed.', occurredAt: r.completedAt ?? r.createdAt, stateFingerprint: null })
  }
  for (const r of sources.backupRunBases) {
    items.push({ type: 'backup_run_base', targetId: r.id, orgId: r.orgId, orgName: r.orgName, spaceId: r.spaceId, spaceName: r.spaceName, label: r.baseName, message: r.errorMessage ?? 'Base backup failed.', occurredAt: r.completedAt ?? r.runCreatedAt ?? EPOCH, stateFingerprint: null })
  }
  for (const r of sources.restoreRuns) {
    items.push({ type: 'restore_run', targetId: r.id, orgId: r.orgId, orgName: r.orgName, spaceId: r.spaceId, spaceName: r.spaceName, label: r.spaceName ?? 'Space', message: r.errorMessage ?? 'Restore failed.', occurredAt: r.completedAt ?? r.createdAt, stateFingerprint: null })
  }
  for (const c of sources.connections) {
    items.push({ type: 'connection', targetId: c.id, orgId: c.orgId, orgName: c.orgName, spaceId: null, spaceName: null, label: c.orgName ?? 'Connection', message: c.oauthRefreshLastError ?? `Connection ${c.status}`, occurredAt: c.invalidatedAt ?? c.pendingReauthAt ?? c.modifiedAt ?? EPOCH, stateFingerprint: connectionFingerprint(c) })
  }
  for (const d of sources.spaceDatabases) {
    items.push({ type: 'space_database', targetId: d.id, orgId: d.orgId, orgName: d.orgName, spaceId: d.spaceId, spaceName: d.spaceName, label: d.spaceName ?? 'Database', message: d.errorMessage ?? 'Database in error state.', occurredAt: d.modifiedAt ?? EPOCH, stateFingerprint: null })
  }
  return items
}

/** Latest ack row matching an item's (type, id[, fingerprint]); connection acks must match the fingerprint. */
function resolveAck(item: { type: ErrorType; targetId: string; stateFingerprint: string | null }, acks: AckRow[]): AckRow | null {
  const matches = acks
    .filter((a) => a.targetType === item.type && a.targetId === item.targetId && (item.stateFingerprint === null || a.targetState === item.stateFingerprint))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return matches[0] ?? null
}

export function classifyErrors(sources: ErrorSources, acks: AckRow[]): ErrorItem[] {
  return normalize(sources)
    .map((item): ErrorItem => {
      const ack = resolveAck(item, acks)
      const acked = ack?.phase === 'ack'
      return { ...item, acked, ackedByEmail: acked ? ack!.ackedByEmail : null, ackedAt: acked ? ack!.createdAt : null }
    })
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
}

export interface OrgErrorGroup {
  orgId: string | null
  orgName: string | null
  items: ErrorItem[]
}

/** Group items by org (newest-first within a group; groups ordered by their newest item). */
export function groupByOrg(items: ErrorItem[]): OrgErrorGroup[] {
  const groups = new Map<string, OrgErrorGroup>()
  for (const item of items) {
    const key = item.orgId ?? '∅'
    const g = groups.get(key) ?? { orgId: item.orgId, orgName: item.orgName, items: [] }
    g.items.push(item)
    groups.set(key, g)
  }
  const out = [...groups.values()]
  for (const g of out) g.items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
  return out.sort((a, b) => (b.items[0]?.occurredAt.getTime() ?? 0) - (a.items[0]?.occurredAt.getTime() ?? 0))
}

/** Open (unacked) error counts, for the ops-overview dashboard tile + the /errors header. */
export function countOpenErrors(items: ErrorItem[]): { total: number; byType: Record<ErrorType, number> } {
  const byType = { backup_run: 0, backup_run_base: 0, restore_run: 0, connection: 0, space_database: 0 } as Record<ErrorType, number>
  let total = 0
  for (const item of items) {
    if (item.acked) continue
    byType[item.type]++
    total++
  }
  return { total, byType }
}
