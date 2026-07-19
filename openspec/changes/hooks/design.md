## Context

`apps/hooks` is the public-facing Cloudflare Worker that Airtable POSTs webhook notification pings to. It is deliberately thin: verify HMAC, mark the registry row dirty, ack. Airtable pings contain no change data (`{base.id, webhook.id, timestamp}` only — ~100 bytes); the data is pulled later by the per-Space polling pipeline via the cursor-based payloads API. So this app ingests wake-up signals, not data.

Stakeholders: Airtable (the upstream caller), `server` team (reads `last_ping_at` from the shared registry), security/on-call (signature verification correctness, rejection-rate + 503 monitoring).

Constraints carried in from product:
- **Independent versioning + deploy** — receiver changes ship without redeploying any other app; `server` deploys never interrupt webhook reception (there is no runtime dependency on `server` at all in this design).
- **Ping-loss tolerance by design** — Airtable retains payloads 7 days and cursors are client-held, so a dropped ping delays discovery at worst. Still: return 503 on DB failure so Airtable retries (13 attempts, exponential backoff from 10s, ~1 day).
- **Defense-in-depth on signature verification** — never mark a row dirty for an unverified request.
- **No client-data exposure** — the central registry holds base IDs, webhook IDs, timestamps, and an encrypted secret. No record data ever transits this app.

## Goals / Non-Goals

**Goals:**
- Median callback latency (verify + upsert) under 100ms.
- Zero dirty-marks for invalid signatures.
- Correct ack contract: 200 + empty body on success (Airtable treats anything else as failure).
- Alert before Airtable's 13-retry exhaustion disables notifications.

**Non-Goals:**
- Payload polling, change processing, cursor management (`server` + `workflows`).
- Webhook lifecycle — registration, dedupe, deletion, renewal, notification re-enable (`server`).
- Event queuing or coalescing — Airtable pre-coalesces pings; the timestamp upsert is naturally idempotent.
- Persistence beyond the one registry row update.

## Decisions

### Dirty-flag upsert instead of forward/queue (supersedes forward-to-DO design)
Because pings carry no data and payloads are replayable for 7 days from a client-held cursor, per-event delivery guarantees buy nothing. The receiver's only job is to record "changes are waiting" — a monotonic `last_ping_at` bump. N pings in a burst collapse into one row update; the per-Space pollers compare `last_ping_at` against their own watermarks. This removes the service binding to `server`, the `webhook_events` table, and all queue infrastructure from the critical path. A Cloudflare Queue remains a documented drop-in write buffer if load testing demands it.

### No central "processed" flag
Multiple Spaces can subscribe to one webhook (org-level dedupe, Airtable's 2-webhooks-per-base-per-OAuth-integration cap). "Processed" is per-Space state (each Space's `last_polled_at` watermark + payload cursor on its subscription row), never a column on the shared webhook row.

### Our row-id in the URL path, not Airtable's webhook id
The `notificationUrl` we register embeds our `airtable_webhooks.id` uuid: `https://hooks.baseout.com/webhooks/airtable/{id}`. That gives a primary-key lookup, avoids trusting the request body before MAC verification, and survives Airtable webhook re-creation (new Airtable id, new row, new URL). The body's `webhook.id`/`base.id` are cross-checked against the row after verification as defense-in-depth.

### HMAC verification order
Read raw body → PK lookup by path id (410 if absent/inactive) → decrypt secret → verify `X-Airtable-Content-MAC` = HMAC-SHA256(raw body, base64-decoded secret) (401 on missing/mismatch) → parse JSON → cross-check ids → upsert. An attacker probing arbitrary path ids gets a fast 410/401 and never dirties a row.

### Response codes
- Valid → **200, empty body** (Airtable requires 200/204 + empty body).
- Unknown `webhook_row_id` or `status='inactive'` → **410** (Airtable's retries stop being useful; lifecycle cleanup is server's job).
- MAC missing/mismatch, or body ids don't match the row → **401**.
- Master-DB failure → **503** (Airtable retries ~1 day; alert fires well before exhaustion).

## Risks / Trade-offs

- **[Risk] Sustained DB outage > ~1 day exhausts Airtable's ping retries and notifications get disabled** → payloads still accumulate on Airtable's side; `server-cron-webhook-renewal` re-enables notifications via the toggle endpoint and the per-Space safety sweep (unconditional poll at least daily) catches anything missed. Alerting threshold: 503 rate sustained > 15 minutes pages on-call.
- **[Risk] DB lookup latency under high callback rate** → PK lookup on a small table via Hyperdrive; add KV caching (60s TTL) only if load tests show it dominating.
- **[Risk] Hot-row contention if one base pings very frequently** → Airtable coalesces pings per webhook, and the upsert is a single-row timestamp write; acceptable. If it ever isn't, the Queue write buffer batches upserts.
- **[Trade-off] No per-ping durable log** → observability wants ping history; structured logs (Logpush) carry `{webhook_row_id, base_id, timestamp, source_ip, outcome}` per request instead of a DB table. Airtable's payload log is the durable record of what changed.

## Migration Plan

1. **Phase 0 — Foundation**: flesh out `apps/hooks` (currently a placeholder Worker): Hyperdrive binding, `@baseout/db-schema` consumption, secrets, CI.
2. **Phase 1 — Receiver + HMAC**: route binding for `hooks.baseout.com`, PK lookup, MAC verification, structured rejections (401/410), correct 200-empty-body ack.
3. **Phase 2 — Dirty-mark**: `last_ping_at`/`last_ping_source_ip` upsert; 503-on-DB-failure path.
4. **Phase 3 — Observability**: structured logs, metrics, alerting (rejection spikes; sustained 503s).
5. **Phase 4 — Hardening**: load test, security review (signature bypass, malformed payloads, oversized bodies), staged rollout.

Rollback: DNS cutover in seconds; `wrangler rollback` < 2 minutes; Airtable's retry policy means a bad deploy returning 5xx delays discovery but loses nothing.

## Open Questions

| # | Question | Default Answer |
|---|---|---|
| W1 | KV caching of webhook rows | V1: direct master DB via Hyperdrive; add KV if load test demands. |
| W2 | Queue write buffer | V1: direct upsert + 503-on-failure; Queue only if upsert path saturates. |
| W3 | Public hostname | `hooks.baseout.com` (settled — matches app name `apps/hooks`). |
| W4 | Body size cap | Reject > 64KB with 401 before verification (pings are ~100 bytes; anything large is not Airtable). |
