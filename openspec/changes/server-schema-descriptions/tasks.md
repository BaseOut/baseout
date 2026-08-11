## Status

IN PROGRESS — POC build 2026-07-09 (see proposal for the Workers AI decision +
the Pro+ tier-gate pre-launch blocker).

## 1. Binding + types

- [x] 1.1 (Resolved: the real blocker was a MULTI-ACCOUNT wrangler login — non-interactive remote-proxy/deploys fail with a misleading "must be logged in" until `account_id` is pinned in wrangler config. Pinned in server+web configs, both files.) `wrangler.jsonc.example` — add `"ai": { "binding": "AI" }` at top level AND in `env.dev` (non-inheritable key); mirror into the rendered local `wrangler.jsonc`. `env.d.ts` — `AI?: Ai` (optional: environments without the binding skip generation).

## 2. Pure module — TDD

- [x] 2.1 RED: `describe-schema` tests — target planning (only `ai_description IS NULL` + active entities), table prompt includes field names/types + existing Airtable descriptions as context, base prompt includes table names, JSON parse handles fenced/dirty output, drops unknown ids, caps description length, returns `{}` on unparseable output (never throws).
- [x] 2.2 GREEN: (11 tests green) `apps/server/src/lib/per-space/describe-schema.ts`.

## 3. IO + hook — TDD

- [x] 3.1 RED: (orchestration with injected load/save/generate — repo idiom; 4 tests green incl. batch-failure resilience + idempotent no-op) integration test (real local PG + `withSpaceSchema`, fake `generate`) — seeded undescribed base/tables/fields get `ai_description` filled; already-described rows untouched; second run no-ops; a throwing `generate` leaves rows null and does not throw out.
- [x] 3.2 GREEN: `describe-schema-io.ts` (injected `generate`), Workers AI adapter (`env.AI.run(model, …)`, model from `AI_DESCRIPTIONS_MODEL` with a pinned default).
- [x] 3.3 `schema-sync.ts` — post-success `ctx.waitUntil(...)` guarded by `env.AI` + `AI_DESCRIPTIONS_ENABLED !== "false"`; fresh per-task DB client (request client is torn down at response); all errors swallowed (advisory).

## 4. Verification + smoke

- [x] 4.1 Targeted server suites green (describe-schema 15 + schema-sync route green); `tsc --noEmit` 0 errors. No stray `console.*`.
- [x] 4.2 Deployed (`deploy:dev`, version c6b4410c). Local-dev outcome: with `account_id` pinned, local `wrangler dev` serves the AI binding via its remote proxy — the local backup loop generates descriptions directly; no deployed-only workaround needed.
- [ ] 4.3 Human smoke: run a backup → within ~seconds of completion, Browse panels show AI descriptions on previously-undescribed tables/fields (hard-refresh /schema). Re-running a backup does not churn existing descriptions.

## Pre-launch blocker (do not archive with this open)

- [ ] Pro+ tier gate for generation (Features §7) — engine-side tier signal or web-gated enqueue.

## Deferred follow-ups

- [ ] Re-describe entities whose schema changed (POC fills missing only).
- [ ] Per-entity "Regenerate description" affordance (pairs with the entity-annotations write-back change).
- [ ] Claude upgrade path behind the `generate` seam; AI Gateway front door (caching + spend analytics) once more AI surfaces ship.
