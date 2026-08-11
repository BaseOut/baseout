import { describe, it, expect } from 'vitest'
import { buildDbTracker, displayLocator, type SpaceDbRow } from './db-tracker'

function row(overrides: Partial<SpaceDbRow>): SpaceDbRow {
  return {
    id: 'db1',
    spaceId: 's1',
    spaceName: 'Space',
    orgName: 'Org',
    backend: 'd1',
    recordsEnabled: false,
    status: 'active',
    d1DatabaseId: 'd1-uuid',
    pgLocator: null,
    schemaVersion: 3,
    lastSchemaSyncAt: null,
    lastRecordsSyncAt: null,
    provisionedAt: null,
    errorMessage: null,
    ...overrides,
  }
}

describe('displayLocator', () => {
  it('shows the backend-specific locator', () => {
    expect(displayLocator(row({}))).toBe('d1-uuid')
    expect(displayLocator(row({ backend: 'managed_pg', pgLocator: 'space_s1' }))).toBe('space_s1')
  })

  it('never exposes a byodb DSN — fixed label (column is not even mirrored)', () => {
    expect(displayLocator(row({ backend: 'byodb' }))).toBe('customer DSN (encrypted)')
  })

  it('flags unprovisioned locators', () => {
    expect(displayLocator(row({ d1DatabaseId: null }))).toBe('(not provisioned)')
  })
})

describe('buildDbTracker', () => {
  it('sorts errors first and attaches per-space volume proxies', () => {
    const { entries, summary } = buildDbTracker(
      [
        row({ id: 'ok', spaceId: 's1', status: 'active' }),
        row({ id: 'bad', spaceId: 's2', status: 'error', errorMessage: 'boom' }),
      ],
      [{ spaceId: 's1', recordCount: 500, tableCount: 4, attachmentCount: 2, completedAt: null }],
    )
    expect(entries.map((e) => e.id)).toEqual(['bad', 'ok'])
    expect(entries[1].volume?.recordCount).toBe(500)
    expect(entries[0].volume).toBeNull()
    expect(summary.errors).toBe(1)
    expect(summary.byBackend).toEqual({ d1: 2 })
    expect(summary.byStatus).toEqual({ active: 1, error: 1 })
  })

  it('handles no rows', () => {
    const { entries, summary } = buildDbTracker([], [])
    expect(entries).toEqual([])
    expect(summary.total).toBe(0)
  })

  it('preserveOrder keeps the SQL page order instead of error-first', () => {
    const { entries } = buildDbTracker(
      [
        row({ id: 'ok', spaceId: 's1', status: 'active' }),
        row({ id: 'bad', spaceId: 's2', status: 'error' }),
      ],
      [],
      { preserveOrder: true },
    )
    expect(entries.map((e) => e.id)).toEqual(['ok', 'bad'])
  })
})
