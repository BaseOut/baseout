## Status

PROPOSED — not yet implemented.

Engine half of AI Schema Insights — the narrative parallel to Health scoring. Per-Space insights storage (observations + entity tags + `active`/`archived` lifecycle + auto-archive-when-stale), a space-level + per-base insight prompt with pure resolution, and `INTERNAL_TOKEN`-gated read/config/sync/re-run routes. Mirrors [`server-schema-health-scoring`](../server-schema-health-scoring/). Decision (inherited from Health): full AI engine, Claude API from the workflows runner. Build order: foundation → sync + read/config → enqueue + re-run. Pairs with [`workflows-schema-insights`](../workflows-schema-insights/) + [`web-schema-insights`](../web-schema-insights/). See [`design.md`](./design.md) for the data model + lifecycle.

---

## 1. Pure logic (TDD) — FIRST (decision-independent)

- [ ] 1.1 `apps/server/tests/integration/per-space/insights-logic.test.ts`: `resolveInsightPrompt` (baseOverride → space → systemDefault + `source`; blanks fall through), `planInsightArchive` (existing active ids → archived; incoming → active insert; empty incoming → nothing archived), `isInsightsStale` (promptUpdatedAt newer than lastGeneratedAt → true; equal/older → false; no generation yet → false).
- [ ] 1.2 `apps/server/src/lib/per-space/insights-logic.ts` — pure helpers (`resolveInsightPrompt`, `planInsightArchive`, `isInsightsStale`) + the `INSIGHTS_SYSTEM_DEFAULT_PROMPT` constant. No DB/AI. Green; server typecheck clean.

## 2. Data model + migration

- [ ] 2.1 Per-Space tables added to BOTH dialects (`pg.ts` + `sqlite.ts`): `bo_at_schema_insights` (base_id, run_id, body, category?, evidence?, status CHECK active|archived, generated_at), `bo_at_schema_insight_entities` (insight_id FK, entity_kind CHECK base|table|field, entity_id, entity_name, field_type?), `bo_at_schema_insight_prompt` (base_id nullable, prompt, prompt_updated_at). No master-DB catalog change.
- [ ] 2.2 `SPACE_SCHEMA_VERSION` bump. Squashed migrations regenerated (space-pg + space-sqlite) + bundled `pg-ddl.ts` regenerated. Parity checks green (pg↔sqlite + DDL↔migration, table counts match); server typecheck clean; `db:check` clean.
- [ ] 2.3 New/re-provisioned Spaces get the new tables via the bundled DDL (decision: dev re-provision). In-place lazy upgrade for existing production Spaces is the separate `system-per-space-upgrade` follow-up — out of scope here per CLAUDE §3.2.

## 3. Generation task contract (workflows-schema-insights — separate change, contract here)

- [ ] 3.1 Contract: on demand (re-run) and after a schema capture, the task resolves the base's effective insight prompt, calls Claude with **schema-metadata-only** context, and POSTs `{ baseId, runId, insights: [{ body, category?, evidence?, entities: [{ entityKind, entityId, entityName, fieldType? }] }] }` to the engine `insights-sync` route. Credits debited per run. (Body shape defined here; task body in [`workflows-schema-insights`](../workflows-schema-insights/).)

## 4. Engine routes + brokered I/O

- [ ] 4.1 (write path) `insights-io.ts` `writeInsights(tx, { baseId, runId, insights })` — archives the base's existing `active` rows (via `planInsightArchive`) + inserts the run's new observations + their entity tags as `active`. Runs in `withSpaceSchema`.
- [ ] 4.2 (write path) `insights-sync.ts` route — the workflows task's POST target; mirrors `schema-sync`/`health-sync` guards (UUID spaceId, `resolveSpaceDb` active + `managed_pg` → 501, `x-internal-token`). Registered in `index.ts` (`SPACES_INSIGHTS_SYNC_RE`). Route-guard test.
- [ ] 4.3 (read path) `insights.ts` GET route + `readInsights` I/O — a base's insights (`active` by default; `?includeArchived=1` includes `archived`) + each insight's entity tags + last-generated + `isInsightsStale`. `index.ts` wiring + route-guard test.
- [ ] 4.4 (config path) `insights-config-io.ts` (prompt read+write) + `insights-config.ts` GET (effective prompt via `resolveInsightPrompt` + source + space/override values + last-generated + stale) + `insights-prompt.ts` POST (set/clear space-level prompt or per-base override; reset to system default; touches `prompt_updated_at`). `index.ts` wiring + route-guard test.
- [ ] 4.5 (enqueue path) `insights-resolve.ts` `resolveInsightInputs` (effective prompt + schema-metadata context via `assembleChatContext`) + `trigger-client.enqueueGenerateBaseInsights` + `insights-rerun.ts` POST (generates runId + enqueues — the trigger). Registered in `index.ts`; route-guard test. Pro+ entitlement enforced web-side (`manual_ai`).

## 5. Verification

- [ ] 5.1 `pnpm --filter @baseout/server typecheck` + `build` clean + the insights route-guard + pure-logic + per-space parity suites green. No stray `console.*` (§3.5).
- [ ] 5.2 Human smoke (with the task + UI): re-run generation on a `managed_pg` Space's base → observations + entity tags populate as `active`; re-run again → the prior set archives + the new set is active; edit the prompt → base goes stale → re-run clears stale; `?includeArchived=1` reveals archived; non-Pro+ blocked. Needs `npx trigger.dev dev` + `ANTHROPIC_API_KEY` + engine `--remote` (`pnpm --filter @baseout/server deploy:dev`).

## Deferred follow-ups

- [ ] In-place lazy per-Space v-bump upgrade for existing production Spaces (file as `system-per-space-upgrade`).
- [ ] Retention/prune of very old `archived` insights (unbounded-growth mitigation).
- [ ] Auto-generate-on-significant-schema-change trigger from the capture path (V1 ships on-demand re-run + post-capture generation; a debounced "significant change" heuristic is a follow-up).
- [ ] Per-entity (table/field) insight prompt overrides beyond the per-base override (Health has per-entity overrides; insights ship space + per-base only in V1).
