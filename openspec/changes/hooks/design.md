## Context

`webhook-ingestion` is the public-facing Cloudflare Worker that Airtable POSTs webhook callbacks to. It's deliberately thin: verify HMAC, look up the row, forward to `server`'s per-Space DO. No coalescing, no persistence, no run-triggering — those concerns live in `server`'s `airtable-webhook-coalescing` capability so that the public contract (this repo) and the data-plane consumption (`server`) can be versioned and deployed independently.

Stakeholders: Airtable (the upstream caller), `server` team (downstream consumer of forwarded events), security/on-call (signature verification correctness, rejection-rate monitoring).

Constraints carried in from product:
- **Independent versioning + deploy** — auth or routing changes should ship without redeploying any other repo. Conversely, `server` deploys must not interrupt webhook reception.
- **No event loss at the receiver** — if downstream forwarding fails, return 5xx so Airtable retries per its delivery policy.
- **Defense-in-depth on signature verification** — never forward an unverified event.
- **No client DB writes** — those are `server`'s job.

## Goals / Non-Goals

**Goals:**
- Median callback latency (verify + forward) under 100ms.
- Zero forward attempts for invalid signatures.
- Clean signal to Airtable's retry mechanism on downstream failure (5xx propagated).
- Independent deploy: `server` redeploys do not require this repo to redeploy and vice versa.

**Non-Goals:**
- Event coalescing (`server`).
- Cursor advancement (`server`).
- Gap detection / full re-read fallback (`server`).
- Webhook lifecycle (registration on Instant Backup enable, renewal cron — `server`).
- Persistence of any kind (this Worker is stateless beyond DB reads).

## Decisions

### Standalone repo (vs. living in `server`)
The public Airtable contract (signature scheme, hostname, route shape) must be deployable independently of the data plane. Splitting the receiver out lets us ship signature scheme rotations or hostname changes without touching the backup engine, and lets the data plane redeploy without interrupting Airtable callback reception. Trade: an extra service-binding hop per event; sub-millisecond on Cloudflare; accepted.

### Service binding to `server` (preferred over public HTTP)
Cloudflare service bindings give us sub-millisecond intra-account forwarding with no public exposure of the per-Space DO endpoint. Fallback if service bindings are unavailable: HMAC-authenticated internal HTTP. Resolved.

### HMAC verification BEFORE any DB lookup
Order of operations matters. Verify HMAC first using the `webhook_id` parameter to look up the secret from `airtable_webhooks`. An attacker probing arbitrary `webhook_id` values gets a fast 401 and never causes downstream forward attempts. (We still do the DB read to get the secret — there's no way to verify HMAC without it — but we exit on signature mismatch before any forwarding.)

### Rejection on missing or invalid `webhook_id` / inactive rows
- Unknown `webhook_id` (no row in `airtable_webhooks`) → 410 Gone (so Airtable stops retrying eventually).
- `is_active=false` row → 410 Gone (so deregistered webhooks don't accidentally fire).
- HMAC mismatch → 401.
- Forward failure → 5xx (so Airtable retries).

### No event-id deduplication here
Dedup happens in `server`'s per-Space DO (so duplicate forwards are a no-op there). Doing dedup here would require state, which we want to avoid.

## Risks / Trade-offs

- **[Risk] DB lookup latency under high callback rate** → Cache `airtable_webhooks` rows in Cloudflare KV with a short TTL (60s) for hot webhook_ids; fall back to master DB on miss. Implement only if load test shows DB lookup is the bottleneck.
- **[Risk] `server` deploy in progress causes forward failures** → Receiver returns 503; Airtable retries per its policy; brief delivery delay but no data loss.
- **[Risk] Signature scheme rotation** → Schema supports multiple active secrets per webhook; rotation is staggered (old + new valid for an overlap window). V1 ships single-secret; multi-secret support is V1.1+.
- **[Trade-off] No event-id dedup at receiver** → Pushes dedup responsibility to `server`. Accepted because dedup needs state and this repo is stateless beyond DB reads.

## Migration Plan

### Build sequence

1. **Phase 0 — Foundation**: `apps/webhook-ingestion/` repo, CI/CD, Cloudflare Workers project per env, secrets, `@baseout/db-schema` consumption.
2. **Phase 1 — Receiver + HMAC**: route binding for `webhooks.baseout.com`, HMAC verification using per-webhook secret from `airtable_webhooks`, structured rejection responses (401/410).
3. **Phase 2 — Forward**: service binding to `server`'s per-Space DO; lock the forward contract with `server` before launch.
4. **Phase 3 — Observability**: structured logs (signature outcome, lookup outcome, forward outcome), metrics (callback rate, rejection rate by reason, forward latency), alerting on rejection-rate spikes.
5. **Phase 4 — Hardening**: load test, security review (signature bypass attempts), staged rollout.

### Rollback strategy
- DNS rollback: `webhooks.baseout.com` cutover via Cloudflare DNS in seconds.
- Worker rollback: `wrangler rollback` in <2 minutes.
- Airtable retries: Airtable's webhook-delivery policy retries 5xx, so a bad deploy that returns 5xx delays delivery but does not lose events.

## Open Questions

| # | Question | Default Answer |
|---|---|---|
| W1 | DB-lookup caching | V1: master DB direct; add KV caching if load test shows latency. |
| W2 | Service binding vs internal HTTP | V1: service binding preferred; HMAC HTTP as fallback. |
| W3 | Multi-secret rotation support | V1.1+; ship single-secret in V1. |
| W4 | Public hostname | `webhooks.baseout.com` (recommend); confirm with Airtable webhook config + DNS owner. |
