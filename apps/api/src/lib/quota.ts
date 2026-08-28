// Monthly-quota evaluation (api-productionization 4.2). Sits beside the rate
// limiter in the request pipeline: resolves the org's plan allowance
// (Features §3 monthly_call_allowance) and month-to-date usage, emits
// X-Quota-* headers, and — ONLY when QUOTA_ENFORCE="true" — blocks with 429
// once used ≥ allowance. Default-off and fail-open everywhere: no AE creds,
// no subscription, a failed read, or a thrown query all mean "don't block".
//
// Per-request cost is kept near zero with per-isolate caches: the plan
// resolution (4 master-DB queries) is cached 5 minutes per org, the AE usage
// read 60 seconds. Both caches are module-level Maps — workerd keeps them for
// the isolate's lifetime, which is exactly the freshness this needs.

import type { ApiDb } from "../db/client";
import type { Env } from "../env";
import { resolveApiPlan, type ApiPlan } from "./entitlements";
import { monthStartUtc, readMonthlyUsage } from "./usage";

const PLAN_TTL_MS = 5 * 60_000;
const USAGE_TTL_MS = 60_000;

const planCache = new Map<string, { expires: number; plan: ApiPlan | null }>();
const usageCache = new Map<string, { expires: number; used: number | null }>();

/** Test hook — caches are per-isolate state. */
export function _resetQuotaCaches(): void {
  planCache.clear();
  usageCache.clear();
}

export interface QuotaOutcome {
  /** true only when enforcement is on AND the allowance is demonstrably exhausted. */
  block: boolean;
  /** X-Quota-* headers; empty when nothing is known (no plan, no reads). */
  headers: Record<string, string>;
}

/** Seconds until the next UTC month begins (Retry-After on a quota 429). */
export function secondsToMonthEnd(now: Date): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

/**
 * Pure decision: allowance null = fair use (never blocks); used null = usage
 * unknown (never blocks — enforcement without evidence would 429 on an AE
 * outage). Headers state what IS known.
 */
export function quotaDecision(allowance: number | null, used: number | null, enforce: boolean, now: Date): QuotaOutcome {
  const headers: Record<string, string> = {};
  if (allowance != null) headers["x-quota-limit"] = String(allowance);
  if (allowance != null && used != null) headers["x-quota-remaining"] = String(Math.max(0, allowance - used));
  const block = enforce && allowance != null && used != null && used >= allowance;
  if (block) headers["retry-after"] = String(secondsToMonthEnd(now));
  return { block, headers };
}

/** Cached plan lookup (fail-open: a thrown resolution reads as "no plan"). */
export async function getCachedPlan(db: ApiDb, orgId: string, now: Date): Promise<ApiPlan | null> {
  const hit = planCache.get(orgId);
  if (hit && hit.expires > now.getTime()) return hit.plan;
  let plan: ApiPlan | null = null;
  try {
    plan = await resolveApiPlan(db, orgId, now);
  } catch {
    /* fail-open */
  }
  planCache.set(orgId, { expires: now.getTime() + PLAN_TTL_MS, plan });
  return plan;
}

async function getCachedUsage(env: Env, orgId: string, now: Date): Promise<number | null> {
  const hit = usageCache.get(orgId);
  if (hit && hit.expires > now.getTime()) return hit.used;
  const used = await readMonthlyUsage(env, orgId, now);
  usageCache.set(orgId, { expires: now.getTime() + USAGE_TTL_MS, used });
  return used;
}

/**
 * The pipeline entry. Zero-cost short-circuit when there is nothing to do:
 * without AE creds no usage exists, so unless enforcement is (mis)flagged on,
 * skip even the plan lookup.
 */
export async function evaluateQuota(env: Env, db: ApiDb, orgId: string, now: Date): Promise<QuotaOutcome> {
  const enforce = env.QUOTA_ENFORCE === "true";
  const canRead = !!env.AE_ACCOUNT_ID && !!env.AE_API_TOKEN;
  if (!canRead && !enforce) return { block: false, headers: {} };
  const plan = await getCachedPlan(db, orgId, now);
  if (!plan || plan.monthlyCallAllowance == null) return { block: false, headers: {} };
  const used = canRead ? await getCachedUsage(env, orgId, now) : null;
  return quotaDecision(plan.monthlyCallAllowance, used, enforce, now);
}
