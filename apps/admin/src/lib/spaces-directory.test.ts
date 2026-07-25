import { describe, expect, it } from 'vitest'
import { buildSpacesDirectory } from './spaces-directory'

const space = (id: string, name: string, over = {}) => ({ id, name, status: 'active', organizationId: 'o1', organizationName: 'Acme', ...over })

describe('buildSpacesDirectory', () => {
  it('summarizes config / db / last-run and defaults the absent ones', () => {
    const rows = buildSpacesDirectory({
      spaces: [space('s1', 'Prod')],
      platforms: [{ spaceId: 's1', code: 'at' }],
      configs: [{ spaceId: 's1', frequency: 'daily', scope: 'schema_and_data', mode: 'static' }],
      dbs: [{ spaceId: 's1', backend: 'managed_pg', status: 'active' }],
      latestRuns: [{ spaceId: 's1', status: 'succeeded', errorMessage: null, createdAt: new Date('2026-07-01') }],
    })
    expect(rows[0]).toMatchObject({
      platformCodes: ['at'],
      config: { frequency: 'daily', scope: 'schema_and_data', mode: 'static' },
      db: { backend: 'managed_pg', status: 'active' },
      attention: false,
    })
    expect(rows[0].lastRun?.status).toBe('succeeded')
  })

  it('shows "not configured" / "not provisioned" / no last run when absent', () => {
    const rows = buildSpacesDirectory({ spaces: [space('s1', 'Bare')], platforms: [], configs: [], dbs: [], latestRuns: [] })
    expect(rows[0].config).toBeNull()
    expect(rows[0].db).toEqual({ backend: null, status: 'not_provisioned' })
    expect(rows[0].lastRun).toBeNull()
  })

  it('sorts attention-first: failed run / space error / db error to the top, then by name', () => {
    const rows = buildSpacesDirectory({
      spaces: [space('s1', 'Aaa healthy'), space('s2', 'Zzz failed'), space('s3', 'Mmm db-error'), space('s4', 'Bbb space-error', { status: 'error' })],
      platforms: [],
      configs: [],
      dbs: [{ spaceId: 's3', backend: 'd1', status: 'error' }],
      latestRuns: [{ spaceId: 's2', status: 'failed', errorMessage: 'boom', createdAt: new Date('2026-07-01') }],
    })
    // attention rows first (by name), then healthy
    expect(rows.map((r) => r.id)).toEqual(['s4', 's3', 's2', 's1'])
    expect(rows[0].attention).toBe(true)
    expect(rows[3].attention).toBe(false)
    expect(rows.find((r) => r.id === 's2')!.lastRun?.errorMessage).toBe('boom')
  })
})
