import { describe, expect, it } from 'vitest'
import { buildPlanFeatureRows, seedEntitlements } from './seed-entitlements'
import { ADDONS, FEATURES, PLAN_SLUGS } from './entitlements-catalog'
import {
  addonCatalog,
  featureGroups,
  features,
  planFeatures,
  planPrices,
  plans,
} from '../schema'

describe('buildPlanFeatureRows (pure typed-value encoding)', () => {
  const rows = buildPlanFeatureRows()
  const at = (feature: string, plan: string) =>
    rows.find((r) => r.featureSlug === feature && r.planSlug === plan)!

  it('expands to one row per feature × plan', () => {
    expect(rows).toHaveLength(FEATURES.length * PLAN_SLUGS.length)
  })

  it('encodes a limit into value_numeric only', () => {
    expect(at('records_under_management', 'lite')).toMatchObject({
      valueBool: null, valueNumeric: 250_000, valueEnum: null,
    })
  })

  it('encodes fair use (Max restores) as a null numeric', () => {
    expect(at('restores_monthly', 'max')).toMatchObject({
      valueBool: null, valueNumeric: null, valueEnum: null,
    })
  })

  it('encodes an enum into value_enum only', () => {
    expect(at('backup_frequency_max', 'lite')).toMatchObject({
      valueBool: null, valueNumeric: null, valueEnum: 'monthly',
    })
  })

  it('encodes a boolean into value_bool only', () => {
    expect(at('byo_ai_key', 'lite')).toMatchObject({
      valueBool: false, valueNumeric: null, valueEnum: null,
    })
    expect(at('byo_ai_key', 'plus')).toMatchObject({ valueBool: true })
  })
})

describe('seedEntitlements applies the full catalog idempotently', () => {
  // Stateful fake: records inserts per table; select returns them with synthetic ids.
  function makeFakeDb() {
    const store = new Map<unknown, Array<Record<string, unknown>>>()
    const rowsFor = (t: unknown) => {
      if (!store.has(t)) store.set(t, [])
      return store.get(t)!
    }
    const db = {
      insert(table: unknown) {
        return {
          values(v: Record<string, unknown>) {
            rowsFor(table).push(v)
            return { onConflictDoNothing: () => Promise.resolve() }
          },
        }
      },
      select() {
        return {
          from(table: unknown) {
            return Promise.resolve(
              rowsFor(table).map((v, i) => ({ id: `${(v.slug as string) ?? i}-id`, slug: String(v.slug) })),
            )
          },
        }
      },
    }
    return { db, store, rowsFor }
  }

  it('inserts every group, feature, plan, price, plan_feature, and add-on', async () => {
    const { db, rowsFor } = makeFakeDb()
    await seedEntitlements(db)

    expect(rowsFor(featureGroups)).toHaveLength(7)
    expect(rowsFor(features)).toHaveLength(FEATURES.length)
    expect(rowsFor(plans)).toHaveLength(6)
    // 4 public plans × 2 periods + trial monthly (free) + enterprise (custom, none).
    expect(rowsFor(planPrices)).toHaveLength(9)
    expect(rowsFor(planFeatures)).toHaveLength(FEATURES.length * PLAN_SLUGS.length)
    expect(rowsFor(addonCatalog)).toHaveLength(ADDONS.length)
  })
})
