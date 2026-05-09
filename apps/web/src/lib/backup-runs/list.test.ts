/**
 * Pure-function tests for the recent-runs list helper.
 *
 * The Drizzle SELECT lives in the route — this helper does the row-to-
 * summary mapping (Date → ISO string, null preservation) and asserts the
 * row order coming out of the dep matches the order going to the caller
 * (the route is responsible for ORDER BY).
 */

import { describe, expect, it, vi } from 'vitest'
import { listRecentRuns } from './list'
import type { BackupRunRowLike } from './list'

const SPACE_ID = '11111111-1111-1111-1111-111111111111'

function makeRow(overrides: Partial<BackupRunRowLike> = {}): BackupRunRowLike {
  return {
    id: 'r_1',
    status: 'queued',
    isTrial: false,
    recordCount: null,
    tableCount: null,
    attachmentCount: null,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    triggerRunIds: null,
    createdAt: new Date('2026-05-08T18:00:00.000Z'),
    ...overrides,
  }
}

describe('listRecentRuns', () => {
  it('passes spaceId and limit through to fetchRuns', async () => {
    const fetchRuns = vi.fn(async () => [])
    await listRecentRuns(SPACE_ID, 7, { fetchRuns })
    expect(fetchRuns).toHaveBeenCalledOnce()
    expect(fetchRuns).toHaveBeenCalledWith(SPACE_ID, 7)
  })

  it('returns an empty array when no rows match', async () => {
    const result = await listRecentRuns(SPACE_ID, 10, {
      fetchRuns: async () => [],
    })
    expect(result).toEqual([])
  })

  it('preserves the row order returned by fetchRuns (route owns ORDER BY)', async () => {
    const r1 = makeRow({ id: 'r_1', createdAt: new Date('2026-05-08T18:00:00.000Z') })
    const r2 = makeRow({ id: 'r_2', createdAt: new Date('2026-05-08T17:00:00.000Z') })
    const result = await listRecentRuns(SPACE_ID, 10, {
      fetchRuns: async () => [r1, r2],
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
    })
    expect(result[0]).toEqual({
      id: 'r_x',
      status: 'succeeded',
      isTrial: true,
      recordCount: 42,
      tableCount: 3,
      attachmentCount: 0,
      startedAt: '2026-05-08T18:30:00.000Z',
      completedAt: '2026-05-08T18:31:00.000Z',
      errorMessage: null,
      triggerRunIds: ['run_a', 'run_b'],
      createdAt: '2026-05-08T18:29:00.000Z',
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
    })
    expect(result[0]?.errorMessage).toBe('Airtable rate limit exceeded')
    expect(result[0]?.status).toBe('failed')
  })
})
