// Shared types for the retention cleanup engine
// (openspec/changes/server-retention-and-cleanup).

import type { RetentionPolicyTier } from "../../db/schema/backup-retention-policies";

export type { RetentionPolicyTier };

/**
 * The resolved policy *values* the cleanup engine decides against — the
 * backup_retention_policies row minus id/spaceId/timestamps. Sourced either
 * from a persisted policy row (the deferred settings UI / backfill) or from
 * getDefaultPolicy(tier) when no row exists. Distinct from apps/web's
 * RetentionPolicy shape, which additionally carries editable-knob metadata for
 * the UI — the engine only needs the decided values.
 */
export interface RetentionPolicyValues {
  tier: RetentionPolicyTier;
  keepLastN?: number | null;
  dailyWindowDays?: number | null;
  weeklyWindowDays?: number | null;
  monthlyIndefinite?: boolean | null;
  customRules?: unknown;
}
