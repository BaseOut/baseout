// Interface-backup tier gate (server-mcp-interface-pages).
//
// Growth+ per the PRD-vs-Features conflict resolution recorded in
// openspec/changes/server-automations-interfaces-docs. Engine-local on
// purpose: tier-capabilities.ts is a byte-for-byte MIRROR of the web
// canonical file, and widening that pair is the web change's call — this
// gate maps the already-resolved tier to a boolean and nothing else.

import type { Tier } from "./tier-capabilities";

const INTERFACE_BACKUP_TIERS: ReadonlySet<Tier> = new Set([
  "growth",
  "pro",
  "business",
  "enterprise",
]);

/** True when the resolved tier includes interface backup. null tier (no active subscription) → false. */
export function interfaceBackupEnabled(tier: Tier | null): boolean {
  return tier !== null && INTERFACE_BACKUP_TIERS.has(tier);
}
