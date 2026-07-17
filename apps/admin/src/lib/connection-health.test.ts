import { describe, it, expect } from 'vitest'
import {
  classifyConnection,
  summarizeHealth,
  classifyDestination,
  filterByHealth,
  REFRESH_STUCK_MS,
  type ConnectionRow,
} from './connection-health'

const NOW = new Date('2026-07-13T12:00:00Z')
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000)

function conn(overrides: Partial<ConnectionRow>): ConnectionRow {
  return {
    id: 'c1',
    orgName: 'Org',
    platformName: 'Airtable',
    displayName: null,
    scope: 'organization',
    status: 'active',
    tokenExpiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
    invalidatedAt: null,
    lastUsedAt: null,
    oauthRefreshClaimId: null,
    oauthRefreshClaimedAt: null,
    oauthRefreshLastError: null,
    createdAt: NOW,
    ...overrides,
  }
}

describe('classifyConnection', () => {
  it('healthy for an active connection with a future token', () => {
    expect(classifyConnection(conn({}), NOW)).toBe('healthy')
  })

  it('invalid and pending_reauth mirror the status column', () => {
    expect(classifyConnection(conn({ status: 'invalid' }), NOW)).toBe('invalid')
    expect(classifyConnection(conn({ status: 'pending_reauth' }), NOW)).toBe('pending_reauth')
  })

  it('refresh_stuck when a claim is older than the threshold', () => {
    const stuck = conn({
      oauthRefreshClaimId: 'claim1',
      oauthRefreshClaimedAt: new Date(NOW.getTime() - REFRESH_STUCK_MS - 1000),
    })
    expect(classifyConnection(stuck, NOW)).toBe('refresh_stuck')
  })

  it('a fresh claim is NOT stuck (refresh in progress is normal)', () => {
    const fresh = conn({
      oauthRefreshClaimId: 'claim1',
      oauthRefreshClaimedAt: minutesAgo(2),
    })
    expect(classifyConnection(fresh, NOW)).toBe('healthy')
  })

  it('refresh_error when the last refresh recorded an error', () => {
    expect(
      classifyConnection(conn({ oauthRefreshLastError: 'invalid_grant' }), NOW),
    ).toBe('refresh_error')
  })

  it('token_expired for an active row whose access token lapsed', () => {
    expect(
      classifyConnection(conn({ tokenExpiresAt: minutesAgo(5) }), NOW),
    ).toBe('token_expired')
  })

  it('terminal status outranks refresh noise', () => {
    const both = conn({ status: 'invalid', oauthRefreshLastError: 'x' })
    expect(classifyConnection(both, NOW)).toBe('invalid')
  })
})

describe('summarizeHealth', () => {
  it('counts by health and sorts broken-first', () => {
    const { classified, summary } = summarizeHealth(
      [conn({ id: 'ok' }), conn({ id: 'bad', status: 'invalid' })],
      NOW,
    )
    expect(classified.map((c) => c.id)).toEqual(['bad', 'ok'])
    expect(summary.total).toBe(2)
    expect(summary.byHealth.healthy).toBe(1)
    expect(summary.byHealth.invalid).toBe(1)
  })
})

describe('classifyDestination', () => {
  const dest = {
    type: 'google_drive',
    orgName: 'Org',
    spaceName: 'Space',
    oauthAccountEmail: 'a@b.com',
    oauthExpiresAt: new Date(NOW.getTime() + 1000),
    connectedAt: NOW,
    lastValidatedAt: null,
  }

  it('ok while the OAuth token is live', () => {
    expect(classifyDestination(dest, NOW)).toBe('ok')
  })

  it('token_expired once it lapses', () => {
    expect(classifyDestination({ ...dest, oauthExpiresAt: minutesAgo(1) }, NOW)).toBe('token_expired')
  })

  it('local_fs has no OAuth to expire', () => {
    expect(classifyDestination({ ...dest, type: 'local_fs', oauthExpiresAt: minutesAgo(1) }, NOW)).toBe('no_oauth')
  })
})

describe('filterByHealth', () => {
  const classified = [
    { health: 'healthy' as const },
    { health: 'invalid' as const },
    { health: 'invalid' as const },
  ]

  it('passes everything through with no filter', () => {
    expect(filterByHealth(classified, null)).toHaveLength(3)
    expect(filterByHealth(classified, '')).toHaveLength(3)
  })

  it('filters by derived health', () => {
    expect(filterByHealth(classified, 'invalid')).toHaveLength(2)
    expect(filterByHealth(classified, 'refresh_stuck')).toHaveLength(0)
  })
})
