/**
 * Pure-function tests for the recent-runs list helper.
 *
 * The Drizzle SELECT lives in the route — this helper does the row-to-
 * summary mapping (Date → ISO string, null preservation, JOIN-derived
 * shape) and asserts the row order coming out of the dep matches the
 * order going to the caller (the route is responsible for ORDER BY).
 */

import { describe, expect, it, vi } from 'vitest'
import { listRecentRuns } from './list'
import type { BackupRunRowLike, IncludedBase } from './list'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'

function makeRow(overrides: Partial<BackupRunRowLike> = {}): BackupRunRowLike {
  return {
    id: 'r_1',
    status: 'queued',
    isTrial: false,
    triggeredBy: 'manual',
    recordCount: null,
    tableCount: null,
    attachmentCount: null,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    triggerRunIds: null,
    createdAt: new Date('2026-05-08T18:00:00.000Z'),
    connectionId: 'conn_1',
    connectionDisplayName: 'Main Airtable',
    configStorageType: 'r2_managed',
    configMode: 'static',
    ...overrides,
  }
}

const NO_BASES: IncludedBase[] = []
const TWO_BASES: IncludedBase[] = [
  { id: 'b_1', name: 'CRM' },
  { id: 'b_2', name: 'Marketing' },
]

describe('listRecentRuns', () => {
  it('passes spaceId and limit through to fetchRuns', async () => {
    const fetchRuns = vi.fn(async () => [])
    const fetchIncludedBases = vi.fn(async () => NO_BASES)
    await listRecentRuns(SPACE_ID, 7, { fetchRuns, fetchIncludedBases })
    expect(fetchRuns).toHaveBeenCalledOnce()
    expect(fetchRuns).toHaveBeenCalledWith(SPACE_ID, 7)
    expect(fetchIncludedBases).toHaveBeenCalledOnce()
    expect(fetchIncludedBases).toHaveBeenCalledWith(SPACE_ID)
  })

  it('returns an empty array when no rows match', async () => {
    const result = await listRecentRuns(SPACE_ID, 10, {
      fetchRuns: async () => [],
      fetchIncludedBases: async () => NO_BASES,
    })
    expect(result).toEqual([])
  })

  it('preserves the row order returned by fetchRuns (route owns ORDER BY)', async () => {
    const r1 = makeRow({ id: 'r_1', createdAt: new Date('2026-05-08T18:00:00.000Z') })
    const r2 = makeRow({ id: 'r_2', createdAt: new Date('2026-05-08T17:00:00.000Z') })
    const result = await listRecentRuns(SPACE_ID, 10, {
      fetchRuns: async () => [r1, r2],
      fetchIncludedBases: async () => NO_BASES,
    })
    expect(result.map((r) => r.id)).toEqual(['r_1', 'r_2'])
  })

  it('maps dates to ISO-8601 strings, preserves nulls, and copies the rest', async () => {
    const result = await listRecentRuns(SPACE_ID, 10, {
      fetchRuns: async () => [
        makeRow({
          id: 'r_x',
          status: 'succeeded',
          isTrial: true,
          triggeredBy: 'scheduled',
          recordCount: 42,
          tableCount: 3,
          attachmentCount: 0,
          startedAt: new Date('2026-05-08T18:30:00.000Z'),
          completedAt: new Date('2026-05-08T18:31:00.000Z'),
          errorMessage: null,
          triggerRunIds: ['run_a', 'run_b'],
          createdAt: new Date('2026-05-08T18:29:00.000Z'),
        }),
      ],
      fetchIncludedBases: async () => TWO_BASES,
    })
    expect(result[0]).toEqual({
      id: 'r_x',
      status: 'succeeded',
      isTrial: true,
      triggeredBy: 'scheduled',
      recordCount: 42,
      tableCount: 3,
      attachmentCount: 0,
      startedAt: '2026-05-08T18:30:00.000Z',
      completedAt: '2026-05-08T18:31:00.000Z',
      errorMessage: null,
      triggerRunIds: ['run_a', 'run_b'],
      createdAt: '2026-05-08T18:29:00.000Z',
      connection: { id: 'conn_1', displayName: 'Main Airtable' },
      configuration: { storageType: 'r2_managed', mode: 'static' },
      includedBases: TWO_BASES,
    })
  })

  it('renders an errorMessage on failed runs', async () => {
    const result = await listRecentRuns(SPACE_ID, 10, {
      fetchRuns: async () => [
        makeRow({
          status: 'failed',
          errorMessage: 'Airtable rate limit exceeded',
          completedAt: new Date('2026-05-08T18:35:00.000Z'),
        }),
      ],
      fetchIncludedBases: async () => NO_BASES,
    })
    expect(result[0]?.errorMessage).toBe('Airtable rate limit exceeded')
    expect(result[0]?.status).toBe('failed')
  })

  it('maps a null connection display name into null connection.displayName but keeps id', async () => {
    // Engine guarantees backup_runs.connectionId is non-null; the LEFT JOIN
    // to connections can still return null displayName if the connection
    // row was deleted (FK is RESTRICT, so this is rare, but possible after
    // a cleanup script).
    const result = await listRecentRuns(SPACE_ID, 10, {
      fetchRuns: async () => [
        makeRow({ connectionId: 'conn_2', connectionDisplayName: null }),
      ],
      fetchIncludedBases: async () => NO_BASES,
    })
    expect(result[0]?.connection).toEqual({
      id: 'conn_2',
      displayName: null,
    })
  })

  it('maps a missing backup_configuration row to configuration: null', async () => {
    const result = await listRecentRuns(SPACE_ID, 10, {
      fetchRuns: async () => [
        makeRow({ configStorageType: null, configMode: null }),
      ],
      fetchIncludedBases: async () => NO_BASES,
    })
    expect(result[0]?.configuration).toBeNull()
  })

  it('stamps the shared includedBases list onto every row in the response', async () => {
    const r1 = makeRow({ id: 'r_a' })
    const r2 = makeRow({ id: 'r_b' })
    const result = await listRecentRuns(SPACE_ID, 10, {
      fetchRuns: async () => [r1, r2],
      fetchIncludedBases: async () => TWO_BASES,
    })
    expect(result[0]?.includedBases).toBe(result[1]?.includedBases)
    expect(result[0]?.includedBases).toEqual(TWO_BASES)
  })
})
