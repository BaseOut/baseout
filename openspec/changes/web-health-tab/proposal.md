## Why

The Schema page ([`SchemaView.astro`](../../../apps/web/src/views/SchemaView.astro)) ships Browse + Docs, but the target tab order is `Browse · Visualize · Relationships · Changelog · Health · Docs · Chat`. The **Health** engine half is already complete and green — the per-Space tables (`bo_at_health_metric_*`, `bo_at_health_issues`), the AI scoring task ([`workflows-health-scoring`](../workflows-health-scoring/)), and the engine read/grade routes ([`server-schema-health-scoring`](../server-schema-health-scoring/) §4: `health-sync` write + `health-overview` read with catalog-weighted base grade). Nothing surfaces it to the user.

The ui-only [`health-tab-scoring`](../../../) spec defines a per-base Health tab: a 0–100 grade with band, a per-metric breakdown, and an issues list with deep-links into Airtable. This change adds the **read-only** Health tab — the last hop from the green engine to the customer. The Pro+ prompt editor / enable toggles / re-run controls are a deferred follow-up (they need the engine mutation routes in `server-schema-health-scoring` §4.2c).

## What Changes

- A new **Health** tab on `/schema` (between Changelog and Docs in the target order), shown for every Space that has captured schema.
- Per **base**: a grade card (score + band, colored by score), a per-metric breakdown table (metric name + severity badge + scope + weight + sub-score), and an issues list (severity badge + message + "Open in Airtable" deep-link when present).
- The tab **lazy-loads** — it fetches `health-overview` for the selected base only when first opened (one engine round-trip), and refetches on base change.
- **Launch+ gating** reuses the Schema Docs tier guard: the proxy route runs `guardSchemaDocsRequest`, so a non-entitled org gets a 403 that the tab renders as an upgrade affordance.
- A new web client method `getHealthOverview(spaceId, baseId)` + a `/api/spaces/:spaceId/health-overview` proxy route, both mirroring the existing `getSchema` / `schema.ts` pattern.

## Capabilities

### New Capabilities
- `health-tab`: a read-only per-base Health view (grade + per-metric breakdown + issues with Airtable deep-links), Launch+ gated, lazy-loaded from the engine `health-overview` route.

### Modified Capabilities
<!-- Adds a tab to the Schema page shipped by shared-schema-docs; consumes the read path from server-schema-health-scoring. No new DB table or migration. -->

## Impact

- `apps/web/src/lib/backup-engine.ts` — `getHealthOverview` + `GetHealthOverviewResult` / `HealthOverviewMetricView` / `HealthOverviewIssueView` types (mirrors `getSchema`).
- `apps/web/src/pages/api/spaces/[spaceId]/health-overview.ts` (new) — authenticated, IDOR- and tier-gated proxy (mirrors `schema.ts` via `guardSchemaDocsRequest`).
- [`apps/web/src/views/SchemaView.astro`](../../../apps/web/src/views/SchemaView.astro) — Health radio tab + base picker + lazy fetch + grade/metrics/issues render.
- **Pairs with** [`server-schema-health-scoring`](../server-schema-health-scoring/) (read path consumed here) and [`workflows-health-scoring`](../workflows-health-scoring/) (produces the scores).
- **Deferred follow-up:** the Pro+ prompt editor / per-base enable / re-run controls + the score trend chart — blocked on the engine mutation routes (`server-schema-health-scoring` §4.2c) and a `created_at` on `bo_at_health_scores` (a v4 per-Space bump).
- No DB, migration, or new capability-key change (gates via the existing `schemaDocs` level).
