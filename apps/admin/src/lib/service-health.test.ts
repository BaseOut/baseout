import { describe, it, expect } from 'vitest'
import { deriveServiceHealth, type ServiceHealthInputs } from './service-health'

const NOW = new Date('2026-07-13T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000)

function inputs(overrides: Partial<ServiceHealthInputs>): ServiceHealthInputs {
  return {
    overdueScheduleCount: 0,
    scheduleCount: 5,
    lastScheduledRunAt: hoursAgo(6),
    staleSessionCount: 0,
    ...overrides,
  }
}

function byKey(signals: ReturnType<typeof deriveServiceHealth>, key: string) {
  const s = signals.find((x) => x.key === key)
  if (!s) throw new Error(`missing signal ${key}`)
  return s
}

describe('deriveServiceHealth', () => {
  it('reports all-ok when nothing is overdue or stale', () => {
    const signals = deriveServiceHealth(inputs({}), NOW)
    // Cleanup signal moved to real service_runs rows — scheduler, scheduled-runs,
    // session-sweep remain the derived set (shared-service-runs 5.3).
    expect(signals).toHaveLength(3)
    expect(signals.every((s) => s.status === 'ok')).toBe(true)
  })

  it('warns when schedules are past due', () => {
    const s = byKey(deriveServiceHealth(inputs({ overdueScheduleCount: 2 }), NOW), 'scheduler')
    expect(s.status).toBe('warning')
    expect(s.detail).toContain('2 of 5')
  })

  it('is unknown (not ok, not warning) with no schedules at all', () => {
    const s = byKey(
      deriveServiceHealth(inputs({ scheduleCount: 0, overdueScheduleCount: 0 }), NOW),
      'scheduler',
    )
    expect(s.status).toBe('unknown')
  })

  it('is unknown when no scheduled run has ever happened (young install ≠ broken)', () => {
    const signals = deriveServiceHealth(inputs({ lastScheduledRunAt: null }), NOW)
    expect(byKey(signals, 'scheduled-runs').status).toBe('unknown')
  })

  it('warns on stale connection-session locks', () => {
    const s = byKey(deriveServiceHealth(inputs({ staleSessionCount: 3 }), NOW), 'session-sweep')
    expect(s.status).toBe('warning')
    expect(s.detail).toContain('3 stale')
  })

  it('renders human recency in details', () => {
    const s = byKey(deriveServiceHealth(inputs({ lastScheduledRunAt: hoursAgo(30) }), NOW), 'scheduled-runs')
    expect(s.detail).toContain('1d ago')
  })
})
