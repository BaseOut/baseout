## Status

PROPOSED — not yet implemented.

The web half of AI Schema Insights: an Insights section on the Health tab —
read-only observation cards with clickable entity-tag chips + archived toggle for
all entitled tiers, plus the Pro+ prompt config (space + per-base override) + a
stale-driven Re-run. Reads gate via the existing `schemaDocs` level (Launch+);
mutations via `manual_ai` (Pro+), like the Health editor. No DB/migration/
capability-key change. Pairs with [`server-schema-insights`](../server-schema-insights/)
+ [`workflows-schema-insights`](../workflows-schema-insights/). Depends on the engine
routes shipping first.

---

## 1. Web client + proxy routes (TDD)

- [ ] 1.1 `apps/web/src/lib/backup-engine.ts` — `getInsights(spaceId, baseId, includeArchived?)`, `getInsightConfig(spaceId, baseId)`, `setInsightPrompt(spaceId, body)`, `rerunInsights(spaceId, baseId)` + view types (`InsightView` / `InsightTagView` / `InsightConfigView` / results), mirroring `getHealthOverview` / `getHealthConfig` (`schemaDocsRequest(options, METHOD, path)`; `if (!res.ok) return res`).
- [ ] 1.2 `pages/api/spaces/[spaceId]/insights.ts` (GET) + `insights-config.ts` (GET) — `guardSchemaDocsRequest` (auth + IDOR + Launch+ tier), `baseId` validation, forwards `?includeArchived=`, 503 when the engine binding/token is absent, `schemaDocsErrorStatus` mapping (mirrors `health-overview.ts`). Tests `insights.test.ts` + `insights-config.test.ts`.
- [ ] 1.3 `pages/api/spaces/[spaceId]/insights-prompt.ts` (POST) + `insights-rerun.ts` (POST) — same guard **plus** `guard.level === 'manual_ai'` (Pro+) → 403; body validation (prompt scope: space | base override | reset); mirrors `health-rerun.ts` / `health-prompt.ts`. Tests `insights-prompt.test.ts` + `insights-rerun.test.ts`.

## 2. Insights section UI

- [ ] 2.1 Add an **Insights** section to the Health tab in `SchemaView.astro`, below the grade/breakdown/issues, shown when the Space has captured schema. Empty state when the base has no insights ("Insights appear once generated for this base"). Base picker reuses the Health tab's (over non-removed bases). NO `<style>` block — daisyUI utilities only (or extend the `raw-markup-audit-allowlist.json` entry if composed vanilla-in-view).
- [ ] 2.2 Lazy fetch on first open of the Health tab + on base/toggle change (piggybacks the Health lazy-load). Render active observation cards (dense): observation body, entity-tag chips (type icon + name), optional category/evidence, muted "generated &lt;date&gt;". All engine strings escaped via the local `esc()`.
- [ ] 2.3 Entity-tag chips are clickable → open the shared entity-detail sidebar/modal via the existing `open-entity-detail` CustomEvent (reuses Browse/Docs; do not build a bespoke sidebar). Field-type icons on field chips (reuse the Airtable field-icon map).
- [ ] 2.4 "Include archived" toggle → refetch with `includeArchived` → archived cards render muted + labeled "archived". Active-only by default.

## 3. Pro+ prompt config + re-run

- [ ] 3.1 When `aiEnabled` (Pro+): a "Configure insights" affordance opens the prompt editor (reuse the Health editor pattern) — effective prompt + source badge (Override / Space / System default), edit the space-level prompt or set/clear a per-base override, Save + Reset → POST `/insights-prompt` → refetch config. Below Pro+: read-only prompt + upgrade affordance.
- [ ] 3.2 "Re-run insights" control (Pro+) shown when the config reports the base **stale** (prompt updated since last generation) → POST `/insights-rerun` → poll the read (~36s) for the async result → the new active set replaces the list. 403 → upgrade affordance.

## 4. Governance

- [ ] 4.1 Any new `components/schema/*.astro` (e.g. `InsightCard` / `InsightTagChip` if extracted): register in [`component-classification.json`](../../../apps/web/src/components/component-classification.json) (classification + `styleguideId` + `designHarnessPath` + rationale), add a sibling `*.stories.ts` (the `stories-coverage` test fails CI otherwise, `apps/web/.claude/CLAUDE.md` §2.5), and add the matching `/styleguide` entry in `apps/design`.
- [ ] 4.2 If the section is composed vanilla-in-view inside `SchemaView.astro` (daisyUI-direct second tier), extend the `SchemaView.astro` entry in [`raw-markup-audit-allowlist.json`](../../../apps/web/src/components/raw-markup-audit-allowlist.json) rather than adding a `<style>` block. Do NOT refactor the existing Browse/Health/Docs tabs (CLAUDE §3.2).

## 5. Verification

- [ ] 5.1 `pnpm --filter @baseout/web typecheck` — 0 errors. `build` green. Full unit suite green incl. the new proxy tests, `islands-governance.test.ts`, `component-classification` / `stories-coverage`, and `raw-markup-audit`. No stray `console.*` (§3.5).
- [ ] 5.2 `pnpm --filter @baseout/web run audit:components` green (classification + stories coverage + raw-markup allowlist).
- [ ] 5.3 Human smoke: on a `managed_pg` Space with generated insights, open `/schema` → Health → Insights section: active observation cards render; entity-tag chips open the shared sidebar; include-archived reveals retired ones; a Pro+ user edits the prompt → base goes stale → Re-run populates a new active set; a Launch-but-not-Pro+ user sees read-only + the upgrade affordance; a non-entitled org sees the upgrade message. (Engine runs `--remote`: `pnpm --filter @baseout/server deploy:dev` + `npx trigger.dev dev` first; existing Spaces need re-provision for the new per-Space tables.)

## Deferred follow-ups

- [ ] Graduate Insights to its own Schema tab if the section grows past the Health tab's density budget.
- [ ] Per-entity (table/field) prompt-override UI (the engine ships space + per-base override only in V1).
- [ ] "Show more"/collapse for very long insight lists.
- [ ] A per-insight "dismiss/archive" action from the UI (V1 archives automatically on regeneration; manual curation is deferred).
