# shared-ai-byok — tasks

TDD throughout (CLAUDE.md §3.4): each pure module writes its Vitest suite first (red → green → refactor). Nothing here is implemented yet. Ordering follows design.md's Migration Plan — the routing seam resolves `pool` for everyone until Task 4 lands, so every step is independently shippable and behavior is identical to today until BYOK is wired end-to-end. `resolveEntitlements(orgId)` (DB-native catalog) is the only capability source — never Stripe metadata (CLAUDE.md §1).

## 1. Key vault schema + encrypted write path (apps/web)

- [x] 1.1 Master-DB migration: `ai_provider_keys` (`organization_id`, `provider` enum, `key_enc`, `key_fingerprint`, `last_four`, `label`, `model_default` nullable, `status` enum `active|invalid|disabled`, `created_by_user_id`, `last_validated_at`, `validation_error` nullable, timestamps) + partial unique index on one **active** key per (org, provider). Generate + apply to dev DB in this change (CLAUDE.md §5.5 — schema-aware SSR 404s on a missing column). — _DONE 2026-08-07: added `ai-provider-keys.ts` to `drizzle.config.ts` schema array; generated `drizzle/0036_ai_provider_keys.sql` (dropped the spurious `usage_rollups` COALESCE-index re-emit drizzle-kit adds because that hand-written 0035 index doesn't round-trip); `db:migrate` applied to dev; `db:check` clean. Table + `ai_provider_keys_org_provider_active_uq` partial unique index live._
- [x] 1.2 Pure `persistProviderKey(db, encryptionKey, inputs)` + tests, mirroring `apps/web/src/lib/airtable/persist.ts`: AES-256-GCM encrypt via `crypto.ts` `encryptToken` before write, compute SHA-256 fingerprint + `last_four`, upsert one active row per (org, provider). Assert plaintext is never returned and never appears in the row read back.

## 2. Key-management API + settings UI (apps/web, Plus+ gated)

- [~] 2.1 API routes (add / rotate / revoke) + tests: server-side validation, Org-admin authz, `byo_ai_key` gate via `resolveEntitlements`; a submit-time provider health-check (Task 6.1) must pass before storing `status='active'`; audit-log rows on every write (metadata only — provider, `last_four`, actor — never the key). — _PARTIAL 2026-08-07: routes + DI handlers landed. `POST`/`DELETE /api/ai-keys` (`apps/web/src/pages/api/ai-keys/index.ts`): provider allow-list, non-empty key, **owner/admin-only** mutations, `byo_ai_key` gate via `resolveEntitlements` (403 `not_entitled` below Plus); add/rotate via `persistProviderKey`, revoke = status→disabled; 13 Vitest cases (incl. plaintext never echoed). **REMAINING:** submit-time provider health-check (6.1) before `status='active'`; audit-log rows on writes._
- [x] 2.2 Read/list endpoint + tests: returns only `{ provider, last_four, label, status, model_default, last_validated_at }` — **never** `key_enc` or plaintext (assert in test). — _DONE 2026-08-07: `GET /api/ai-keys` selects display-only columns; test asserts the payload never contains `key_enc`._
- [ ] 2.3 Settings UI (Storybook-first per §4.2): per-provider key entry (write-only field, shows only `last_four` once saved), rotate + revoke controls, status/last-validated display, disabled affordance when un-entitled; `setButtonLoading` on every server-waiting action (§4.5). Paired designer surface flagged if a ui-only change is spun out.

## 3. Routing seam + credential delivery (apps/server)

- [x] 3.1 Read-only `ai_provider_keys` mirror in `apps/server` (header comment names the canonical web migration; admin/server own no migrations). — _DONE 2026-08-07: `apps/server/src/db/schema/ai-provider-keys.ts` (read-only mirror, cites 0036) + barrel export; `apps/server/src/lib/ai/provider-keys-io.ts` provides the real `ResolveAiRoutingDeps` — `findActiveKey` (active-row facts, no key material) + `isByokEntitled` (server `resolveEntitlements` → `byo_ai_key`, fail-closed). Pure `byokEntitledFrom` decision has 4 Vitest cases; server tsc clean. Seam is now wireable; the call-site cutover is 4.x (needs per-provider clients — larger than a seam wire)._
- [x] 3.2 Pure `resolveAiRouting(orgId)` + tests: returns `{ mode: 'pool' }` or `{ mode: 'byok', provider, model, billable: false }`; `byok` only when `byo_ai_key` resolves true AND an `active` key exists for a supported provider. Return shape carries **no secret material** (safe to log).
- [ ] 3.3 `INTERNAL_TOKEN`-gated credential-fetch endpoint (`GET /api/internal/orgs/:orgId/ai-credential?provider=…`) + tests: resolves routing, decrypts `key_enc` server-side, returns plaintext only over the trusted boundary; rejects missing/invalid `x-internal-token`; response body never logged. Payload/enqueue carries only `{ orgId, provider }`.

## 4. Route the three AI call sites through the seam

- [ ] 4.1 `apps/workflows` chat task: fetch the customer key at run start via the Task 3.3 endpoint when routing is `byok`; construct the Anthropic client from it instead of `process.env.ANTHROPIC_API_KEY`; fall back to the pool key when `pool` (or on strict-custody, hard-fail per D5/D9). Tests target the pure module with an injected credential provider — plaintext never in the payload.
- [ ] 4.2 `apps/server` `describe-schema-io.ts`: branch `workersAiGenerate` behind `resolveAiRouting` — `byok` routes to the customer provider (direct SDK per D2); `pool` keeps `env.AI` unchanged. Tests cover both branches.
- [ ] 4.3 `apps/server` `health-score-run.ts`: same branch for `workersAiScoreMetric`; `pool` keeps `env.AI` unchanged. Tests cover both branches.

## 5. Compose with `ai_usage` policy + zero-credit flag

- [ ] 5.1 Enforce D3 ordering at every AI entry point (+tests): resolve the `shared-ai-controls` `ai_usage` policy FIRST (reject `off`; record-data AI requires `all`), THEN `resolveAiRouting`. Assert a valid BYOK key never bypasses `off` and never widens `schema_only` to record-data AI.
- [ ] 5.2 Attach `billable: false` to the AI usage sample on BYOK routing (+tests). Note in code + test that the AI-credit meter is unwired (`shared-entitlements` 3.3); this only sets the flag the meter will honor.

## 6. Validation, health, lifecycle

- [ ] 6.1 Provider health-check helper + tests: minimal models-list / 1-token completion per provider; used at submit (Task 2.1) and by the sweep; external providers mocked at the HTTP boundary (msw, CLAUDE.md §3.4).
- [ ] 6.2 Periodic re-validation sweep + tests: flips a key to `status='invalid'` with `validation_error` + stamps `last_validated_at` on provider auth failure; default call-time fallback to pool (if entitled) with a surfaced warning; strict-custody opt-in hard-fails instead (D5/D9).
- [ ] 6.3 Revocation / rotation / downgrade + tests: rotate = re-validate then replace-in-place (old plaintext overwritten, never archived); revoke reverts routing to `pool`; downgrade below Plus sets `status='disabled'` (not purged) so re-upgrade restores.

## 7. Verification & docs

- [ ] 7.1 Security sweep (design.md → Security review points): grep the diff for the key variable + `console.` at commit; assert no read/list/log/payload path exposes `key_enc` or plaintext; confirm the credential endpoint is `INTERNAL_TOKEN`-gated and its response is unlogged; confirm web/server share `BASEOUT_ENCRYPTION_KEY`.
- [ ] 7.2 `pnpm --filter @baseout/web test` + `@baseout/server test` + `@baseout/workflows test` green; `tsc --noEmit` clean across the three apps; `db:check` clean after 1.1.
- [ ] 7.3 Cross-reference bookkeeping: note the BYOK routing seam in `shared-entitlements` (zero-credit `billable` consumer) and `shared-ai-controls` (policy-first composition) proposals; record the founder's Gateway-vs-direct + launch-provider decisions (design.md Open Questions) once made; add an `oauth-setup.md`-style credential note if Gateway routing is chosen.
