import { describe, it, expect } from 'vitest'
import { buildConnectionDetail, type ConnSession, type ConnStatusFlip, type ServedSpace } from './connection-detail'
import type { ConnectionRow } from './connection-health'

const NOW = new Date('2026-08-03T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000)
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 3600_000)

const conn = (over: Partial<ConnectionRow> = {}): ConnectionRow => ({
  id: 'c1',
  orgName: 'Acme',
  platformName: 'Airtable',
  displayName: 'Acme Airtable',
  scope: 'organization',
  status: 'active',
  tokenExpiresAt: hoursAhead(24),
  invalidatedAt: null,
  lastUsedAt: hoursAgo(1),
  oauthRefreshClaimId: null,
  oauthRefreshClaimedAt: null,
  oauthRefreshLastError: null,
  createdAt: hoursAgo(100),
  ...over,
})

describe('buildConnectionDetail', () => {
  it('classifies health, counts active vs stale sessions, and orders history newest-first', () => {
    const sessions: ConnSession[] = [
      { lockedBy: 'run-1', startedAt: hoursAgo(2), expiresAt: hoursAgo(1) }, // stale
      { lockedBy: 'run-2', startedAt: hoursAgo(1), expiresAt: hoursAhead(1) }, // active
    ]
    const statusAudit: ConnStatusFlip[] = [
      { oldStatus: 'active', newStatus: 'invalid', changedAt: hoursAgo(5), applicationName: 'web', dbUser: 'app' },
      { oldStatus: 'invalid', newStatus: 'active', changedAt: hoursAgo(1), applicationName: 'server', dbUser: 'app' },
    ]
    const servedSpaces: ServedSpace[] = [
      { id: 's2', name: 'Zeta', status: 'active' },
      { id: 's1', name: 'Alpha', status: 'active' },
    ]
    const view = buildConnectionDetail({ connection: conn(), sessions, statusAudit, servedSpaces }, NOW)

    expect(view.health).toBe('healthy')
    expect(view.sessionSummary).toEqual({ total: 2, active: 1, stale: 1 })
    expect(view.statusHistory.map((f) => f.newStatus)).toEqual(['active', 'invalid']) // newest first
    expect(view.servedSpaces.map((s) => s.name)).toEqual(['Alpha', 'Zeta']) // name-sorted
  })

  it('surfaces an invalid connection as invalid health with empty session/space sets', () => {
    const view = buildConnectionDetail(
      { connection: conn({ status: 'invalid', invalidatedAt: hoursAgo(1) }), sessions: [], statusAudit: [], servedSpaces: [] },
      NOW,
    )
    expect(view.health).toBe('invalid')
    expect(view.sessionSummary).toEqual({ total: 0, active: 0, stale: 0 })
    expect(view.statusHistory).toEqual([])
    expect(view.servedSpaces).toEqual([])
  })
})
