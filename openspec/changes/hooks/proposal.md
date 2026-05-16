## Why

Airtable's webhook callbacks are a public-facing contract. The receiver endpoint must be available even when the data plane (`server`) is being deployed; signature scheme rotations, hostname/route changes, and observability for callback rates need to ship on their own cadence; and the public auth model (HMAC against a per-webhook secret) is structurally different from the user-token auth used by `web`, `inbound-api`, and `sql-rest-api`. None of it exists yet. This change splits the Airtable webhook receiver out of `server` into its own runtime repo `webhook-ingestion` that is independently versioned and deployed.

## What Changes

- Establish `webhook-ingestion` as a standalone Cloudflare Workers project at `apps/webhook-ingestion/`, deployed independently of every other Baseout repo.
- Public hostname (e.g., `webhooks.baseout.com`) bound to a Cloudflare Worker that exposes `POST /webhooks/airtable/{webhook_id}`.
- Verify Airtable's HMAC signature against the per-webhook secret stored in `airtable_webhooks`.
- Look up the owning Space (`space_id`) and Connection from `airtable_webhooks.airtable_webhook_id`.
- Forward verified events to `server`'s per-Space Durable Object via service binding (or HMAC-authed internal HTTP).
- Reject (and never forward) requests with missing/invalid signatures, unknown `webhook_id`, or `is_active=false` rows.
- Emit structured logs and metrics (callback rate, rejection rate by reason, forward latency).

## Capabilities

### New Capabilities

- `airtable-webhook-receiver`: Public Cloudflare Worker endpoint at `POST /webhooks/airtable/{webhook_id}` that authenticates Airtable callbacks via HMAC, looks up the owning Space, and forwards verified events to `server`'s per-Space DO. Independent deploy + version cadence; this repo never coalesces events, never persists to client DBs, and never triggers backup runs — those concerns live in `server`'s `airtable-webhook-coalescing` capability.

### Modified Capabilities

None — this is the initial `webhook-ingestion` implementation.

## Impact

- **New repo**: `apps/webhook-ingestion/` — Cloudflare Workers project for the public Airtable webhook receiver.
- **Consumed packages**: `@baseout/db-schema` (for `airtable_webhooks` lookup).
- **External dependencies**: Cloudflare Workers, DigitalOcean PostgreSQL (master DB read).
- **Cross-repo contracts**:
  - With `server`: forwards verified events to the per-Space Durable Object via service binding (preferred) or HMAC-authenticated internal HTTP. The forward-target contract MUST be locked before launch.
  - With `web`: none direct. (`web` users enable Instant Backup; `server` calls Airtable to register webhooks and writes the `airtable_webhooks` row that this repo reads.)
  - With Airtable: receiver of Airtable webhook callbacks per Airtable's webhook contract.
- **Master DB access**: reads `airtable_webhooks` (signature secret + `space_id` + `is_active`).
- **Secrets**: master DB connection string, master encryption key (decrypt per-webhook secrets), service-to-`server` HMAC (forward auth).
- **Operational**: a `wrangler.jsonc` per environment with one route binding (the public hostname `webhooks.baseout.com`), Logpush + tail Workers, on-call alert routing for elevated rejection rates or forward failures.
