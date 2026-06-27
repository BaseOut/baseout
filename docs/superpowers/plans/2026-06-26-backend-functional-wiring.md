# Backend Functional Wiring — Implementation Plan (Roadmap)

> **For agentic workers:** This is a **sequencing roadmap**, not a from-scratch task spec. Most subsystems below are already decomposed into per-subsystem OpenSpec changes whose `tasks.md` files ARE the executable, task-by-task plans. Implement each via `opsx:apply <change>`. This document orders them by dependency + value, and specifies the few gaps that have **no** change yet (so they need `opsx:propose` first) plus the decisions only a human can make.

**Goal:** Make the redesigned `apps/web` UI actually *do* what it shows — wire restore, run-control, per-base run detail, retention, scheduled runs, and connection-health to the `apps/server` engine + `apps/workflows` tasks.

**Architecture:** Baseout is two Workers + one Trigger.dev project + shared Postgres. `apps/web` (SSR + `/api/*`) calls `apps/server` (`/api/internal/*`, INTERNAL_TOKEN-gated, via the `BACKUP_ENGINE` service binding); `apps/server` owns run/restore lifecycle + Durable Objects and enqueues `apps/workflows` Trigger.dev tasks; tasks POST progress/completion back. Master-DB migrations are owned by `apps/web`; `apps/server`/`apps/workflows` mirror tables read-only.

**Tech Stack:** Cloudflare Workers (workerd), Astro SSR, Drizzle/postgres-js, Durable Objects, Trigger.dev v3 (Node), Vitest (+ `@cloudflare/vitest-pool-workers` on the server), `msw` for HTTP boundaries.

---

## Current state (verified 2026-06-26)

**Functional today:** manual + scheduled-INSERT backup runs (run-level totals), per-base task fan-out, progress/complete callbacks, ConnectionDO rate-limit + token refresh, per-Space DB schema/record sync, attachment dedup lookup, workspace rediscovery, **cancel backend** (`server-schedule-and-cancel` Phase A), and now **run-now from the Space Home rail** (this session).

**Gated / not wired (what this plan covers):**

| Frontend gap (what the UI shows) | Backend owner | Status | New work needed |
|---|---|---|---|
| **Cancel button** on `BackupRunDetailView` | `server-schedule-and-cancel` Phase A (DONE) + `apps/web` cancel route (exists) | **button is static** | Tiny `apps/web` wiring only |
| **Scheduled runs actually fire** | `server-schedule-and-cancel` **Phase B** | [0/11] proposal | Implement Phase B (SpaceDO alarm) |
| **Restore** (`/restore` + RestoreView) | `server-restore` + `workflows-restore` | both **[0/24]/[0/18] proposal** | Implement both + an `apps/web` restore route/wiring (no web change yet) |
| **Per-base / per-table run detail** (`metricsPending`) | *no change owns backup per-run detail* | **GAP** | `opsx:propose` a new change + a schema decision |
| **Retention / cleanup** (cutoff persistence + sweep) | `server-retention-and-cleanup` + `workflows-retention-and-cleanup` | both **proposal** | Implement; blocked on R2 + (manual trigger) credits |
| **Pause / Resume** | *no change exists* | **GAP** | `opsx:propose` + a hard Trigger.dev semantics decision |
| **Home `baseMetrics` / `usage`** | *no change for metrics feed; usage needs billing* | **GAP / blocked** | Small read endpoint; usage blocks on quota model |
| **ConnectionHealth global banner** + notify cadence | UI track (not promoted) + `server-cron-dead-connection-cadence` | UI not promoted; cron **[0/9]** | Promote banner (reads existing status) + implement cron |

---

## Phasing (dependency- and value-ordered)

Each phase is independently shippable + smoke-testable. Implement a phase's OpenSpec change(s) with `opsx:apply`, then do the listed `apps/web` wiring, then verify.

### Phase 0 — Close the near-done gaps (fast, high-confidence)
**0a. Wire the Cancel button.** Backend cancel is done (Phase A) and `apps/web/src/pages/api/spaces/[spaceId]/backup-runs/[runId]/cancel.ts` exists, but `BackupRunDetailView.astro:162` renders a static `<Button>`. Add a `<script>` that POSTs the cancel route (mirror `RunBackupButton`'s `setButtonLoading` + error pattern), with a `ConfirmModal` confirm (ui-only's design). **Files:** `apps/web/src/views/BackupRunDetailView.astro` (+ a small client lib if preferred). **Verify:** cancel a running run → row flips `cancelling`→`cancelled`.

**0b. Scheduled runs fire — `opsx:apply server-schedule-and-cancel` (Phase B, [0/11]).** SpaceDO alarm → INSERT queued run on cadence; `next-fire.ts` pure fn; PATCH `/api/spaces/:id/backup-config` sets the alarm; bootstrap existing Spaces. This makes "Next backup: <date>" real. **Verify:** set a short frequency in dev → a run appears at the alarm.

### Phase 1 — Restore (the headline gated feature)
Dependency chain: `server-restore` (lifecycle/schema/routes) → `workflows-restore` (task) → `apps/web` (route + RestoreView data).
1. **`opsx:apply server-restore` [0/24]** — `restore_runs` migration (apps/web-owned), `POST /api/internal/restores/:id/start|progress|complete|cancel`, `lib/restores/*` mirroring `lib/runs/*`, per-base aggregation into `restore_runs.{tables,records,attachments}_restored`.
2. **`opsx:apply workflows-restore` [0/18]** — `restore-base.task.ts` + `runRestoreBase`, `_lib/csv-reader.ts`, `_lib/field-denormalizer.ts` (inverse of `field-normalizer`), `_lib/airtable-create.ts` (batch create + 429 backoff), `_lib/storage-readers/*`. MVP: always a fresh base `<name>-restored-<ts>`, never overwrite.
3. **`apps/web` restore wiring (NO change yet — `opsx:propose web-restore` first):**
   - `POST /api/spaces/:spaceId/restore` → INSERT `restore_runs` (queued) → `engine.startRestore(restoreId)` (new `BACKUP_ENGINE` method).
   - Feed `RestoreView` real data: **source `bases`/`tables`** from the per-Space DB schema broker (`GET /api/internal/spaces/:id/schema`), **`existingBases`** from `atBases`, and the **outcome** (`/restore?done=1`) from the completed `restore_runs` row.
   - Replace the `/restore` `PlaceholderView` stub with the wired `RestoreView`; add the "Restore" entry point on `BackupRunDetailView`/`BackupRunBaseView` (succeeded runs).
- **Decision D1 (attachments on restore):** MVP emits attachments as link-text (per `workflows-restore` proposal); the UI offers "as attachments / as links" (RestoreView Step 3). Confirm MVP = links-only, re-upload deferred (`server-attachment-restore`).

### Phase 2 — Per-base / per-table run detail (turn off `metricsPending`)
**No existing change owns this for backups.** `opsx:propose` a paired change (e.g. `workflows-run-detail` + `server-run-detail` or fold into `web-backups-redesign`'s "Engineer" tasks).
- **Decision D2 (snapshot vs derive):** the per-table data IS captured by `backup-base` → per-Space DB (schema/records sync), but that's *current* schema, not a per-RUN snapshot. Choose: (a) write a per-run snapshot — new `backup_run_bases` + `backup_run_tables` tables (apps/web migration) populated from the `complete` callback's per-base payload; or (b) derive the breakdown at read time from the per-Space DB + the run's aggregates (cheaper, approximate, can't show historical per-run divergence). Recommend (a) for an honest audit trail.
- Then: extend `backup-base` completion payload with per-table detail; add `GET /api/internal/runs/:id/detail` (assembles `BaseRun[]`/`TableRun[]`); add `apps/web` `GET /api/spaces/:id/backup-runs/:runId/detail` + populate `pages/backups/run.astro` (drop `metricsPending`); **build the missing `pages/backups/run/base.astro` route** (now unblocked — `BackupRunBaseView` gets real `tables[]`).

### Phase 3 — Retention / cleanup (cutoff persistence + sweep)
- **`opsx:apply server-retention-and-cleanup` [0/52]** — `backup_retention_policies` table + `backup_runs.deleted_at`, `resolveRetentionPolicy(tier)`, `decideDeletions` (5 policy tiers), manual-trigger route.
- **`opsx:apply workflows-retention-and-cleanup` [0/9]** — hourly cron task → `runCleanupPass`.
- `apps/web`: persist the wizard's cleanup cutoff/ladder (currently informational) to the policy table.
- **Blockers:** the R2-delete path depends on R2 stance + `StorageWriter.deletePrefix` (exists for delete-run-files); the *manual* cleanup trigger charges credits → blocks on `server-manual-quota-and-credits`. Schema + resolver + auto-sweep can ship without credits.

### Phase 4 — Pause / Resume (hardest; no spec)
- **`opsx:propose server-pause-resume`** + **Decision D3 (semantics):** a run fans out N parallel `backup-base` Trigger.dev tasks. Trigger.dev supports cancel (abort injection) but **not** native pause/resume of an in-flight task. Options: (a) "pause" = cancel-and-checkpoint, "resume" = a fresh run skipping completed bases (needs per-base completion tracking from Phase 2); (b) defer pause entirely, keep only Cancel (which is done). Recommend deferring or (a) layered on Phase 2's per-base tracking. The UI already renders the `paused` status; the *control* is what's missing.

### Phase 5 — Home metrics/usage + ConnectionHealth
- **`baseMetrics`** (Home left column): small `apps/web` read — top bases by attachment volume from the per-Space DB / latest run. Unblocks once Phase 2's detail read exists.
- **`usage`**: blocked on the billing/quota model (`server-manual-quota-and-credits` / `server-trial-quota-enforcement`). Keep "illustrative" until then.
- **ConnectionHealth banner** (the un-promoted UI track): connection status detection already exists (token-refresh failure flips `connections.status`; `server-cron-oauth-refresh` largely done). Work = (i) promote `ConnectionHealthBanner`/`Pill` + `emph` into `apps/web` with governance + wire the shell (middleware/layout surfaces a per-request connection-health flag); (ii) **`opsx:apply server-cron-dead-connection-cadence` [0/9]** for the escalating email cadence + auto-invalidation.

---

## Decisions needed from the human (block specific phases)
- **D1** — Restore attachments MVP = links-only (re-upload deferred)? (Phase 1)
- **D2** — Per-run per-base detail: store a snapshot (`backup_run_bases`/`_tables`) or derive at read time? (Phase 2) — **recommend snapshot.**
- **D3** — Pause semantics: cancel-and-resume-as-new-run, or defer pause (keep cancel-only)? (Phase 4) — **recommend defer.**
- **D4** — Sequence/scope: do all phases, or stop after Phase 1 (restore) + Phase 0 (cancel/schedule)? Retention/usage are partly blocked on R2 + billing.

## Recommended first step
**Phase 0** (cancel-button wiring + scheduled-runs Phase B) — small, unblocks "is the schedule real?", and 0a is a quick honest win. Then **Phase 1 (restore)** as the headline. Phases 2–5 follow per decisions D2–D4.

## Per-change execution
Each OpenSpec change carries its own task-by-task plan in its `tasks.md` (run `pnpm openspec:changes server` / `workflows`). Implement with `opsx:apply <change>`, follow this repo's TDD (§3.4) + Verification-commit (§3.8) conventions, and keep `apps/server` Worker-runtime rules (per-request postgres-js, Hyperdrive, DO re-exports) in mind. Gaps without a change (Phase 2 detail, Phase 4 pause, `web-restore` wiring) need `opsx:propose` before `opsx:apply`.
