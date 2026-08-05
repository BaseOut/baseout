# shared-ai-byok

## Why

Bring-your-own-key (BYOK) is already **priced and gated** but has **no mechanism anywhere**. The catalog seeds a `byo_ai_key` boolean, true from Plus (`apps/web/src/db/seed/entitlements-catalog.ts:191`), the pricing model promises "from Plus: enter your own AI provider key and Baseout uses it instead of the credit pool" (`research/pricing/pricing-guide.md:69`) with "customer's key, their provider bill, zero credits consumed" (`research/pricing/ai-credit-model.md:93`) — yet nothing lets a customer enter a key, nothing encrypts or stores it, and none of the three AI call sites can route through it. The founder asked in today's meeting (2026-08-05) to "spec out bring your own keys." The compelling case Dan cited is the government-contractor / compliance-bound org: their AI runs on **their** provider account under **their** data-processing terms, and "we never see the key."

Today all AI runs on Baseout's own credentials: Schema Chat uses our paid Anthropic Claude (`apps/workflows/trigger/tasks/chat-respond.task.ts:20`, key from `process.env.ANTHROPIC_API_KEY` at `:73`), and schema descriptions + health scoring use Cloudflare Workers AI on our account (`apps/server/src/lib/per-space/describe-schema-io.ts:147` and `health-score-run.ts:77`, both via `env.AI`). BYOK must insert a customer-key routing seam at all three so a Plus+ org's key is used instead of the pool and consumes zero AI credits.

## What Changes

- **Customer AI-key vault (master DB, web-owned).** A new `ai_provider_keys` table stores one active key per (Organization, provider) with the key material **AES-256-GCM-encrypted at rest** in a `key_enc` column — reusing the exact discipline OAuth tokens already follow (`apps/web/src/lib/crypto.ts` + the `*_enc` persistence pattern in `apps/web/src/lib/airtable/persist.ts`; PRD §20.2). The plaintext is **write-only**: never returned to the client, never logged, never shown in admin — only a `last_four` + fingerprint are displayable.
- **Key-management UI + API (web), Plus+ gated.** A settings surface to add / rotate / revoke a per-provider key (Anthropic, OpenAI, Cloudflare, …), gated by resolving `byo_ai_key` from the DB-native catalog (`resolveEntitlements(orgId)` — never Stripe metadata, per CLAUDE.md §1). Server-side validation on every write; a submit-time provider health-check confirms the key works before it is stored active.
- **A single AI-routing seam consumed at every AI entry point.** `resolveAiRouting(orgId)` returns either `{ mode: 'pool' }` (today's behavior — our Claude key + our Workers AI) or `{ mode: 'byok', provider, model, billable: false }` when a Plus+ org has a valid active key. Wired into all three call sites: the Claude chat task, the Workers-AI schema-description adapter, and the Workers-AI health-scoring adapter.
- **Plaintext never rides the Trigger.dev payload.** The chat task runs on the Node runner; it fetches the decrypted key at run start from a new `INTERNAL_TOKEN`-gated engine endpoint rather than receiving it in the enqueue payload (which would land in Trigger.dev run history/logs).
- **Zero-credit accounting.** When routing is BYOK, usage is recorded with `billable: false` so the usage meter attributes **zero AI credits** to the org (`ai-credit-model.md:93`). Because AI-credit metering itself is not yet wired (`openspec/changes/shared-entitlements` task 3.3 is still open), this change ships the `billable` flag the meter will honor and treats zero-credit as trivially satisfied until metering lands — an explicit dependency, not a silent assumption.
- **Validation, health, and lifecycle.** Keys carry a `status` (`active | invalid | disabled`); a periodic re-validation (mirroring the OAuth keep-alive posture) flips a key to `invalid` on provider auth failure. Revocation and rotation are first-class; downgrade below Plus disables (does not purge) the key so re-upgrade restores it.
- **Composition with the AI-usage policy.** BYOK **composes with** the `ai_usage` org/space gate from the adjacent `shared-ai-controls` change (`openspec/changes/shared-ai-controls/proposal.md`): policy resolves **first**, so a customer key never bypasses an `off` policy and never widens a `schema_only` org to record-data AI. BYOK changes *whose credentials/bill* an allowed call uses — never *whether* the call is allowed.

Out of scope: any change to model selection semantics for the pooled path; the AI-credit meter itself (owned by `shared-entitlements` 3.3); a customer-hosted gateway model where Baseout holds no key material at all (see Open Questions); provider-specific prompt/behavior tuning.

## Capabilities

### New Capabilities

- `ai-byok`: the end-to-end bring-your-own-key mechanism — the encrypted per-provider key vault, the Plus+-gated key-management UI/API with submit-time validation, the `resolveAiRouting` seam wired at all three AI entry points, runtime key delivery to the Node runner without payload exposure, the health/validation/rotation/revocation lifecycle, zero-credit accounting via the `billable` flag, and composition with the `ai_usage` policy gate.

### Modified Capabilities

_None in `openspec/specs/` — no AI capability is archived yet. This change supplies the mechanism for un-archived sibling material, superseded in place:_

- _`feature-catalog` / `account-entitlements` (`shared-entitlements`): the seeded `byo_ai_key` boolean gains its runtime behavior; `usage-metering` gains the `billable: false` zero-credit path this change feeds._
- _`schema-chat` (`workflows-schema-chat` / `server-schema-chat`): the Claude chat task's credential source becomes routing-resolved instead of always `process.env.ANTHROPIC_API_KEY`._
- _the Workers-AI schema-description and health-scoring adapters (`describe-schema-io.ts` / `health-score-run.ts`): gain the customer-key routing branch alongside the `env.AI` pool path._
- _`ai-controls` (`shared-ai-controls`): the `ai_usage` resolution is now consumed as the first gate ahead of BYOK routing; cross-referenced, no behavior change to the policy itself._

## Impact

- **Multi-app (`shared-` prefix), per CLAUDE.md §3.6.** Reverting this change requires touching **three** apps' source trees — it is not single-app:
  - `apps/web` — the master-DB migration for `ai_provider_keys` (web owns all master-DB migrations); the key-entry/rotate/revoke settings API + UI; AES-256-GCM encrypt-on-write via `crypto.ts`; `byo_ai_key` capability gate via `resolveEntitlements`.
  - `apps/server` — `resolveAiRouting(orgId)` resolution + the read-only `ai_provider_keys` mirror; the routing branch at the two Workers-AI call sites; the `INTERNAL_TOKEN`-gated credential-fetch endpoint the chat task calls; validation/health-check helper.
  - `apps/workflows` — the Claude chat task fetches and uses the customer key when routing is BYOK, falling back to the pool key otherwise.
- **DB:** one new master-DB table (`ai_provider_keys`, with `key_enc` + `key_fingerprint` + `last_four` + `status`); a read-only mirror in `apps/server` (header-comment names the canonical web migration). No destructive changes.
- **Security (new secret surface + new auth path — review required per CLAUDE.md §3.3):** customer AI keys are a brand-new class of at-rest secret; a new gated engine endpoint returns decrypted key material to the Node runner. Full review points are enumerated in `design.md` → "Security review points". Key encryption reuses `BASEOUT_ENCRYPTION_KEY` and the OAuth-token AES-256-GCM path; the same web/server key-agreement discipline that governs OAuth `*_enc` columns (CLAUDE.md §3.3) applies — drift silently breaks decryption.
- **Coordination:** composes with `shared-ai-controls` (policy gate — resolve first) and depends on `shared-entitlements` 3.3 (AI-credit metering) for the zero-credit path to be observable. No code-ordering hard dependency on either landing first; the seam ships with a `billable` flag the meter consumes when wired.
- **Runbook:** if the founder chooses AI-Gateway routing (Open Questions), `shared/internal/oauth-setup.md`-style per-env credential notes may need a parallel entry; flagged, not bundled.
