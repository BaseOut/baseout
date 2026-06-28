## Context

Relationships are connections between schema entities. Most are derivable from the captured schema (`bo_at_fields.type` + `options` give linked-record targets, formula/rollup/lookup references, lastModified references). Synced views are **not** in the API but can be inferred from very-similar field structures across tables/bases. This runs as part of schema processing (`server-split-backup-schedules` schema capture), writes to the per-Space DB (`system-per-space-db`), and feeds a new Relationships tab. No prompts/config in master — relationships are derived/inferred content + a user confirm/dismiss action.

## Goals / Non-Goals

**Goals**
- A relationship graph (typed relationships + many-to-many entity-pair links) per Space.
- Detect API-derived relationships during schema processing; infer synced views across the Space.
- Preserve history: links go `removed` (with dates) rather than being deleted; relationships keep their record.
- Let users confirm / dismiss inferred relationships; compute validity from links.

**Non-Goals**
- Editing real (API-derived) relationships (they reflect Airtable; only inferred ones are user-confirmable).
- A visual graph (that's Visualize); this is the data + the list/detail tab.
- Cross-Space relationships (within a Space only).

## Decisions

### Data model (per-Space DB)
- `bo_at_relationships`: `id`, `type` (`linked_records` | `formula` | `rollup` | `lookup` | `last_modified` | `synced_view`), `origin` (`api` | `inferred`), `status` (`inferred` | `confirmed` | `dismissed` — defaults `confirmed` for `api`, `inferred` for inferred), `label?`, `first_seen_run`, `last_seen_run`. **No validity column** — validity is computed.
- `bo_at_relationship_links`: `id`, `relationship_id`, `entity_a_type`, `entity_a_id`, `entity_b_type`, `entity_b_id`, `status` (`active` | `removed`), `first_seen_run`, `removed_run` (nullable). The many-to-many: a formula's relationship pairs the formula field ↔ each referenced field (multiple links); a field referenced by many formulas appears in many links across relationships. The **initial / removed dates** derive from `first_seen_run` / `removed_run` (time lives on the run, per `system-per-space-db`).

### API-derived detection (per base, during the schema step)
From the captured fields the task creates/updates relationships + links:
- **linked_records**: a linked-record field → relationship; links pair the linked field ↔ the target table (and the reciprocal field if present).
- **formula**: a formula field → relationship; links pair the formula field ↔ each field its expression references.
- **rollup / lookup**: the field → relationship; links pair it ↔ its source linked field and the target field it pulls.
- **last_modified**: `lastModifiedBy`/`lastModifiedTime` → relationship; links pair it ↔ the field(s)/table it tracks.

### Inferred synced views (space-level, after all bases captured)
Because inference compares tables **across the Space**, it runs after every base's schema is captured (a space-level step, not per-base). Heuristic: two tables whose field sets are very similar (name + type overlap above a threshold) → a `synced_view` relationship, `origin = inferred`, `status = inferred`, links pairing the two tables (and matching field pairs). It SHALL **not** recreate relationships the user `dismissed`, and SHALL be idempotent run-to-run.

### Lifecycle + validity
- **Upsert**: new relationships/links insert with `first_seen_run`; re-seen links stay `active` and bump `last_seen_run`.
- **Removal**: a link whose pair is no longer present (referenced field removed, linked record gone, inferred match no longer holds) → `status = removed` + `removed_run` (kept for history, still associated with its entities). The relationship record is retained.
- **Computed validity**: valid iff ≥1 `active` link; otherwise invalid (computed at read; no stored field).
- **Confirm / dismiss** (user, inferred only): confirm → `status = confirmed`; dismiss/remove → `status = dismissed` (kept so inference won't recreate it).

### Where it runs
- Per-base API-derived detection: in the `workflows` `backup-base` schema step (it already has the base's fields). 
- Space-level synced-view inference: a step after the run's bases are all captured (engine-enqueued task or post-run hook) — capability `schema-relationships-inference`.

### Read / actions API
Engine endpoints to list relationships (grouped by base + type, with computed validity), read a relationship's links + entity details (for click-through to the shared sidebar), and confirm/dismiss an inferred relationship.

## Risks / Trade-offs

- **[Risk] False-positive synced-view inference.** → Conservative similarity threshold; mark `inferred` (not authoritative); require user confirm; never auto-treat inferred as real for downstream features.
- **[Risk] Dismissed inferred relationships reappearing.** → `dismissed` status is retained and inference skips dismissed pairs.
- **[Trade-off] Link history grows.** → Links are far lower-volume than records; `removed` links are kept deliberately for history; a retention sweep can prune ancient removed links later if needed.
- **[Trade-off] Cross-base inference needs whole-Space schema.** → Run it space-level after per-base capture, not inside `backup-base`.
- **[Trade-off] Dates via runs vs explicit columns.** → `first_seen_run`/`removed_run` keep time-on-runs consistency; the UI derives the dates. (Switchable to literal timestamps if preferred.)
</content>
