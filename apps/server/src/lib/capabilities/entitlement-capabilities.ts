// MIRROR of apps/web/src/lib/capabilities/entitlement-capabilities.ts (canonical
// writer). Per CLAUDE.md §5.3.
//
// Bridge: DB-native entitlements (resolveEntitlements) → the engine's
// TierCapabilitySet (shared-entitlements task 2.3 cutover). The engine's
// capability set carries only `basesPerSpace`, so this is the single-field subset
// of web's mapping: basesPerSpace ← `bases_under_management` (org-wide cap — the
// per-Space gate was retired in the 2026-08-04 pricing decision; null = fair use).

import { getLimit, type EntitlementMap } from "@baseout/db-schema";
import type { TierCapabilitySet } from "./tier-capabilities";

/**
 * Derive the engine capability set from resolved entitlements. Throws if
 * `bases_under_management` is absent (catalog-integrity error) — resolveCapabilities
 * catches and falls back to the legacy tier table, keeping the cutover fail-safe.
 */
export function entitlementsToCapabilities(
  entitlements: EntitlementMap,
): TierCapabilitySet {
  return {
    basesPerSpace: getLimit(entitlements, "bases_under_management"),
  };
}
