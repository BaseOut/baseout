/// <reference types="astro/client" />

// Binding types (SURVEY_DB, runtime globals, the `cloudflare:workers` module)
// are generated into worker-configuration.d.ts by `wrangler types` — rerun it
// after changing wrangler.jsonc (the typecheck script does this automatically).
// Secrets are set via `wrangler secret put`, so they aren't in wrangler.jsonc;
// declare them here by merging into both Env surfaces.

interface SurveySecrets {
  /** Secret. Dev falls back to a fixed dev-only value. */
  BETTER_AUTH_SECRET?: string;
  /** Optional var — set to https://survey.baseout.com in prod; inferred from the request otherwise. */
  BETTER_AUTH_URL?: string;
  /** Secret. Absent in dev → magic links are logged to the dev server console instead of emailed. */
  RESEND_API_KEY?: string;
}

interface Env extends SurveySecrets {}

declare namespace Cloudflare {
  interface Env extends SurveySecrets {}
}
