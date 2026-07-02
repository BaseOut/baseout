## Context

The per-Space capture writes `bo_at_fields` (type + options + lifecycle status) and `bo_at_tables`. Airtable's relationship semantics live in those field types/options. The engine reaches the per-Space DB through `withSpaceSchema`; the workflows backup task POSTs schema to `schema-sync`. This change models relationships on top of that without re-capturing anything.

## Goals / Non-Goals

**Goals**
- Surface every API-derived relationship without a new table or capture step.
- Detect likely synced views (no API signal) and let the user confirm/dismiss, never re-proposing dismissals.
- Keep validity + removed-history computable from existing lifecycle status.

**Non-Goals**
- Editing API-derived relationships (they reflect Airtable).
- A visual graph (that's Visualize).
- Per-relationship history rows (the field lifecycle already carries first/last-seen).

## Decisions

1. **Derive API relationships on read, don't persist them.** They are a deterministic function of `bo_at_fields` — persisting would duplicate state that the schema capture already owns and risk drift. `deriveRelationships` is pure (slim row inputs), so it's unit-tested without a DB.

2. **One table, only for synced views.** Synced-view candidates are the only relationship state the API can't reconstruct (inferred + a user lifecycle). `bo_at_synced_view_candidates` holds one row per unordered table pair (canonical `source<dest`) with `status` + `origin` + match data. v4 bump.

3. **Inference runs engine-side, triggered per run.** The heuristic (`inferSyncedViews`) is pure, but the *data* lives in the engine's per-Space DB. Computing in the Node runner would mean shipping the whole schema over the wire and back. Instead `/relationships/sync {baseId,runId}` reads tables/fields + prior dismissals from the per-Space DB and upserts candidates. `schema-sync` also calls it best-effort so candidates stay fresh automatically; the workflows task is the explicit per-run trigger (and a future re-infer hook).

4. **Validity + removed-history from lifecycle.** A derived relationship is `valid` when its anchor field is active and (if it references entities) at least one ref resolves active; `hasRemovedHistory` when the anchor or any ref is removed. Synced views are `inferred` while status==='inferred'. The "include removed/dismissed" toggle reveals invalid derived rows + (with `includeDismissed=1`) dismissed candidates.

5. **Inference is advisory in schema-sync.** It runs in its own `withSpaceSchema` after the schema write and swallows errors — a not-yet-v4 Space or an inference bug must never fail the schema capture.

## Risks / Trade-offs

- **[Risk] Inferred false positives.** → threshold (60%) + minMatches (2) + name/type signature matching; the user confirms/dismisses, dismissals never re-proposed.
- **[Risk] v3 Spaces lack the table.** → schema-sync inference is best-effort (swallowed); the read route 500s until re-provision. Tracked by `system-per-space-upgrade`.
- **[Trade-off] Recompute derive on every read.** → cheap (one base's fields); avoids a persisted-state drift class entirely.

## Migration Plan

Per-Space v4: new/re-provisioned Spaces get `bo_at_synced_view_candidates` from the bundled DDL. Existing prod Spaces need the deferred in-place upgrade (`system-per-space-upgrade`); dev re-provisions. No master-DB migration. Verified: server `typecheck` + targeted suites green; `db-schema` parity 25 tables.
