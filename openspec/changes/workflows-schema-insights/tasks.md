## Status

PROPOSED — not yet implemented.

Workflows half of AI Schema Insights. Claude via `@anthropic-ai/sdk` (model `claude-opus-4-8`, structured output via a forced tool / `output_config.format`). Pairs with [`server-schema-insights`](../server-schema-insights/) (`insights-sync` route + prompt resolution + credits). Pattern mirrors [`workflows-health-scoring`](../workflows-health-scoring/) / `backup-base` (pure module + thin wrapper; tests on the pure module). Depends on [`server-schema-insights`](../server-schema-insights/) shipping the `insights-sync` contract.

---

## 1. Pure orchestration (TDD) — FIRST

- [ ] 1.1 `apps/workflows/tests/generate-base-insights.test.ts`: the generator is invoked once with the effective prompt + metadata context; returned observations are normalized (observations with a blank body dropped) and capped to a per-run limit; each observation keeps its entity tags; an empty/normalized-empty set → `postInsightsSync` is NOT called; the `postInsightsSync` payload shape is `{ baseId, runId, insights: [{ body, category?, evidence?, entities: [...] }] }`.
- [ ] 1.2 `apps/workflows/trigger/tasks/generate-base-insights.ts` — pure `runGenerateBaseInsights(input, deps)` with injected `generateInsights` + `postInsightsSync`. No SDK/DB. Green.

## 2. Wrapper + Claude integration

- [ ] 2.1 `generate-base-insights.task.ts` — Trigger.dev wrapper: Anthropic client from `process.env.ANTHROPIC_API_KEY`; `generateInsights` calls `messages.create` with model `claude-opus-4-8` + a **forced `report_insights` tool** (`tool_choice`) for reliable structured `{ insights: [{ body, category?, evidence?, entities: [...] }] }` (4.x rejects prefill; tool-use is well-typed), **schema-metadata-only** context; `postInsightsSync` POSTs the engine `insights-sync` route (409/501 → no-op, transport errors fire-and-forget). Model in an `INSIGHTS_MODEL` env for cost swaps (operator's call).
- [ ] 2.2 `index.ts` — `export type { generateBaseInsightsTask, GenerateBaseInsightsPayload, ... }` (type-only, so the task body doesn't leak into the Worker bundle).
- [ ] 2.3 Reuse `@anthropic-ai/sdk` (already a dependency from `workflows-health-scoring`) — no new dependency needed.

## 3. Verification

- [ ] 3.1 `pnpm --filter @baseout/workflows test generate-base-insights` green + full suite green (no regression) + `typecheck` clean. No stray `console.*` (§3.5).
- [ ] 3.2 Human smoke (with server route + `ANTHROPIC_API_KEY` set in the Trigger.dev env): re-run insights on a `managed_pg` Space's base → observations with entity tags land as `active` via `insights-sync`; a second run archives the prior set. Needs `npx trigger.dev dev` + engine `--remote`.

## Deferred follow-ups

- [ ] A "significant schema change" heuristic in the capture path that debounces auto-generation (V1 generates post-capture + on-demand re-run; the debounce/heuristic is deferred).
- [ ] Per-entity (table/field) prompt context beyond the base-level prompt, if `server-schema-insights` adds per-entity overrides.
- [ ] Cost/latency tuning: a cheaper model tier for large bases (swap via `INSIGHTS_MODEL`) once real usage is measured.
