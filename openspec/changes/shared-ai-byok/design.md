# shared-ai-byok — design

## Context

Baseout's AI features run on **Baseout's own credentials** today, across two runtimes and two providers:

- **Schema Chat** — the paid Anthropic Claude call in the Trigger.dev Node task. Model is hardcoded `claude-opus-4-8` (`apps/workflows/trigger/tasks/chat-respond.task.ts:20`) and the SDK client is constructed from `process.env.ANTHROPIC_API_KEY` (`chat-respond.task.ts:73`, throwing at `:76` if unset). Runs on the Node runner (`process.env` is the config source per CLAUDE.md §6).
- **Schema descriptions** — Cloudflare Workers AI, `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via `env.AI` (`apps/server/src/lib/per-space/describe-schema-io.ts:147`; adapter `workersAiGenerate(env)` at `:150`).
- **Health scoring** — the same Workers-AI model + `env.AI` binding (`apps/server/src/lib/per-space/health-score-run.ts:77`; adapter `workersAiScoreMetric(env)` at `:80`).

BYOK is priced and gated but inert: the catalog seeds `byo_ai_key` as a boolean, `false/false/true/true/true` across Lite/Core/Plus/Max/(trial+enterprise) — true from Plus (`apps/web/src/db/seed/entitlements-catalog.ts:191`). The only prior *code* reference to the slug is a placeholder derivation of a Schema-Docs level (`apps/web/src/lib/capabilities/entitlement-capabilities.ts:61`), not a real key mechanism — confirming "priced, no mechanism." The pricing intent: "enter your own AI provider key and Baseout uses it instead of the credit pool" (`research/pricing/pricing-guide.md:69`); "customer's key, their provider bill, zero credits consumed; our AI COGS ≈ $0" (`research/pricing/ai-credit-model.md:93`).

Two adjacent changes bound this one:

- **`shared-ai-controls`** (`openspec/changes/shared-ai-controls/proposal.md`) introduces `organizations.ai_usage` + `spaces.ai_usage` (enum `all | schema_only | off`, default `all`, restrictive resolution `min(org, space)`). BYOK must **compose** with that gate.
- **`shared-entitlements`** owns AI-credit metering (`tasks.md` task 3.3 — still `[ ]`, unwired) and names, in `design.md:105` (D11a), "**AI Gateway** … as the BYOK routing point." That is the only prior architectural hint for where BYOK routing lives.

The encryption-at-rest pattern to reuse is fixed and proven: OAuth tokens are AES-256-GCM-encrypted with `BASEOUT_ENCRYPTION_KEY` (`apps/web/src/lib/crypto.ts` — `encryptToken`/`decryptToken`, Web Crypto `AES-GCM`) and written to `*_enc` columns by pure persistence functions (`apps/web/src/lib/airtable/persist.ts:50` encrypts before upsert). PRD §20.2 mandates AES-256-GCM for "OAuth tokens" and "API keys" alike.

## Goals / Non-Goals

**Goals:**

- A customer-supplied AI key, per provider, encrypted at rest with the same discipline as OAuth tokens — write-only, never logged, never returned, never surfaced to staff in plaintext.
- One routing seam (`resolveAiRouting(orgId)`) consumed at all three AI entry points, so a Plus+ org's valid key is used instead of the pool and the call consumes zero AI credits.
- Plaintext key material never persisted in the Trigger.dev enqueue payload or run history.
- Validation on submit; a health lifecycle that detects a dead key and degrades gracefully.
- Correct composition with the `shared-ai-controls` `ai_usage` gate (policy first; BYOK never widens).

**Non-Goals:**

- The AI-credit meter itself (owned by `shared-entitlements` 3.3) — this change emits the `billable` flag it will honor.
- Model-selection UX for the pooled path (unchanged).
- A zero-trust "customer-hosted gateway, Baseout holds no key" architecture (see Open Questions — the honest read of "we never see the key" is addressed in D9, and a true no-custody model is a separate change if the founder requires it).
- Per-provider prompt/behavior tuning; supporting every provider on day one (launch set is an Open Question).

## Decisions

### D1 — New master-DB table `ai_provider_keys`, AES-256-GCM at rest, write-only

Web owns the canonical migration. One row per (Organization, provider); `provider` is an enum (`anthropic | openai | cloudflare | …`). Columns: `id`, `organization_id`, `provider`, `key_enc` (AES-256-GCM ciphertext, IV-prefixed exactly like OAuth `*_enc`), `key_fingerprint` (SHA-256 of plaintext — dedupe + "same key re-submitted" detection, never reversible), `last_four` (display only), `label`, `model_default` (nullable — the customer's chosen model for their provider), `status` (`active | invalid | disabled`), `created_by_user_id`, `last_validated_at`, `validation_error` (nullable), `created_at`, `modified_at`. A partial unique index enforces one **active** key per (org, provider).

Encryption reuses `apps/web/src/lib/crypto.ts` `encryptToken`/`decryptToken` and `BASEOUT_ENCRYPTION_KEY` — the identical mechanism proven for OAuth tokens (`apps/web/src/lib/airtable/persist.ts:50`; PRD §20.2). The write path is a pure `persistProviderKey(db, encryptionKey, inputs)` function mirroring `persistAirtableConnection` so it is DB-integration-testable without a browser.

*Alternative considered:* a generic `secrets` table keyed by purpose — rejected: BYOK keys have provider-specific validation, status, and model defaults; a dedicated table keeps the lifecycle legible and matches the `connections`-table precedent.

### D2 — One routing seam: `resolveAiRouting(orgId)`; direct provider SDK at launch, AI Gateway as a fast-follow

A single resolver, consumed identically at all three call sites, returns:

- `{ mode: 'pool' }` — today's behavior: our Claude key (chat) / our Workers AI `env.AI` (descriptions, health).
- `{ mode: 'byok', provider, model, billable: false }` — when the org resolves `byo_ai_key = true` **and** has an `active` key for a supported provider. Call sites obtain the plaintext key via D6's delivery path (never from the resolver return, which stays free of secret material so it is safe to log/trace).

Routing at launch is **direct provider SDK calls** (the Anthropic SDK is already a dependency in `apps/workflows`; add the OpenAI SDK where needed). This is the fewest moving parts and keeps the Workers-AI adapters' shape intact behind a branch.

This *tensions* with `shared-entitlements` `design.md:105` (D11a), which names **Cloudflare AI Gateway** as "the BYOK routing point" — adopted there as an observability/verification layer in front of Workers AI. The reconciliation: Gateway is a wrapper we can layer over direct calls later (unified call shape across providers + per-request token/cost logs, valuable for reconciling metering). Starting direct avoids coupling BYOK launch to Gateway provisioning per env. **Gateway-vs-direct is surfaced for founder confirmation in Open Questions**, since the sibling design already leaned Gateway.

*Alternative considered:* Gateway-first — rejected for launch: adds a per-env provisioning + credential dependency (a new `oauth-setup.md`-style runbook surface) for no capability the direct path lacks at one-provider scale.

### D3 — Composition with `ai_usage`: policy resolves FIRST, BYOK never widens

The order at every AI entry point is fixed:

1. Resolve the effective `ai_usage` policy (`shared-ai-controls`, `min(org, space)` on `off < schema_only < all`). If the call is not permitted (`off` blocks all; record-data AI requires `all`), **reject — regardless of any customer key.**
2. Only for a permitted call, resolve `resolveAiRouting(orgId)` to choose credentials/bill.

BYOK answers "**whose** credentials and bill does this allowed call use," never "**is** this call allowed." A `schema_only` org with a valid BYOK key still cannot run record-data AI; an `off` org runs no AI even with a key. This keeps the compliance story coherent: the policy gate is the security boundary, BYOK is the billing/credential routing on top.

### D4 — Zero-credit accounting via a `billable` flag on the usage sample

When routing is BYOK, the AI usage sample carries `billable: false`, so the (forthcoming) AI-credit meter attributes **zero credits** to the org — the pricing promise (`ai-credit-model.md:93`). Call *counts* are still recorded (`billable: false` ≠ unmetered) for abuse-observability and support.

**Dependency, stated plainly:** AI-credit metering is unwired today (`shared-entitlements` task 3.3, still `[ ]`). Until it lands, "zero credits" is trivially true (nothing meters AI yet). This change ships only the `billable` flag on the sample shape the meter will read; it does **not** build the meter. If 3.3 lands after this change, the flag is already present; if before, this change fills the flag. No hard ordering.

### D5 — Validation + health lifecycle; invalid key degrades to the pool by default

- **Submit-time:** the write path performs a cheap provider health-check (a minimal models-list or 1-token completion) before storing `status = 'active'`; a failing check stores nothing and returns a field error (server-side validation per CLAUDE.md §3.3).
- **Ongoing:** a periodic re-validation sweep (mirroring the OAuth keep-alive posture) flips a key to `status = 'invalid'` with a `validation_error` on provider auth failure, and stamps `last_validated_at`.
- **On invalid at call time:** default behavior is **fall back to the credit pool** (if the org is still entitled) with a surfaced warning, so a dead key never hard-breaks AI. The exception is D9's strict-custody flag: a compliance org that has opted "never use Baseout's pool" gets a hard failure instead of silent fallback (their data must never touch our provider account).

*Alternative considered:* hard-fail on invalid always — rejected as the default (a lapsed key silently killing a paying customer's AI is worse than a warned fallback), but preserved as the opt-in for compliance orgs.

### D6 — Plaintext key delivery to the Node runner via a gated engine endpoint, never the payload

The chat task runs on Trigger.dev's Node runner; its enqueue payload is persisted in Trigger.dev run history and visible in that dashboard. Putting the plaintext key (or even the ciphertext + our decrypt key) in the payload would leak it there. Instead: `apps/server` exposes an `INTERNAL_TOKEN`-gated endpoint (e.g. `GET /api/internal/orgs/:orgId/ai-credential?provider=anthropic`) that resolves routing, decrypts `key_enc` server-side, and returns the plaintext over the trusted service boundary (TLS, `x-internal-token`, response never logged). The task calls it at run start, holds the key in memory only, and never persists it. The enqueue payload carries only `{ orgId, provider }` (non-secret).

*Alternative considered:* pass ciphertext + have the runner decrypt — rejected: it would require shipping `BASEOUT_ENCRYPTION_KEY` to the Trigger.dev env (a second custody location for the master key) and still risks the ciphertext landing in run logs.

### D7 — Revocation, rotation, downgrade

- **Revoke:** delete the row (or mark `disabled`); routing immediately reverts to `pool` for entitled orgs, or "no AI key + not entitled" otherwise.
- **Rotate:** replace-in-place on (org, provider) — re-validate, then swap `key_enc`/`last_four`/`fingerprint` in one write; the old plaintext is overwritten, never archived.
- **Downgrade below Plus:** the key is set `status = 'disabled'` (not purged), so a later re-upgrade restores BYOK without re-entry; the capability gate (`byo_ai_key = false`) means a disabled key is never routed to while un-entitled. An explicit customer "delete key" remains available.

### D8 — Per-provider keys, keyed to the call site's need

Keys are stored per provider so an org can supply, e.g., an Anthropic key (covers chat) and separately an OpenAI key. Each call site names the provider(s) it can route to. The **launch provider set** (Anthropic only? Anthropic + OpenAI? include a customer Cloudflare account for the Workers-AI-shaped calls?) is an Open Question — the schema and seam are provider-generic so adding one is data + a validation adapter, not a redesign.

A subtlety the founder must weigh: the two Workers-AI call sites (descriptions, health) run our cheap llama model. "BYOK" for those means routing them to the customer's chosen provider/model instead of Workers AI — which changes their cost/latency/output profile. The seam supports it; whether all three sites route to BYOK or only the paid-Claude chat does is an Open Question.

### D9 — "We never see the key" — the honest interpretation + a strict-custody option

Dan's compliance framing is "we never see the key." Stated precisely, given D1/D6: the key is **write-only in every human-facing surface** — never displayed back to the customer, never shown to staff/admin (only `last_four` + fingerprint), never logged. But Baseout **does hold the encrypted material** and decrypts it in-process at call time to reach the provider. That is the same trust model as OAuth tokens, and it is the honest scope of "we never see it" — no human at Baseout ever views the plaintext.

For an org that needs *true* non-custody (Baseout never holds the material at all), the only architecture that delivers it is a customer-hosted gateway where the customer configures a proxy URL and Baseout holds no key — a **separate change**, flagged in Open Questions, not built here. The strict-custody flag from D5 ("never fall back to our pool") is the launch-scope compliance affordance: it guarantees a compliance org's AI traffic only ever uses their key or fails, never our account.

## Risks / Trade-offs

- **[New at-rest secret class]** — mitigated by reusing the proven OAuth AES-256-GCM path (`crypto.ts` + `persist.ts`, PRD §20.2) verbatim; no new crypto. The key-agreement discipline that governs OAuth `*_enc` (web encrypts, server decrypts, keys must match — CLAUDE.md §3.3) now also governs BYOK: drift silently breaks decryption. Documented in the security section.
- **[Plaintext transits the service boundary at call time]** (D6) — accepted and minimized: TLS + `INTERNAL_TOKEN`, in-memory only, response never logged, payload carries no secret. The alternative (ciphertext in payload / key in Trigger.dev env) is strictly worse.
- **[Zero-credit path depends on unbuilt metering]** (D4) — de-risked by shipping only the `billable` flag on the sample shape; no ordering dependency, no silent assumption. Called out as an explicit dependency in the proposal.
- **[Invalid-key fallback vs compliance expectation]** (D5/D9) — a silent pool fallback could send a compliance org's traffic to our provider account against their intent; mitigated by the strict-custody opt-in that hard-fails instead.
- **[Routing choice not yet founder-confirmed]** (D2) — direct-at-launch may need to become Gateway to match `shared-entitlements` D11a; contained because Gateway wraps the same call sites and the seam return shape is stable.
- **[Workers-AI sites routing to a customer provider changes cost/output]** (D8) — surfaced as an Open Question; the seam supports either scope without redesign.

### Security review points (CLAUDE.md §3.3)

This change introduces a **new secret surface** and a **new internal-API auth path** — both require explicit review before approval:

1. **New at-rest secret:** `ai_provider_keys.key_enc` — AES-256-GCM via `BASEOUT_ENCRYPTION_KEY`, IV-prefixed, identical to OAuth `*_enc`. Never stored plaintext (PRD §20.2).
2. **Non-disclosure invariants:** plaintext is never returned by any read API, never rendered in web or admin (only `last_four` + fingerprint), never written to any log or structured-log field, never placed in a Trigger.dev payload. Grep the diff for the key variable name at commit; assert in tests that read/list endpoints omit `key_enc` and plaintext.
3. **New internal-API surface:** the `INTERNAL_TOKEN`-gated credential-fetch endpoint (D6) is the only surface that emits plaintext, and only over the trusted service boundary to the Node runner. It must reject any request without a valid `x-internal-token`, never widen to public, and never log its response body.
4. **Key-agreement discipline:** web (encrypt-on-write) and server (decrypt-on-read) must share `BASEOUT_ENCRYPTION_KEY` byte-for-byte, exactly as OAuth tokens require (CLAUDE.md §3.3, `oauth-setup.md` failure-mode). Drift silently breaks BYOK decryption the same way it flips Airtable connections to `invalid`.
5. **Input validation + authz:** every key write validates server-side and is authorized to Org admins of the owning org; the `byo_ai_key` gate is resolved from the DB-native catalog (`resolveEntitlements`), never from Stripe metadata or request input. Fingerprint is SHA-256 (non-reversible).
6. **Audit:** key add / rotate / revoke / auto-invalidation write to the audit log (metadata only — provider, `last_four`, actor, timestamp — never the key).
7. **Least privilege at the provider:** the customer's key is used only for the AI operations their `ai_usage` policy permits (D3); BYOK never expands scope.

## Migration Plan

Additive, no data migration. Order: (1) `ai_provider_keys` migration + `crypto`-backed pure write path (web) with tests; (2) key-management API + Plus+-gated settings UI (web); (3) `resolveAiRouting` + read-only mirror + the gated credential-fetch endpoint + validation helper (server); (4) branch the two Workers-AI adapters and the Claude chat task onto the seam (server + workflows), pool path unchanged when no key; (5) wire `ai_usage`-first ordering (D3) and the `billable` flag; (6) lifecycle sweep + downgrade handling. Each step is independently shippable — until step 4 lands, the seam resolves `pool` for everyone and behavior is identical to today. Rollback = redeploy prior versions; a stored key simply goes unused (never purged by rollback).

## Open Questions

- **Routing: Cloudflare AI Gateway vs direct provider SDK.** D2 chooses direct-at-launch; `shared-entitlements` D11a (`design.md:105`) leaned Gateway as "the BYOK routing point." Founder decision — does BYOK launch on direct calls (Gateway as a later observability wrapper), or provision AI Gateway per env now?
- **Launch provider set.** Anthropic only (covers the paid chat call), Anthropic + OpenAI, or also a customer Cloudflare account for the Workers-AI-shaped calls? Drives the validation adapters built in this change.
- **BYOK scope across call sites.** Does a customer key route *all three* AI sites (including the cheap Workers-AI descriptions/health, changing their cost/latency/output), or only the paid Claude chat, leaving descriptions/health on our Workers AI? (D8.)
- **Per-provider vs single-key.** The schema is per-provider (D1/D8). Confirm the product intent is "a key per provider" rather than "one key, one provider, one org."
- **Strict-custody / true non-custody.** Is the D5/D9 "never fall back to our pool" opt-in sufficient for the government-contractor case, or does a compliance org require true non-custody (customer-hosted gateway, Baseout holds no key material) — a separate change?
- **Downgrade grace.** On downgrade below Plus, disable-not-purge (D7) — confirm the retention posture (how long a disabled key is retained before a purge job, if ever).
