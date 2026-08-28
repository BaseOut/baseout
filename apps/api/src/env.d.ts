// Worker bindings for apps/api (public read REST API — api-rest-read).
//
// Master DB is read in-Worker (org/space/backup resources + api_tokens auth);
// per-Space schema is read ONLY through apps/server via the SERVER service
// binding (design D3). Analytics Engine + Rate Limiting are optional so the
// Worker runs locally / in tests without them (metering + shadow limiting are
// failure-isolated no-ops when unbound).

export interface Env {
  /** Master Postgres URL — local wrangler dev only; deployed envs use HYPERDRIVE. */
  DATABASE_URL?: string;
  /** Hyperdrive binding — deployed envs (production / staging). */
  HYPERDRIVE?: Hyperdrive;

  /** Service binding to baseout-server (internal schema read/search/versions/changelog). */
  SERVER?: Fetcher;
  /**
   * Shared secret gating apps/server's /api/internal/* (its INTERNAL_TOKEN).
   * apps/api sends it as `x-internal-token` over the SERVER binding. (The design
   * names an HMAC service token; the deployed server gate is the header token —
   * matched here, HMAC can supersede uniformly later.)
   */
  INTERNAL_TOKEN?: string;

  /** Workers Analytics Engine dataset for per-request usage metering (baseout_api_requests). */
  API_USAGE?: AnalyticsEngineDataset;
  /** Workers Rate Limiting binding — evaluated in shadow mode (see RATE_LIMIT_ENFORCE). */
  RATE_LIMITER?: RateLimit;
  /** Optional per-tier limiters (api-productionization 4.1) — declared when
   *  Dan's per-tier numbers land; the org's plan slug selects one, falling
   *  back to RATE_LIMITER. */
  RATE_LIMITER_LITE?: RateLimit;
  RATE_LIMITER_CORE?: RateLimit;
  RATE_LIMITER_PLUS?: RateLimit;
  RATE_LIMITER_MAX?: RateLimit;
  RATE_LIMITER_ENTERPRISE?: RateLimit;
  /** "true" flips shadow rate limiting to enforcing (429). Default (unset/anything else) = shadow. */
  RATE_LIMIT_ENFORCE?: string;
  /** "true" blocks with 429 once monthly usage ≥ the plan allowance (quota.ts).
   *  Default off; requires the AE read creds below to have evidence to act on. */
  QUOTA_ENFORCE?: string;

  /** Web console origin for MCP appUrl deep links (api-search-tools D4).
   *  Unset (production, until Dan's env lane) → enrichment is a no-op. */
  PUBLIC_APP_URL?: string;

  /** Analytics Engine SQL-read credentials for the usage surface
   *  (api-productionization D3). OPTIONAL secrets — unset ⇒ usage reads null.
   *  NOT in wrangler vars; set via .dev.vars → secret sync when provisioned. */
  AE_ACCOUNT_ID?: string;
  AE_API_TOKEN?: string;
}

/** Workers Rate Limiting binding shape (beta) — minimal typing. */
export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
