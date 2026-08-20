// Report capability gate (engine-side, defense-in-depth) — server-reports task 7.
//
// The user-facing cap is enforced by apps/web (checkCreationCap lives there);
// this is the engine's server-side re-check on the INTERNAL_TOKEN surface.
//
// Gated via resolveEntitlements(orgId) — NEVER Stripe metadata (CLAUDE.md §1).
// Dark by default: only enforced when ENTITLEMENT_ENFORCEMENT === '1'; a missing
// plan / resolution gap fails OPEN (a create gate must not block on a gap).
//
// ┌─ FLAGGED SPEC CONFLICT (design §Scope/tier — do NOT resolve by inventing) ─┐
// │ Only the `active_reports` creation cap exists in the DB-native catalog      │
// │ (Features §216: 5/25/50/100 per tier + add-on `reports_5`). Features        │
// │ §795/§798/§799 describe Custom-Reports availability / Scheduled Delivery /  │
// │ Report Export as Plus+/Max features, but NO feature slug for them exists in │
// │ the catalog yet. So this gate enforces ONLY the creation cap; the           │
// │ scheduled-delivery + export availability checks fail OPEN and are wired but │
// │ inert until a human adds the feature slugs and resolves §216-vs-§795.       │
// └────────────────────────────────────────────────────────────────────────────┘

import { eq } from "drizzle-orm";
import type { AppDb } from "../../db/worker";
import type { Env } from "../../env";
import { spaces } from "../../db/schema";
import { resolveEntitlements } from "../entitlements/resolve";
import { canCreate } from "@baseout/db-schema";
import { countActiveReportsForOrg } from "./store";

const ACTIVE_REPORTS_FEATURE = "active_reports";
const ACTIVE_REPORTS_ADDON = "reports_5";

// Availability feature slugs are NOT in the catalog yet (see flag above). Once a
// human adds them + resolves §216/§795, set these and flip the checks to enforce.
const SCHEDULED_DELIVERY_FEATURE: string | null = null;
const EXPORT_FEATURE: string | null = null;

export interface ReportGateResult {
  allowed: boolean;
  code?: string;
  message?: string;
  feature?: string;
  used?: number | null;
  limit?: number | null;
  addon?: string | null;
}

async function orgIdForSpace(db: AppDb, spaceId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: spaces.organizationId })
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);
  return row?.organizationId ?? null;
}

/**
 * Gate a definition create. Enforces the `active_reports` org-scoped creation cap
 * when enforcement is on; scheduled-delivery/export availability are inert (see
 * the flagged conflict). Returns { allowed:true } in every fail-open case.
 */
export async function checkReportCreationGate(
  db: AppDb,
  env: Env,
  args: { spaceId: string; wantsSchedule: boolean; wantsExport: boolean },
): Promise<ReportGateResult> {
  if (env.ENTITLEMENT_ENFORCEMENT !== "1") return { allowed: true };

  const orgId = await orgIdForSpace(db, args.spaceId);
  if (!orgId) return { allowed: true }; // fail open — no org to resolve

  const resolution = await resolveEntitlements(db, orgId);
  if (!resolution) return { allowed: true }; // no active plan → nothing to enforce

  const { entitlements } = resolution;

  // Availability checks (inert until the catalog gains the slugs).
  if (args.wantsSchedule && SCHEDULED_DELIVERY_FEATURE) {
    if (!canCreate(entitlements, SCHEDULED_DELIVERY_FEATURE, 0)) {
      return {
        allowed: false,
        code: "capability_required",
        message: "Scheduled report delivery is not available on your plan.",
        feature: SCHEDULED_DELIVERY_FEATURE,
      };
    }
  }
  if (args.wantsExport && EXPORT_FEATURE) {
    if (!canCreate(entitlements, EXPORT_FEATURE, 0)) {
      return {
        allowed: false,
        code: "capability_required",
        message: "Report export is not available on your plan.",
        feature: EXPORT_FEATURE,
      };
    }
  }

  // Creation cap (real, catalog-backed).
  const used = await countActiveReportsForOrg(db, orgId);
  if (!canCreate(entitlements, ACTIVE_REPORTS_FEATURE, used)) {
    const feature = entitlements[ACTIVE_REPORTS_FEATURE];
    const limit =
      feature && feature.effective.type === "limit" ? feature.effective.limit : null;
    return {
      allowed: false,
      code: "limit_reached",
      message: `Active reports limit reached${limit != null ? ` (${limit})` : ""}.`,
      feature: ACTIVE_REPORTS_FEATURE,
      used,
      limit,
      addon: ACTIVE_REPORTS_ADDON,
    };
  }

  return { allowed: true };
}
