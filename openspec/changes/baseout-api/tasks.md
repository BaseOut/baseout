## 1. Phase 0 — Foundation

- [ ] 1.1 Create `apps/inbound-api/` repo with README, Vitest, Drizzle, Zod, msw, Wrangler config
- [ ] 1.2 Wire GitHub Actions CI (Vitest + OpenAPI-diff check on `/v1/` schemas)
- [ ] 1.3 Provision Cloudflare Workers project (production + staging) with route binding for `api.baseout.com`
- [ ] 1.4 Consume `@baseout/db-schema` (pinned version)
- [ ] 1.5 Populate Cloudflare Secrets (master DB string, master encryption key, service-to-`baseout-backup` HMAC)

## 2. Phase 1 — Receiver + Auth

- [ ] 2.1 Implement bearer-token auth via `api_tokens` SHA-256 hash lookup
- [ ] 2.2 Implement structured 401 / 200 responses; never log plaintext bearer
- [ ] 2.3 Lock token format + auth header contract with `baseout-web` (which manages token CRUD)

## 3. Phase 2 — Validation + Rate Limit + Credit

- [ ] 3.1 Author Zod schemas for `/v1/inbound/automations`
- [ ] 3.2 Author Zod schemas for `/v1/inbound/interfaces`
- [ ] 3.3 Author Zod schemas for `/v1/inbound/synced-tables`
- [ ] 3.4 Author Zod schemas for `/v1/inbound/custom-metadata`
- [ ] 3.5 Implement per-token monthly rate limits (10K Growth, 50K Pro, 200K Business, Unlimited Enterprise)
- [ ] 3.6 Implement period reset on Stripe `invoice.paid` for the Org
- [ ] 3.7 Implement credit-debit-then-forward (1 credit per 100 calls) via `credit_transactions`
- [ ] 3.8 Implement refund-on-failure (negative `credit_transactions` row with `reason='inbound_forward_failed'`)
- [ ] 3.9 Return structured 429 with rate-limit headers; structured 402 on credit cap

## 4. Phase 3 — Forwarding

- [ ] 4.1 Implement HMAC service-token forwarder to `baseout-backup`'s `/inbound/automations`
- [ ] 4.2 Implement forwarder for `/inbound/interfaces`
- [ ] 4.3 Implement forwarder for `/inbound/synced-tables`
- [ ] 4.4 Implement forwarder for `/inbound/custom-metadata`
- [ ] 4.5 Lock forwarder contract with `baseout-backup` before launch
- [ ] 4.6 Implement retry on transient 5xx (max 1 retry; if both fail, refund credits)

## 5. Phase 4 — Documentation

- [ ] 5.1 Add `zod-to-openapi` integration; auto-generate OpenAPI 3 spec from runtime Zod schemas
- [ ] 5.2 Set up `docs.baseout.com` hosting (separate Pages project or static asset)
- [ ] 5.3 Wire CI step: regenerate OpenAPI on every PR; fail if `/v1/` breaks (additive only)
- [ ] 5.4 Publish v1 OpenAPI spec at launch

## 6. Phase 5 — Pre-Launch Hardening

- [ ] 6.1 Run load test for rate-limit counter contention; if master DB locks, migrate counters to Cloudflare KV with periodic flush
- [ ] 6.2 Secrets audit (no plaintext, no logs)
- [ ] 6.3 OpenAPI docs review with a sample external integrator
- [ ] 6.4 Configure error-rate alerts (4xx anomaly, 5xx anomaly)
- [ ] 6.5 Wire Logpush + tail Workers

## 7. Definition of Done — `baseout-inbound-api` V1 Launch

- [ ] 7.1 All 4 endpoints (`/automations`, `/interfaces`, `/synced-tables`, `/custom-metadata`) accept valid tokens, validate payloads, rate-limit, debit credits, and forward to `baseout-backup`
- [ ] 7.2 Refund-on-failure verified end-to-end
- [ ] 7.3 v1 OpenAPI spec published at `docs.baseout.com`
- [ ] 7.4 OpenAPI-diff CI check blocks breaking changes on `/v1/`
- [ ] 7.5 Load test passes at projected V1 traffic
- [ ] 7.6 No plaintext token in any log line
- [ ] 7.7 Cross-repo contracts locked: `api_tokens` shape with `baseout-web`, `/inbound/{type}` forwarder shape with `baseout-backup`
