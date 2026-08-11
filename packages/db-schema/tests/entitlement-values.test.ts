import { describe, expect, it } from 'vitest'
import {
  FAIR_USE,
  compareEnumRank,
  enumRank,
  fromValueColumns,
  isFairUse,
  maxEnumValue,
  parseLimit,
  toValueColumns,
  type TypedValue,
} from '../src/entitlements/values'

const FREQUENCY = ['monthly', 'weekly', 'daily', 'instant'] as const
const DB_CLASS = ['d1', 'shared_cluster', 'dedicated_cluster', 'byodb'] as const

describe('typed value encode/decode', () => {
  it('boolean round-trips through storage columns', () => {
    const v: TypedValue = { type: 'boolean', bool: true }
    const cols = toValueColumns(v)
    expect(cols).toEqual({ valueBool: true, valueNumeric: null, valueEnum: null })
    expect(fromValueColumns('boolean', cols)).toEqual(v)
  })

  it('limit round-trips and accepts numeric-as-string from Drizzle', () => {
    const v: TypedValue = { type: 'limit', limit: 250000 }
    const cols = toValueColumns(v)
    expect(cols.valueNumeric).toBe(250000)
    // Drizzle `numeric` reads back as a string:
    expect(fromValueColumns('limit', { ...cols, valueNumeric: '250000' })).toEqual(v)
  })

  it('enum round-trips', () => {
    const v: TypedValue = { type: 'enum', enum: 'weekly' }
    const cols = toValueColumns(v)
    expect(cols).toEqual({ valueBool: null, valueNumeric: null, valueEnum: 'weekly' })
    expect(fromValueColumns('enum', cols)).toEqual(v)
  })

  it('a null numeric decodes to the fair-use sentinel', () => {
    const decoded = fromValueColumns('limit', {
      valueBool: null,
      valueNumeric: null,
      valueEnum: null,
    })
    expect(decoded).toEqual({ type: 'limit', limit: FAIR_USE })
    expect(isFairUse((decoded as { limit: number | null }).limit)).toBe(true)
  })

  it('throws when a boolean/enum feature is missing its value', () => {
    expect(() =>
      fromValueColumns('boolean', { valueBool: null, valueNumeric: null, valueEnum: null }),
    ).toThrow(/value_bool/)
    expect(() =>
      fromValueColumns('enum', { valueBool: null, valueNumeric: null, valueEnum: '' }),
    ).toThrow(/value_enum/)
  })

  it('parseLimit rejects non-numeric junk', () => {
    expect(parseLimit(null)).toBe(FAIR_USE)
    expect(parseLimit('5000000')).toBe(5000000)
    expect(() => parseLimit('lots')).toThrow(/finite/)
  })
})

describe('enum rank comparison', () => {
  it('ranks by ladder index', () => {
    expect(enumRank(FREQUENCY, 'monthly')).toBe(0)
    expect(enumRank(FREQUENCY, 'instant')).toBe(3)
  })

  it('compares two members by rank', () => {
    expect(compareEnumRank(FREQUENCY, 'weekly', 'daily')).toBeLessThan(0)
    expect(compareEnumRank(FREQUENCY, 'instant', 'monthly')).toBeGreaterThan(0)
    expect(compareEnumRank(DB_CLASS, 'byodb', 'byodb')).toBe(0)
  })

  it('picks the higher-ranked member', () => {
    expect(maxEnumValue(FREQUENCY, 'monthly', 'daily')).toBe('daily')
    expect(maxEnumValue(DB_CLASS, 'dedicated_cluster', 'shared_cluster')).toBe('dedicated_cluster')
  })

  it('throws on a value outside the ladder (never silently string-compares)', () => {
    expect(() => enumRank(FREQUENCY, 'hourly')).toThrow(/not in ladder/)
    expect(() => compareEnumRank(DB_CLASS, 'd1', 'sqlite')).toThrow(/not in ladder/)
  })
})
