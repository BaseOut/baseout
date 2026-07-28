// Comment-backup tier gate (server-comments).
//
// Recommended stance (design Decision 4, drafted into Features §6.3 + §17 Q18
// on 2026-07-27): comments RIDE THE RECORD-BACKUP TIER — they're record data,
// so every tier with an active subscription captures them. ⚠ Dan has not yet
// confirmed the tier (the alternative is Growth+ alignment with the other
// premium-entity backups) — if Growth+ wins, swap the implementation to the
// AUTOMATION_BACKUP_TIERS shape in automation-backup.ts; the call sites are
// tier-agnostic. Kept as its own module for exactly that reason.

import type { Tier } from "./tier-capabilities";

/** True when the resolved tier includes comment backup. null tier (no active subscription) → false. */
export function commentBackupEnabled(tier: Tier | null): boolean {
  return tier !== null;
}
