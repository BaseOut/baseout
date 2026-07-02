## Status

The Health **engine** half is complete + green (`server-schema-health-scoring` §4
read/grade + `workflows-health-scoring` task). This change is the **read-only UI**:
web client method + tier-gated proxy route + the Health tab. Mutation controls
(prompt editor / enable / re-run) + score trend are deferred (need engine §4.2c +
a per-Space v4 `created_at`). No DB/migration/capability-key change — gates via the
existing `schemaDocs` level.

---

## 1. Web client + proxy route

- [x] 1.1 `apps/web/src/lib/backup-engine.ts` — `getHealthOverview(spaceId, baseId)` + result types (`GetHealthOverviewResult` / `HealthOverviewMetricView` / `HealthOverviewIssueView`), mirroring `getSchema` (`schemaDocsRequest(options,"GET",path)`; `if (!res.ok) return res`).
- [x] 1.2 `apps/web/src/pages/api/spaces/[spaceId]/health-overview.ts` — `handleHealthOverview` + Astro `GET` wrapper, mirroring `schema.ts`: `guardSchemaDocsRequest` (auth + IDOR + tier), 400 on missing `baseId`, 503 when the engine binding/token is absent, `schemaDocsErrorStatus` mapping. Forwards `?baseId=` to the engine.

## 2. Health tab UI

- [x] 2.1 `SchemaView.astro` — a "Health" radio tab between Browse and Docs (target order). Empty state when `!hasSchema`. Base picker (`<select>` for >1 base, hidden input for 1) over **non-removed** bases.
- [x] 2.2 Lazy fetch: a vanilla `<script>` loads the selected base's overview the first time the Health radio is checked, and refetches on base change. Grade card (daisyUI `stats`, score-colored), per-metric breakdown (`table table-sm` + severity badge), issues list (severity badge + message + "Open in Airtable" link). All engine strings escaped via a local `esc()`.
- [x] 2.3 403 → "Health scoring is available on the Launch plan and above."; other non-OK → generic error; grade-null + no-metrics → "not scored yet".

## 3. Verification

- [x] 3.1 `pnpm --filter @baseout/web typecheck` — 0 errors (368 files). No stray `console.*` (§3.5). Engine route shape (`grade`/`metrics`/`issues`) confirmed against `readHealthOverview` + `health-overview.ts`.
- [ ] 3.2 `pnpm --filter @baseout/web build` green.
- [ ] 3.3 Human smoke: on a managed_pg Space with scored health, open `/schema` → Health → grade + breakdown + issues render; base picker switches bases; deep-links open Airtable; non-entitled org sees the upgrade message. (Engine runs `--remote`: `pnpm --filter @baseout/server deploy:dev` + `npx trigger.dev dev` first.)

## 4. Pro+ editor (DONE — follow-up)

- [x] 4.1 Client methods `getHealthConfig` / `setHealthPrompt` / `setHealthEnable` / `rerunHealth` + 4 Pro+ (`manual_ai`) proxy routes (`health-config` GET, `health-prompt`/`health-enable`/`health-rerun` POST). Tests: `health-config.test.ts` (5) + `health-rerun.test.ts` (3) + `health-enable.test.ts` (6, covers prompt too).
- [x] 4.2 Health tab editor (shown when `aiEnabled`): "Re-run scoring" button (POST + polls the overview ~36s for the async score) + "Configure metrics" panel (per-metric enable toggle + prompt textarea + Save/Reset + source/stale/scored badges). Edits apply Space-wide; per-entity override UI deferred.
