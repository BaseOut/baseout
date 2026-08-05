import { describe, expect, it } from 'vitest'
import { enumRank } from '@baseout/db-schema'
import {
  ADDONS,
  FEATURES,
  FEATURE_GROUPS,
  PLANS,
  PLAN_SLUGS,
  type FeatureSeed,
  type PlanSlug,
} from './entitlements-catalog'

const PUBLIC_LADDER: PlanSlug[] = ['lite', 'core', 'plus', 'max']
const featureBySlug = (slug: string) => FEATURES.find((f) => f.slug === slug)!
const groupSlugs = new Set(FEATURE_GROUPS.map((g) => g.slug))

// A limit's magnitude for monotonicity: null (fair use) ranks highest.
function limitMagnitude(v: { type: string; limit?: number | null }): number {
  if (v.type !== 'limit') throw new Error('not a limit')
  return v.limit === null ? Number.POSITIVE_INFINITY : (v.limit as number)
}

describe('catalog structural integrity', () => {
  it('has the 7 pricing groups and 6 plans', () => {
    expect(FEATURE_GROUPS).toHaveLength(7)
    expect(PLANS.map((p) => p.slug).sort()).toEqual([...PLAN_SLUGS].sort())
  })

  it('feature slugs are unique and every feature belongs to a real group', () => {
    const slugs = FEATURES.map((f) => f.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const f of FEATURES) expect(groupSlugs.has(f.group)).toBe(true)
  })

  it('every feature has a typed value for every plan, matching its value_type', () => {
    for (const f of FEATURES) {
      for (const plan of PLAN_SLUGS) {
        const v = f.values[plan]
        expect(v, `${f.slug}/${plan}`).toBeDefined()
        expect(v.type, `${f.slug}/${plan}`).toBe(f.valueType)
        if (v.type === 'enum') {
          // Never string-compares: value must be a ladder member.
          expect(() => enumRank(f.enumValues!, v.enum)).not.toThrow()
        }
      }
    }
  })

  it('meterable limit features carry a meter_kind; enum/boolean features do not need one', () => {
    for (const f of FEATURES) {
      if (f.meterable) expect(f.meterKind, f.slug).toBeDefined()
      if (f.meterKind) expect(['flow', 'stock', 'creation']).toContain(f.meterKind)
    }
  })
})

describe('matrix values match the pricing guide (§3)', () => {
  // Independent transcription of the guide headline numbers — drift between this
  // and the seed fails the build.
  const SPOT: Array<[string, PlanSlug, number | null]> = [
    ['records_under_management', 'lite', 250_000],
    ['records_under_management', 'max', 5_000_000],
    ['file_storage_gb', 'core', 250],
    ['file_storage_gb', 'max', 1500],
    ['ai_credits_monthly', 'lite', 200],
    ['ai_credits_monthly', 'max', 15000],
    ['bases_under_management', 'plus', 150],
    ['spaces', 'core', 10],
    ['database_size_gb', 'plus', 25],
    ['seats', 'max', 25],
    ['restores_monthly', 'lite', 3],
    ['restores_monthly', 'max', null], // fair use
    ['monthly_call_allowance', 'plus', 250_000],
    ['schema_history_retention_days', 'core', 180],
  ]

  it('spot-checks headline limit values', () => {
    for (const [slug, plan, expected] of SPOT) {
      const v = featureBySlug(slug).values[plan]
      expect(v.type).toBe('limit')
      expect((v as { limit: number | null }).limit, `${slug}/${plan}`).toBe(expected)
    }
  })

  it('enum gates match the guide', () => {
    expect((featureBySlug('backup_frequency_max').values.lite as { enum: string }).enum).toBe('monthly')
    expect((featureBySlug('backup_frequency_max').values.max as { enum: string }).enum).toBe('instant')
    expect((featureBySlug('backup_frequency_max').values.trial as { enum: string }).enum).toBe('one_time')
    expect((featureBySlug('database_isolation_class').values.plus as { enum: string }).enum).toBe('dedicated_cluster')
    expect((featureBySlug('support_level').values.max as { enum: string }).enum).toBe('priority_chat')
    expect((featureBySlug('support_level').values.enterprise as { enum: string }).enum).toBe('csm_sla')
  })

  it('metered limits are non-decreasing across lite → core → plus → max', () => {
    const metered = FEATURES.filter((f) => f.valueType === 'limit' && f.meterable)
    for (const f of metered) {
      const mags = PUBLIC_LADDER.map((p) => limitMagnitude(f.values[p] as { type: string; limit: number | null }))
      for (let i = 1; i < mags.length; i++) {
        expect(mags[i], `${f.slug} @ ${PUBLIC_LADDER[i]}`).toBeGreaterThanOrEqual(mags[i - 1])
      }
    }
  })

  it('enum gates are non-decreasing in rank across lite → core → plus → max', () => {
    const enums = FEATURES.filter((f: FeatureSeed) => f.valueType === 'enum')
    for (const f of enums) {
      const ranks = PUBLIC_LADDER.map((p) => enumRank(f.enumValues!, (f.values[p] as { enum: string }).enum))
      for (let i = 1; i < ranks.length; i++) {
        expect(ranks[i], `${f.slug} @ ${PUBLIC_LADDER[i]}`).toBeGreaterThanOrEqual(ranks[i - 1])
      }
    }
  })

  it('always-on features are true on every plan', () => {
    const allOn = [
      'internal_snapshots', 'mcp_access', 'automations_interfaces_backup',
      'comments_backup', 'api_access', 'sso_saml', 'pii_detection', 'direct_sql_access',
    ]
    for (const slug of allOn) {
      for (const plan of PLAN_SLUGS) {
        expect((featureBySlug(slug).values[plan] as { bool: boolean }).bool, `${slug}/${plan}`).toBe(true)
      }
    }
  })

  it('trial mirrors Lite except the one-time backup frequency', () => {
    for (const f of FEATURES) {
      if (f.slug === 'backup_frequency_max') continue
      expect(f.values.trial, f.slug).toEqual(f.values.lite)
    }
  })
})

describe('plan prices match the guide (§1)', () => {
  const EXPECTED: Record<string, [number | null, number | null]> = {
    lite: [4900, 49900],
    core: [9900, 99900],
    plus: [19900, 199900],
    max: [39900, 399900],
  }
  it('public plan monthly/annual cents are correct', () => {
    for (const [slug, [m, a]] of Object.entries(EXPECTED)) {
      const p = PLANS.find((x) => x.slug === slug)!
      expect(p.monthlyCents).toBe(m)
      expect(p.annualCents).toBe(a)
    }
  })
})

describe('add-on library (§6)', () => {
  it('has 12 recurring ($10) + 3 one-time ($12) add-ons, each on a real feature', () => {
    const recurring = ADDONS.filter((a) => a.kind === 'recurring')
    const oneTime = ADDONS.filter((a) => a.kind === 'one_time')
    expect(recurring).toHaveLength(12)
    expect(oneTime).toHaveLength(3)
    for (const a of recurring) expect(a.priceCents).toBe(1000)
    for (const a of oneTime) expect(a.priceCents).toBe(1200)
    const validFeatures = new Set(FEATURES.map((f) => f.slug))
    for (const a of ADDONS) expect(validFeatures.has(a.featureSlug), a.slug).toBe(true)
  })

  it('add-on slugs are unique', () => {
    const slugs = ADDONS.map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})
