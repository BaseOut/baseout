// Entitlement-sourced retention window (shared-entitlements 4.4).
//
// The retention cleanup engine's snapshot-age safety cap has historically come
// from the hardcoded TIER_CAP_DAYS ladder (tier-cap.ts). Behind the
// RETENTION_FROM_ENTITLEMENTS flag, buildCleanupPlan prefers this per-org value
// instead. The snapshot cap maps to `record_history_retention_days` (how long
// record data is retained — the pricing "history retention" ladder: Lite 90 /
// Core 180 / Plus 365 / Max 1095). Returns null when the feature can't be
// resolved (no plan / not a limit) so the caller falls back to the legacy ladder.
//
// This is a PURE decision — the flag read + DB resolution live in cleanup-deps.

import { getLimit, type EntitlementMap } from "@baseout/db-schema";

/** The entitlement slug the snapshot retention cap is sourced from (4.4). */
export const RETENTION_ENTITLEMENT_SLUG = "record_history_retention_days";

/**
 * Snapshot retention cap (days) from the org's entitlements, or null when the
 * feature isn't a resolvable limit (→ caller uses the legacy tier cap). Fair-use
 * (null limit) means keep forever → Infinity, matching enterprise's legacy cap.
 */
export function retentionCapDaysFromEntitlements(
  entitlements: EntitlementMap,
): number | null {
  try {
    const days = getLimit(entitlements, RETENTION_ENTITLEMENT_SLUG);
    return days === null ? Number.POSITIVE_INFINITY : days;
  } catch {
    return null;
  }
}
