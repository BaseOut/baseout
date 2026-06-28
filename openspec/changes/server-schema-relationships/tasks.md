## 1. Per-Space DB

- [ ] 1.1 Add `bo_at_relationships` (`type`, `origin`, `status`, `first_seen_run`, `last_seen_run`) and `bo_at_relationship_links` (`relationship_id`, `entity_a_type/id`, `entity_b_type/id`, `status`, `first_seen_run`, `removed_run`) to `packages/db-schema/src/space/{pg,sqlite}.ts`; bump `SPACE_SCHEMA_VERSION`; regenerate; keep parity test green.

## 2. API-derived detection (apps/workflows, in the schema step)

- [ ] 2.1 Pure detectors from captured fields → relationships + links: `linked_records`, `formula` (parse referenced fields), `rollup`/`lookup` (source linked field + target), `last_modified`. TDD per type.
- [ ] 2.2 Wire detection into the `backup-base` schema step (origin `api`, status `confirmed`); upsert relationships/links, bump `last_seen_run`.
- [ ] 2.3 Mark vanished links `removed` (+ `removed_run`); never delete; retain the relationship record.

## 3. Synced-view inference (apps/workflows / apps/server) — `schema-relationships-inference`

- [ ] 3.1 Pure similarity heuristic over the Space's tables (name + type overlap ≥ threshold), conservative; returns candidate table/field pairs. TDD.
- [ ] 3.2 Space-level step after all bases captured: create `synced_view` relationships (`origin=inferred`, `status=inferred`) + links; skip `dismissed`; idempotent; mark no-longer-similar links `removed`.

## 4. Lifecycle + validity (apps/server)

- [ ] 4.1 Computed validity (≥1 active link → valid) at read time; no stored field.
- [ ] 4.2 Confirm / dismiss API for inferred relationships (`inferred` → `confirmed` | `dismissed`; dismissed retained). API-derived relationships not user-editable.

## 5. Read API + orchestration

- [ ] 5.1 Enqueue the space-level inference after a run's bases are captured (coordinate with `server-split-backup-schedules`).
- [ ] 5.2 Read API: list relationships grouped by base + type (with computed validity, inferred/removed flags); read a relationship's links + referenced entity details for click-through.

## 6. Cross-refs + verification

- [ ] 6.1 Cross-reference `system-per-space-db` (entities, schema capture, dates-via-runs), `server-split-backup-schedules` (post-capture trigger), the shared entity sidebar (click-through). Link the ui-only `relationships-tab`.
- [ ] 6.2 Demo: capture a base with linked/formula/rollup/lookup fields → relationships + links created; remove a linked field → its link goes `removed` (kept), relationship computes invalid if no active links remain.
- [ ] 6.3 Demo: two similar tables across bases → an `inferred` `synced_view` appears; confirm one and dismiss another → confirmed persists, dismissed isn't recreated next run.
</content>
