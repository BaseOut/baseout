import { describe, expect, it } from 'vitest'
import {
  evaluate,
  resetForNewPeriod,
  WARN_AT,
  ENFORCE_AT,
  HYSTERESIS,
  type UsageState,
} from '../src/entitlements/evaluate'

// Convenience: evaluate at an exact fraction of a fixed limit.
const at = (
  fraction: number,
  current: UsageState,
  enforcementEnabled = false,
) => evaluate({ used: fraction * 1000, limit: 1000, current, enforcementEnabled })

describe('evaluate — threshold tiers (from ok, escalating)', () => {
  it('stays ok below the warn threshold', () => {
    expect(at(0, 'ok')).toEqual({ next: 'ok', fired: 'none', pct: 0 })
    expect(at(0.5, 'ok').next).toBe('ok')
    expect(at(0.899, 'ok').next).toBe('ok')
  })

  it('crosses into warned_90 at exactly 90% and fires a warning', () => {
    const r = at(WARN_AT, 'ok')
    expect(r.next).toBe('warned_90')
    expect(r.fired).toBe('warning')
    expect(r.pct).toBeCloseTo(0.9)
  })

  it('warn-only posture (flag off): 100% → warned_100 fires a warning, not enforcement', () => {
    const r = at(ENFORCE_AT, 'warned_90', false)
    expect(r.next).toBe('warned_100')
    expect(r.fired).toBe('warning')
  })

  it('enforcing posture (flag on): 100% → enforced fires enforcement', () => {
    const r = at(ENFORCE_AT, 'warned_90', true)
    expect(r.next).toBe('enforced')
    expect(r.fired).toBe('enforcement')
  })

  it('over 100% behaves like 100% for the tier', () => {
    expect(at(1.5, 'warned_90', true).next).toBe('enforced')
    expect(at(3.0, 'ok', false).next).toBe('warned_100')
  })
})

describe('evaluate — transitions fire ONLY on escalation (dedupe)', () => {
  it('re-evaluating within the same tier fires nothing', () => {
    expect(at(0.92, 'warned_90').fired).toBe('none') // already warned
    expect(at(0.5, 'ok').fired).toBe('none')
    expect(at(1.2, 'enforced', true).fired).toBe('none') // already enforced
  })

  it('each upward step fires once: ok→warned_90→warned_100→enforced', () => {
    // ok → warned_90
    expect(at(0.9, 'ok').fired).toBe('warning')
    // warned_90 → warned_100 (flag off) still fires a warning
    expect(at(1.0, 'warned_90', false)).toMatchObject({ next: 'warned_100', fired: 'warning' })
    // warned_100 → enforced (flag flips on at 100%) fires enforcement
    expect(at(1.0, 'warned_100', true)).toMatchObject({ next: 'enforced', fired: 'enforcement' })
  })

  it('a jump straight past intermediate tiers fires the terminal notification', () => {
    // 0% → 200% in one sync, enforcing: lands enforced, fires enforcement
    expect(at(2.0, 'ok', true)).toMatchObject({ next: 'enforced', fired: 'enforcement' })
    // 0% → 95%, warn-only: lands warned_90, fires warning
    expect(at(0.95, 'ok', false)).toMatchObject({ next: 'warned_90', fired: 'warning' })
  })
})

describe('evaluate — hysteresis on de-escalation (no flapping / re-alerts)', () => {
  it('holds warned_90 in the band [0.85, 0.90) instead of dropping to ok', () => {
    // just under 90% but within the band → stay warned_90, fire nothing
    expect(at(0.88, 'warned_90')).toMatchObject({ next: 'warned_90', fired: 'none' })
    expect(at(WARN_AT - HYSTERESIS, 'warned_90').next).toBe('warned_90') // exactly 0.85 still holds
  })

  it('drops warned_90 → ok only once below the band (0.85)', () => {
    expect(at(0.84, 'warned_90')).toMatchObject({ next: 'ok', fired: 'none' })
  })

  it('holds the at-limit tier in [0.95, 1.00) instead of dropping to warned_90', () => {
    expect(at(0.97, 'enforced', true)).toMatchObject({ next: 'enforced', fired: 'none' })
    expect(at(0.97, 'warned_100', false)).toMatchObject({ next: 'warned_100', fired: 'none' })
  })

  it('drops the at-limit tier → warned_90 once below 0.95, without re-firing', () => {
    expect(at(0.94, 'enforced', true)).toMatchObject({ next: 'warned_90', fired: 'none' })
  })

  it('a big drop de-escalates straight to ok, firing nothing', () => {
    expect(at(0.1, 'enforced', true)).toMatchObject({ next: 'ok', fired: 'none' })
  })
})

describe('evaluate — fair-use (unlimited) and edge limits', () => {
  it('a null (fair-use) limit never leaves ok', () => {
    expect(evaluate({ used: 9_999_999, limit: null, current: 'enforced', enforcementEnabled: true })).toEqual({
      next: 'ok',
      fired: 'none',
      pct: 0,
    })
  })

  it('a zero limit with any usage is over-limit (∞ fraction)', () => {
    const r = evaluate({ used: 1, limit: 0, current: 'ok', enforcementEnabled: true })
    expect(r.next).toBe('enforced')
    expect(r.pct).toBe(Number.POSITIVE_INFINITY)
  })

  it('a zero limit with zero usage stays ok', () => {
    expect(evaluate({ used: 0, limit: 0, current: 'ok' }).next).toBe('ok')
  })

  it('enforcementEnabled defaults to false (warn-only) when omitted', () => {
    expect(evaluate({ used: 1000, limit: 1000, current: 'warned_90' }).next).toBe('warned_100')
  })
})

describe('resetForNewPeriod', () => {
  it('returns ok (period rollover clears the state machine)', () => {
    expect(resetForNewPeriod()).toBe('ok')
  })
})
