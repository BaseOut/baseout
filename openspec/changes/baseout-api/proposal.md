## Why

The Inbound API (`/api/v1/inbound/*`) is a public, token-authorized programmatic API used by Airtable Scripts, AI agents, and external automations to submit data Airtable's REST API does not expose (Automations, Interfaces, Synced Tables, custom metadata). It needs its own URL-versioned contract that NEVER breaks v1, its own deploy and version cadence (independent of UI iteration in `baseout-web` or data-plane changes in `baseout-backup`), and a clear ownership boundary as the public auth/validation/rate-limit/billing layer for back-side ingestion. None of it exists yet. This change moves the Inbound API out of `baseout-web` (where it was originally proposed) into its own runtime repo `baseout-inbound-api` and converts the spec for that repo.

## What Changes

- Establish `baseout-inbound-api` as a standalone Cloudflare Workers project at `apps/inbound-api/`, deployed independently of every other Baseout repo.
- Public hostname (e.g., `api.baseout.com`) with URL-versioned paths under `/v1/inbound/*`.
- Bearer-token authentication using the shared `api_tokens` table (master DB), same hash + plaintext-once-at-creation model `baseout-web` uses for token CRUD.
- Per-endpoint Zod validation for `POST /v1/inbound/automations`, `/interfaces`, `/synced-tables`, `/custom-metadata` (extensible).
- Tier-based monthly rate limits (10K Growth, 50K Pro, 200K Business, Unlimited Enterprise) per token, period reset at billing boundary.
- Credit consumption: 1 credit per 100 inbound calls debited via `credit_transactions`.
- Forward validated payloads to `baseout-backup`'s internal `/inbound/{type}` endpoints (HMAC service-token-authed); `baseout-inbound-api` SHALL NOT write to client DBs directly.
- OpenAPI 3 specification hosted at `docs.baseout.com`.

## Capabilities

### New Capabilities

- `inbound-api`: Public versioned ingestion API at `api.baseout.com/v1/inbound/*` with Bearer-token auth (`api_tokens`), Zod validation per endpoint, tier-based monthly rate limits, per-call credit consumption, forwarding to `baseout-backup`'s internal ingestion endpoints, and OpenAPI documentation at `docs.baseout.com`.

### Modified Capabilities

None — this is the initial `baseout-inbound-api` implementation.

## Impact

- **New repo**: `apps/inbound-api/` — Cloudflare Workers project for the public Inbound API.
- **Consumed packages**: `@baseout/db-schema` (Drizzle schema for `api_tokens`, `credit_buckets`, `credit_transactions`).
- **External dependencies**: Cloudflare Workers, DigitalOcean PostgreSQL (master DB reads/writes), Zod, OpenAPI docs hosting at `docs.baseout.com`.
- **Cross-repo contracts**:
  - With `baseout-web`: shares the `api_tokens` table that `baseout-web` manages CRUD on; reads tokens for auth verification; never invokes `baseout-web`.
  - With `baseout-backup`: forwards validated Inbound API payloads to `baseout-backup`'s internal `/inbound/{type}` endpoints with HMAC service token; receives a write-confirmation response.
- **Master DB access**: reads `api_tokens` (auth), reads `subscription_items` + `plan_limits` (tier-gating + rate-limit lookup), reads `organization_billing_settings` (overage cap), writes `credit_transactions` (per-call credit debit), reads `credit_buckets` + `organization_credit_balance` (bucket priority debiting).
- **Secrets**: master DB connection string, master encryption key (`api_tokens` hashing), service-to-`baseout-backup` HMAC.
- **Operational**: a `wrangler.jsonc` per environment with one route binding (the public hostname `api.baseout.com`), Logpush + tail Workers, on-call alert routing for elevated 4xx/5xx rates, OpenAPI docs deploy pipeline.
- **Public contract stability**: URL-versioned (`/v1/`); v1 SHALL NEVER break (additive changes only). Breaking changes ship as `/v2/` with parallel availability.
