import { describe, expect, it } from 'vitest'
import { currentMonthlyPeriod } from '../src/entitlements/period'

// Monthly-anniversary cycle derived from a subscription's start date
// (shared-entitlements design D6). Flow meters reset on this boundary — on
// annual plans too — so the cycle is ALWAYS one calendar month keyed to the
// anchor's day-of-month, never the Stripe billing interval. All arithmetic is
// UTC so the boundary is deterministic regardless of server TZ.

const iso = (d: Date) => d.toISOString()

describe('currentMonthlyPeriod', () => {
  it('brackets now within the anchor-day cycle, preserving time-of-day', () => {
    const anchor = new Date(Date.UTC(2025, 0, 15, 14, 30, 0))
    const { start, end } = currentMonthlyPeriod(anchor, new Date(Date.UTC(2025, 0, 20)))
    expect(iso(start)).toBe('2025-01-15T14:30:00.000Z')
    expect(iso(end)).toBe('2025-02-15T14:30:00.000Z')
  })

  it('steps back to the prior anniversary when now precedes this month’s', () => {
    // anchor day is the 15th; Feb 10 is before Feb 15 → still the Jan cycle.
    const anchor = new Date(Date.UTC(2025, 0, 15))
    const { start, end } = currentMonthlyPeriod(anchor, new Date(Date.UTC(2025, 1, 10)))
    expect(iso(start)).toBe('2025-01-15T00:00:00.000Z')
    expect(iso(end)).toBe('2025-02-15T00:00:00.000Z')
  })

  it('gives an annual subscriber a fresh monthly cycle mid-year', () => {
    const anchor = new Date(Date.UTC(2025, 0, 15))
    const { start, end } = currentMonthlyPeriod(anchor, new Date(Date.UTC(2025, 2, 20)))
    expect(iso(start)).toBe('2025-03-15T00:00:00.000Z')
    expect(iso(end)).toBe('2025-04-15T00:00:00.000Z')
  })

  it('clamps an end-of-month anchor into a short month', () => {
    // anchor on the 31st; Feb 2025 has 28 days → cycle [Jan31, Feb28).
    const anchor = new Date(Date.UTC(2025, 0, 31))
    const { start, end } = currentMonthlyPeriod(anchor, new Date(Date.UTC(2025, 1, 20)))
    expect(iso(start)).toBe('2025-01-31T00:00:00.000Z')
    expect(iso(end)).toBe('2025-02-28T00:00:00.000Z')
  })

  it('carries the clamp forward — a clamped start rolls to the real next-month day', () => {
    // anchor 31st, now Mar 5 → current cycle is [Feb28, Mar31).
    const anchor = new Date(Date.UTC(2025, 0, 31))
    const { start, end } = currentMonthlyPeriod(anchor, new Date(Date.UTC(2025, 2, 5)))
    expect(iso(start)).toBe('2025-02-28T00:00:00.000Z')
    expect(iso(end)).toBe('2025-03-31T00:00:00.000Z')
  })

  it('honors leap-year February for an end-of-month anchor', () => {
    const anchor = new Date(Date.UTC(2024, 0, 31))
    const { start, end } = currentMonthlyPeriod(anchor, new Date(Date.UTC(2024, 1, 15)))
    expect(iso(start)).toBe('2024-01-31T00:00:00.000Z')
    expect(iso(end)).toBe('2024-02-29T00:00:00.000Z')
  })

  it('treats the anniversary instant as the start of the new cycle (start inclusive)', () => {
    const anchor = new Date(Date.UTC(2025, 0, 15))
    const { start, end } = currentMonthlyPeriod(anchor, new Date(Date.UTC(2025, 0, 15)))
    expect(iso(start)).toBe('2025-01-15T00:00:00.000Z')
    expect(iso(end)).toBe('2025-02-15T00:00:00.000Z')
  })

  it('rolls a December anchor into the next calendar year', () => {
    const anchor = new Date(Date.UTC(2024, 11, 20))
    const { start, end } = currentMonthlyPeriod(anchor, new Date(Date.UTC(2024, 11, 25)))
    expect(iso(start)).toBe('2024-12-20T00:00:00.000Z')
    expect(iso(end)).toBe('2025-01-20T00:00:00.000Z')
  })

  it('always satisfies start <= now < end', () => {
    const anchor = new Date(Date.UTC(2023, 5, 30, 9, 0, 0))
    for (const now of [
      new Date(Date.UTC(2025, 1, 1)),
      new Date(Date.UTC(2025, 1, 28)),
      new Date(Date.UTC(2025, 11, 31, 23, 59)),
      new Date(Date.UTC(2024, 2, 30)),
    ]) {
      const { start, end } = currentMonthlyPeriod(anchor, now)
      expect(start.getTime()).toBeLessThanOrEqual(now.getTime())
      expect(end.getTime()).toBeGreaterThan(now.getTime())
    }
  })
})
