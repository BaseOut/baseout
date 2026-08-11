/**
 * Limit-state evaluator — pure, no I/O (shared-entitlements design D7, task 4.1).
 *
 * The deduplicated warn/enforce state machine that runs wherever usage changes
 * land (rollup ingestion after each run/flush, and the reconciliation sweep). It
 * maps `used / effective_limit` to a `usage_notification_state`
 * (`ok → warned_90 → warned_100 → enforced`) and reports which notification, if
 * any, this transition fires — so callers alert ONLY on transitions, never on
 * every sync.
 *
 * Thresholds (locked pricing model): warn at 90%, enforce at 100%. De-escalation
 * carries a hysteresis band so usage hovering on a boundary can't flap the state
 * (and re-fire notifications) sync after sync. Escalation is immediate.
 *
 * `enforced` vs `warned_100`: both are the "at/over 100%" tier. Which one applies
 * is the ENTITLEMENT_ENFORCEMENT flag's call (task 4.3): flag on → `enforced`
 * (enforcement action taken, fires notifyLimitEnforced); flag off → `warned_100`
 * (warn only, no action). This keeps the pre-cutover posture warn-only.
 *
 * A fair-use (unlimited, NULL) limit never leaves `ok`.
 *
 * The state strings match the `usage_notification_state.state` CHECK constraint
 * in the schema exactly — keep them in sync.
 */

import { FAIR_USE } from './values'

export type UsageState = 'ok' | 'warned_90' | 'warned_100' | 'enforced'

/** What a transition fires. De-escalation and no-change fire nothing. */
export type NotificationKind = 'none' | 'warning' | 'enforcement'

export const WARN_AT = 0.9
export const ENFORCE_AT = 1.0
/** De-escalation band: leave a tier only once usage falls this far below its
 *  entry threshold (0.90→0.85 to return under warned_90; 1.00→0.95 to leave the
 *  at-limit tier). Escalation ignores the band (crosses up immediately). */
export const HYSTERESIS = 0.05

const RANK: Record<UsageState, number> = { ok: 0, warned_90: 1, warned_100: 2, enforced: 3 }

/** The "at/over 100%" state for the current enforcement posture. */
function atLimitState(enforcementEnabled: boolean): UsageState {
  return enforcementEnabled ? 'enforced' : 'warned_100'
}

export interface EvaluateInput {
  /** Current period usage for the feature (records, GB, credits, calls, count…). */
  used: number
  /** Effective limit from resolveEntitlements. `null`/FAIR_USE = unlimited. */
  limit: number | null
  /** The org+feature's current persisted `usage_notification_state.state`. */
  current: UsageState
  /** ENTITLEMENT_ENFORCEMENT flag (task 4.3). Defaults off → warn-only. */
  enforcementEnabled?: boolean
}

export interface EvaluateResult {
  /** The state to persist. */
  next: UsageState
  /** The notification this transition fires (callers dedupe on this being non-'none'). */
  fired: NotificationKind
  /** used / limit, for the notification payload. `0` when unlimited, `Infinity`
   *  when the limit is 0 and usage is positive. */
  pct: number
}

/** Fraction of the limit consumed. Unlimited → 0; zero-limit with usage → ∞. */
function usageFraction(used: number, limit: number): number {
  if (limit > 0) return used / limit
  return used > 0 ? Number.POSITIVE_INFINITY : 0
}

/** Tier from a fraction using the given warn/enforce thresholds. */
function tierAt(pct: number, warnAt: number, enforceAt: number, enforcementEnabled: boolean): UsageState {
  if (pct >= enforceAt) return atLimitState(enforcementEnabled)
  if (pct >= warnAt) return 'warned_90'
  return 'ok'
}

/**
 * Evaluate the next notification state and the notification (if any) this
 * transition fires. Pure: same inputs → same output.
 */
export function evaluate(input: EvaluateInput): EvaluateResult {
  const { used, limit, current } = input
  const enforcementEnabled = input.enforcementEnabled ?? false

  // Unlimited (fair use): never warns or enforces; always resets to ok.
  if (limit === FAIR_USE) {
    return { next: 'ok', fired: 'none', pct: 0 }
  }

  const pct = usageFraction(used, limit)

  // Escalation tier (immediate on crossing up).
  const escalated = tierAt(pct, WARN_AT, ENFORCE_AT, enforcementEnabled)

  let next: UsageState
  if (RANK[escalated] >= RANK[current]) {
    // Same tier or escalating — take the escalation tier directly.
    next = escalated
  } else {
    // Would de-escalate: only drop past a boundary once below its lower band.
    next = tierAt(pct, WARN_AT - HYSTERESIS, ENFORCE_AT - HYSTERESIS, enforcementEnabled)
    // Never let hysteresis push the state ABOVE current on a downward move.
    if (RANK[next] > RANK[current]) next = current
  }

  // Fire only on an upward transition; the kind is set by the tier reached.
  let fired: NotificationKind = 'none'
  if (RANK[next] > RANK[current]) {
    fired = next === 'enforced' ? 'enforcement' : 'warning'
  }

  return { next, fired, pct }
}

/**
 * Period rollover reset (design D7: "reset at period rollover"). A new billing
 * period starts every meter back at `ok`; the caller also zeroes the period's
 * usage counters. Separate from `evaluate` so the rollover is an explicit step.
 */
export function resetForNewPeriod(): UsageState {
  return 'ok'
}
