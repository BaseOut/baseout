/**
 * Entitlement value model — pure helpers (no DB, no I/O).
 *
 * A feature's value is one of three typed shapes (shared-entitlements design D3):
 *   - boolean  — an on/off gate            → value_bool
 *   - limit    — a numeric cap             → value_numeric  (NULL = fair use / unlimited)
 *   - enum     — a graded ladder member    → value_enum     (rank from features.enum_values)
 *
 * `plan_features` and `account_feature_overrides` both store values in the same
 * three nullable columns; the feature's `value_type` selects which one is live.
 * These helpers encode/decode that representation and compare enum ranks. They
 * live in @baseout/db-schema so web, server, and admin resolve identically
 * (the resolution library — shared-entitlements task 2.1 — builds on them).
 */

export type FeatureValueType = 'boolean' | 'limit' | 'enum'
export type MeterKind = 'flow' | 'stock' | 'creation'
export type PlanKind = 'public' | 'trial' | 'custom' | 'legacy'
export type PlanStatus = 'active' | 'inactive'

/**
 * A limit stored as NULL numeric means "fair use / unlimited" (e.g. Max restores).
 * Distinct from an absent row; a limit feature always has a `plan_features` row,
 * and NULL there is the sentinel. Enterprise "Custom" is NOT a sentinel — those
 * values arrive as per-account overrides on a conservative base plan (D10).
 */
export const FAIR_USE = null

/** Typed, decoded representation of a single feature value. */
export type TypedValue =
  | { type: 'boolean'; bool: boolean }
  | { type: 'limit'; limit: number | null } // null = fair use / unlimited
  | { type: 'enum'; enum: string }

/** The three nullable storage columns, exactly as Drizzle reads/writes them. */
export interface ValueColumns {
  valueBool: boolean | null
  // Drizzle `numeric` round-trips as a string; accept number on the way in.
  valueNumeric: string | number | null
  valueEnum: string | null
}

/** Encode a typed value into the three storage columns (the other two are NULL). */
export function toValueColumns(v: TypedValue): ValueColumns {
  switch (v.type) {
    case 'boolean':
      return { valueBool: v.bool, valueNumeric: null, valueEnum: null }
    case 'limit':
      return { valueBool: null, valueNumeric: v.limit, valueEnum: null }
    case 'enum':
      return { valueBool: null, valueNumeric: null, valueEnum: v.enum }
  }
}

/** Decode the storage columns back into a typed value, driven by the feature type. */
export function fromValueColumns(
  type: FeatureValueType,
  cols: ValueColumns,
): TypedValue {
  switch (type) {
    case 'boolean':
      if (typeof cols.valueBool !== 'boolean') {
        throw new Error('boolean feature is missing value_bool')
      }
      return { type: 'boolean', bool: cols.valueBool }
    case 'limit':
      return { type: 'limit', limit: parseLimit(cols.valueNumeric) }
    case 'enum':
      if (typeof cols.valueEnum !== 'string' || cols.valueEnum.length === 0) {
        throw new Error('enum feature is missing value_enum')
      }
      return { type: 'enum', enum: cols.valueEnum }
  }
}

/** NULL numeric → fair-use sentinel (null); otherwise a finite number. */
export function parseLimit(raw: string | number | null): number | null {
  if (raw === null || raw === undefined) return FAIR_USE
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) {
    throw new Error(`limit value is not a finite number: ${String(raw)}`)
  }
  return n
}

export function isFairUse(limit: number | null): boolean {
  return limit === FAIR_USE
}

/**
 * Rank of an enum value within its ordered ladder (index = rank; higher = more).
 * `enumValues` is the feature's ordered `enum_values` array. Throws if the value
 * is not a ladder member — callers must never string-compare enum values (D3).
 */
export function enumRank(
  enumValues: readonly string[],
  value: string,
): number {
  const rank = enumValues.indexOf(value)
  if (rank === -1) {
    throw new Error(
      `enum value "${value}" is not in ladder [${enumValues.join(', ')}]`,
    )
  }
  return rank
}

/** Negative if a < b, 0 if equal, positive if a > b — by ladder rank. */
export function compareEnumRank(
  enumValues: readonly string[],
  a: string,
  b: string,
): number {
  return enumRank(enumValues, a) - enumRank(enumValues, b)
}

/** The higher-ranked of two ladder members (used when an override raises a gate). */
export function maxEnumValue(
  enumValues: readonly string[],
  a: string,
  b: string,
): string {
  return compareEnumRank(enumValues, a, b) >= 0 ? a : b
}
