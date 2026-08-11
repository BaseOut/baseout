## Why

The Health tab ([`web-health-tab`](../web-health-tab/)) surfaced the engine's per-base grade + breakdown + issues, and its Pro+ editor (prompt/enable/re-run) is green. The next schema-intelligence surface is **AI Insights**: advisory *observations* about a base, each tagging the tables/fields it references. The engine half is proposed as [`server-schema-insights`](../server-schema-insights/) (per-Space observation storage + entity tags + `active`/`archived` lifecycle + a space-level + per-base insight prompt + read/config/sync/re-run routes) and its generation task as [`workflows-schema-insights`](../workflows-schema-insights/). Nothing surfaces it to the customer.

The ui-only [`schema-insights-ui`](../../../) spec defines an **Insights** section on the Schema page's **Health tab** ([`SchemaHealth.astro`](../../../apps/web/src/components/schema/SchemaHealth.astro) in ui-only): observation cards, each with **entity-tag chips** (click → the shared entity-detail sidebar) and a muted "generated &lt;date&gt;"; a **prompt config** (Pro+) for the space-level prompt + optional per-base override with the effective resolution shown + Reset; a **Re-run** control when the prompt changed since the last generation; and an **archived-insights toggle**. This change adds that Insights section: read-only observations for all entitled tiers, plus the Pro+ prompt editor + per-base override + re-run. It may graduate to its own Schema tab if it grows.

## What Changes

- An **Insights** section on the Health tab (below the grade/breakdown/issues), shown for every Space that has captured schema. Per **base**: a dense list of **active** observation cards — each showing the observation body, a row of **entity-tag chips** (type icon + name; click → the shared entity-detail sidebar/modal reused from Browse/Docs), an optional category/evidence, and a muted "generated &lt;date&gt;".
- An **"include archived"** toggle reveals archived observations (muted, labeled "archived"); active-only by default (the read forwards `includeArchived`).
- A **prompt config** affordance (Pro+): the effective prompt + source (Override / Space / System default), edit the **space-level** prompt or set/clear a **per-base override**, with **Reset** to default — reusing the prompt-editor pattern from the Health tab. Below Pro+: read-only + upgrade affordance.
- A **Re-run** control (Pro+) shown when the base is **stale** (effective prompt updated since last generation), wired to the engine's on-demand generation; polls the read for the async result.
- The section **lazy-loads** per base on first open of the Health tab + refetches on base change / toggle (piggybacks the Health tab's existing lazy-load, one extra engine round-trip).
- **Launch+ gating** for reads reuses the Schema Docs tier guard (`guardSchemaDocsRequest`); **Pro+ (`manual_ai`)** gating for the prompt edit + re-run mutations, exactly like the Health editor. No new capability key.
- New web client methods `getInsights` / `getInsightConfig` / `setInsightPrompt` / `rerunInsights` + proxy routes `/insights` (GET), `/insights-config` (GET), `/insights-prompt` (POST), `/insights-rerun` (POST).

## Capabilities

### New Capabilities
- `schema-insights-ui`: the Insights section on the Health tab — the active-observations list with clickable entity-tag chips (→ shared sidebar), the archived toggle, the Pro+ prompt config (space + per-base override with resolution + Reset), and the last-generated + stale-driven Re-run. Reads Launch+; mutations Pro+.

### Modified Capabilities
<!-- Adds an Insights section to the Health tab shipped by web-health-tab; consumes server-schema-insights. No new DB/migration/capability-key. -->

## Impact

- `apps/web/src/lib/backup-engine.ts` — `getInsights` / `getInsightConfig` / `setInsightPrompt` / `rerunInsights` + view types (`InsightView` / `InsightTagView` / `InsightConfigView` / results), mirroring `getHealthOverview` / `getHealthConfig`.
- `apps/web/src/pages/api/spaces/[spaceId]/insights.ts` (GET), `insights-config.ts` (GET), `insights-prompt.ts` (POST), `insights-rerun.ts` (POST) — guarded proxies: reads via `guardSchemaDocsRequest` (auth + IDOR + tier); mutations additionally require `guard.level === 'manual_ai'` (Pro+) → 403; 503 when the engine binding/token is absent; `schemaDocsErrorStatus` mapping (mirrors `health-overview.ts` + `health-rerun.ts`). Sibling `*.test.ts` for each.
- **Component governance** (per `apps/web/.claude/CLAUDE.md` §2.5, enforced by `pnpm --filter @baseout/web audit:components`): any new `components/schema/*.astro` (e.g. an `InsightCard` / `InsightTagChip` if extracted) is registered in [`component-classification.json`](../../../apps/web/src/components/component-classification.json), gets a sibling `*.stories.ts`, and a `/styleguide` entry in `apps/design`; **no `<style>` blocks** where a daisyUI primitive covers it. If the section is composed vanilla-in-view inside `SchemaView.astro`, extend its [`raw-markup-audit-allowlist.json`](../../../apps/web/src/components/raw-markup-audit-allowlist.json) entry rather than adding scoped CSS. Do **not** refactor the existing Browse/Health/Docs tabs (CLAUDE §3.2).
- **Reuses**: the shared entity-detail sidebar/modal + tag-chip + Airtable field-type icons from Browse/Docs; the Pro+ prompt editor + upgrade affordance from the Health tab.
- **Pairs with** [`server-schema-insights`](../server-schema-insights/) (read/config/re-run path consumed here) and [`workflows-schema-insights`](../workflows-schema-insights/) (produces the observations).
- **Deferred follow-ups:** graduating Insights to its own Schema tab if the section grows; per-entity (table/field) prompt overrides in the UI (engine ships space + per-base only in V1); a "show more"/collapse for very long lists. No DB/migration/capability-key change (gates via the existing `schemaDocs` + `manual_ai` levels).
