// API-usage surface (api-productionization D3): the org's plan, its Features §3
// monthly call allowance, and month-to-date consumption off the Analytics
// Engine dataset. Enforcement is deliberately "off" until Dan's numbers land
// (design D5) — this endpoint makes the quota VISIBLE first.

import { requireOrg } from "../lib/guards";
import { resolveApiPlan } from "../lib/entitlements";
import { monthStartUtc, readMonthlyUsage } from "../lib/usage";
import { json } from "../lib/responses";
import type { Operation } from "../lib/registry";

export const usageOperations: Operation[] = [
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/api-usage",
    scope: "org:read",
    summary: "The Organization's plan, monthly API-call allowance, and month-to-date usage.",
    handler: async (c) => {
      const orgId = await requireOrg(c, "org:read");
      const plan = await resolveApiPlan(c.db, orgId, c.now);
      const used = await readMonthlyUsage(c.env, orgId, c.now);
      const allowance = plan?.monthlyCallAllowance ?? null;
      return json(
        {
          plan: plan?.planSlug ?? null,
          monthlyCallAllowance: allowance,
          used,
          remaining: used != null && allowance != null ? Math.max(0, allowance - used) : null,
          periodStart: monthStartUtc(c.now).toISOString(),
          usageAvailable: used != null,
          enforcement: "off",
        },
        c.requestId,
      );
    },
  },
];
