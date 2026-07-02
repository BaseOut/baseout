## Status

Workflows half of AI Health scoring. Claude via `@anthropic-ai/sdk` (model `claude-opus-4-8`, structured output via `output_config.format`). Pairs with `server-schema-health-scoring` (`health-sync` route + prompt resolution + credits). Pattern mirrors `backup-base` (pure module + thin wrapper; tests on the pure module).

---

## 1. Pure orchestration (TDD) — DONE

- [x] 1.1 `apps/workflows/tests/health-score-base.test.ts` (4): scorer called per enabled metric; scores clamped/rounded to 0–100; a per-metric scorer error skips that metric (others still scored); `postHealthSync` payload shape; empty metrics → no sync.
- [x] 1.2 `apps/workflows/trigger/tasks/health-score-base.ts` — pure `runHealthScoreBase(input, deps)` with injected `scoreMetric` + `postHealthSync`. No SDK/DB. Green (4/4).

## 2. Wrapper + Claude integration — DONE

- [x] 2.1 `health-score-base.task.ts` — Trigger.dev wrapper: Anthropic client from `process.env.ANTHROPIC_API_KEY`; `scoreMetric` calls `messages.create` with model `claude-opus-4-8` + a **forced `report_score` tool** (`tool_choice`) for reliable structured `{score, findings}` (4.x rejects prefill; tool-use is well-typed in SDK 0.105.0), metadata-only context; `postHealthSync` POSTs the engine `health-sync` route (409/501 → no-op). Model in `HEALTH_SCORE_MODEL` (swap to haiku/sonnet for cost — operator's call).
- [x] 2.2 `index.ts` — `export type { healthScoreBaseTask, HealthScoreBasePayload, ... }`.
- [x] 2.3 `@anthropic-ai/sdk@^0.105.0` added to `apps/workflows`.

## 3. Verification

- [x] 3.1 `pnpm --filter @baseout/workflows test health-score-base` 4/4 + full suite **189/189** (no regression) + `typecheck` clean. No stray `console.*`.
- [ ] 3.2 Human smoke (with server route + `ANTHROPIC_API_KEY` set in the Trigger.dev env): score a managed_pg Space's base → per-metric sub-scores + findings land; grade aggregates.
