# Tasks

## 1. Data model (web-owned migrations)

- [ ] 1.1 `organizations.ai_usage` + `spaces.ai_usage` (enum `all | schema_only | off`, default `all`, backfill existing rows to `all`); audit-log coverage for both write paths.

## 2. Policy core (engine, tests first)

- [ ] 2.1 `lib/ai-policy.ts`: level ordering + `min()` resolution (pure, unit-tested: all×all, org-restricts, space-restricts, off-anywhere wins; stored Space value preserved under a lower Org ceiling).
- [ ] 2.2 `resolveAiPolicy(orgId, spaceId)` read path + per-request pass-down (explicit param, no ambient state).

## 3. Enforcement

- [ ] 3.1 Route guards: schema-chat send/context requires ≥ `schema_only`; data-scoped chat context requires `all`; violations → 403 `ai_disabled_by_policy` + effective level. Integration tests per level × entry point.
- [ ] 3.2 Context assemblers re-assert policy immediately before building AI payloads (defense in depth test: assembler called directly with `off` throws).
- [ ] 3.3 Workflows enqueue guarded + resolved policy carried in task payloads; per-send re-read gives one-message-bounded staleness on tightening.

## 4. Web plumbing

- [ ] 4.1 Settings API routes (Org: admin-only; Space: space-admin) with server-side validation + audit rows; effective-policy read endpoint (effective + both raw values + which scope restricts).
- [ ] 4.2 File/port the ui-only [`ai-settings`](../../../../ui-only/openspec/changes/ai-settings/) UI when it lands (proxy + gating wiring here).

## 5. Claims + docs

- [ ] 5.1 Update the GTM claims inventory + any published "metadata-only" copy to the conditional formulation in the same release that enables `all`-level data AI; name `schema_only` as "metadata-only mode" in docs.

## 6. Verification

- [ ] 6.1 Typecheck + build + suites green. Smoke: Org `all`/Space `all` → data chat works; Space → `schema_only` → next data-scoped send 403s with the right error while schema chat still works; Org → `off` → all AI 403s; audit rows written for each change; effective-policy endpoint explains the restriction source.
