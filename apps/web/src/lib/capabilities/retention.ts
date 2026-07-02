/**
 * Retention-policy capability resolver (openspec/changes/server-retention-and-cleanup
 * Phase B/E — the web half). Resolves the per-tier default policy + the editable-knob
 * metadata the settings UI renders and the PATCH route validates against. The DEFAULT
 * values mirror apps/server's getDefaultPolicy (a backfilled policy row equals this
 * resolver default), per Features §6.9 (policy ladder) + §3 (retention windows).
 *
 * Trial is not a tier (it inherits Starter, Features §5.5.4); a null tier resolves to
 * the Starter policy. Trial-run aggressiveness lives at the run level (is_trial → 7-day
 * cap in the engine's decideDeletions), not here.
 *
 * `custom` (Business/Enterprise) renders a free-form JSON editor in the first pass —
 * no numeric knobs. A rich rule editor is the deferred `server-retention-custom-editor`.
 */

import type { Tier } from './tier-capabilities'
import type { RetentionPolicyTier } from '../../db/schema/core'

export interface NumericKnob {
  editable: boolean
  min?: number
  max?: number
  default: number
}

export type RetentionPolicy =
  | { tier: 'basic'; keepLastN: number; knobs: { keepLastN: NumericKnob } }
  | {
      tier: 'time_based'
      dailyWindowDays: number
      knobs: { dailyWindowDays: NumericKnob }
    }
  | {
      tier: 'two_tier'
      dailyWindowDays: number
      weeklyWindowDays: number
      knobs: { dailyWindowDays: NumericKnob; weeklyWindowDays: NumericKnob }
    }
  | {
      tier: 'three_tier'
      dailyWindowDays: number
      weeklyWindowDays: number
      monthlyIndefinite: boolean
      knobs: { dailyWindowDays: NumericKnob; weeklyWindowDays: NumericKnob }
    }
  | { tier: 'custom'; knobs: Record<string, never> }

/** The persisted policy values written to backup_retention_policies (no knob metadata). */
export interface RetentionPolicyValues {
  tier: RetentionPolicyTier
  keepLastN?: number
  dailyWindowDays?: number
  weeklyWindowDays?: number
  monthlyIndefinite?: boolean
  customRules?: unknown
}

const DAILY_KNOB: NumericKnob = { editable: true, min: 7, max: 90, default: 30 }
const WEEKLY_KNOB: NumericKnob = { editable: true, min: 30, max: 180, default: 120 }

const POLICIES: Record<Tier, RetentionPolicy> = {
  starter: {
    tier: 'basic',
    keepLastN: 10,
    knobs: { keepLastN: { editable: true, min: 1, max: 30, default: 10 } },
  },
  launch: {
    tier: 'time_based',
    dailyWindowDays: 30,
    knobs: { dailyWindowDays: DAILY_KNOB },
  },
  growth: {
    tier: 'two_tier',
    dailyWindowDays: 30,
    weeklyWindowDays: 120,
    knobs: { dailyWindowDays: DAILY_KNOB, weeklyWindowDays: WEEKLY_KNOB },
  },
  pro: {
    tier: 'three_tier',
    dailyWindowDays: 30,
    weeklyWindowDays: 120,
    monthlyIndefinite: true,
    knobs: { dailyWindowDays: DAILY_KNOB, weeklyWindowDays: WEEKLY_KNOB },
  },
  business: { tier: 'custom', knobs: {} },
  enterprise: { tier: 'custom', knobs: {} },
}

export function resolveRetentionPolicy(tier: Tier | null): RetentionPolicy {
  return tier ? POLICIES[tier] : POLICIES.starter
}

export type RetentionPatchResult =
  | { ok: true; values: RetentionPolicyValues }
  | { ok: false; field: string }

/** Read an incoming numeric knob against its bounds; null on absent (→ default). */
function readKnob(
  raw: Record<string, unknown>,
  key: string,
  knob: NumericKnob,
): { ok: true; value: number } | { ok: false } {
  const v = raw[key]
  if (v === undefined) return { ok: true, value: knob.default }
  if (typeof v !== 'number' || !Number.isInteger(v)) return { ok: false }
  if (knob.min !== undefined && v < knob.min) return { ok: false }
  if (knob.max !== undefined && v > knob.max) return { ok: false }
  return { ok: true, value: v }
}

/**
 * Validate a PATCH payload against the tier's capability knobs, returning the
 * persisted values or the first out-of-range field. Omitted knobs fall back to
 * the tier default so a partial PATCH is well-defined.
 */
export function parseRetentionPatchPayload(
  tier: Tier | null,
  raw: Record<string, unknown>,
): RetentionPatchResult {
  const policy = resolveRetentionPolicy(tier)

  switch (policy.tier) {
    case 'basic': {
      const n = readKnob(raw, 'keepLastN', policy.knobs.keepLastN)
      if (!n.ok) return { ok: false, field: 'keepLastN' }
      return { ok: true, values: { tier: 'basic', keepLastN: n.value } }
    }
    case 'time_based': {
      const d = readKnob(raw, 'dailyWindowDays', policy.knobs.dailyWindowDays)
      if (!d.ok) return { ok: false, field: 'dailyWindowDays' }
      return { ok: true, values: { tier: 'time_based', dailyWindowDays: d.value } }
    }
    case 'two_tier': {
      const d = readKnob(raw, 'dailyWindowDays', policy.knobs.dailyWindowDays)
      if (!d.ok) return { ok: false, field: 'dailyWindowDays' }
      const w = readKnob(raw, 'weeklyWindowDays', policy.knobs.weeklyWindowDays)
      if (!w.ok) return { ok: false, field: 'weeklyWindowDays' }
      return {
        ok: true,
        values: {
          tier: 'two_tier',
          dailyWindowDays: d.value,
          weeklyWindowDays: w.value,
        },
      }
    }
    case 'three_tier': {
      const d = readKnob(raw, 'dailyWindowDays', policy.knobs.dailyWindowDays)
      if (!d.ok) return { ok: false, field: 'dailyWindowDays' }
      const w = readKnob(raw, 'weeklyWindowDays', policy.knobs.weeklyWindowDays)
      if (!w.ok) return { ok: false, field: 'weeklyWindowDays' }
      return {
        ok: true,
        values: {
          tier: 'three_tier',
          dailyWindowDays: d.value,
          weeklyWindowDays: w.value,
          monthlyIndefinite: true,
        },
      }
    }
    case 'custom': {
      // First pass: free-form JSON. Accept whatever the editor sends; the rich
      // validator is the deferred server-retention-custom-editor.
      return {
        ok: true,
        values: { tier: 'custom', customRules: raw.customRules ?? null },
      }
    }
  }
}
