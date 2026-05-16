## Context

`inbound-api` is the public versioned ingestion API. It's a thin Cloudflare Workers project whose only job is to accept token-authenticated HTTP POSTs from external scripts and AI agents, validate the payloads, enforce tier-based rate limits, debit credits, and forward the validated payload to `server`'s internal ingestion endpoints. It does not own auth state (`api_tokens` is in master DB, managed by `web`), does not own client DB writes (`server` does), and does not render UI (`web` provides token CRUD).

Stakeholders: external developers and AI agents (the API consumers), `web` team (token CRUD owner), `server` team (downstream of forwarded payloads), product (versioning + rate-limit policy), revenue (credit consumption rate).

Constraints carried in from product:
- **URL-versioned, v1 never breaks** — additive changes only on `/v1/`; breaking changes ship as `/v2/` with parallel availability.
- **Auth lives in master DB** — `api_tokens` table is shared; this repo only reads it.
- **Forwards to backup; no direct client DB writes** — keeps client DB ownership clean.
- **Independently versioned and deployed** — auth or routing changes (e.g., signature scheme rotation) do not require redeploying any other repo.

## Goals / Non-Goals

**Goals:**
- A request from an external script reaches the receiver, gets authenticated, validated, rate-limit-checked, credit-debited, and forwarded in <300ms median (excluding `server` write time).
- v1 contract is stable across all V1 launch and beyond; no breaking change ships under `/v1/`.
- Rate-limit counting is accurate per period and resets cleanly at billing boundaries.
- Credit debiting is atomic with the request — a failed forward MUST NOT debit credits.
- OpenAPI docs are auto-generated from the same Zod schemas the runtime validates against (single source of truth).

**Non-Goals:**
- Token CRUD UI (`web`).
- Client DB writes (`server`).
- Email notifications.
- Capability resolution beyond the per-token tier check (the rich resolver is in `web`).
- Anything stateful beyond rate-limit counters in master DB.

## Decisions

### Standalone repo (vs. living in `web`)
The Inbound API is the public versioned ingestion contract. Versioning is the dominant constraint; `/v1/` MUST never break for external consumers regardless of UI iteration cadence. Splitting it out lets the public API ship on its own deploy schedule and keeps the contract change surface area visible. Trade: duplicated auth logic vs. `web` (token-hash check) — accepted because the duplication is small (a single `api_tokens` lookup) and the deploy-independence win is large.

### Forward to `server` (vs. write to client DBs directly)
This repo authenticates, validates, rate-limits, and debits credits, then POSTs to `server`'s internal `/inbound/{type}` endpoints. `server` owns the actual client DB write. Reason: client DB ownership stays with the data plane; this repo stays thin and stateless beyond the forward-and-debit transaction. Trade: extra hop (sub-millisecond on Cloudflare service binding); accepted.

### Bearer tokens + SHA-256 hash storage
Tokens are issued as plaintext once at creation (shown to the user) and stored as SHA-256 hashes in `api_tokens`. Authentication compares the hash of the presented bearer to the stored hash. No plaintext is ever logged. Resolved.

### Rate limits as monthly counters per token, reset at billing period
Counters live in master DB (or a derived counter table), per `(api_tokens.id, period_start)`. Reset on Stripe `invoice.paid` for the token's Org. Burst limits (per-second) are NOT enforced in V1 — Cloudflare's built-in DDoS protections handle abuse.

### Credit debit policy: debit-then-forward, refund-on-failure
Each call debits credits at validation success, BEFORE forwarding. If the forward to `server` returns a 5xx after credits were debited, the credit transaction is reversed (`credit_transactions` insert with negative amount, marked `reason='inbound_forward_failed'`). Reason: prevents customers from being charged for failed forwards while keeping the happy path simple.

### OpenAPI generated from Zod
The Zod schemas used for validation also generate the OpenAPI spec via `zod-to-openapi` (or similar). One source of truth. Docs deploy pipeline runs on each `/v1/` PR.

## Risks / Trade-offs

- **[Risk] Forward failure leaves credits debited and no work done** → Mitigated by refund-on-failure policy; covered by integration tests.
- **[Risk] Per-token rate-limit counter contention** → Counters in master DB risk lock contention at high call rates. If observed in load test, move to Cloudflare KV with eventual flush to master DB.
- **[Risk] Token leak via logs** → Strict logging policy: never log the bearer header, never include plaintext in error responses.
- **[Trade-off] Duplicated auth logic with `web`** → A few dozen lines of `api_tokens` hash lookup duplicated. Accepted — much smaller than the deploy-independence win.
- **[Trade-off] Forward latency** → ~5–20ms overhead per call vs. writing directly. Negligible for batch-oriented external automations.

## Migration Plan

### Build sequence

1. **Phase 0 — Foundation**: `apps/inbound-api/` repo, CI/CD, Cloudflare Workers project per env, secrets, `@baseout/db-schema` consumption.
2. **Phase 1 — Receiver + Auth**: route binding for `api.baseout.com`, bearer-token auth via `api_tokens` hash lookup, basic 401/200 responses.
3. **Phase 2 — Validation + Rate Limit + Credit**: Zod schemas per endpoint, monthly rate-limit counters, credit-debit-then-forward with refund-on-failure.
4. **Phase 3 — Forwarding**: HMAC service-token forwarder to `server`'s `/inbound/{type}` endpoints; lock the contract with `server` before launch.
5. **Phase 4 — Documentation**: OpenAPI 3 spec generated from Zod; deploy at `docs.baseout.com`.
6. **Phase 5 — Hardening**: load test (rate-limit counter contention), secrets audit, OpenAPI docs review with a real external integrator before public launch.

### Rollback strategy
- Public DNS rollback: Cloudflare DNS allows instant cutover; if a deploy breaks `/v1/`, revert the Workers deploy via `wrangler rollback` in <2 minutes.
- v1 contract: any change must be additive. Breaking change attempts caught in CI by an OpenAPI-diff check against the published v1.

## Open Questions

| # | Question | Default Answer |
|---|---|---|
| I1 | Per-second burst limits | V1: rely on Cloudflare DDoS; revisit if abuse observed. |
| I2 | Counter backing store: master DB vs Cloudflare KV | V1: master DB; move to KV with flush if contention shows up in load test. |
| I3 | Public hostname | `api.baseout.com` (recommend); confirm with marketing/legal before public launch. |
| I4 | OpenAPI docs hosting | `docs.baseout.com` (separate Pages project or static asset). Confirm with team. |
