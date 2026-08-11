## 1. Phase 0 — Foundation

- [x] 1.1 Flesh out `apps/hooks/` (placeholder Worker today): Vitest, msw, Hyperdrive binding in `wrangler.jsonc`, `.dev.vars.example` → Vitest wired (vitest.config.ts, 10 tests); Hyperdrive binding + local simulator shim (scripts/dev.mjs, same as apps/api); .dev.vars.example updated (DATABASE_URL + MASTER_ENCRYPTION_KEY only). msw not needed — DB seam is dep-injected, MAC crypto is real.
- [x] 1.2 Consume `@baseout/db-schema` (`airtable_webhooks`) and `@baseout/shared` (HMAC verify, AES-256-GCM decrypt) → @baseout/shared decryptToken + verifyAirtableContentMac (both implemented this change: packages/shared/src/{encryption,airtable-mac}.ts, cross-compat-tested vs apps/web crypto). airtable_webhooks consumed via a LOCAL mirror (src/db.ts) per the api_tokens precedent — canonical stays apps/web/src/db/schema/core.ts (migration 0030).
- [x] 1.3 Wire CI (Vitest) for the app → `pnpm --filter @baseout/hooks test` green (10).
- [ ] 1.4 Provision Cloudflare route binding for `hooks.baseout.com` (staging + production)
- [x] 1.5 Populate secrets via `.dev.vars` → `wrangler secret bulk` (master DB string, master encryption key) — no service-to-server token needed in this design → .dev.vars carries DATABASE_URL + MASTER_ENCRYPTION_KEY (gitignored); no service token by design. Deploy-time `wrangler secret bulk` rides the standard pipeline when 1.4 unblocks.

## 2. Phase 1 — Receiver + HMAC

- [x] 2.1 Implement `POST /webhooks/airtable/{webhook_row_id}` route handler (raw-body read first; 64KB cap) → src/index.ts (route regex, POST-only 405, raw arrayBuffer read) + src/receive.ts (64KB cap → 401 before any work).
- [x] 2.2 PK lookup of `airtable_webhooks` by path id; 410 on unknown id or `status='inactive'` → handlePing: fetchWebhookRow by PK; 410 unknown/inactive.
- [x] 2.3 Verify `X-Airtable-Content-MAC` = HMAC-SHA256(raw body, base64-decoded decrypted secret); 401 on missing/mismatch → real @baseout/shared verify, constant-time compare; 401 on missing/malformed/mismatch AND undecryptable secret.
- [x] 2.4 Cross-check parsed body `webhook.id` / `base.id` against the row; 401 + warn log on mismatch → parse only after MAC passes; webhook.id/base.id mismatch → 401 + webhook_ping_body_row_mismatch log.
- [x] 2.5 TDD: 401 mac missing, 401 mac mismatch, 410 unknown id, 410 inactive, 401 body/row mismatch → all five cases + oversized-body + decrypt-failure in tests/receive.test.ts (watched RED first).

## 3. Phase 2 — Dirty-mark

- [x] 3.1 Upsert `last_ping_at = now()`, `last_ping_source_ip` on the verified row → recordPing updates last_ping_at/last_ping_source_ip/modified_at.
- [x] 3.2 Return 200 with empty body on success (Airtable requires 200/204 + empty body) → 200 with null body; smoke asserts empty string.
- [x] 3.3 Return 503 on DB write failure (Airtable retries ~1 day) → recordPing throw → 503 (logged webhook_ping_record_failed).
- [x] 3.4 TDD: happy-path upsert; burst idempotency; 503 path with stubbed DB failure → covered (burst ×3 idempotency; stubbed throw → 503).

## 4. Phase 3 — Observability

- [x] 4.1 Structured log per callback: `webhook_row_id`, `base_id`, timestamp, source IP, outcome → structured JSON events: webhook_ping_recorded / mac_rejected / body_row_mismatch / record_failed / secret_decrypt_failed. Plus `webhook_receiver_misconfigured` / `webhook_receiver_error` on the wire layer.
- [ ] 4.2 Metrics: callback rate, rejection rate by reason, upsert latency — **DEFERRED (ops):** the 4.1 structured events already carry outcome + reason per ping, so the metrics are derivable via Logpush/Analytics once the pipeline exists. A dedicated Analytics Engine binding is deferred to the ops rollout (needs the binding provisioned) rather than added as a dead no-op seam.
- [ ] 4.3 Alert: rejection-rate spike above threshold — **DEFERRED (ops):** Cloudflare dashboard alert config; no dashboard access in this env.
- [ ] 4.4 Alert: sustained 503s > 15 minutes (must fire well inside Airtable's ~1-day retry window; exhaustion disables notifications) — **DEFERRED (ops):** dashboard alert config.
- [ ] 4.5 Wire Logpush + tail Workers — **DEFERRED (ops):** account-level Logpush config.

## 5. Phase 4 — Pre-Launch Hardening

- [ ] 5.1 Load test at projected V1 callback rate (remember: pings are ~100 bytes and pre-coalesced by Airtable) — **DEFERRED (needs deployed env).**
- [x] 5.2 Security review: signature bypass attempts, malformed/oversized payloads, path-id enumeration → reviewed + regression-tested in `tests/index.test.ts` (9 cases) alongside the existing `receive.test.ts` MAC/verification-order matrix. Findings:
  - **Signature bypass** — no dirty-mark occurs without a passing MAC: verification order (cap → row → decrypt → MAC → body cross-check → upsert) short-circuits to 401/410 with `recordPing` never called (asserted). Undecryptable secret is indistinguishable from a bad MAC (401). MAC compare is constant-time (`@baseout/shared`).
  - **Malformed/oversized** — >64KB → 401 before any crypto/DB (asserted, `fetchWebhookRow` not called); post-MAC non-JSON → 401; body `webhook.id`/`base.id` ≠ row → 401 (blocks cross-webhook replay).
  - **Path-id enumeration/traversal** — route is `^/webhooks/airtable/<36 hex/-chars>$`; non-matching/short/non-hex/traversal (`..` is URL-normalized away) → 404 before any DB. The 410(unknown/inactive) vs 401(bad-MAC) split is a theoretical existence oracle, but the id is an unguessable UUID and lookups are parameterized (Drizzle `eq`), so enumeration is infeasible — behavior pinned by tests rather than tightened (working contract, per §3.2).
  - **Method/misconfig** — non-POST → 405; missing `MASTER_ENCRYPTION_KEY` → 503 fail-closed with an empty body, before the DB is constructed (asserted).
- [ ] 5.3 Simulate master-DB outage; verify 503s, alerting, and clean recovery when DB returns → **partially covered in unit tests** (`recordPing` throw → 503; misconfig → 503 before DB). **Live-outage sim + alerting + recovery DEFERRED (ops/deployed env).**
- [ ] 5.4 Optional (only if load test demands): KV cache for webhook rows; Cloudflare Queue write buffer — **DEFERRED (conditional on 5.1).**

## 6. Definition of Done — `apps/hooks` V1 Launch

- [x] 6.1 Receiver verifies HMAC and rejects invalid signatures cleanly → receive.test.ts (401 missing/malformed/mismatch/undecryptable).
- [x] 6.2 Verified pings dirty-mark the registry row; nothing else is written or called → recordPing is the only write; app declares no service bindings.
- [ ] 6.3 Success responses are 200 + empty body; DB failures produce 503 + alert → **response half done** (200/empty + 503 on write-fail/misconfig, asserted); **alert DEFERRED (ops, 4.4).**
- [x] 6.4 No row is dirty-marked without HMAC verification → verification-order tests assert `recordPing` is never called on any 401/410 path.
- [x] 6.5 Receiver operates normally during a `server` deploy/outage (no runtime dependency) → structural: zero service bindings, master-DB only (env.ts, index.ts).
- [ ] 6.6 Observability + alerting wired → **DEFERRED (ops, 4.2–4.5).**
- [ ] 6.7 Independent deploy verified — hooks redeploys without touching any other app and vice versa → **DEFERRED (deploy; blocked on 1.4 route binding — no Cloudflare dashboard access in this env).**
