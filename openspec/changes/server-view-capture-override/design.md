# server-view-capture-override — design

## Context

The §8.2 gate resolves per run in `spacesSchemaSyncHandler`:

```ts
const viewCapture = await resolveViewCaptureForRun(masterDb, backupRunId);
const capturedGated = viewCapture ? captured : stripCapturedViews(captured);
// … diffSchema({ …, includeViews: viewCapture })
```

`resolveViewCaptureForRun` joins `backup_runs.connection_id → connections.platform_config` and checks `is_enterprise_scope === true` (default closed). Prior view rows are deliberately untouched when the gate is closed (`includeViews:false` skips the whole views block in `diffSchema`).

## Goals / Non-Goals

**Goals**
- Dev/demo environments capture views without an Enterprise Airtable account, via explicit per-Worker opt-in.
- Non-Enterprise Spaces' pre-gate view rows converge to an honest lifecycle state (`unknown`) instead of frozen `active`.
- Zero effect on staging/production customer behavior unless someone deliberately sets the var there.

**Non-Goals**
- Staff/org-scoped overrides, web UI surfacing, incremental-path view application (see proposal Non-Goals).

## Decisions

1. **Override is an env var, not data.** `env.VIEW_CAPTURE_OVERRIDE === "1"` short-circuits *before* the DB resolution (`override || await resolveViewCaptureForRun(…)` — skip the query entirely when overridden; one fewer master-DB round-trip per sync in dev). Rationale: the need is environment-scoped (dev Worker), not org-scoped; `.dev.vars` is already the source of truth for dev Worker config and is auto-synced on deploy (CLAUDE.md §3.3). A `platform_config` flag or staff-org check would add DB surface for no current consumer.

2. **Response distinguishes override from Enterprise.** `viewCapture: true | false | "override"` — `true` = connection is Enterprise-scoped, `"override"` = env var opened it. Truthiness is preserved, so any caller doing `if (viewCapture)` keeps working; the workflows writer ignores the field today.

3. **Unknown-sweep lives in the same transaction as the diff apply.** New io helper `markViewsUnknownForBase(tx, baseId)` (in `space-db-pg.ts`, next to `applyLifecycleOp`):

   ```sql
   UPDATE bo_at_views SET status='unknown' WHERE base_id = $1 AND status='active'
   ```

   Called from the route only when the gate resolved closed. Semantics follow the existing lifecycle rules exactly: `unknown` = "we can no longer observe this entity" — no `first_unseen_run` stamp (that is reserved for confident `removed`), matching `applyLifecycleOp`'s unknown branch. Idempotent (second gated sync matches zero rows). Reappearance needs no new code: a later gated-open sync's insert/seen upsert sets `status='active', last_seen_run=<run>`.

4. **`removed` rows are not touched.** Only `active → unknown`; a view already confidently removed stays removed.

## Risks / Trade-offs

- **[Risk] Var accidentally set in prod** → gate silently open for everyone. Mitigation: the var is read only from the Worker env (never a default), staging/prod secret sets are managed separately from `.dev.vars` (CLAUDE.md §3.3), and the response's `"override"` value makes it visible in any smoke.
- **[Trade-off] Dev captures views for non-Enterprise test connections** — dev per-Space DBs diverge from what the same org would have in prod. Acceptable: that is the point of the override, and dev data is disposable.
- **[Edge] Override toggled off after dev captures** → next gated sync sweeps those rows to `unknown`. Correct and self-describing, no churn (single idempotent UPDATE).
