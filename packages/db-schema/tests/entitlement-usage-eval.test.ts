import { describe, expect, it } from 'vitest'
import { evaluateUsage } from '../src/entitlements/usage-eval'
import type { EntitlementMap, ResolvedFeature } from '../src/entitlements/resolve'

// ── Test fixtures: build a minimal resolved entitlement map ──

function limitFeature(slug: string, limit: number | null): ResolvedFeature {
  return {
    slug,
    valueType: 'limit',
    enumValues: null,
    meterable: true,
    meterKind: 'stock',
    planValue: { type: 'limit', limit },
    overrideValue: null,
    addonBonus: 0,
    effective: { type: 'limit', limit },
  }
}

function boolFeature(slug: string, bool: boolean): ResolvedFeature {
  return {
    slug,
    valueType: 'boolean',
    enumValues: null,
    meterable: false,
    meterKind: null,
    planValue: { type: 'boolean', bool },
    overrideValue: null,
    addonBonus: 0,
    effective: { type: 'boolean', bool },
  }
}

function mapOf(...features: ResolvedFeature[]): EntitlementMap {
  const map: EntitlementMap = {}
  for (const f of features) map[f.slug] = f
  return map
}

describe('evaluateUsage — partitions changed vs fired', () => {
  const entitlements = mapOf(limitFeature('records_under_management', 1000))

  it('crossing 90% marks the feature changed AND fires a warning', () => {
    const r = evaluateUsage({
      entitlements,
      usage: [{ featureSlug: 'records_under_management', used: 920 }],
      states: [{ featureSlug: 'records_under_management', state: 'ok' }],
    })
    expect(r.evaluations).toHaveLength(1)
    expect(r.evaluations[0]).toMatchObject({
      featureSlug: 'records_under_management',
      previous: 'ok',
      next: 'warned_90',
      fired: 'warning',
    })
    expect(r.changed.map((e) => e.featureSlug)).toEqual(['records_under_management'])
    expect(r.notifications.map((e) => e.featureSlug)).toEqual(['records_under_management'])
  })

  it('re-evaluating within the same tier changes nothing and fires nothing (dedupe)', () => {
    const r = evaluateUsage({
      entitlements,
      usage: [{ featureSlug: 'records_under_management', used: 950 }],
      states: [{ featureSlug: 'records_under_management', state: 'warned_90' }],
    })
    expect(r.evaluations[0].next).toBe('warned_90')
    expect(r.changed).toHaveLength(0)
    expect(r.notifications).toHaveLength(0)
  })

  it('de-escalation below the hysteresis band persists the drop but does NOT re-notify', () => {
    const r = evaluateUsage({
      entitlements,
      usage: [{ featureSlug: 'records_under_management', used: 500 }], // 50% < 0.85 band
      states: [{ featureSlug: 'records_under_management', state: 'warned_90' }],
    })
    expect(r.evaluations[0]).toMatchObject({ next: 'ok', fired: 'none' })
    expect(r.changed.map((e) => e.featureSlug)).toEqual(['records_under_management']) // ok != warned_90
    expect(r.notifications).toHaveLength(0)
  })

  it('missing persisted state defaults to ok', () => {
    const r = evaluateUsage({
      entitlements,
      usage: [{ featureSlug: 'records_under_management', used: 920 }],
      // no states array
    })
    expect(r.evaluations[0].previous).toBe('ok')
    expect(r.evaluations[0].fired).toBe('warning')
  })
})

describe('evaluateUsage — enforcement posture', () => {
  const entitlements = mapOf(limitFeature('api_calls', 100))

  it('flag off (default): 100% → warned_100, fires a warning', () => {
    const r = evaluateUsage({
      entitlements,
      usage: [{ featureSlug: 'api_calls', used: 100 }],
      states: [{ featureSlug: 'api_calls', state: 'warned_90' }],
    })
    expect(r.evaluations[0]).toMatchObject({ next: 'warned_100', fired: 'warning' })
  })

  it('flag on: 100% → enforced, fires enforcement', () => {
    const r = evaluateUsage({
      entitlements,
      usage: [{ featureSlug: 'api_calls', used: 100 }],
      states: [{ featureSlug: 'api_calls', state: 'warned_90' }],
      enforcementEnabled: true,
    })
    expect(r.evaluations[0]).toMatchObject({ next: 'enforced', fired: 'enforcement' })
  })
})

describe('evaluateUsage — non-metered inputs are skipped', () => {
  it('skips a feature absent from the entitlement map', () => {
    const r = evaluateUsage({
      entitlements: mapOf(limitFeature('records_under_management', 1000)),
      usage: [{ featureSlug: 'not_a_feature', used: 999 }],
    })
    expect(r.evaluations).toHaveLength(0)
    expect(r.changed).toHaveLength(0)
    expect(r.notifications).toHaveLength(0)
  })

  it('skips a boolean/enum (non-limit) feature — it has no numeric cap to evaluate', () => {
    const r = evaluateUsage({
      entitlements: mapOf(boolFeature('byo_ai_key', true)),
      usage: [{ featureSlug: 'byo_ai_key', used: 5 }],
    })
    expect(r.evaluations).toHaveLength(0)
  })
})

describe('evaluateUsage — fair-use (unlimited) limits', () => {
  it('never warns/enforces and resets a stale state to ok without notifying', () => {
    const r = evaluateUsage({
      entitlements: mapOf(limitFeature('restores', null)), // fair use
      usage: [{ featureSlug: 'restores', used: 9_999_999 }],
      states: [{ featureSlug: 'restores', state: 'warned_90' }],
    })
    expect(r.evaluations[0]).toMatchObject({ next: 'ok', fired: 'none', limit: null })
    expect(r.changed.map((e) => e.featureSlug)).toEqual(['restores']) // stale state cleared
    expect(r.notifications).toHaveLength(0)
  })
})

describe('evaluateUsage — multiple features in one pass', () => {
  it('evaluates each independently and partitions correctly', () => {
    const entitlements = mapOf(
      limitFeature('records_under_management', 1000),
      limitFeature('file_storage_gb', 10),
      limitFeature('api_calls', 100),
    )
    const r = evaluateUsage({
      entitlements,
      usage: [
        { featureSlug: 'records_under_management', used: 950 }, // → warned_90 (fires)
        { featureSlug: 'file_storage_gb', used: 2 }, // 20% → ok (no change)
        { featureSlug: 'api_calls', used: 100 }, // 100%, flag on → enforced (fires)
      ],
      states: [
        { featureSlug: 'records_under_management', state: 'ok' },
        { featureSlug: 'file_storage_gb', state: 'ok' },
        { featureSlug: 'api_calls', state: 'warned_100' },
      ],
      enforcementEnabled: true,
    })
    expect(r.evaluations).toHaveLength(3)
    expect(r.changed.map((e) => e.featureSlug).sort()).toEqual([
      'api_calls',
      'records_under_management',
    ])
    expect(r.notifications.map((e) => e.featureSlug).sort()).toEqual([
      'api_calls',
      'records_under_management',
    ])
  })
})
