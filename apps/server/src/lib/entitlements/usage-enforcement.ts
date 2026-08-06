/**
 * Usage-enforcement evaluation — pure DI orchestration (shared-entitlements 4.2).
 *
 * The engine-side wiring of the (already-tested) `evaluateUsage` core into a real
 * usage-write path (design D7: "evaluation runs wherever usage changes land").
 * After a backup completion's usage lands in `usage_rollups`, this:
 *
 *   1. resolves the org's effective entitlements (limits),
 *   2. reads the current-period usage + persisted notification state for the
 *      affected features,
 *   3. runs `evaluateUsage` (warn-90 / enforce-100 dedup state machine), then
 *   4. persists ONLY the states that moved and dispatches the skeleton notifier
 *      ONLY on transitions.
 *
 * All I/O is injected (deps), so this is unit-tested with fakes — no DB. The
 * route (runs/complete) assembles the real Drizzle-backed deps.
 */

import {
  evaluateUsage,
  type EntitlementMap,
  type FeatureEvaluation,
  type NotificationState,
  type UsageObservation,
} from "@baseout/db-schema";
import type { LimitNotifier } from "./notify";

export interface BillingPeriod {
  start: Date;
  end: Date;
}

export interface EvaluateUsageForOrgInput {
  organizationId: string;
  /** The features to evaluate — the meters just ingested (e.g. the two stock meters). */
  featureSlugs: string[];
  period: BillingPeriod;
  /** Timestamp stamped on any persisted state transition. */
  now: Date;
}

export interface UsageEnforcementDeps {
  /** Effective entitlements for the org, or null if nothing to enforce (skip). */
  resolveEntitlements: (organizationId: string) => Promise<EntitlementMap | null>;
  /** Current-period used level per feature (org-summed across Spaces) from usage_rollups. */
  readUsage: (
    organizationId: string,
    featureSlugs: string[],
    period: BillingPeriod,
  ) => Promise<UsageObservation[]>;
  /** Persisted usage_notification_state for the period. */
  readStates: (
    organizationId: string,
    featureSlugs: string[],
    periodStart: Date,
  ) => Promise<NotificationState[]>;
  /** Upsert the states that moved (transition timestamp = `at`). */
  writeStates: (
    organizationId: string,
    periodStart: Date,
    changed: FeatureEvaluation[],
    at: Date,
  ) => Promise<void>;
  notifier: LimitNotifier;
  /** ENTITLEMENT_ENFORCEMENT flag (task 4.3). Default off → warn-only. */
  enforcementEnabled: boolean;
}

export interface UsageEnforcementResult {
  evaluated: number;
  changed: number;
  notified: number;
}

const NOTHING: UsageEnforcementResult = { evaluated: 0, changed: 0, notified: 0 };

export async function evaluateUsageForOrg(
  input: EvaluateUsageForOrgInput,
  deps: UsageEnforcementDeps,
): Promise<UsageEnforcementResult> {
  const entitlements = await deps.resolveEntitlements(input.organizationId);
  if (!entitlements) return NOTHING;

  const [usage, states] = await Promise.all([
    deps.readUsage(input.organizationId, input.featureSlugs, input.period),
    deps.readStates(input.organizationId, input.featureSlugs, input.period.start),
  ]);

  const result = evaluateUsage({
    entitlements,
    usage,
    states,
    enforcementEnabled: deps.enforcementEnabled,
  });

  if (result.changed.length > 0) {
    await deps.writeStates(
      input.organizationId,
      input.period.start,
      result.changed,
      input.now,
    );
  }

  for (const n of result.notifications) {
    const payload = {
      organizationId: input.organizationId,
      featureSlug: n.featureSlug,
      used: n.used,
      limit: n.limit,
      pct: n.pct,
    };
    if (n.fired === "enforcement") {
      await deps.notifier.notifyLimitEnforced(payload);
    } else {
      await deps.notifier.notifyLimitWarning(payload);
    }
  }

  return {
    evaluated: result.evaluations.length,
    changed: result.changed.length,
    notified: result.notifications.length,
  };
}
