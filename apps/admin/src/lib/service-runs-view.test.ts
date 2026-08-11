import { describe, expect, it } from 'vitest'
import { recentFailures, summarizeServiceRuns, SERVICE_DISPLAY, type ServiceRunRow } from './service-runs-view'

const now = new Date('2026-07-20T12:00:00.000Z')
const at = (isoMinutesAgo: number, over: Partial<ServiceRunRow> = {}): ServiceRunRow => ({
  service: 'oauth_refresh_sweep',
  status: 'succeeded',
  startedAt: new Date(now.getTime() - isoMinutesAgo * 60_000),
  completedAt: new Date(now.getTime() - isoMinutesAgo * 60_000 + 1200),
  durationMs: 1200,
  errorMessage: null,
  counts: {},
  ...over,
})

describe('summarizeServiceRuns', () => {
  it('lists every live + reserved service even with no rows', () => {
    const s = summarizeServiceRuns([], now)
    const services = s.map((x) => x.service)
    expect(services).toEqual(Object.keys(SERVICE_DISPLAY)) // live first, then reserved, all present
    const sweep = s.find((x) => x.service === 'oauth_refresh_sweep')!
    expect(sweep.latest).toBeNull()
    expect(sweep.reserved).toBe(false)
    expect(s.find((x) => x.service === 'webhook_renewal')!.reserved).toBe(true)
  })

  it('computes the failure streak from newest backwards (stops at the last success)', () => {
    const rows = [
      at(1, { status: 'failed', errorMessage: 'e1' }),
      at(2, { status: 'failed', errorMessage: 'e2' }),
      at(3, { status: 'succeeded' }),
      at(4, { status: 'failed' }),
    ]
    const sweep = summarizeServiceRuns(rows, now).find((x) => x.service === 'oauth_refresh_sweep')!
    expect(sweep.failureStreak).toBe(2)
    expect(sweep.lastSuccessAt).toEqual(rows[2].completedAt)
  })

  it('flags a started row older than its cadence window as stale', () => {
    // quarter-hour cadence → 1h window. A started row 90m old is stale.
    const stale = summarizeServiceRuns([at(90, { status: 'started', completedAt: null, durationMs: null })], now)
      .find((x) => x.service === 'oauth_refresh_sweep')!
    expect(stale.stale).toBe(true)
    // a started row 30m old is within the window → not stale.
    const fresh = summarizeServiceRuns([at(30, { status: 'started', completedAt: null, durationMs: null })], now)
      .find((x) => x.service === 'oauth_refresh_sweep')!
    expect(fresh.stale).toBe(false)
  })

  it('collects recent durations from completed rows only', () => {
    const rows = [at(1, { durationMs: 100 }), at(2, { status: 'started', durationMs: null, completedAt: null }), at(3, { durationMs: 300 })]
    const sweep = summarizeServiceRuns(rows, now).find((x) => x.service === 'oauth_refresh_sweep')!
    expect(sweep.recentDurations).toEqual([100, 300])
  })

  it('renders an unknown service id found in the rows (forward-tolerant)', () => {
    const s = summarizeServiceRuns([at(1, { service: 'future_job' })], now)
    const unknown = s.find((x) => x.service === 'future_job')!
    expect(unknown).toBeDefined()
    expect(unknown.known).toBe(false)
    expect(unknown.label).toBe('future_job')
  })
})

describe('recentFailures', () => {
  it('returns the newest failed rows across services, capped', () => {
    const rows = [
      at(5, { status: 'failed', service: 'oauth_refresh_sweep' }),
      at(1, { status: 'failed', service: 'retention_cleanup' }),
      at(2, { status: 'succeeded' }),
      at(3, { status: 'failed', service: 'run_reconciliation' }),
    ]
    const fails = recentFailures(rows, 2)
    expect(fails).toHaveLength(2)
    expect(fails[0].service).toBe('retention_cleanup') // newest failure first
    expect(fails[1].service).toBe('run_reconciliation')
  })
})
