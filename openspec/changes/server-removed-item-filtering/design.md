## Context

`system-per-space-db` already gives `bo_at_bases/tables/fields` a lifecycle: `status` (`active` | `removed` | `unknown`), `first_seen_run`, `first_unseen_run`, `last_seen_run`, with the rule "mark `removed` only on a confident full parent enumeration; a failed/partial run uses `unknown`, never a false removal." So the storage and the removal signal exist. This change adds the **read-side** behavior (default active-only + `include_removed`) and reaffirms that the schema step actually flips vanished items to `removed`.

## Goals / Non-Goals

**Goals**
- On re-capture, vanished bases/tables/fields are marked `removed` with the run that found them missing (kept for history).
- Schema read endpoints default to active-only; `include_removed` returns removed items flagged with their removal run/date.

**Non-Goals**
- New columns (the lifecycle already exists).
- Hard-deleting removed entities (history is preserved).
- Record-level removal UI (records have their own lifecycle; this scope is bases/tables/fields — the schema entities the Browse tab lists).

## Decisions

1. **No schema change.** Reuse `bo_at_bases/tables/fields` `status` + `first_unseen_run` from `system-per-space-db`. `removed` is the "deleted" state surfaced by the filter; `unknown` remains the failed-run safety state and is **not** treated as deleted.
2. **Removal-marking reaffirmed.** During the `backup-base` schema step, after a confident full enumeration, any previously-`active` entity not seen this run flips to `status = 'removed'` with `first_unseen_run = <this run>`; re-seen entities stay `active` and bump `last_seen_run`. A `removed` entity later seen again (rare for schema — Airtable IDs don't recycle) reactivates.
3. **Read default = active-only.** The engine schema read endpoints (powering Browse and the other tabs) return only `status = 'active'` entities by default. They accept `include_removed=true`, which additionally returns `removed` entities, each flagged with `removed` + the removal run/date (derived from `first_unseen_run`). `unknown` items are returned as active-equivalent (present, just not confidently confirmed this run) — not hidden as deleted.
4. **Consistent flag shape.** Removed entities are returned with a clear marker (`status`, `removed_run`/date) so the UI can render them muted with "no longer in Airtable since <date>".

## Risks / Trade-offs

- **[Risk] False removals from a flaky run** hiding live items. → The confident-enumeration rule + `unknown` state (already in `system-per-space-db`) prevent this; this change does not relax it.
- **[Trade-off] `unknown` vs `removed` in the UI.** → Only `removed` is hidden-by-default/filterable as "deleted"; `unknown` stays visible (it's "couldn't confirm", not "gone").
- **[Trade-off] Scope = schema entities only.** → Records have their own lifecycle and listing; this change covers bases/tables/fields (the Browse/schema surfaces). Records can follow the same pattern later if needed.
</content>
