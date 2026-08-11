/**
 * Usage evaluation orchestration — pure, no I/O (shared-entitlements task 4.2).
 *
 * The reusable heart that every usage-write path calls (rollup ingestion after a
 * backup completes, point-of-use metering, and the reconciliation sweep — design
 * D7). Given the org's resolved entitlements, the current-period usage for the
 * affected features, and their persisted notification states, it runs the pure
 * per-feature `evaluate()` state machine and partitions the outcome into:
 *
 *   - `changed`       — features whose notification state moved (upsert these)
 *   - `notifications` — features whose transition fires an alert (dispatch these)
 *
 * Callers dedupe on `notifications` (never on `changed`): a de-escalation moves
 * the state (→ persist) but fires nothing (no re-alert). Only limit-type features
 * carry a numeric cap, so boolean/enum gates and features absent from the plan
 * are silently skipped — the caller may pass a superset without pre-filtering.
 *
 * Pure: same inputs → same output. The DB read (usage + states) and the writes
 * (state upsert + notifier dispatch) live in the per-app wiring around this.
 */

import { evaluate, type NotificationKind, type UsageState } from './evaluate'
import type { EntitlementMap } from './resolve'

/** One (organization, feature) usage observation for the current period. */
export interface UsageObservation {
  featureSlug: string
  /** Current-period usage level (stock) or accumulated count (flow). */
  used: number
}

/** A persisted `usage_notification_state` row for the current period. */
export interface NotificationState {
  featureSlug: string
  state: UsageState
}

/** The evaluation outcome for one feature. */
export interface FeatureEvaluation {
  featureSlug: string
  used: number
  /** Effective limit; `null` = fair use / unlimited. */
  limit: number | null
  /** The state before this evaluation (persisted, or `ok` if none). */
  previous: UsageState
  /** The state to persist. */
  next: UsageState
  /** The notification this transition fires (`none` = don't dispatch). */
  fired: NotificationKind
  /** used / limit, for the notifier payload. `0` unlimited, `Infinity` at 0-limit. */
  pct: number
}

export interface EvaluateUsageInput {
  /** Resolved effective entitlements for the org (from resolveEntitlements). */
  entitlements: EntitlementMap
  /** Current-period usage for the affected features (the pairs that changed). */
  usage: UsageObservation[]
  /** Persisted notification state per feature; a missing feature defaults to `ok`. */
  states?: NotificationState[]
  /** ENTITLEMENT_ENFORCEMENT flag (task 4.3). Default off → warn-only. */
  enforcementEnabled?: boolean
}

export interface EvaluateUsageResult {
  /** One entry per evaluated limit feature (non-limit / unknown features skipped). */
  evaluations: FeatureEvaluation[]
  /** Evaluations whose state moved (`previous !== next`) → upsert notification state. */
  changed: FeatureEvaluation[]
  /** Evaluations that fired a notification (`fired !== 'none'`) → dispatch notifier. */
  notifications: FeatureEvaluation[]
}

/**
 * Evaluate a batch of usage observations against the org's effective limits and
 * partition the results for persistence and notification. See module doc.
 */
export function evaluateUsage(input: EvaluateUsageInput): EvaluateUsageResult {
  const stateBySlug = new Map(
    (input.states ?? []).map((s) => [s.featureSlug, s.state] as const),
  )

  const evaluations: FeatureEvaluation[] = []
  const changed: FeatureEvaluation[] = []
  const notifications: FeatureEvaluation[] = []

  for (const obs of input.usage) {
    const feature = input.entitlements[obs.featureSlug]
    // Only limit-type features carry a numeric cap to evaluate. Boolean/enum
    // gates and features absent from the plan are not metered → skip.
    if (!feature || feature.effective.type !== 'limit') continue

    const limit = feature.effective.limit // number | null (null = fair use)
    const previous = stateBySlug.get(obs.featureSlug) ?? 'ok'
    const result = evaluate({
      used: obs.used,
      limit,
      current: previous,
      enforcementEnabled: input.enforcementEnabled,
    })

    const evaluation: FeatureEvaluation = {
      featureSlug: obs.featureSlug,
      used: obs.used,
      limit,
      previous,
      next: result.next,
      fired: result.fired,
      pct: result.pct,
    }

    evaluations.push(evaluation)
    if (evaluation.next !== evaluation.previous) changed.push(evaluation)
    if (evaluation.fired !== 'none') notifications.push(evaluation)
  }

  return { evaluations, changed, notifications }
}
