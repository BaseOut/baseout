import { describe, expect, it } from 'vitest'
import {
  applyOverrideWrite,
  validateOverrideValue,
  type OverrideFeatureDef,
  type OverrideUpsert,
} from '../src/entitlements/override'

const LIMIT = { valueType: 'limit' as const }
const ENUM = { valueType: 'enum' as const, enumValues: ['monthly', 'weekly', 'daily', 'instant'] }
const BOOL = { valueType: 'boolean' as const }

describe('validateOverrideValue', () => {
  it('requires a non-empty reason', () => {
    const r = validateOverrideValue(LIMIT, { value: { type: 'limit', limit: 5 }, reason: '   ' })
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/reason is required/) })
  })

  it('rejects a value whose type mismatches the feature', () => {
    const r = validateOverrideValue(LIMIT, { value: { type: 'boolean', bool: true }, reason: 'x' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/does not match feature type/)
  })

  it('accepts a valid limit and returns storage columns', () => {
    const r = validateOverrideValue(LIMIT, { value: { type: 'limit', limit: 25 }, reason: 'contract' })
    expect(r).toEqual({ ok: true, columns: { valueBool: null, valueNumeric: 25, valueEnum: null } })
  })

  it('accepts a fair-use (null) limit', () => {
    const r = validateOverrideValue(LIMIT, { value: { type: 'limit', limit: null }, reason: 'fair use' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.columns.valueNumeric).toBeNull()
  })

  it('rejects a negative or non-finite limit', () => {
    expect(validateOverrideValue(LIMIT, { value: { type: 'limit', limit: -1 }, reason: 'x' }).ok).toBe(false)
    expect(validateOverrideValue(LIMIT, { value: { type: 'limit', limit: Number.NaN }, reason: 'x' }).ok).toBe(false)
  })

  it('accepts an enum member and rejects a non-member', () => {
    expect(validateOverrideValue(ENUM, { value: { type: 'enum', enum: 'daily' }, reason: 'x' })).toEqual({
      ok: true,
      columns: { valueBool: null, valueNumeric: null, valueEnum: 'daily' },
    })
    const bad = validateOverrideValue(ENUM, { value: { type: 'enum', enum: 'hourly' }, reason: 'x' })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toMatch(/not a valid ladder member/)
  })

  it('accepts a boolean override', () => {
    expect(validateOverrideValue(BOOL, { value: { type: 'boolean', bool: true }, reason: 'x' })).toEqual({
      ok: true,
      columns: { valueBool: true, valueNumeric: null, valueEnum: null },
    })
  })
})

describe('applyOverrideWrite', () => {
  function makeDeps(feature: OverrideFeatureDef | null) {
    const upserts: OverrideUpsert[] = []
    const deps = {
      getFeature: async () => feature,
      upsertOverride: async (row: OverrideUpsert) => {
        upserts.push(row)
      },
    }
    return { deps, upserts }
  }

  it('refuses an unknown feature and does not write', async () => {
    const { deps, upserts } = makeDeps(null)
    const r = await applyOverrideWrite(deps, {
      organizationId: 'org_1', featureSlug: 'ghost', value: { type: 'limit', limit: 5 }, reason: 'x',
    })
    expect(r).toEqual({ ok: false, code: 'unknown_feature', error: expect.stringMatching(/unknown feature/) })
    expect(upserts).toHaveLength(0)
  })

  it('refuses an invalid value and does not write', async () => {
    const { deps, upserts } = makeDeps({ valueType: 'enum', enumValues: ['monthly', 'weekly'] })
    const r = await applyOverrideWrite(deps, {
      organizationId: 'org_1', featureSlug: 'backup_frequency_max', value: { type: 'enum', enum: 'hourly' }, reason: 'x',
    })
    expect(r).toEqual({ ok: false, code: 'invalid_value', error: expect.any(String) })
    expect(upserts).toHaveLength(0)
  })

  it('writes the validated override with reason, actor, and expiry', async () => {
    const { deps, upserts } = makeDeps({ valueType: 'limit' })
    const expiresAt = new Date('2027-01-01T00:00:00Z')
    const r = await applyOverrideWrite(deps, {
      organizationId: 'org_1', featureSlug: 'spaces', value: { type: 'limit', limit: 25 },
      reason: 'enterprise contract #42', grantedByUserId: 'user_staff', expiresAt,
    })
    expect(r).toEqual({ ok: true })
    expect(upserts).toHaveLength(1)
    expect(upserts[0]).toEqual({
      organizationId: 'org_1',
      featureSlug: 'spaces',
      columns: { valueBool: null, valueNumeric: 25, valueEnum: null },
      reason: 'enterprise contract #42',
      grantedByUserId: 'user_staff',
      expiresAt,
    })
  })

  it('defaults grantedByUserId and expiresAt to null', async () => {
    const { deps, upserts } = makeDeps({ valueType: 'boolean' })
    await applyOverrideWrite(deps, {
      organizationId: 'org_1', featureSlug: 'byo_ai_key', value: { type: 'boolean', bool: true }, reason: 'x',
    })
    expect(upserts[0]).toMatchObject({ grantedByUserId: null, expiresAt: null })
  })
})
