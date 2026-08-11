// Data-export entitlement gate — pure decision (shared-data-portability task 1.2).
//
// The customer-facing "export all my data" surface and its internal enqueue
// route must both gate on a DB-native entitlement, resolved through
// resolveEntitlements(db, orgId) (apps/web/src/lib/entitlements/resolve.ts,
// mirrored in apps/server) — NEVER a Stripe product-name string (CLAUDE.md §1).
//
// This module is the pure decision half of that gate: it takes the resolved
// EntitlementMap (or `null` when the org has no plan-carrying subscription)
// and returns a structured verdict. It has no DB and no clock, so web, server,
// and the workflows enqueue re-check can share one rule and test it trivially.
//
// The catalog seed (task 1.1) that actually adds `data_export` to plan_features
// is NOT part of this slice (concurrent uncommitted work on that catalog);
// this helper is written against the assumed slug and degrades safely when the
// feature is absent from an un-seeded plan.

import { getBool, type EntitlementMap } from "@baseout/db-schema";

/** Feature slug in the DB-native plan_features catalog (assumed; task 1.1). */
export const DATA_EXPORT_FEATURE = "data_export";

/**
 * The shape resolveEntitlements returns (minus the fields the gate doesn't
 * need). Declared locally rather than imported from apps/web so this helper
 * stays app-agnostic — both apps run their own query and hand the result here.
 */
export interface DataExportGateInput {
  entitlements: EntitlementMap;
}

/** Structured verdict — distinguishes "no subscription" from "plan lacks it". */
export type DataExportGate =
  | { entitled: true }
  | { entitled: false; reason: "no_subscription" | "not_entitled" };

/**
 * Decide whether an org may initiate a portable full-export.
 *
 * - `null` resolution → no active/trialing plan-carrying subscription →
 *   `no_subscription` (callers may map to 402 / upgrade prompt).
 * - plan carries `data_export = true` → entitled.
 * - plan carries `data_export = false`, or does not carry it at all →
 *   `not_entitled` (callers may map to 403 / upgrade prompt).
 *
 * An absent feature is treated as unentitled rather than throwing: an older
 * plan predating the task-1.1 seed must not error the export surface.
 */
export function decideDataExportGate(
  resolution: DataExportGateInput | null,
): DataExportGate {
  if (resolution === null) {
    return { entitled: false, reason: "no_subscription" };
  }
  // getBool throws when the feature isn't resolved for the plan; treat that
  // (and an explicit false) as unentitled.
  if (!resolution.entitlements[DATA_EXPORT_FEATURE]) {
    return { entitled: false, reason: "not_entitled" };
  }
  return getBool(resolution.entitlements, DATA_EXPORT_FEATURE)
    ? { entitled: true }
    : { entitled: false, reason: "not_entitled" };
}
