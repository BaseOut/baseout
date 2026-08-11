## Why

The `web-backups-redesign` change covers reading backups — the auditable drill-down (list → run → base → tables, done / running / failed, reviewable failed attachments). It deliberately stopped at the audit trail. But the product also has to *act on* backups, and those actions were built into the UI (run-actions header, Run Backup Now modal, the Restore flow, the cleanup schedule in the wizard Options) **without a spec behind them** — the handoff registry rows pointed at `specs: []`. The engineer porting Restore or the retention schedule had a blurb, not a contract.

This change writes that missing contract. It captures the founder's confirmed model (Slack Q3/Q4, 2026-06-17/19, plus the On2Air cleanup docs): a run is an immutable log; the only in-flight controls are Pause/Restart and Cancel; on-demand runs cost extra credits and must be confirmed; restore is rare, last-resort, base-by-base, always into new tables; and a tiered cleanup schedule is the only thing that ever removes backed-up data. It also fills three states that had no story at all: the `paused` / `cancelled` run statuses, the restore outcome report, and role-gated run control.

## What Changes

- **A backup run is an immutable log.** No Delete, no Run-again at the history level. The only controls are **Pause/Restart** and **Cancel**, and only while a run is in flight. This adds two run statuses the audit trail did not have — `paused` and `cancelled` — shown in the list and detail with whatever counts were captured before stopping.
- **On-demand runs are gated by a credits acknowledgement.** A top-level "Run backup now" (Space Home rail, Backups header / empty state — never per history row) warns that off-schedule runs use additional credits and requires explicit confirmation before starting.
- **Failed attachments retry in place** — a small re-fetch of only the failed files into the same run, not a new run.
- **Restore is specified end to end**: reached from a succeeded run/base only; pick one base → its tables (all by default) → an existing or new base; **always new tables, never overwriting**; best-effort with a persistent expectation-setting notice; and a new **outcome report** of what was recreated versus what to finish manually.
- **A cleanup schedule** (GFS-style tiered retention, keyed to frequency, configurable cutoff defaulting to 5 years) is documented as the **only** mechanism that removes backed-up data.

## Capabilities

### New Capabilities
- `backup-operations`: acting on backups — on-demand runs (with the credits confirmation), in-flight run control (Pause/Restart, Cancel; immutable-log lifecycle), failed-attachment retry, restore (base → tables → new tables, best-effort, with an outcome report), and the tiered cleanup/retention schedule. The read/audit side stays in `backups` (`web-backups-redesign`); this is the write/lifecycle side.

## Impact

- apps/web (already built, this change is the spec catching up to it): `components/backups/RunBackupNowModal.astro` (credits confirm), `views/RestoreView.astro` (+ the `/restore` route and entry points on `BackupRunDetailView` / `BackupRunBaseView`), the cleanup-schedule block in `views/IntegrationsSetupWizard.astro` Options, and the Pause/Cancel header on `BackupRunDetailView`.
- Not yet built (this change defines them): the `paused` / `cancelled` run statuses in `BackupsListView` / `BackupRunDetailView`; the restore **outcome** screen; role-gating; and the still-open action semantics (Cancel keep-vs-discard, Pause resume-vs-restart) which the client must lock — see `design.md`.
- Handoff: `flow-registry.ts` rows `backups-actions`, `run-backup-now`, `restore-from-backup`, `cleanup-schedule` get their `specs[]` filled against this change; new rows added for the paused/cancelled states, the restore outcome, and failure notification.
- Ports to `apps/web` (real product code) via the normal PR flow once the open semantics are confirmed.
