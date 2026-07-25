/**
 * Pure-logic tests for the FrequencyPicker component's decision helpers
 * (web-instant-webhook). The component (.astro) stays thin; everything
 * testable lives in ./frequency-picker.ts:
 *
 *   - instantLockReason: why Instant is locked ('tier' | 'dynamic_db' | null)
 *   - lockReasonCopy: customer-facing copy per lock reason
 *   - intervalChoices: tier-clamped poll-interval options
 *   - formatIntervalSeconds: seconds → human label
 *   - describeFrequencySaveError: SaveConfigResult → inline message + whether
 *     to revert the selection (cap reached ⇒ revert, per the spec scenario)
 */

import { describe, expect, it } from 'vitest'
import {
  INTERVAL_CHOICES,
  describeFrequencySaveError,
  formatIntervalSeconds,
  instantLockReason,
  intervalChoices,
  lockReasonCopy,
} from './frequency-picker'

describe('instantLockReason', () => {
  it('returns null when the tier allows Instant and the dynamic DB is ready', () => {
    expect(
      instantLockReason({ tierAllowsInstant: true, dynamicDbReady: true }),
    ).toBeNull()
  })

  it('locks by tier when the tier disallows Instant (tier wins over db)', () => {
    expect(
      instantLockReason({ tierAllowsInstant: false, dynamicDbReady: true }),
    ).toBe('tier')
    expect(
      instantLockReason({ tierAllowsInstant: false, dynamicDbReady: false }),
    ).toBe('tier')
  })

  it('locks by dynamic_db when the tier allows but the DB is not ready', () => {
    expect(
      instantLockReason({ tierAllowsInstant: true, dynamicDbReady: false }),
    ).toBe('dynamic_db')
  })
})

describe('lockReasonCopy', () => {
  it('explains the tier lock with an upgrade nudge', () => {
    expect(lockReasonCopy('tier')).toMatch(/Pro/)
  })

  it('explains the dynamic-DB lock', () => {
    expect(lockReasonCopy('dynamic_db')).toMatch(/dynamic database/i)
  })
})

describe('formatIntervalSeconds', () => {
  it('formats minutes and hours', () => {
    expect(formatIntervalSeconds(60)).toBe('1 minute')
    expect(formatIntervalSeconds(300)).toBe('5 minutes')
    expect(formatIntervalSeconds(900)).toBe('15 minutes')
    expect(formatIntervalSeconds(3600)).toBe('1 hour')
  })
})

describe('intervalChoices', () => {
  it('offers only choices at or above the tier minimum', () => {
    expect(intervalChoices(900).map((c) => c.value)).toEqual(['900', '1800', '3600'])
    expect(intervalChoices(300).map((c) => c.value)).toEqual(['300', '900', '1800', '3600'])
    expect(intervalChoices(60).map((c) => c.value)).toEqual(
      INTERVAL_CHOICES.map(String),
    )
  })

  it('labels choices with the human interval', () => {
    expect(intervalChoices(900)[0]).toEqual({ value: '900', label: 'Every 15 minutes' })
  })

  it('includes an off-preset current value so a saved custom interval is not lost', () => {
    expect(intervalChoices(900, 1200).map((c) => c.value)).toEqual([
      '900',
      '1200',
      '1800',
      '3600',
    ])
  })
})

describe('describeFrequencySaveError', () => {
  it('returns null on success', () => {
    expect(describeFrequencySaveError({ ok: true })).toBeNull()
  })

  it('cap reached ⇒ revert + explains the org cap (spec scenario)', () => {
    const out = describeFrequencySaveError({
      ok: false,
      error: 'airtable_webhook_cap_reached',
      status: 409,
    })
    expect(out?.revert).toBe(true)
    expect(out?.message).toMatch(/maximum number of organizations/i)
  })

  it('below minimum ⇒ keep edits (no revert) + names the tier minimum', () => {
    const out = describeFrequencySaveError({
      ok: false,
      error: 'webhook_poll_interval_below_minimum',
      status: 422,
      minimum: 900,
    })
    expect(out?.revert).toBe(false)
    expect(out?.message).toMatch(/15 minutes/)
  })

  it('below minimum without an echoed minimum still renders a message', () => {
    const out = describeFrequencySaveError({
      ok: false,
      error: 'webhook_poll_interval_below_minimum',
      status: 422,
    })
    expect(out?.revert).toBe(false)
    expect(out?.message).toMatch(/minimum/i)
  })

  it('dynamic_db_not_ready ⇒ revert + explains the wait', () => {
    const out = describeFrequencySaveError({
      ok: false,
      error: 'dynamic_db_not_ready',
      status: 422,
    })
    expect(out?.revert).toBe(true)
    expect(out?.message).toMatch(/dynamic database/i)
  })

  it('frequency_not_allowed ⇒ revert + plan copy', () => {
    const out = describeFrequencySaveError({
      ok: false,
      error: 'frequency_not_allowed',
      status: 422,
    })
    expect(out?.revert).toBe(true)
    expect(out?.message).toMatch(/plan/i)
  })

  it('unknown / transport errors ⇒ generic retry copy, no revert', () => {
    for (const error of ['network', 'unknown'] as const) {
      const out = describeFrequencySaveError({ ok: false, error, status: 0 })
      expect(out?.revert).toBe(false)
      expect(out?.message).toMatch(/try again/i)
    }
  })
})
