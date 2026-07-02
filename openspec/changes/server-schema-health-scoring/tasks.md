## Status

Engine half of the AI Health tab. Decision (2026-06): **full AI engine, Claude API from the workflows runner**. Substrate exists (`health_score_rules` catalog + `bo_at_health_scores`/`bo_at_health_issues`). Build order mirrors Phase 2: foundation → scoring task → routes → UI. Pairs with `workflows-health-scoring` + `web-health-tab`.

---

## 1. Pure logic (TDD) — FIRST (decision-independent) — DONE

- [x] 1.1 `apps/server/tests/integration/per-space/health-scoring.test.ts` (12): `resolveMetricPrompt` (override→space→system + source, blanks absent), `band` (≥90/60–89/<60 + clamp), `aggregateGrade` (weighted avg of enabled; disabled excluded; all-zero-weight → simple avg; none enabled → null), `isMetricStale`.
- [x] 1.2 `apps/server/src/lib/per-space/health-scoring.ts` — pure helpers, no DB/AI. Green (12/12); server typecheck clean.

## 2. Data model + migration

- [x] 2.1 Master `health_score_rules` += `prompt` (text) + `entity_tier` (text: base|table|field, CHECK) — [core.ts](../../../apps/web/src/db/schema/core.ts). Migration `apps/web/drizzle/0023_health_metric_prompt.sql` **applied** (db:check clean, web typecheck 0). Server mirror deferred to §4 (engine read path).
- [x] 2.2 Per-Space tables added to BOTH dialects (`pg.ts` + `sqlite.ts`): `bo_at_health_metric_prompts`, `bo_at_health_metric_overrides`, `bo_at_health_metric_state`, `bo_at_health_metric_scores`. `SPACE_SCHEMA_VERSION` 2→3. Squashed migrations regenerated (`space-pg/0000_sour_goliath`, `space-sqlite/0000_blue_peter_parker`) + bundled `pg-ddl.ts` regenerated. **Parity 5/5** (pg↔sqlite + DDL↔migration, both 24 tables); server typecheck clean.
- [x] 2.3 New/re-provisioned Spaces get the v3 tables via the bundled DDL (decision: dev re-provision). **FOLLOW-UP (file separately, `system-per-space-upgrade`):** an in-place lazy v2→v3 upgrade for existing production Spaces — not yet implemented anywhere (the "lazy on-access migration" is aspirational); out of scope for the Health feature per CLAUDE §3.2.

## 3. Scoring task (workflows-health-scoring — separate change, contract here)

- [ ] 3.1 Contract: after a schema capture (and on re-run), the task resolves each enabled metric's effective prompt, calls Claude with **schema-metadata-only** context, and POSTs per-metric sub-score + findings to the engine `health-sync` route. Credits debited per run. (Body shape defined here; task body in `workflows-health-scoring`.)

## 4. Engine routes + brokered I/O

- [x] 4.1 (write path) `health-io.ts` `writeHealthResults(tx, {baseId, runId, metrics})` — replaces each metric's current sub-score (bo_at_health_metric_scores, last_generated_at) + the base's issue list (bo_at_health_issues from findings). Runs in `withSpaceSchema`.
- [x] 4.2a (write path) `health-sync.ts` route — the workflows task's POST target; mirrors schema-sync guards (UUID, resolveSpaceDb active + managed_pg→501, x-internal-token). Registered in `index.ts` (`SPACES_HEALTH_SYNC_RE`). Route-guard test 7/7.
- [x] 4.2b (read + grade) Server mirror `health-score-rules.ts` (id/org/code/name/category/severity/weight/enabled/prompt/entityTier) + barrel + mirror test. **Base-grade aggregation** wired into `health-sync` (reads org via `spaces` mirror → catalog weights → pure `aggregateGrade` over the synced/enabled metrics → replaces the base grade in `bo_at_health_scores`). `health-overview` GET route + `readHealthOverview` I/O (grade + per-metric breakdown enriched with catalog labels + issues) + `index.ts` wiring + route-guard test 4/4.
- [x] 4.2c (DONE) **Enqueue path + mutation routes.** The task previously had no trigger, so Health never produced data — now `health-resolve.ts` `resolveScoreInputs` (org catalog ∩ per-Space enable-state, effective prompts via `resolveMetricPrompt`, schema context via `assembleChatContext`) + `trigger-client.enqueueHealthScoreBase`. Routes: `health-rerun` (generates runId + enqueues — the trigger), `health-prompt` (space-level + per-entity override + reset), `health-enable` (per-base), `health-config` (editor read: catalog + enabled + effective prompt + source + `isMetricStale`). `health-config-io.ts` (prompts/overrides/state read+write). Pro+ entitlement enforced web-side (`manual_ai`). All registered in `index.ts`; route-guard tests `spaces-health-config-route.test.ts` (14).
- [ ] 4.2d (still deferred) per-run **trend** — needs a `created_at` on `bo_at_health_scores` (a v6 per-Space bump) + the grade write path changed from replace → append. Low value; the lazy upgrade now makes the v6 bump cheap.

## 5. Verification

- [x] 5.1 `pnpm --filter @baseout/server typecheck` + `build` clean + `health-sync`/`health-overview`/`health-config-route`/`health-scoring` + `schema-mirrors` batch green (74). No stray `console.*`.
- [ ] 5.2 Human smoke (with the task + UI): re-run scoring → grade + per-metric breakdown + issues populate; edit a prompt → metric goes stale → re-run updates it; disable a metric → excluded; non-Pro+ blocked. Needs `npx trigger.dev dev` + `ANTHROPIC_API_KEY` + engine `--remote`.
