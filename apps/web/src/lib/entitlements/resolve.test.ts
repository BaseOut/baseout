import { describe, expect, it } from 'vitest'
import { getBool, getEnum, getLimit } from '@baseout/db-schema'
import type { AppDb } from '../../db'
import { resolveEntitlements } from './resolve'

// A chainable fake: every builder method returns the same thenable, which
// resolves to the next preset result set in call order (plan → planFeatures →
// overrides → addons). Lets us exercise the real query→compose wiring with no DB.
function makeFakeDb(resultSets: unknown[][]): AppDb {
  let i = 0
  const chain: Record<string, unknown> = {}
  const passthrough = () => chain
  chain.from = passthrough
  chain.innerJoin = passthrough
  chain.where = passthrough
  chain.limit = passthrough
  chain.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
    Promise.resolve(resultSets[i++]).then(onF, onR)
  return { select: () => chain } as unknown as AppDb
}

const FREQUENCY = ['one_time', 'monthly', 'weekly', 'daily', 'instant']

describe('resolveEntitlements (query wrapper)', () => {
  it('returns null when the org has no plan-carrying subscription', async () => {
    const db = makeFakeDb([[]]) // empty plan lookup
    expect(await resolveEntitlements(db, 'org_1')).toBeNull()
  })

  it('composes plan values, an override, and an add-on end to end', async () => {
    const db = makeFakeDb([
      [{ planId: 'plan_core', planSlug: 'core' }],
      [
        { slug: 'spaces', valueType: 'limit', enumValues: null, meterable: true, meterKind: 'creation', valueBool: null, valueNumeric: '10', valueEnum: null },
        { slug: 'byo_ai_key', valueType: 'boolean', enumValues: null, meterable: false, meterKind: null, valueBool: false, valueNumeric: null, valueEnum: null },
        { slug: 'backup_frequency_max', valueType: 'enum', enumValues: FREQUENCY, meterable: false, meterKind: null, valueBool: null, valueNumeric: null, valueEnum: 'weekly' },
      ],
      // Override spaces → 25
      [{ featureSlug: 'spaces', valueBool: null, valueNumeric: '25', valueEnum: null, expiresAt: null }],
      // +2 spaces add-on
      [{ featureSlug: 'spaces', unitQuantity: '1', quantity: 2, status: 'active', expiresAt: null }],
    ])

    const res = await resolveEntitlements(db, 'org_1')
    expect(res).not.toBeNull()
    expect(res!.planSlug).toBe('core')
    // override (25) + add-on (2×1) = 27
    expect(getLimit(res!.entitlements, 'spaces')).toBe(27)
    expect(res!.entitlements.spaces.overrideValue).toEqual({ type: 'limit', limit: 25 })
    expect(res!.entitlements.spaces.addonBonus).toBe(2)
    expect(getBool(res!.entitlements, 'byo_ai_key')).toBe(false)
    expect(getEnum(res!.entitlements, 'backup_frequency_max')).toBe('weekly')
  })
})
