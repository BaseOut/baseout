## Why

Airtable's webhook callbacks are a public-facing contract. The receiver endpoint must be available even when the data plane (`baseout-backup`) is being deployed; signature scheme rotations, hostname/route changes, and observability for callback rates need to ship on their own cadence; and the public auth model (HMAC against a per-webhook secret) is structurally different from the user-token auth used by `baseout-web`, `baseout-inbound-api`, and `baseout-sql-rest-api`. None of it exists yet. This change splits the Airtable webhook receiver out of `baseout-backup` into its own runtime repo `baseout-webhook-ingestion` that is independently versioned and deployed.

## What Changes

- Establish `baseout-webhook-ingestion` as a standalone Cloudflare Workers project at `apps/webhook-ingestion/`, deployed independently of every other Baseout repo.
- Public hostname (e.g., `webhooks.baseout.com`) bound to a Cloudflare Worker that exposes `POST /webhooks/airtable/{webhook_id}`.
- Verify Airtable's HMAC signature against the per-webhook secret stored in `airtable_webhooks`.
- Look up the owning Space (`space_id`) and Connection from `airtable_webhooks.airtable_webhook_id`.
- Forward verified events to `baseout-backup`'s per-Space Durable Object via service binding (or HMAC-authed internal HTTP).
- Reject (and never forward) requests with missing/invalid signatures, unknown `webhook_id`, or `is_active=false` rows.
- Emit structured logs and metrics (callback rate, rejection rate by reason, forward latency).

## Capabilities

### New Capabilities

- `airtable-webhook-receiver`: Public Cloudflare Worker endpoint at `POST /webhooks/airtable/{webhook_id}` that authenticates Airtable callbacks via HMAC, looks up the owning Space, and forwards verified events to `baseout-backup`'s per-Space DO. Independent deploy + version cadence; this repo never coalesces events, never persists to client DBs, and never triggers backup runs — those concerns live in `baseout-backup`'s `airtable-webhook-coalescing` capability.

### Modified Capabilities

None — this is the initial `baseout-webhook-ingestion` implementation.

## Impact

- **New repo**: `apps/webhook-ingestion/` — Cloudflare Workers project for the public Airtable webhook receiver.
- **Consumed packages**: `@baseout/db-schema` (for `airtable_webhooks` lookup).
- **External dependencies**: Cloudflare Workers, DigitalOcean PostgreSQL (master DB read).
- **Cross-repo contracts**:
  - With `baseout-backup`: forwards verified events to the per-Space Durable Object via service binding (preferred) or HMAC-authenticated internal HTTP. The forward-target contract MUST be locked before launch.
  - With `baseout-web`: none direct. (`baseout-web` users enable Instant Backup; `baseout-backup` calls Airtable to register webhooks and writes the `airtable_webhooks` row that this repo reads.)
  - With Airtable: receiver of Airtable webhook callbacks per Airtable's webhook contract.
- **Master DB access**: reads `airtable_webhooks` (signature secret + `space_id` + `is_active`).
- **Secrets**: master DB connection string, master encryption key (decrypt per-webhook secrets), service-to-`baseout-backup` HMAC (forward auth).
- **Operational**: a `wrangler.jsonc` per environment with one route binding (the public hostname `webhooks.baseout.com`), Logpush + tail Workers, on-call alert routing for elevated rejection rates or forward failures.
