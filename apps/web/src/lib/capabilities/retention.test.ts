import { describe, it, expect } from 'vitest'
import {
  resolveRetentionPolicy,
  parseRetentionPatchPayload,
} from './retention'
import type { Tier } from './tier-capabilities'

// The resolver's per-tier DEFAULT values must match apps/server's getDefaultPolicy
// (a backfilled policy row == the resolver default), per Features §6.9 + §3.
// It additionally carries editable-knob metadata for the settings UI + PATCH bounds.

describe('resolveRetentionPolicy', () => {
  it('starter → basic, keepLastN 10 editable 1–30', () => {
    expect(resolveRetentionPolicy('starter')).toEqual({
      tier: 'basic',
      keepLastN: 10,
      knobs: { keepLastN: { editable: true, min: 1, max: 30, default: 10 } },
    })
  })

  it('null (trial / no subscription) inherits the starter policy', () => {
    expect(resolveRetentionPolicy(null)).toEqual(resolveRetentionPolicy('starter'))
  })

  it('launch → time_based, dailyWindowDays 30 editable 7–90', () => {
    expect(resolveRetentionPolicy('launch')).toEqual({
      tier: 'time_based',
      dailyWindowDays: 30,
      knobs: { dailyWindowDays: { editable: true, min: 7, max: 90, default: 30 } },
    })
  })

  it('growth → two_tier, daily 30 + weekly 120, both editable', () => {
    const p = resolveRetentionPolicy('growth')
    expect(p.tier).toBe('two_tier')
    expect(p).toMatchObject({ dailyWindowDays: 30, weeklyWindowDays: 120 })
    expect(p.knobs).toEqual({
      dailyWindowDays: { editable: true, min: 7, max: 90, default: 30 },
      weeklyWindowDays: { editable: true, min: 30, max: 180, default: 120 },
    })
  })

  it('pro → three_tier, daily 30 + weekly 120 + monthlyIndefinite', () => {
    expect(resolveRetentionPolicy('pro')).toEqual({
      tier: 'three_tier',
      dailyWindowDays: 30,
      weeklyWindowDays: 120,
      monthlyIndefinite: true,
      knobs: {
        dailyWindowDays: { editable: true, min: 7, max: 90, default: 30 },
        weeklyWindowDays: { editable: true, min: 30, max: 180, default: 120 },
      },
    })
  })

  it('business + enterprise → custom (no numeric knobs in first pass)', () => {
    expect(resolveRetentionPolicy('business')).toEqual({ tier: 'custom', knobs: {} })
    expect(resolveRetentionPolicy('enterprise')).toEqual({ tier: 'custom', knobs: {} })
  })

  it('every tier resolves', () => {
    const tiers: (Tier | null)[] = [
      'starter', 'launch', 'growth', 'pro', 'business', 'enterprise', null,
    ]
    for (const t of tiers) expect(resolveRetentionPolicy(t).tier).toBeTruthy()
  })
})

describe('parseRetentionPatchPayload', () => {
  it('accepts an in-bounds basic keepLastN and returns the stored values', () => {
    const r = parseRetentionPatchPayload('starter', { keepLastN: 20 })
    expect(r).toEqual({ ok: true, values: { tier: 'basic', keepLastN: 20 } })
  })

  it('rejects a knob below its min', () => {
    const r = parseRetentionPatchPayload('starter', { keepLastN: 0 })
    expect(r).toEqual({ ok: false, field: 'keepLastN' })
  })

  it('rejects a knob above its max', () => {
    const r = parseRetentionPatchPayload('launch', { dailyWindowDays: 365 })
    expect(r).toEqual({ ok: false, field: 'dailyWindowDays' })
  })

  it('rejects a non-integer knob', () => {
    const r = parseRetentionPatchPayload('starter', { keepLastN: 5.5 })
    expect(r).toEqual({ ok: false, field: 'keepLastN' })
  })

  it('validates two_tier with both windows in bounds', () => {
    const r = parseRetentionPatchPayload('growth', {
      dailyWindowDays: 14,
      weeklyWindowDays: 90,
    })
    expect(r).toEqual({
      ok: true,
      values: { tier: 'two_tier', dailyWindowDays: 14, weeklyWindowDays: 90 },
    })
  })

  it('three_tier always carries monthlyIndefinite=true in stored values', () => {
    const r = parseRetentionPatchPayload('pro', {
      dailyWindowDays: 30,
      weeklyWindowDays: 120,
    })
    expect(r).toEqual({
      ok: true,
      values: {
        tier: 'three_tier',
        dailyWindowDays: 30,
        weeklyWindowDays: 120,
        monthlyIndefinite: true,
      },
    })
  })

  it('custom accepts free-form JSON rules', () => {
    const r = parseRetentionPatchPayload('business', { customRules: { keep: 'all' } })
    expect(r).toEqual({
      ok: true,
      values: { tier: 'custom', customRules: { keep: 'all' } },
    })
  })

  it('falls back to the tier default when a knob is omitted', () => {
    const r = parseRetentionPatchPayload('starter', {})
    expect(r).toEqual({ ok: true, values: { tier: 'basic', keepLastN: 10 } })
  })
})
