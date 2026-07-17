// Connection-health classification (pure; testable without a DB).
//
// PRD §16.1: "OAuth connections dashboard … connection status monitoring."
// Health is DERIVED from the connections row — there is no separate health
// table. Webhook renewal state is not instrumented yet (no table, renewal
// cron unbuilt) — the page says so instead of pretending.

import type { BadgeVariant } from './ui'

export interface ConnectionRow {
  id: string
  orgName: string | null
  platformName: string | null
  displayName: string | null
  scope: string
  status: string // 'active' | 'invalid' | 'refreshing' | 'pending_reauth'
  tokenExpiresAt: Date | null
  invalidatedAt: Date | null
  lastUsedAt: Date | null
  oauthRefreshClaimId: string | null
  oauthRefreshClaimedAt: Date | null
  oauthRefreshLastError: string | null
  createdAt: Date
}

export type ConnectionHealth =
  | 'healthy'
  | 'token_expired'
  | 'refresh_stuck'
  | 'refresh_error'
  | 'pending_reauth'
  | 'invalid'

// A refresh claim older than this with no resolution means the claimant died
// mid-refresh (crash between claim and write-back).
export const REFRESH_STUCK_MS = 10 * 60 * 1000

// Ordered most-broken-first: a terminal status outranks refresh noise, a
// stuck/stale-error refresh outranks a merely-expired access token (expiry is
// normal — the lazy on-access refresh handles it — unless refresh is failing).
export function classifyConnection(row: ConnectionRow, now: Date): ConnectionHealth {
  if (row.status === 'invalid') return 'invalid'
  if (row.status === 'pending_reauth') return 'pending_reauth'
  if (
    row.oauthRefreshClaimId &&
    row.oauthRefreshClaimedAt &&
    now.getTime() - row.oauthRefreshClaimedAt.getTime() > REFRESH_STUCK_MS
  ) {
    return 'refresh_stuck'
  }
  if (row.oauthRefreshLastError) return 'refresh_error'
  if (row.tokenExpiresAt && row.tokenExpiresAt.getTime() <= now.getTime()) {
    return 'token_expired'
  }
  return 'healthy'
}

export interface HealthSummary {
  total: number
  byHealth: Record<ConnectionHealth, number>
}

export function summarizeHealth(
  rows: ConnectionRow[],
  now: Date,
): { classified: Array<ConnectionRow & { health: ConnectionHealth }>; summary: HealthSummary } {
  const classified = rows.map((r) => ({ ...r, health: classifyConnection(r, now) }))
  const byHealth: Record<ConnectionHealth, number> = {
    healthy: 0,
    token_expired: 0,
    refresh_stuck: 0,
    refresh_error: 0,
    pending_reauth: 0,
    invalid: 0,
  }
  for (const c of classified) byHealth[c.health]++
  // Broken connections surface first; ties keep org order from the query.
  const rank: Record<ConnectionHealth, number> = {
    invalid: 0,
    pending_reauth: 1,
    refresh_stuck: 2,
    refresh_error: 3,
    token_expired: 4,
    healthy: 5,
  }
  classified.sort((a, b) => rank[a.health] - rank[b.health])
  return { classified, summary: { total: rows.length, byHealth } }
}

// null/'' = no filter; otherwise keep rows whose derived health matches.
// Filtering happens post-classification (health is derived, not a column).
export function filterByHealth<T extends { health: ConnectionHealth }>(
  classified: T[],
  health: string | null,
): T[] {
  if (!health) return classified
  return classified.filter((c) => c.health === health)
}

export const HEALTH_FILTERS: readonly ConnectionHealth[] = [
  'invalid',
  'pending_reauth',
  'refresh_stuck',
  'refresh_error',
  'token_expired',
  'healthy',
]

// Shared @web Badge variants (not raw daisyUI classes) — see BadgeVariant.
export const HEALTH_BADGE: Record<ConnectionHealth, BadgeVariant> = {
  healthy: 'success',
  token_expired: 'warning',
  refresh_stuck: 'error',
  refresh_error: 'error',
  pending_reauth: 'warning',
  invalid: 'error',
}

// Storage destinations (BYOS OAuth) — a lighter classification: local_fs has
// no OAuth to expire.
export interface DestinationRow {
  type: string
  orgName: string | null
  spaceName: string | null
  oauthAccountEmail: string | null
  oauthExpiresAt: Date | null
  connectedAt: Date
  lastValidatedAt: Date | null
}

export type DestinationHealth = 'ok' | 'token_expired' | 'no_oauth'

export function classifyDestination(row: DestinationRow, now: Date): DestinationHealth {
  if (row.type === 'local_fs') return 'no_oauth'
  if (row.oauthExpiresAt && row.oauthExpiresAt.getTime() <= now.getTime()) return 'token_expired'
  return 'ok'
}
