## 1. Phase 0 — Foundation

- [ ] 1.1 Create `apps/webhook-ingestion/` repo with README, Vitest, Drizzle, msw, Wrangler config
- [ ] 1.2 Wire GitHub Actions CI (Vitest)
- [ ] 1.3 Provision Cloudflare Workers project (production + staging) with route binding for `webhooks.baseout.com`
- [ ] 1.4 Consume `@baseout/db-schema` (pinned version)
- [ ] 1.5 Populate Cloudflare Secrets (master DB string, master encryption key, service-to-`server` HMAC)

## 2. Phase 1 — Receiver + HMAC

- [ ] 2.1 Implement `POST /webhooks/airtable/{webhook_id}` route handler
- [ ] 2.2 Look up `airtable_webhooks` by `airtable_webhook_id` to fetch per-webhook HMAC secret + `space_id` + `is_active`
- [ ] 2.3 Verify Airtable HMAC signature; reject mismatched signatures with 401
- [ ] 2.4 Reject unknown `webhook_id` with 410
- [ ] 2.5 Reject `is_active=false` rows with 410
- [ ] 2.6 Reject missing-signature requests with 401

## 3. Phase 2 — Forward

- [ ] 3.1 Implement service binding to `server`'s per-Space DO (preferred path)
- [ ] 3.2 Implement HMAC-authed internal HTTP forwarder (fallback path)
- [ ] 3.3 Forwarding payload includes verified `webhook_id`, `space_id`, raw event
- [ ] 3.4 Return 200 to Airtable on successful forward
- [ ] 3.5 Return 503 on forward failure so Airtable retries
- [ ] 3.6 Lock forward contract with `server` before launch

## 4. Phase 3 — Observability

- [ ] 4.1 Emit structured logs for each callback (signature outcome, lookup outcome, forward outcome)
- [ ] 4.2 Emit metrics: callback rate, rejection rate by reason, forward latency
- [ ] 4.3 Configure on-call alert when rejection rate spikes above threshold
- [ ] 4.4 Configure on-call alert on forward failure rate
- [ ] 4.5 Wire Logpush + tail Workers

## 5. Phase 4 — Pre-Launch Hardening

- [ ] 5.1 Load test at projected V1 callback rate
- [ ] 5.2 Security review: signature bypass attempts, malformed-payload handling
- [ ] 5.3 Test downstream-failure handling: simulate `server` outage; verify Airtable retries are accepted on recovery
- [ ] 5.4 Optionally add Cloudflare KV caching for `airtable_webhooks` lookups if load test shows DB latency dominates

## 6. Definition of Done — `webhook-ingestion` V1 Launch

- [ ] 6.1 Receiver verifies HMAC and rejects invalid signatures cleanly
- [ ] 6.2 Receiver looks up Space and forwards verified events to `server`
- [ ] 6.3 No event reaches `server` without HMAC verification
- [ ] 6.4 Forward failures return 5xx so Airtable retries
- [ ] 6.5 Receiver continues accepting callbacks during a `server` deploy (with brief 5xx-and-retry behavior, no event loss)
- [ ] 6.6 Observability + alerting wired
- [ ] 6.7 Independent deploy verified — receiver redeploys without `server` redeploy and vice versa
