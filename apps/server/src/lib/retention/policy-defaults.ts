// Per-tier default retention policy for the cleanup engine
// (openspec/changes/server-retention-and-cleanup Phase B).
//
// The engine's mirror of apps/web's resolveRetentionPolicy defaults (the web
// resolver additionally carries editable-knob metadata for the settings UI;
// the engine only needs the decided values). Used as the fallback when a Space
// has no persisted backup_retention_policies row — e.g. a Space created after
// the one-time backfill ran. Policy-tier mapping is canonical per Features §6.9;
// the window numbers are implementation defaults the deferred settings UI tunes.

import type { Tier } from "./tier-cap";
import type { RetentionPolicyValues } from "./types";

const DEFAULTS: Record<Tier, RetentionPolicyValues> = {
  // Trial inherits this via the null-tier fallback (Features §5.5.4). Trial
  // runs are additionally capped at 7 days by decideDeletions (is_trial).
  starter: { tier: "basic", keepLastN: 10 },
  launch: { tier: "time_based", dailyWindowDays: 30 },
  growth: { tier: "two_tier", dailyWindowDays: 30, weeklyWindowDays: 120 },
  pro: {
    tier: "three_tier",
    dailyWindowDays: 30,
    weeklyWindowDays: 120,
    monthlyIndefinite: true,
  },
  // Business/Enterprise are Custom per Features §6.9. With no explicit rules,
  // decideDeletions applies the three-tier default; Enterprise's Infinity
  // tier-cap means nothing is force-pruned beyond that policy.
  business: { tier: "custom", customRules: null },
  enterprise: { tier: "custom", customRules: null },
};

export function getDefaultPolicy(tier: Tier | null): RetentionPolicyValues {
  return tier ? DEFAULTS[tier] : DEFAULTS.starter;
}
