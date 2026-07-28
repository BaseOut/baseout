// Comment-backup tier gate (server-comments).
//
// Comments RIDE THE RECORD-BACKUP TIER — they're record data, so every tier
// with an active subscription captures them (design Decision 4, Features §6.3
// + §17 Q18, confirmed 2026-07-28). Kept as its own module so a future tier
// split only touches this file — the call sites are tier-agnostic.

import type { Tier } from "./tier-capabilities";

/** True when the resolved tier includes comment backup. null tier (no active subscription) → false. */
export function commentBackupEnabled(tier: Tier | null): boolean {
  return tier !== null;
}
