// Database provisioning tracker assembly (pure; testable without a DB).
//
// PRD §5.4 / §16.1: track every provisioned per-Space database — backend,
// lifecycle status, locator, schema version, sync recency. Real utilization
// (bytes) is not recorded anywhere yet and admin cannot reach per-Space DBs;
// the "last observed volume" columns proxy it from each Space's most recent
// succeeded backup run until a phase-2 service writes real size metrics.

import type { BadgeVariant } from './ui'

export interface SpaceDbRow {
  id: string
  spaceId: string
  spaceName: string | null
  orgName: string | null
  backend: string // 'd1' | 'managed_pg' | 'byodb'
  recordsEnabled: boolean
  status: string // 'pending' | 'provisioning' | 'active' | 'migrating' | 'error'
  d1DatabaseId: string | null
  pgLocator: string | null
  schemaVersion: number | null
  lastSchemaSyncAt: Date | null
  lastRecordsSyncAt: Date | null
  provisionedAt: Date | null
  errorMessage: string | null
}

export interface VolumeRow {
  spaceId: string
  recordCount: number | null
  tableCount: number | null
  attachmentCount: number | null
  completedAt: Date | null
}

export interface DbTrackerEntry extends SpaceDbRow {
  locator: string
  volume: VolumeRow | null
}

export interface DbTrackerSummary {
  total: number
  byBackend: Record<string, number>
  byStatus: Record<string, number>
  errors: number
}

// The byodb DSN is encrypted and deliberately not even mirrored into admin's
// schema — display a fixed label instead of a locator.
export function displayLocator(row: SpaceDbRow): string {
  if (row.backend === 'd1') return row.d1DatabaseId ?? '(not provisioned)'
  if (row.backend === 'managed_pg') return row.pgLocator ?? '(not provisioned)'
  if (row.backend === 'byodb') return 'customer DSN (encrypted)'
  return '—'
}

export function buildDbTracker(
  rows: SpaceDbRow[],
  volumes: VolumeRow[],
): { entries: DbTrackerEntry[]; summary: DbTrackerSummary } {
  const volumeBySpace = new Map(volumes.map((v) => [v.spaceId, v]))

  // Errors first, then the rest grouped by lifecycle, alphabetical within.
  const statusRank: Record<string, number> = {
    error: 0,
    migrating: 1,
    provisioning: 2,
    pending: 3,
    active: 4,
  }
  const entries = rows
    .map((r) => ({
      ...r,
      locator: displayLocator(r),
      volume: volumeBySpace.get(r.spaceId) ?? null,
    }))
    .sort(
      (a, b) =>
        (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) ||
        (a.orgName ?? '').localeCompare(b.orgName ?? ''),
    )

  const byBackend: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  for (const r of rows) {
    byBackend[r.backend] = (byBackend[r.backend] ?? 0) + 1
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
  }

  return {
    entries,
    summary: {
      total: rows.length,
      byBackend,
      byStatus,
      errors: byStatus['error'] ?? 0,
    },
  }
}

// Shared @web Badge variants (not raw daisyUI classes) — see BadgeVariant.
export const DB_STATUS_BADGE: Record<string, BadgeVariant> = {
  active: 'success',
  provisioning: 'primary',
  migrating: 'warning',
  pending: 'default',
  error: 'error',
}
