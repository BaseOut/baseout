## Why

Airtable's webhook callbacks are a public-facing contract. The receiver endpoint must be available even when the data plane (`server`) is being deployed; signature scheme changes, hostname/route changes, and observability for callback rates need to ship on their own cadence; and the public auth model (HMAC against a per-webhook secret) is structurally different from the user-token auth used by `web`, `inbound-api`, and `sql-rest-api`. This change establishes `apps/hooks` as the standalone public Airtable webhook receiver.

**Architecture (settled 2026-07-18, supersedes the earlier forward-to-DO design):** Airtable notification pings carry no change data — only `{base.id, webhook.id, timestamp}`. The actual changes are pulled later via the cursor-based payloads API. The receiver therefore does NOT forward events, enqueue work, or wake any Durable Object. It verifies the MAC and records "this base has changes waiting" as a single `last_ping_at` timestamp upsert on the central `airtable_webhooks` registry in the master DB. Per-Space cadence polling (owned by `server`) discovers dirty bases from that table on each Space's own schedule. A lost ping loses nothing: Airtable retains payloads for 7 days and the stored cursor is the source of truth.

## What Changes

- Establish `apps/hooks` as a standalone Cloudflare Workers project, deployed independently of every other Baseout app.
- Public hostname `hooks.baseout.com` bound to the Worker, exposing `POST /webhooks/airtable/{webhook_row_id}` (path parameter is OUR `airtable_webhooks.id` uuid, embedded in the `notificationUrl` at webhook-creation time).
- Verify Airtable's `X-Airtable-Content-MAC` HMAC-SHA256 signature against the per-webhook secret stored (encrypted) in `airtable_webhooks`.
- On success: upsert `last_ping_at = now()` (+ `last_ping_source_ip`) on the matching `airtable_webhooks` row. That is the entire write path — no event rows, no queue, no forwarding.
- Respond `200` with an **empty body** (Airtable requires 200/204 + empty body; anything else counts as a failed delivery).
- Reject requests with missing/invalid signatures (401), unknown `webhook_row_id`, or `status='inactive'` rows (410).
- On master-DB write failure: respond `503`. Airtable retries pings up to 13 times with exponential backoff over ~1 day; sustained failure must alert on-call well before retry exhaustion, because exhaustion causes Airtable to **disable notifications** for the webhook (recovery via the toggle-notifications endpoint is owned by `server-cron-webhook-renewal`).
- Emit structured logs and metrics (callback rate, rejection rate by reason, DB-write latency).

## Capabilities

### New Capabilities

- `airtable-webhook-receiver`: Public Cloudflare Worker endpoint at `POST /webhooks/airtable/{webhook_row_id}` that authenticates Airtable callbacks via HMAC and marks the owning webhook row dirty (`last_ping_at`). This app never processes payloads, never touches per-space DBs, never triggers runs, and holds no state beyond the master-DB registry row it updates — change detection and processing live in `server` (`airtable-webhook-polling`) and `workflows` (`incremental-backup-task`).

### Modified Capabilities

None — this is the initial `apps/hooks` implementation.

## Impact

- **App**: `apps/hooks/` — Cloudflare Workers project (currently a placeholder Worker; this change fills it in).
- **Consumed packages**: `@baseout/db-schema` (for the `airtable_webhooks` upsert), `@baseout/shared` (HMAC verify helper, AES-256-GCM decrypt).
- **External dependencies**: Cloudflare Workers, master Postgres (Hyperdrive).
- **Cross-app contracts**:
  - With `web`: none direct. The canonical `airtable_webhooks` migration is owned by `apps/web` per CLAUDE.md; specced in `server-instant-webhook` Phase A.
  - With `server`: none at runtime. The shared contract is the `airtable_webhooks` table shape — hooks writes `last_ping_at`/`last_ping_source_ip`; server reads them. No service binding, no internal HTTP.
  - With Airtable: receiver of notification pings per Airtable's webhook contract (200/204 + empty body; 13-retry/1-day backoff on failure; notifications disabled after exhaustion).
- **Master DB access**: reads + updates `airtable_webhooks` only (secret, status, `last_ping_at`).
- **Secrets**: master DB connection string (Hyperdrive), master encryption key (decrypt per-webhook MAC secrets).
- **Operational**: `wrangler.jsonc` per environment with one route binding (`hooks.baseout.com`), Logpush + tail Workers, on-call alerts for elevated rejection rates and sustained 503s (ping-retry-exhaustion risk).

## Deferred (explicitly out, with re-entry criteria)

- **Cloudflare Queue as a write buffer** — only if load testing shows the direct upsert path saturating (the upsert is one indexed row update per ping, and Airtable pre-coalesces pings). A queue would slot between verify and upsert with zero downstream changes.
- **KV caching of webhook rows** (secret + status) — only if the master-DB lookup dominates callback latency at load.
- **Multi-secret rotation overlap** — V1 is single-secret; Airtable rotates the MAC secret only on webhook re-creation, which the lifecycle handles by replacing the row.
