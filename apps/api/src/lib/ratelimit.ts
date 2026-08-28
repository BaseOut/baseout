// Shadow-mode rate limiting via the Workers Rate Limiting binding
// (api-usage-tracking). Evaluated per authenticated request keyed by token id.
// While RATE_LIMIT_ENFORCE is not "true" (launch state), an over-limit outcome is
// logged + reflected in X-RateLimit-* headers but does NOT block. Flipping to
// enforce (429 + Retry-After) is a config change, not code. No-op (allow) when
// the binding is absent.

import { log } from "./log";
import type { Env } from "../env";

/** Provisional per-token rate — placeholder pending product-owner confirmation. */
export const SHADOW_LIMIT = 100;
export const SHADOW_WINDOW_SECONDS = 60;

export interface RateDecision {
  /** true → the request should be blocked with 429 (only when enforcing). */
  block: boolean;
  headers: Record<string, string>;
}

/** Pure: given the binding outcome + enforce flag, decide block + headers. */
export function rateDecision(allowed: boolean, enforce: boolean, limit = SHADOW_LIMIT): RateDecision {
  const headers: Record<string, string> = {
    "x-ratelimit-limit": String(limit),
    "x-ratelimit-remaining": allowed ? String(limit) : "0",
  };
  if (allowed) return { block: false, headers };
  if (enforce) {
    return { block: true, headers: { ...headers, "retry-after": String(SHADOW_WINDOW_SECONDS) } };
  }
  return { block: false, headers }; // shadow: over limit but not enforced
}

/**
 * Tier-aware limiter selection (api-productionization 4.1): when a per-plan
 * binding exists (RATE_LIMITER_LITE / _CORE / _PLUS / _MAX / _ENTERPRISE —
 * declared in wrangler once Dan's per-tier numbers land), the org's plan slug
 * picks it; otherwise the flat default binding applies. Pure fallback chain,
 * so shipping the numbers is config-only.
 */
export function limiterForPlan(env: Env, planSlug: string | null): Env["RATE_LIMITER"] {
  if (planSlug) {
    const perTier = (env as Record<string, unknown>)[`RATE_LIMITER_${planSlug.toUpperCase()}`] as Env["RATE_LIMITER"];
    if (perTier) return perTier;
  }
  return env.RATE_LIMITER;
}

/** Any per-tier binding declared? (Gates the per-request plan lookup.) */
export function hasTierLimiters(env: Env): boolean {
  return !!(env.RATE_LIMITER_LITE || env.RATE_LIMITER_CORE || env.RATE_LIMITER_PLUS || env.RATE_LIMITER_MAX || env.RATE_LIMITER_ENTERPRISE);
}

/** Evaluate the binding (allow on any error/absence) and derive the decision. */
export async function evaluateRateLimit(env: Env, tokenId: string, planSlug: string | null = null): Promise<RateDecision> {
  const enforce = env.RATE_LIMIT_ENFORCE === "true";
  const limiter = limiterForPlan(env, planSlug);
  if (!limiter) return rateDecision(true, enforce);
  let allowed = true;
  try {
    allowed = (await limiter.limit({ key: tokenId })).success;
  } catch (err) {
    log.warn("api.ratelimit.eval_failed", { err: err instanceof Error ? err.message : String(err) });
    return rateDecision(true, enforce);
  }
  if (!allowed) {
    log.warn("api.ratelimit.over_limit", { tokenId, enforce });
  }
  return rateDecision(allowed, enforce);
}
