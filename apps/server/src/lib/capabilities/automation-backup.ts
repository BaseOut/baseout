// Automation-backup tier gate (server-mcp-automations).
//
// Growth+ per the PRD-vs-Features conflict resolution recorded in
// openspec/changes/server-automations-interfaces-docs — the same resolution
// interface-backup.ts follows. Kept as its own module (not a reuse of the
// interface gate) because PRD §2.9 tracks the two capabilities separately and
// their tiers could diverge.

import type { Tier } from "./tier-capabilities";

const AUTOMATION_BACKUP_TIERS: ReadonlySet<Tier> = new Set([
  "growth",
  "pro",
  "business",
  "enterprise",
]);

/** True when the resolved tier includes automation backup. null tier (no active subscription) → false. */
export function automationBackupEnabled(tier: Tier | null): boolean {
  return tier !== null && AUTOMATION_BACKUP_TIERS.has(tier);
}
