## Context

The engine exposes `GET /api/internal/spaces/:spaceId/health-overview?baseId=appXXX` returning `{ ok, grade: {score,band}|null, metrics: [...], issues: [...] }` ([`health-overview.ts`](../../../apps/server/src/pages/api/internal/spaces/health-overview.ts)). The web app reaches the engine through the `BACKUP_ENGINE` service binding, never public HTTP. The established pattern for a read endpoint is `getSchema` (web client) → `schema.ts` (proxy, `guardSchemaDocsRequest` for auth + IDOR + tier) → engine route. This change clones that pattern exactly so the Health read path is navigable by analogy to Schema.

## Goals / Non-Goals

**Goals**
- Surface the already-computed grade + breakdown + issues per base, read-only.
- Gate at Launch+ by reusing the Schema Docs tier guard (no new capability key).
- Lazy-load so opening `/schema` doesn't trigger a Health round-trip unless the tab is used.

**Non-Goals**
- Prompt editing, per-base enable/disable, single-metric re-run (Pro+) — need engine mutation routes (`server-schema-health-scoring` §4.2c).
- Score trend over time — needs a `created_at` on `bo_at_health_scores` (per-Space v4).
- Scoring on demand from the UI — scoring is task-driven after a schema capture.

## Decisions

- **Reuse `schemaDocs` level for gating, no `health` capability key.** The roadmap floated a dedicated `health` key, but the spec's "Health basic = Launch+" maps exactly onto `schemaDocs >= manual` (Launch+). Reusing `guardSchemaDocsRequest` keeps the read tab consistent with Browse/Docs and avoids a capability-resolver change. A distinct `health` key is only warranted once Pro+ Health controls diverge from Schema Docs tiers — defer it to the mutation-routes follow-up.
- **Per-base, with a base picker.** Health is computed per base (each base has its own grade). The tab renders a base `<select>` (hidden input when there's a single base) and fetches that base's overview. This matches the engine route's `?baseId=` contract and the spec's per-base grade cards.
- **Lazy fetch on first tab open.** Tabs are CSS-only daisyUI radios (content is in the DOM up front). A vanilla `<script>` listens for the Health radio's `change`; the first time it's checked it fetches, then refetches on base change. Avoids an engine call for users who never open Health.
- **Render via `innerHTML` strings, escaped.** Consistent with the existing Browse `entity-detail` renderer in the same file (governance §4.2 sanctioned daisyUI-direct second tier). Uses daisyUI `stats`/`table`/`badge`/`link` primitives; no bespoke CSS. A local `esc()` guards all interpolated engine data.
- **403 → upgrade affordance.** The proxy guard returns 403 for non-entitled orgs; the tab renders "Health scoring is available on the Launch plan and above." rather than a generic error. (In practice non-entitled orgs already see no schema, so this is the edge-case path.)

## Risks / Trade-offs

- **`innerHTML` rendering** — mitigated by escaping every engine-supplied string through `esc()`; the only non-escaped attribute is the Airtable deep-link `href`, which is escaped too.
- **Reusing the Schema Docs gate** — if Health entitlement ever needs to differ from Schema Docs (e.g. Health at a different tier), this needs a real `health` capability key. Acceptable now because the spec aligns them; flagged for the mutation follow-up.

## Migration Plan

None — additive UI + a new read-only proxy route. No DB, migration, or capability change. Verified with web `typecheck` + `build`; human smoke needs a managed_pg Space with scored health (engine runs `--remote`).
