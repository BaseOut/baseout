# Tasks — Backup operations (run-actions · run-now · restore · cleanup)

This change is mostly the **spec catching up to UI that is already built**. The build status below reflects what exists in `apps/web`; the open items are the genuinely-missing states and the client decisions.

## Built — on `main`, committed (`a7f8672`)
- [x] **Run Backup Now + credits confirm** — `components/backups/RunBackupNowModal.astro` (catalog Modal + soft-warning alert + md buttons); wired on the Space Home rail, the Backups header, and the Backups empty state. Off-schedule → "additional credits" → Cancel / Run anyway; only Run anyway starts a run. Top-level only (no per-row run-again).
- [x] **Restore flow** — `views/RestoreView.astro` + the `/restore` route + entry points on `BackupRunDetailView` (succeeded) and `BackupRunBaseView`. Steps: pick one base → pick tables (all by default, Select all / red Clear) → existing base (select) or new base (name). Always new tables, never overwriting. Persistent best-effort alert up top.
- [x] **Cleanup schedule** — in `IntegrationsSetupWizard.astro` Options: a soft-info alert + a tiered retention ladder (`CLEANUP_TIERS` map + JS that rebuilds the ladder on frequency change) + a cutoff select (1 / 2 / 5 years / never, default 5y).
- [x] **Run actions header** — `BackupRunDetailView` shows Pause + Cancel run only while running; a finished/failed run is read-only (no Delete, no Run-again).

## To build — the missing states this change defines
- [x] 🔴 **`paused` / `cancelled` run statuses** in `BackupsListView` + `BackupRunDetailView` — neutral statuses keeping the counts captured before stopping. BUILT 2026-06-19 (paused = soft-warning + Resume; cancelled = ghost, read-only).
- [x] 🔴 **Restore outcome report** — the screen after a restore completes (tables/records recreated + Formula/text/link items to finish by hand + open-the-base). BUILT 2026-06-19 (`/restore?done=1`).
- [x] 🔴 **Attachments option in Restore** (client Q6, 2026-06-20) — BUILT: restore Step 3 lets the user choose attachments **as attachments** (re-upload into Airtable) or **as links** (links to the files in the backup destination), default **as attachments**; the choice carries into the outcome (an Attachments stat with count + mode). Demo `/restore?done=1&att=links`.
- [ ] 🟠 **Role-gating** — viewers cannot Pause/Cancel or Run Backup Now (read-only). Boundary not raised this round; assumption stands.
- [ ] 🟠 **Failure notification** — DEFERRED to next round (pulled from the question list). When a scheduled run fails, alert the user (the "your backup failed" notice the deep-link story assumes). On2Air precedent: failure emails + a monthly audit. Tracked as registry `backups-failure-notification` (discussion).
- [ ] 🟠 **Retry-failed outcome** — the in-place re-fetch result shown in the same run (button exists; outcome undefined).

## Decisions — confirmed by the client 2026-06-20 (see `design.md` "Client decisions")
- [x] Cancel — **keep** the partial backup, status `cancelled` ✅
- [x] Pause/Restart — **resume** from where it stopped ✅
- [x] Cleanup — keep as built (tiers fixed, **cutoff configurable**) ✅
- [x] Restore base→tables→new-tables + outcome — **matches** ✅ (+ the new Attachments option above)
- [ ] Credits model — DEFERRED: per-task & volume-based (~100cr/1000 records), not finalised; the off-schedule **warning is sufficient for now** — no balance/out-of-credits UI yet
- [ ] Run control by role — not raised this round; viewers-read-only assumption stands

## Then
- [ ] Engineer: wire Pause / Cancel / Retry / Run-now / Restore to real endpoints once the semantics are locked
- [ ] Fill the `flow-registry.ts` `specs[]` for these flows against this change (done in this pass)

## Applied to monorepo apps/web (2026-06-26) — frontend promotion (backend excluded)
- [x] **`RestoreView.astro` ported into `apps/web/src/views/`** (the deferred Restore track). Self-contained view
      (no component imports; its own `<style>` + `<script>`), with the full flow: best-effort alert → pick base →
      pick tables → attachments (as-attachments / as-links) → target (existing/new) → and the **outcome report**
      (`?done=1`, `&att=links`). Added a raw-markup-allowlist entry (daisyUI-direct view, §4.2). Adapted the
      `<script>` to the monorepo's stricter TS (`worker-config` DOM-type shadow): mirrored the wizard's `$`/`$$`
      helper; `<select>` typed loosely + `toggleAttribute('disabled')`.
- [x] **Design harness renders it** — `apps/design/src/pages/restore.astro` now imports `@web/views/RestoreView`
      with fixtures (form + outcome states). Verified: web `astro check` 0 errors (350 files) · web unit 804/804 ·
      governance 12/12 · design `astro check` 0 errors.
- **Production `/restore` route kept as the `PlaceholderView` stub (deliberate).** The restore *operation* and the
      per-base/per-table *source* data are backend (`atTables` not in the master DB; restore endpoint is "Engineer")
      — wiring the interactive flow now would fake a restore. The view is promoted + design-exercisable; production
      wiring + the `BackupRunDetailView`/`BackupRunBaseView` "Restore" entry points land with the backend endpoint.
- [x] **`RunBackupNowModal` + `ConfirmModal` ported into `apps/web`** (2026-06-26). `ConfirmModal` (built on the
      existing `Modal` primitive) classified `ui-primitive-storybook` + `confirm-modal` styleguide entry + sibling
      story; `RunBackupNowModal` (`components/backups/`) classified `daisyui-direct-styleguide` (thin ConfirmModal
      configuration) + sibling story. Wired on the **Space Home rail** (the "Run backup now" button opens the
      credits-warning confirm; "Run anyway" → `/?status=running`). Verified: web `astro check` 0 errors (354 files) ·
      web unit 805/805 · governance 12/12 · design 0 errors.
- [x] **Run-now made functional (2026-06-26):** `RunBackupNowModal` "Run anyway" now performs a **real** on-demand
      run — `spaceId` prop + a custom `confirm` slot wired to `runBackup(spaceId)` (POST `/api/spaces/:id/backup-runs`,
      the same path `RunBackupButton` uses) with `setButtonLoading` + error display, then navigates to `/?status=running`.
      Works in both apps (prod enqueues to the engine via the service binding; the design stub returns `{ok,runId}`).
      So the Space Home rail "Run backup now" is no longer a prototype nav. (The Backups-page `RunBackupButton` stays
      as the other real-run entry; not regressed.)
- [x] **paused/cancelled statuses** (2026-06-26). `cancelled` was already handled; added `paused` to the central
      `STATUS_META` (`lib/backups/list-row.ts`, soft-warning badge) + the Backups list status filter options. The
      detail view renders both via `statusMetaFor`. (The Pause/Resume *controls* are backend ops — gated.)
- [x] **cleanup-schedule UI** in the wizard Options (2026-06-26). Ported the `CLEANUP_TIERS` map + the soft-info
      alert + the retention ladder (rebuilds on frequency change via the existing `$` helper + change delegation) +
      the cutoff select (1/2/5y/never, default 5y). Informational; cutoff persistence is an engine/retention concern.
      Added an `IntegrationsSetupWizard` raw-markup-allowlist entry for the cleanup block's daisyUI-direct alert/select.
- Verified (full Change 2): web `astro check` 0 errors (354 files) · web unit 805/805 · governance 12/12 · design 0 errors.
