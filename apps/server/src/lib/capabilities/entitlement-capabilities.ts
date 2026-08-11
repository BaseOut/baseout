// MIRROR of apps/web/src/lib/capabilities/entitlement-capabilities.ts (canonical
// writer). Per CLAUDE.md §5.3.
//
// Bridge: DB-native entitlements (resolveEntitlements) → the engine's
// TierCapabilitySet (shared-entitlements task 2.3 cutover). The engine's
// capability set carries only `basesPerSpace`, so this is the single-field subset
// of web's mapping: basesPerSpace ← `bases_under_management` (org-wide cap — the
// per-Space gate was retired in the 2026-08-04 pricing decision; null = fair use).

import { getBool, getLimit, type EntitlementMap } from "@baseout/db-schema";
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

/**
 * Read a boolean feature (e.g. `automations_interfaces_backup`, `comments_backup`)
 * from a resolution, or `null` when it can't be resolved (no plan / feature absent
 * / not a boolean) so the caller falls back to the legacy tier gate. Used by the
 * start-deps interfaces/automations/comments resolvers (2.3 follow-up). In the new
 * model these features are true for every plan, so the cutover fixes the legacy
 * Growth+ gate that wrongly blocked Lite/Core.
 */
export function boolFeatureFrom(
  resolution: { entitlements: EntitlementMap } | null,
  slug: string,
): boolean | null {
  if (!resolution) return null;
  try {
    return getBool(resolution.entitlements, slug);
  } catch {
    return null;
  }
}
