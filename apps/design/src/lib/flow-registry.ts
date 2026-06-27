// ─────────────────────────────────────────────────────────────────────────────
// FLOW REGISTRY — the single front door for handoff.
//
// One canonical list of every flow / state in the product, each row tying four
// layers together so nothing drifts:
//
//   id        → the canonical name used EVERYWHERE (switcher label, spec tag,
//               index row). Same id across layers = the layers line up.
//   status    → build/maturity: 'built' (clickable now) · 'planned' (agreed, not
//               built yet) · 'discussion' (direction set, design still open). The
//               spec is a reference column, not a status — it exists at any status.
//   specs[]   → the OpenSpec WHEN/THEN scenarios this flow realizes (the contract).
//   code[]    → the apps/web files it exercises (the porting targets).
//   steps[]   → ordered states; href is the live harness URL (null = not built).
//   inSwitcher→ curated demo subset shown in the floating ScenarioSwitcher panel.
//               Independent of status: a flow can be built but kept out of the panel.
//
// Why this file exists: states are DATA, not duplicated screens. A new variant is
// a new row here (+ a fixture / query param), never a new page. The /handoff route
// renders this list as a live traceability index.
//
// Consumed by: demo-flows.ts (derives DEMO_FLOWS for the panel) and
// apps/design/src/pages/handoff.astro (renders the index).
// ─────────────────────────────────────────────────────────────────────────────

export type FlowStatus = 'built' | 'planned' | 'discussion';

export interface FlowStepRef {
  /** Short step name, shown in the indicator / index. */
  label: string;
  /** Live harness URL (pathname + query), or null when the step isn't built yet. */
  href: string | null;
  /** Presenter note: what to say / show on that screen. */
  caption: string;
}

export interface SpecRef {
  /** OpenSpec change id, e.g. 'space-setup-wizard'. */
  change: string;
  /** Capability / spec file, e.g. 'integrations'. */
  capability: string;
  /** Exact scenario title from the spec, e.g. 'Empty Space overview'. */
  scenario: string;
}

export interface RegistryFlow {
  /** Canonical id — used as the switcher key, the spec tag, and the index anchor. */
  id: string;
  /** Human name shown in the panel and the index. */
  name: string;
  /** Grouping bucket for the index, e.g. 'Space setup', 'Edge cases'. */
  feature: string;
  status: FlowStatus;
  /** One line shown in the flow list. */
  blurb: string;
  /** The OpenSpec scenarios this flow satisfies (the contract). */
  specs: SpecRef[];
  /** apps/web files this flow exercises — the engineer's porting targets. */
  code: string[];
  steps: FlowStepRef[];
  /** Whether this flow appears in the floating ScenarioSwitcher demo panel. */
  inSwitcher?: boolean;
  /** Open question / decision pending / honest caveat. */
  note?: string;
}

export const FLOW_REGISTRY: RegistryFlow[] = [
  // ── Space setup ───────────────────────────────────────────────────────────
  {
    id: 'empty-state-setup',
    name: 'Empty State',
    feature: 'Space setup',
    status: 'built',
    inSwitcher: true,
    blurb: 'A blank Space to a running backup — every object created inline.',
    specs: [
      { change: 'space-setup-wizard', capability: 'integrations', scenario: 'Empty Space overview' },
      { change: 'space-setup-wizard', capability: 'integrations', scenario: 'Ordered setup' },
      { change: 'space-setup-wizard', capability: 'integrations', scenario: 'No account object yet' },
      { change: 'space-setup-wizard', capability: 'integrations', scenario: 'Created and selected' },
      { change: 'integrations-redesign', capability: 'integrations', scenario: 'First backup running confirmation' },
    ],
    code: [
      'apps/web/src/views/SpaceHomeView.astro',
      'apps/web/src/components/integrations/SpacePipelineHero.astro',
      'apps/web/src/views/IntegrationsSetupWizard.astro',
    ],
    steps: [
      {
        label: 'Empty Space',
        href: '/?fixture=empty',
        caption: "A brand-new Space's Home — nothing set up yet. Click 'Set up backup' to begin.",
      },
      {
        label: 'Set up (all empty)',
        href: '/integrations/configure?first=1',
        caption:
          'No source or destination on the account yet. Connect a source in the drawer, pick bases, add a destination in its drawer, choose options, then Run — walk it with the wizard step buttons.',
      },
      {
        label: 'First backup running',
        href: '/?status=running',
        caption: 'Back on Home — the Space is protected and the first backup is running (no completed history yet).',
      },
    ],
  },
  {
    id: 'edit-config',
    name: 'Edit an existing backup',
    feature: 'Space setup',
    status: 'built',
    blurb: 'Configure a set-up Space as free tabs, saved as a set — no run step.',
    specs: [
      { change: 'space-setup-wizard', capability: 'integrations', scenario: 'Configure opens edit tabs' },
      { change: 'space-setup-wizard', capability: 'integrations', scenario: 'No run step when editing' },
      { change: 'integrations-redesign', capability: 'integrations', scenario: 'Returning user edits a setting' },
    ],
    code: ['apps/web/src/views/IntegrationsSetupWizard.astro'],
    steps: [
      {
        label: 'Configured Space',
        href: '/',
        caption: 'A working Space Home. Click Configure on the pipeline to change its backup.',
      },
      {
        label: 'Edit tabs',
        href: '/integrations/configure',
        caption:
          'Source / Bases / Destination / Options as free tabs, pre-filled with the current config. Jump in any order, then Save changes — no Review/Run step.',
      },
      {
        label: 'Back on Home',
        href: '/?status=saved',
        caption: 'Saved — a confirmation banner shows on Home; changes apply on the next scheduled run.',
      },
    ],
  },

  // ── Space Home (states) ────────────────────────────────────────────────────
  {
    id: 'healthy-overview',
    name: 'Healthy Space Home',
    feature: 'Space Home',
    status: 'built',
    blurb: 'A configured Space Home: status header, KPIs, the backup pipeline as a status section, and recent history.',
    specs: [
      { change: 'space-setup-wizard', capability: 'integrations', scenario: 'Healthy pipeline' },
      { change: 'nav-ia-restructure', capability: 'navigation', scenario: 'Configured Space overview' },
    ],
    code: ['apps/web/src/views/SpaceHomeView.astro'],
    steps: [
      {
        label: 'Home',
        href: '/',
        caption:
          '"Everything\'s backed up" status header (last / next run), KPIs, and the pipeline Source → bases → Destination joined by a green check: connected and flowing.',
      },
    ],
  },
  {
    id: 'paused-overview',
    name: 'Paused Space (broken connection)',
    feature: 'Space Home',
    status: 'built',
    blurb: 'When a Source or Destination loses access, the status header turns amber and Home links to reconnect.',
    specs: [
      { change: 'space-setup-wizard', capability: 'integrations', scenario: 'Paused pipeline' },
      { change: 'nav-ia-restructure', capability: 'navigation', scenario: 'A source or destination is broken' },
    ],
    code: ['apps/web/src/views/SpaceHomeView.astro'],
    steps: [
      {
        label: 'Paused Home',
        href: '/?broken=src',
        caption:
          'The status header flips to "Backups paused", naming the broken Source/Destination with a Reconnect button, and the pipeline connectors turn amber. Try ?broken=dest or ?broken=both.',
      },
    ],
    note: 'Demo via ?broken=src|dest|both on Home (`/`). The view renders the paused state from status; the harness just flips the referenced object to lost-access.',
  },

  // ── Edge cases (agreed with client, not built) ─────────────────────────────
  {
    id: 'reconnect-inline',
    name: 'Reconnect mid-setup',
    feature: 'Edge cases',
    status: 'built',
    blurb: 'A Source/Destination that lost access reconnects in place, without leaving the wizard.',
    specs: [
      { change: 'space-setup-wizard', capability: 'integrations', scenario: 'Reconnect a broken object in place' },
      { change: 'account-destinations', capability: 'destinations', scenario: 'Reconnect a broken destination' },
      { change: 'integrations-redesign', capability: 'integrations', scenario: 'Configuration unavailable on a broken connection' },
    ],
    code: ['apps/web/src/views/IntegrationsSetupWizard.astro'],
    steps: [
      {
        label: 'Broken object selected',
        href: '/integrations/configure?broken=src',
        caption:
          'Configure opens with the selected source in a lost-access state — an amber "Lost access" chip plus a Reconnect button. Save is blocked with a reconnect hint.',
      },
      {
        label: 'Reconnect in the drawer',
        href: '/integrations/configure?broken=src',
        caption:
          'Reconnect opens a drawer that reauthorizes in place (OAuth popup, or a re-entered token / connection string). On success the chip flips to Connected and Save unblocks — no kick-out.',
      },
    ],
    note: 'Demo with ?broken=src (source), ?broken=dest (file destination), ?broken=db (database), or ?broken=both. Reconnect is simulated client-side; the real app uses an OAuth popup or a re-entered secret.',
  },
  {
    id: 'source-change-resets-bases',
    name: 'Source change resets bases',
    feature: 'Edge cases',
    status: 'built',
    blurb: 'Bases belong to a Source; switching it clears the selection after a heads-up.',
    specs: [
      { change: 'space-setup-wizard', capability: 'integrations', scenario: 'Switching the Source clears the base selection' },
      { change: 'account-sources', capability: 'sources', scenario: 'Choose the source for a Space' },
      { change: 'integrations-redesign', capability: 'integrations', scenario: 'Bases listed with comparison cues' },
    ],
    code: ['apps/web/src/views/IntegrationsSetupWizard.astro', 'apps/web/src/components/integrations/BaseSelectionTable.astro'],
    steps: [
      {
        label: 'Switch source → heads-up',
        href: '/integrations/configure',
        caption:
          'On the Source tab, switch to another source while bases are selected — a heads-up confirms before clearing them ("bases belong to a source").',
      },
      {
        label: 'Cleared for the new source',
        href: '/integrations/configure',
        caption:
          'Switch & clear empties the selection (the table count resets too) and the Bases step notes the new source. Keep current reverts with the bases intact.',
      },
    ],
    note: 'The wizard demo runs all-connected by default so switching is clean. Harness bases are source-agnostic, so the base *list* does not change — only the *selection* resets (the real engine swaps in the new source\'s bases).',
  },
  {
    id: 'base-cap-upgrade',
    name: 'Plan base cap + new bases',
    feature: 'Edge cases',
    status: 'built',
    blurb: 'Block selecting beyond the plan limit with an upgrade nudge; notify on new Airtable bases (opt-in auto-add).',
    specs: [
      { change: 'space-setup-wizard', capability: 'integrations', scenario: 'New bases are notified' },
      { change: 'integrations-redesign', capability: 'integrations', scenario: 'Tier limit visible' },
      { change: 'integrations-redesign', capability: 'integrations', scenario: 'Selecting beyond the tier limit' },
      { change: 'integrations-redesign', capability: 'integrations', scenario: 'New bases discovered' },
      { change: 'integrations-redesign', capability: 'integrations', scenario: 'Select all up to the plan limit' },
      { change: 'integrations-redesign', capability: 'integrations', scenario: 'Auto-add future bases' },
    ],
    code: ['apps/web/src/components/integrations/BaseSelectionTable.astro'],
    steps: [
      {
        label: 'Cap blocks selection',
        href: '/integrations/configure',
        caption: 'On the Bases tab, Select all stops at the plan cap (10 of 50) with an upgrade nudge; manual checks past the cap are blocked.',
      },
      {
        label: 'New bases notified',
        href: '/integrations/configure?newbases=3',
        caption:
          'Bases that appeared in Airtable since the last backup are tagged "New" with a banner: Review (filter to them) or Add (up to the cap). At the cap, Add is disabled and the upgrade nudge shows. The opt-in "auto-add future bases" toggle stays for the all-selected case.',
      },
    ],
    note: 'Decision (client confirmed): notify by default, opt-in auto-add. Demo new bases via ?newbases=N. isNew on BaseSummary = bases discovered since the last backup (derivable from the known base-id list).',
  },

  // ── Space Home (confirmations) ─────────────────────────────────────────────
  {
    id: 'configured-dashboard',
    name: 'First-backup & saved confirmations',
    feature: 'Space Home',
    status: 'built',
    blurb:
      'Home is the dashboard (it absorbed the old Overview): right after setup it shows the first backup running; after an edit it shows a saved banner.',
    specs: [
      { change: 'integrations-redesign', capability: 'integrations', scenario: 'Protected and settled' },
      { change: 'integrations-redesign', capability: 'integrations', scenario: 'First backup running confirmation' },
      { change: 'nav-ia-restructure', capability: 'navigation', scenario: 'Configured Space overview' },
    ],
    code: ['apps/web/src/views/SpaceHomeView.astro'],
    steps: [
      {
        label: 'First backup running',
        href: '/?status=running',
        caption:
          'Just after setup: status header reads "First backup running…", a confirmation banner links to the Backups page, history shows the in-progress placeholder, and counts read "—" until the run finishes.',
      },
      {
        label: 'Edit saved',
        href: '/?status=saved',
        caption: 'After saving an edit on a running Space: a "Backup configuration saved" banner; changes apply on the next scheduled run.',
      },
    ],
    note: 'Home replaced the standalone Overview page — the pipeline is a status section on Home, deep config lives in the focused /integrations/configure flow.',
  },

  // ── Backups (audit trail: list → run → base → tables) ──────────────────────
  {
    id: 'backups-list',
    name: 'Backup history list',
    feature: 'Backups',
    status: 'built',
    blurb: 'Every backup run as an auditable table; the whole row drills into the run.',
    specs: [
      { change: 'backups-redesign', capability: 'backups', scenario: 'A completed run row' },
      { change: 'backups-redesign', capability: 'backups', scenario: 'The whole row drills in' },
      { change: 'backups-redesign', capability: 'backups', scenario: 'No runs yet' },
      { change: 'backups-redesign', capability: 'backups', scenario: 'Run one now' },
    ],
    code: ['apps/web/src/views/BackupsListView.astro'],
    steps: [
      {
        label: 'Run history',
        href: '/backups',
        caption: 'One row per run — status · when · trigger · bases · records · attachments · duration · Details. The whole row drills in (running → running detail, failed → failed detail).',
      },
      {
        label: 'No runs yet',
        href: '/backups?fixture=empty',
        caption: 'Empty state: runs land here with full audit detail, plus a way to run the first one.',
      },
    ],
  },
  {
    id: 'backups-run-detail',
    name: 'Backup run detail (succeeded / running / failed)',
    feature: 'Backups',
    status: 'built',
    blurb: 'One run on its own page — status, captured layers, destination, and a per-base breakdown — across all three run states.',
    specs: [
      { change: 'backups-redesign', capability: 'backups', scenario: 'A succeeded run' },
      { change: 'backups-redesign', capability: 'backups', scenario: 'A running run shows progress, not final numbers' },
      { change: 'backups-redesign', capability: 'backups', scenario: 'A failed run explains itself' },
      { change: 'backups-redesign', capability: 'backups', scenario: 'Which layers were captured' },
      { change: 'backups-redesign', capability: 'backups', scenario: 'The destination is shown as where the data actually landed' },
    ],
    code: ['apps/web/src/views/BackupRunDetailView.astro'],
    steps: [
      {
        label: 'Succeeded run',
        href: '/backups/run?state=done',
        caption: 'Totals (bases · tables · records · attachments), Schema/Data/Attachments depth chips, the destination, and a per-base table. Breadcrumb + back to Backups. Try ?dest=drive|s3|db.',
      },
      {
        label: 'Running run',
        href: '/backups/run?state=running',
        caption: 'Estimated time remaining; bases in flight show captured-so-far vs total, not-yet-started bases marked pending.',
      },
      {
        label: 'Failed run',
        href: '/backups/run?state=failed',
        caption: 'Stopped, which base failed and the error; bases that completed before the failure still show their counts.',
      },
    ],
  },
  {
    id: 'backups-base-detail',
    name: 'Base-in-run detail (tables)',
    feature: 'Backups',
    status: 'built',
    blurb: 'The leaf of the audit trail — one base of one run drilled to its tables, each with Fields · Records · Views · Attachments.',
    specs: [
      { change: 'backups-redesign', capability: 'backups', scenario: 'A backed-up base' },
      { change: 'backups-redesign', capability: 'backups', scenario: 'A base still being captured' },
      { change: 'backups-redesign', capability: 'backups', scenario: 'A base that failed' },
      { change: 'backups-redesign', capability: 'backups', scenario: 'Distinct from the schema view' },
      { change: 'backups-redesign', capability: 'backups', scenario: 'Drilling preserves the run state' },
    ],
    code: ['apps/web/src/views/BackupRunBaseView.astro'],
    steps: [
      {
        label: 'Backed-up base',
        href: '/backups/run/base?base=b-sales',
        caption: "The base's tables with field / record / view / attachment counts, status, timing, the destination folder, and Open in Airtable. Breadcrumb Backups / Backup run / base.",
      },
      {
        label: 'Base still capturing',
        href: '/backups/run/base?base=b-eng&state=running',
        caption: 'The table being written shows records & attachments captured-so-far vs total; tables not yet started are pending.',
      },
      {
        label: 'Failed base',
        href: '/backups/run/base?state=failed',
        caption: 'Nothing written, tables failed / pending, and the error explaining why. This reflects the run, not the run-agnostic /schema.',
      },
    ],
  },
  {
    id: 'backups-failed-attachments',
    name: 'Failed-attachments review',
    feature: 'Backups',
    status: 'built',
    blurb: 'Attachments that could not be backed up are flagged and reviewable in a slide-over (run-level and base-level) without failing the whole run.',
    specs: [
      { change: 'backups-redesign', capability: 'backups', scenario: 'Failed attachments are reviewable' },
      { change: 'backups-redesign', capability: 'backups', scenario: 'Base-level failed attachments' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'Retry re-fetches only the failed files into the same run' },
    ],
    code: ['apps/web/src/views/BackupRunDetailView.astro', 'apps/web/src/views/BackupRunBaseView.astro'],
    steps: [
      {
        label: 'Flagged on the run',
        href: '/backups/run?state=done',
        caption: 'A banner reports the count ("N attachments couldn\'t be backed up; the rest completed") with Review, opening a slide-over of each failed file · base · table · reason.',
      },
      {
        label: 'Reviewed per base',
        href: '/backups/run/base?base=b-eng',
        caption: 'The affected tables show a "N failed" chip; the base\'s failed attachments open in a slide-over scoped to that base.',
      },
    ],
    note: 'The slide-over\'s "Retry failed" semantics are now specced in backup-operations: a small in-place re-fetch of ONLY the failed files, reported within the same run (not a new run). UI button is built; the outcome wiring is the to-do.',
  },

  // ── Backups — operations: actions · run-now · restore (+ attachments) · cleanup (backup-operations) ─
  {
    id: 'backups-actions',
    name: 'Run actions: Pause / Restart, Cancel',
    feature: 'Backups',
    status: 'built',
    blurb: 'A run is an immutable log. The ONLY actions are Pause/Restart and Cancel while it is in flight — no Delete, no Run-again. Backed-up data is never deleted here; only the cleanup schedule removes data.',
    specs: [
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'A running run offers Pause and Cancel' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'Pausing holds the run and resumes where it stopped' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'Cancelling keeps the partial backup already written' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'A settled run has no destructive history actions' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'A paused or cancelled run is shown as such in the list and detail' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'Run control is gated by role' },
    ],
    code: ['apps/web/src/views/BackupRunDetailView.astro', 'apps/web/src/views/BackupRunBaseView.astro'],
    steps: [
      {
        label: 'Running run → Pause / Cancel (each confirms)',
        href: '/backups/run?state=running',
        caption: 'While a run is in flight the header shows Pause and Cancel run (a quieter destructive). Both open a confirm dialog first — Cancel: "partial kept, can\'t be resumed"; Pause: "you can resume anytime" (Resume on a paused run is a direct action, no confirm). A finished/failed/cancelled run is a read-only log — no actions in its header.',
      },
      {
        label: 'Paused / Cancelled in the audit trail',
        href: '/backups/run?state=paused',
        caption: 'Pausing and cancelling add two run statuses to the audit trail — neutral "paused" (amber, with a Resume action) and "cancelled" (grey), shown in the list and run-detail with the counts captured before stopping, distinct from red "failed". Demo: run `?state=paused` / `?state=cancelled`; the list shows both badges (a paused + a cancelled run are in the fixture).',
      },
      {
        label: 'Behaviours — confirmed 2026-06-20',
        href: null,
        caption: 'Locked with the client: Cancel KEEPS the partial backup (status "cancelled", always confirms first); Pause/Restart RESUMES from where it stopped (not from scratch). Retry failed = an in-place re-fetch of only the failed files, in the same run. Role: viewers read-only (assumption, not raised). Remaining = engine wiring of the real Pause/Cancel/Resume endpoints.',
      },
    ],
    note: 'Client Q4 (2026-06-19): only Pause/Restart + Cancel on a run; NO Delete (a run is just a log of what happened); NO Run-again at the history level. Data is only ever removed by the cleanup schedule (see cleanup-schedule). BUILT: the header buttons (Pause/Cancel while running, Resume/Cancel while paused, Restore only when succeeded) + the paused/cancelled audit statuses in the list & run-detail. CONFIRMED with the client 2026-06-20: Cancel KEEPS the partial backup (status `cancelled`); Restart RESUMES from where it stopped. Both were genuinely new (no On2Air in-flight run control to copy) and are now locked. Engine wiring of the real Pause/Cancel/Resume endpoints is the remaining to-do.',
  },
  {
    id: 'run-backup-now',
    name: 'Run Backup Now (on-demand + credits confirm)',
    feature: 'Backups',
    status: 'built',
    blurb: 'A top-level "Run Backup Now" fires an immediate backup instead of waiting for the next scheduled run — it first warns that additional credits will be used and asks the user to confirm.',
    specs: [
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'Run Backup Now is a top-level action' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'Running off-schedule warns about credits and requires confirmation' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'Cancelling the confirmation starts nothing' },
    ],
    code: ['apps/web/src/components/backups/RunBackupNowModal.astro', 'apps/web/src/views/SpaceHomeView.astro', 'apps/web/src/views/BackupsListView.astro'],
    steps: [
      {
        label: 'Run Backup Now → credits confirm',
        href: '/backups',
        caption: 'Click "Run backup now" (Backups header / empty state, or the Space Home rail). It opens a credits-warning confirm modal — "Off-schedule runs use additional credits" — with Cancel / Run anyway. Only "Run anyway" kicks off the run (Space flips to "first/next backup running"). On-demand runs are top-level only — there is no per-history "run again".',
      },
    ],
    note: 'Client Q4 (2026-06-19). BUILT: components/backups/RunBackupNowModal.astro (catalog Modal + soft-warning Alert + md buttons), wired on Home rail + Backups header + empty state. Off-schedule on-demand runs cost extra credits, hence the explicit acknowledgement. CREDITS (client 2026-06-20): the model will be per-task & volume-based (~100 credits / 1000 records) but is NOT finalised — the founder confirmed this warning is SUFFICIENT FOR NOW, so no balance / out-of-credits UI is built yet (Usage stays a placeholder until the model lands). On2Air had no credits (it was plan-based), so this is net-new Baseout.',
  },
  {
    id: 'backups-running-refresh',
    name: 'Live run refresh',
    feature: 'Backups',
    status: 'built',
    blurb: 'An in-progress run is a load-time snapshot; a manual Refresh + "updated Ns ago" keeps it honest, transitioning to done/failed when it finishes.',
    specs: [],
    code: ['apps/web/src/components/backups/LiveRefresh.astro', 'apps/web/src/views/BackupRunDetailView.astro', 'apps/web/src/views/BackupsListView.astro'],
    steps: [
      {
        label: 'Manual refresh + freshness',
        href: '/backups/run?state=running',
        caption: 'A running run-detail header shows a Refresh control + an "updated Ns ago" stamp that ticks up. On the Backups list the same control appears in the panel header only when a run is live (running/queued). On refresh a finished run flips to done/failed.',
      },
    ],
    note: 'BUILT 2026-06-22 as the reusable components/backups/LiveRefresh.astro. Decision (chosen): manual Refresh + freshness stamp, NOT auto-poll — the old auto-polling history widget lagged and was removed. Prototype reloads the page; the real app re-fetches the runs query.',
  },
  {
    id: 'backups-list-scale',
    name: 'List at scale: filter / search / paginate',
    feature: 'Backups',
    status: 'built',
    blurb: 'The run list filters by status / trigger / date, searches by Run ID or error, and paginates — demoable over ~50 runs.',
    specs: [
      { change: 'backups-redesign', capability: 'backups', scenario: 'The list scales to filter, search, and paginate' },
    ],
    code: ['apps/web/src/views/BackupsListView.astro'],
    steps: [
      {
        label: 'Filter / search / paginate',
        href: '/backups',
        caption: 'Search by Run ID or error (support-ticket triage), filter by status / trigger / date, and page through with a rows-per-page (10/20/50) control. A "no runs match" state is distinct from the no-runs-at-all empty state. Base filter is deliberately omitted — includedBases is the current config, not a per-run snapshot. Filtering is client-side in the prototype; the real app pushes it to the runs query (?status=&trigger=&since=&q=&page=).',
      },
    ],
    note: 'Built 2026-06-17. Fixture expanded to ~50 runs (FIXTURE_BACKUP_RUNS) so search/filter/pagination are demoable.',
  },
  {
    id: 'backups-stale-deeplink',
    name: 'Stale deep-link / not-found',
    feature: 'Backups',
    status: 'built',
    blurb: 'A deep link to a deleted or missing run (from an email or a support link) shows a clear scoped not-found, not a broken page.',
    specs: [],
    code: ['apps/web/src/views/BackupRunDetailView.astro', 'apps/web/src/views/BackupRunBaseView.astro'],
    steps: [
      {
        label: 'Run no longer exists',
        href: '/backups/run?state=notfound',
        caption: 'Entry from "your backup failed" emails or support links can land on a run that was deleted or whose base was removed from the Space. Shows a scoped not-found — "This backup run no longer exists" + why (no per-run delete; the cleanup schedule or a removed base) + Back to Backups. Built on run-detail (notFound prop); the base-detail mirror is a quick follow-up.',
      },
    ],
    note: 'BUILT 2026-06-22 on BackupRunDetailView (notFound prop → scoped not-found state; harness ?state=notfound). The per-base mirror (BackupRunBaseView) is the remaining small piece.',
  },
  {
    id: 'restore-from-backup',
    name: 'Restore from a backup (base → tables → new tables)',
    feature: 'Backups',
    status: 'built',
    blurb: 'Rare, last-resort, best-effort. Base-by-base: pick a base, pick which tables to restore (all by default), then restore — ALWAYS into NEW tables, never overwriting the original, in an existing base or a brand-new base.',
    specs: [
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'Restore is reached from a succeeded run or base' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'Choose one base, then its tables' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'Choose the target — an existing base or a new base' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'Restore always creates new tables, never overwriting' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'Restore is best-effort and says so' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'After restore, the outcome reports what to finish manually' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'Choose how attachments are restored' },
    ],
    code: ['apps/web/src/views/RestoreView.astro', 'apps/web/src/views/BackupRunDetailView.astro', 'apps/web/src/views/BackupRunBaseView.astro'],
    steps: [
      {
        label: 'Restore entry point',
        href: '/backups/run?state=done',
        caption: 'A "Restore" action on the run detail (succeeded runs) and on the base detail. Restore is a secondary affordance — the product\'s primary value is the external backup + documentation + insights, not restore. Failed runs don\'t offer it.',
      },
      {
        label: 'Base → tables → attachments → target',
        href: '/restore',
        caption: 'The restore flow: (1) choose ONE base from the backup; (2) choose its tables — all selected by default, with Select all / a red Clear; (3) choose how attachments come back — as files or as links (see the restore-attachments card); (4) choose the target — into an EXISTING base (a select) or a NEW base (a name). A persistent best-effort alert sets expectations up top.',
      },
      {
        label: 'Restore outcome',
        href: '/restore?done=1',
        caption: 'The result screen after a restore completes — the honest part. Headline stats (tables recreated · records restored · needs-attention) + a table of what could NOT be rebuilt automatically: Formula fields (rebuild by hand — the API can\'t create them), fields restored as plain text (convert back to their type), and linked-record relationships (re-link), with a button to open the restored base. A clean restore shows an all-good state instead.',
      },
    ],
    note: 'Client Q3 (2026-06-19) + On2Air docs (2026-06-19). BUILT: views/RestoreView.astro (form + outcome states) + the /restore route + entry points on the run/base detail. Always creates new tables (never overwrites) — matches Airtable\'s own restore, which always makes a NEW base. Best-effort limits are concrete (from On2Air): Formula fields are NOT recreatable via the API (manual rebuild); some fields come back as text to convert; linked records drop. Restore-OUTCOME screen now BUILT (demo `/restore?done=1`). On2Air restored at base level; our per-table selection is a Baseout refinement. Client Q6 (2026-06-20) CONFIRMED the flow and added an **Attachments option** (now BUILT as restore Step 3): restore attachments AS ATTACHMENTS (re-upload into Airtable) or AS LINKS (links to the files in the backup destination), default as attachments; the choice carries into the outcome (an Attachments stat showing count + mode).',
  },
  {
    id: 'restore-attachments',
    name: 'Restore: attachments as files or as links',
    feature: 'Backups',
    status: 'built',
    blurb: 'Part of the restore flow (client Q6, 2026-06-20): the user chooses how attachments come back — re-uploaded as real files into Airtable, or as links to the copies kept in the backup destination.',
    specs: [
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'Choose how attachments are restored' },
    ],
    code: ['apps/web/src/views/RestoreView.astro'],
    steps: [
      {
        label: 'Pick the attachments mode',
        href: '/restore',
        caption: 'Restore Step 3 (two radio cards on the catalog .rs-target pattern): "Restore as attachments" — re-upload the files into the new Airtable tables — or "Restore as links" — the field holds links to the files kept in your backup destination, nothing re-uploaded. Default: as attachments.',
      },
      {
        label: 'Reflected in the outcome',
        href: '/restore?done=1&att=links',
        caption: 'The choice carries into the restore outcome: an "Attachments" stat shows how many landed and in which mode ("as attachments" / "as links"). Compare `/restore?done=1` (default) with `?att=links`.',
      },
    ],
    note: 'Client Q6 (2026-06-20). BUILT in views/RestoreView.astro (Step 3 + the outcome stat). Both modes are real engine choices — the files already live in the backup destination, so "as attachments" re-uploads them into Airtable and "as links" points the field at the destination copy (no fabricated data). This is a sub-step of restore-from-backup, surfaced as its own card for quick reference.',
  },
  {
    id: 'cleanup-schedule',
    name: 'Cleanup schedule (tiered retention)',
    feature: 'Backups',
    status: 'built',
    blurb: 'The ONLY thing that deletes backed-up data. A rolling, tiered retention (GFS-style) that progressively thins older backup versions to cap storage — keyed to the backup frequency, with a configurable cutoff (5 years default).',
    specs: [
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'Retention is configured in the Space\'s backup options' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'The retention ladder is keyed to the backup frequency' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'Older versions are thinned, then removed past the cutoff' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'The cutoff is configurable with a sensible default' },
      { change: 'backup-operations', capability: 'backup-operations', scenario: 'No other action deletes backed-up data' },
    ],
    code: ['apps/web/src/views/IntegrationsSetupWizard.astro'],
    steps: [
      {
        label: 'Cleanup schedule in Options',
        href: '/integrations/configure',
        caption: 'On the Options tab, below the backup Schedule: a soft-info alert explains the thinning, then a retention ladder that updates with the chosen frequency, plus a "remove anything older than" cutoff (1 / 2 / 5 years / never).',
      },
      {
        label: 'The retention tiers',
        href: null,
        caption: 'The ladder downsamples as backups age, keyed to frequency. Monthly: monthly versions kept. Weekly: 3 months of weekly → then monthly. Daily: 30 days of daily → 2 months of weekly → then monthly. Instant/Continuous: 3 days of continuous → 27 days of daily → 2 months of weekly → then monthly. Then anything older than the cutoff is removed (default 5 years).',
      },
    ],
    note: 'From On2Air docs (verified 2026-06-19): the tier numbers match On2Air EXACTLY (Continuous 3d→27d daily→2mo weekly→monthly; Daily 30d→2mo weekly→monthly; Weekly 3mo→monthly; cutoff 5y). Attachments are incremental (all on first backup, new-only after). BUILT in the wizard Options (CLEANUP_TIERS map + a JS ladder that rebuilds on frequency change). DELTA vs On2Air: there the tiers + cutoff read as FIXED system behaviour; we expose the cutoff as a knob (1/2/5y/never) — CONFIRMED by the client 2026-06-20: keep it as built (tiers fixed, cutoff configurable). Cleanup is the only mechanism that removes backed-up data (no per-run Delete).',
  },
  {
    id: 'backups-failure-notification',
    name: 'Failure alert + post-run audit',
    feature: 'Backups',
    status: 'discussion',
    blurb: 'When a scheduled run fails (or attachments drop), the user is told — an alert, not just a row buried in history — and each run gets a health check. The deep-link / not-found stories already assume these "your backup failed" notices exist.',
    specs: [],
    code: [],
    steps: [
      {
        label: 'Notify on failure (not built)',
        href: null,
        caption: 'A scheduled run that fails (connection lost, permission revoked, attachments dropped) should reach the user proactively — email and/or in-app — with what failed and a path to reconnect/retry. Today a failure is only visible if you open Backups.',
      },
      {
        label: 'Per-run audit / health check (not built)',
        href: null,
        caption: 'On2Air ran a Backup Audit after each run — verifying the Airtable connection, the storage connection, and the per-base / table / attachment status — with a monthly summary and an on-demand check. This is the seed of the Health Score / insights the founder named as core value.',
      },
    ],
    note: 'Grounded in On2Air precedent (verified 2026-06-19): On2Air SENT failure emails (connection / permission issues) and ran a post-backup audit (monthly + manual). This is a genuinely missing Baseout story — it overlaps the Notifications + Health Score differentiators (still placeholders). Scoped as its own future change, not part of backup-operations; up for discussion on shape (channels, what an audit checks, anomaly thresholds).',
  },

  // ── Schema ─────────────────────────────────────────────────────────────────
  // Spec: overview/schema/{04-browse,01-visualize,02-changelog,03-health,05-docs}-tab.md
  // + research.html (Visualize) + research-browse-docs.html (Browse + Docs).
  // Tab order: Browse · Visualize · Changelog · Health · Docs (Browse is the landing).
  // No OpenSpec change yet (specs[] empty) — the .md briefs are the contract.
  {
    id: 'schema-browse',
    name: 'Browse — explorer + detail panel',
    feature: 'Schema',
    status: 'built',
    inSwitcher: true,
    blurb: "The list/explorer counterpart to Visualize and the Schema landing: find and inspect any base / table / field via a Tree or Flat index + one global search, then open a shared stacking detail panel that drills base → table → field without losing place.",
    specs: [],
    code: ['apps/web/src/components/schema/SchemaBrowse.astro', 'apps/web/src/components/schema/EntityPanel.astro', 'apps/web/src/components/schema/EntitySearch.astro', 'apps/web/src/components/schema/schemaEntities.ts', 'apps/web/src/components/schema/FacetFilter.astro'],
    steps: [
      { label: 'Tree explorer', href: '/schema', caption: 'As a power user who knows roughly what I want, I should not have to pan a diagram. Browse is the landing tab: a collapsible Base ▸ Table ▸ Field tree, each row = the vendored Airtable field-type icon · name · type · a health dot · a linked-record badge. Clicking a row opens its detail panel; the twist toggles children.' },
      { label: 'Flat index', href: '/schema', caption: 'Toggle to a dense, sortable table of every entity (Name / Type / Parent / Linked / Health), default sorted worst-health-first (trust-signals-first). Click a header to re-sort, including Ordinal/source order. The dbt Project/Database toggle, proven.' },
      { label: 'Search + faceted filters', href: '/schema', caption: 'One global search filters the Tree/Flat in place (and offers a grouped jump-to typeahead). The same FacetFilter pattern as everywhere else: Bases / Type / Field types / Health, plus Undocumented and Linked-only checkboxes, a "Showing N of M" count and a Clear so a filtered list never reads as missing data. Staleness stamp: "Schema as of {last backup}".' },
      { label: 'Stacking detail panel', href: '/schema', caption: 'Selecting any entity slides in a right panel; clicking a child or linked entity pushes a new sheet with a breadcrumb trail (back / a crumb / Esc pops). Sections: Context+type, Descriptions (a two-source sync flow — Airtable · Internal — with an AI Generate action and a Draft → Publish → Synced lifecycle; see schema-descriptions), Children, Relationships, and Documentation (the docs that tag it). Shared with Docs.' },
      { label: 'Empty — never backed up', href: '/schema?fixture=empty', caption: 'Before a first backup there is no schema to read → an empty state explaining entities appear once a backup completes.' },
    ],
    note: 'BUILT 2026-06-24 from overview/schema/04-browse-tab.md + research-browse-docs.html. The detail panel + entity typeahead are SHARED components (also used by Docs). Strictly inside the Airtable metadata boundary: record counts read "as of last backup", no value-statistics section, Workspace is a placeholder. The all-fields tree density + the dot-only health vocabulary are OUR calls (research §12 open decisions, founder unconfirmed).',
  },
  {
    id: 'schema-descriptions',
    name: 'Browse — description sync (Airtable · Internal)',
    feature: 'Schema',
    status: 'built',
    blurb: "The Descriptions block inside the entity detail panel: two source tabs (Airtable — public, the only one that syncs back · Internal — Baseout-only), AI demoted from a stored tab to a Generate action, and a safe edit → Draft → Publish (confirm + stale-warning) → Synced lifecycle. Faked client-side (no backend in ui-only).",
    specs: [],
    code: ['apps/web/src/components/schema/EntityPanel.astro', 'apps/web/src/components/schema/SchemaBrowse.astro', 'apps/web/src/components/schema/schemaEntities.ts', 'apps/web/src/components/schema/SchemaCanvas.tsx', 'apps/design/src/pages/schema.astro'],
    steps: [
      { label: 'Two source tabs + identity', href: '/schema', caption: 'Open any table / field detail panel → the Descriptions block has two tabs, each labelled with its role. Airtable carries a "Public · shown to everyone in Airtable · the only synced copy" meta line; Internal carries "Internal · visible only in Baseout · never synced". Founder model, Dan 2026-06-26 (closes report item A5).' },
      { label: 'Airtable — empty → Generate / Write', href: '/schema', caption: 'When the Airtable description is blank: a primary "Generate with AI · 10 credits" (cost shown on the button, not hidden) seeds a draft from the schema, or "Write manually" opens the editor. Dan: "if the Airtable description is blank, auto fill using the AI version." Demo: open Contacts ▸ Job Title.' },
      { label: 'Editing — AI is an action, not a tab', href: '/schema', caption: 'The editor is an inline textarea: Save / Cancel, Cmd-Ctrl+Enter to save, Esc to cancel, and (Airtable only) Regenerate · 10 credits. AI belongs to the public Airtable copy — the Internal note has no Generate, so AI off the same schema cannot duplicate it. Navigating or closing mid-edit autosaves the text as a Draft instead of losing it.' },
      { label: 'Draft — out of sync (+ list pip)', href: '/schema', caption: 'Editing the Airtable copy flags it out of sync: a "Draft" badge on the section heading, an inline "Not yet published to Airtable" status, and Publish / Edit / Discard changes. The same Draft pip shows on the entity\'s row in any field list, so unpublished edits are visible without opening the field. Demo: open Deals ▸ Stage (seeded out-of-sync).' },
      { label: 'Publish — confirm + stale + Synced', href: '/schema', caption: 'Publish is a guarded destructive write-back: a confirm card ("Publish replaces the entire description in Airtable") with an amber "Airtable changed since the last backup — publishing overwrites it" stale warning when the live value drifted, then Publishing… → Published ✓ → Synced (green check, Edit only). Dan: "override the entire airtable description"; once published it is "in sync, no longer has the label or publish button."' },
      { label: 'Internal — Baseout-only note', href: '/schema', caption: 'The Internal tab holds a technical description visible only in Baseout, never pushed to Airtable. Write / Edit only — no Publish, no sync state, no AI. Dan: "for more administrative description… only visible to people who have access to Baseout."' },
    ],
    note: "BUILT 2026-06-26 from Dan's description-feedback screenshot (closes report item A5), then fully hardened the same day with the P1+P2+P3 set from the /impeccable critique: autosave-on-navigate, the Draft pip in the panel child rows AND the Browse Tree/Flat lists (live via a schema:descChanged event), the Publish confirm + stale-warning + Publishing…/Published states, the Internal rename + Airtable Public identity line, the visible credit cost, aria-live announcements + focus restore, and Cmd+Enter. Visualize already opened this same shared panel on node-click, so it was aligned for free (its old inline description UI was retired dead code, now deleted). Write-back is FAKED client-side (a descStates overlay; airtableDraft + airtableExternallyChanged fixture fields seed the demo on Deals ▸ Stage). The real Airtable meta-API write-back is the monorepo target. Only backend-dependent items remain — see schema-descriptions-planned.",
  },
  {
    id: 'schema-visualize',
    name: 'Visualize — ER diagram',
    feature: 'Schema',
    status: 'built',
    inSwitcher: true,
    blurb: "Read-only ER canvas of the Space's Airtable structure: tables as nodes, linked-record fields as edges, dagre auto-layout. Click a node → the SAME shared detail panel Browse uses (one vocabulary), with the full field list + the description sync flow.",
    specs: [],
    code: ['apps/web/src/views/SchemaView.astro', 'apps/web/src/components/schema/SchemaCanvas.tsx', 'apps/web/src/components/schema/airtableFieldIcons.ts'],
    steps: [
      { label: 'ER canvas', href: '/schema', caption: 'As a power user who lives in Airtable, I want my whole structure on one canvas — how many tables, how they link, which look unhealthy — without clicking base by base. Tables = nodes (health dot · name · record/field count + the relationship-bearing field rows), links = edges, auto-arranged (dagre LR), with pan / zoom / minimap.' },
      { label: 'Node → shared detail panel', href: '/schema', caption: 'Click any node → the SAME stacking EntityPanel that Browse / Docs / Changelog open (schema:openEntity), with the full field list, descriptions (the Airtable/Internal sync flow), relationships, and changelog. One detail surface everywhere — no separate Visualize-only panel. Each field shows its REAL Airtable field-type icon (the vendored 31-icon set).' },
      { label: 'Focus relationships', href: '/schema', caption: 'Click a table → the tables it links to light up (primary, animated edges) and everything unrelated dims, so I read exactly what THIS table connects to — essential once there are more than a handful of tables.' },
      { label: 'Find a table', href: '/schema', caption: 'A search box (top-left) finds a table by name and centres + selects it — fast navigation in a large schema (Enter jumps to the first match).' },
      { label: 'Base filter (multi-base)', href: '/schema?bases=multi', caption: 'On a Space that backs up several bases, a header base-filter scopes the canvas to one base and its ER diagram (the diagram is per-base; Airtable links never cross bases). Single-base Spaces hide it.' },
      { label: 'AI description · ready (Pro+)', href: '/schema', caption: 'In the shared panel, Generate with AI (Pro+, 10 credits, cost shown on the button) seeds a blank Airtable description; it then follows the Draft → Publish lifecycle. AI generation lives on the public Airtable copy only (see schema-descriptions).' },
      { label: 'AI · below Pro+ (locked)', href: '/schema?ai=locked', caption: 'Below Pro+, Generate is a locked upsell (lock + Pro+) that routes to billing, not a dead control — shown in the shared panel opened from a node.' },
      { label: 'AI · out of credits', href: '/schema?ai=no-credits', caption: 'Pro+ but out of credits → the Generate affordance reflects it instead of failing silently (handled in the shared panel).' },
    ],
    note: 'Node-clicks open the SHARED EntityPanel (schema:openEntity), so Visualize, Browse, Docs and Changelog all use one detail surface — descriptions, AI Generate and the Draft/Publish lifecycle live there (see schema-descriptions). The old Visualize-only inline description panel was retired dead code and was DELETED 2026-06-26. The real vendored Airtable field-icon set, focus-mode + search-jump, and the multi-base filter were BUILT 2026-06-23. Only tier-gated Export remains — see schema-visualize-planned.',
  },
  {
    id: 'schema-changelog',
    name: 'Changelog — change feed',
    feature: 'Schema',
    status: 'built',
    blurb: 'A day-grouped vertical timeline of schema changes (added / removed / renamed / type-changed / view), diffed from backup snapshots. Base name = heading, change type = one badge, ⚠ when a change may have broken data.',
    specs: [],
    code: ['apps/web/src/components/schema/SchemaChangelog.astro', 'apps/web/src/components/schema/FacetFilter.astro'],
    steps: [
      { label: 'Change feed', href: '/schema', caption: 'As a user, I want a trustworthy audit trail of how my Airtable structure evolved (a field renamed last Tuesday, a new table on the 20th) — the thing Airtable itself does not surface. Open the Changelog tab: a timeline rail, day groups, each entry = base heading · location (table) · type badge · time · the engine pre-rendered summary (with before→after) · ⚠ soft-warning chip when data may be invalid.' },
      { label: 'Faceted filters', href: '/schema', caption: 'Show/hide the feed by Base / Table (grouped by base) / Field type via faceted dropdowns (the Visualize Display pattern: toggle rows + Show all / Hide all + count badge), with Change type and Time as plain selects and a Needs-attention toggle that isolates the ⚠ changes. Clear resets everything.' },
      { label: 'Entry detail panel', href: '/schema', caption: 'Click any entry → a right-side detail panel with its full context: location breadcrumb (base ▸ table ▸ field), change type, full timestamp, the summary, before → after values, and the warning. Esc or the scrim closes it.' },
      { label: 'Empty', href: '/schema?fixture=empty', caption: 'Before two backups exist there is nothing to diff → an empty state explaining changes appear once there are two backups to compare.' },
    ],
    note: 'Spec wants TWO distinct empty states (only-one-backup vs backed-up-no-changes) — currently one; needs a backup-count flag from the engine (planned — see schema-changelog-planned).',
  },
  {
    id: 'schema-health',
    name: 'Health — per-base grades',
    feature: 'Schema',
    status: 'built',
    inSwitcher: true,
    blurb: "Per-base 0–100 composite grade + Green/Yellow/Red band, the category breakdown, and the issue punch-list ('where's the rot'). Hybrid base nav: tabs for a few bases, a two-pane console for many.",
    specs: [],
    code: ['apps/web/src/components/schema/SchemaHealth.astro'],
    steps: [
      { label: 'Tabs (≤6 bases)', href: '/schema', caption: 'As a power user, I want to know where the rot is and act on it. Open the Health tab: each base is a tab (score · band); selecting one shows its score ring, category bars, freshness stamp, and the issues grouped by severity (Needs attention / Worth a look / Minor) with Open in Airtable to fix where it lives.' },
      { label: 'Two-pane console (>6 bases)', href: '/schema?bases=many', caption: 'With many bases the nav becomes a console: a searchable, sortable (worst-first) base list on the left; the selected base report on the right, updating in place. Scales to 20+.' },
      { label: 'How this is scored', href: '/schema', caption: 'A Health-level How-this-is-scored modal explains the default rules (the 3 rule areas) + band thresholds, so the score is not a black box.' },
      { label: 'Configure rules (Pro+)', href: '/settings/billing', caption: 'Configure rules (Pro+) — Space/Org-level, in the Health header — currently routes to billing; the real rule-config screen is planned (see schema-rule-config).' },
    ],
  },
  {
    id: 'schema-docs',
    name: 'Docs — schema documentation',
    feature: 'Schema',
    status: 'built',
    blurb: 'Author long-form documentation ABOUT the schema (distinct from the per-entity descriptions on Browse). Two-pane master-detail (like the Health console): a persistent documents list on the left, the selected document on the right — a rich editor with inline @-entity tags, a tags + links panel, and saved React-Flow mini-diagrams, plus a clean reading mode. Tagging is bidirectional.',
    specs: [],
    code: ['apps/web/src/components/schema/SchemaDocs.astro', 'apps/web/src/components/schema/EntityPanel.astro', 'apps/web/src/components/schema/EntitySearch.astro', 'apps/web/src/components/schema/SchemaCanvas.tsx'],
    steps: [
      { label: 'Documents list (master pane)', href: '/schema', caption: 'Two-pane master-detail, like the Health console: a persistent LEFT list of every document for the Space (title · last edited · tag count · excerpt) with search + New, and the selected document on the RIGHT (the first is auto-selected). The list stays put while you read/edit — no full-screen swap. Empty state: "No documents yet."' },
      { label: 'Document editor (detail pane)', href: '/schema', caption: 'Selecting a document loads it on the right: a rich-text editor (headings, paragraphs, lists) with a Tagged-entities + Links rail (beside the editor on wide screens, below it on narrower). As a user I want to write up how a part of the schema works, referencing the real tables and fields, and have those references stay live and clickable.' },
      { label: 'Inline @-tagging', href: '/schema', caption: 'Typing @ opens the shared entity typeahead (grouped Bases / Tables / Fields with parent paths). Selecting inserts a tag chip — the entity identity, not a text snapshot. Chips are clickable (open the shared detail panel) and a removed entity flips to a "no longer in schema" state. The tag also appears in the rail and reverse-lists on Browse.' },
      { label: 'Links + mini-diagram', href: '/schema', caption: 'Named external links live in the rail. A document can embed one or more saved mini ER-diagrams — the real React Flow engine, scoped to a few tables, read-only and pannable, with "Open in Visualize" to expand. The Fibery/dbt "diagram-in-a-doc" pattern, reusing the Visualize island (not a mock).' },
      { label: 'Reading mode', href: '/schema', caption: 'The Edit/Read toggle switches to a clean reading view: editing chrome hidden, tags clickable → the entity panel, links + diagrams rendered read-only. The "click any reference to see its details" loop.' },
      { label: 'Empty — never backed up', href: '/schema?fixture=empty', caption: 'With no schema yet, Docs explains documents appear once there is a schema to document.' },
    ],
    note: "BUILT 2026-06-24 from overview/schema/05-docs-tab.md + research-browse-docs.html. The production editor target is Plate (platejs.org) for the custom inline entity-tag node; this mirror ships a dependency-free contenteditable editor shell with the same UX (the @ flow, real chips, tags panel, links, embedded React Flow diagram) — CONFIRMED by the user 2026-06-24 to NOT add Plate here. Swap the editor core for Plate in the monorepo. Diagram edit depth (view-only vs inline-editable) is research §12 open decision #4.",
  },
  {
    id: 'schema-empty',
    name: 'Schema — never backed up',
    feature: 'Schema',
    status: 'built',
    blurb: 'The Schema page only has data after the first backup. Before that, each tab shows a clear "appears after your first backup" empty state.',
    specs: [],
    code: ['apps/web/src/views/SchemaView.astro'],
    steps: [
      { label: 'Never backed up', href: '/schema?fixture=empty', caption: 'As a brand-new user opening Schema before any backup, I see an honest empty state (Schema appears after your first backup) instead of a broken / blank canvas.' },
    ],
  },
  // ── Schema · planned edge-cases (tracked, not built) ──
  {
    id: 'schema-visualize-planned',
    name: 'Visualize — Export (planned)',
    feature: 'Schema',
    status: 'planned',
    blurb: 'The one Visualize spec item still unbuilt: tier-gated Export.',
    specs: [],
    code: ['apps/web/src/views/SchemaView.astro'],
    steps: [
      { label: 'Real Export (not built)', href: null, caption: 'Export is tier-gated PNG (Growth) / SVG (Pro) / PDF (Business) / embed (Enterprise), rendered client-side from the graph. Today the menu shows tier badges only. DEFERRED by decision 2026-06-23: a real raster / PDF render needs new frontend deps (html-to-image for PNG/SVG, jspdf for PDF) not yet in apps/web — a prod-dependency call left to the owner.' },
    ],
    note: 'Field-icons, base-filter, and focus-mode + search-jump were all BUILT 2026-06-23 (see schema-visualize). Export alone remains, blocked only on the html-to-image / jspdf dependency decision.',
  },
  {
    id: 'schema-changelog-planned',
    name: 'Changelog — planned edge-cases',
    feature: 'Schema',
    status: 'planned',
    blurb: 'Spec states / links not yet built on the feed.',
    specs: [],
    code: ['apps/web/src/components/schema/SchemaChangelog.astro'],
    steps: [
      { label: 'Two distinct empty states (not built)', href: null, caption: 'Spec: differentiate only-one-backup-so-far (nothing to compare yet) from backups-exist-no-changes-since. Same screen, different copy, chosen by a backup-count flag from the engine.' },
      { label: 'Base sub-grouping for high volume (not built)', href: null, caption: 'High-volume Spaces: consider a secondary grouping by base within a day so the feed stays scannable.' },
      { label: 'Link ⚠ → Health (V2)', href: null, caption: 'A broken-data ⚠ change is the same problem Health grades — link the entry to the relevant Health issue. Spec marks this V2.' },
    ],
  },
  {
    id: 'schema-descriptions-planned',
    name: 'Browse — description sync: remaining work',
    feature: 'Schema',
    status: 'planned',
    blurb: 'After the 2026-06-26 build the critique\'s P1+P2+P3 set is fully shipped (see schema-descriptions). What remains needs a backend / host capability we do not have in ui-only, plus the V2 Dan deferred.',
    specs: [],
    code: ['apps/web/src/components/schema/EntityPanel.astro', 'apps/web/src/components/schema/SchemaBrowse.astro'],
    steps: [
      { label: 'Space-level "N unpublished" + bulk Publish', href: null, caption: 'The per-row Draft pip now shows unpublished edits across the Browse Tree / Flat lists (and the panel child rows). Still to do: a Space-level roll-up — "N unpublished changes" with a single bulk Publish — so you can push a batch at once. Needs a real aggregation + write API.' },
      { label: 'Roles: hide write actions for viewers (edge)', href: null, caption: 'Edit / Generate / Publish / Discard assume an editor. A read-only role should see the descriptions but not the write affordances (hidden, or disabled-with-reason), not fail after the click. Needs a capability flag from the host.' },
      { label: 'Base-level bulk auto-update (deferred V2)', href: null, caption: 'Dan: "in future versions we may add more functionality like at the base level to auto-update all field descriptions… but lets leave that for now." Tracked as V2; outside the approved set.' },
    ],
    note: 'Source: the 2026-06-26 /impeccable critique (Design Health 23/40). FULLY SHIPPED the same day in schema-descriptions: autosave-on-navigate, the Draft pip in field lists AND the Browse page Tree/Flat (live via schema:descChanged), Publish confirm + stale-warning + Publishing…/Published, the Internal rename + Airtable Public identity line, visible credit cost, the P3 copy/layout polish, Cmd+Enter, and aria-live announcements + focus restore. The critique\'s "align the Visualize side panel" item was a FALSE POSITIVE — Visualize node-clicks already open the shared EntityPanel; the inline description UI was retired dead code, now deleted. What remains needs a backend: the Space-level bulk roll-up, viewer-role gating, and the V2 base-level bulk.',
  },
  {
    id: 'schema-rule-config',
    name: 'Health — Configure rules (Pro+)',
    feature: 'Schema',
    status: 'planned',
    blurb: 'The Pro+ rule-configuration screen behind the Health Configure-rules button: define what counts as an issue + severity thresholds (Org-level).',
    specs: [],
    code: [],
    steps: [
      { label: 'Rule-config UI (not built)', href: null, caption: 'As a Pro+ admin, I want to tune the health rules: toggle which checks count, set severity thresholds, and see the engine default rules read-only when nothing is configured. Below Pro+, the same defaults show read-only with an upgrade affordance. Today the button routes to a billing placeholder.' },
    ],
    note: 'Spec: overview/schema/03-health-tab.md §Rule configuration. Gating: Pro+. The default rules are partially surfaced today via the How-this-is-scored modal.',
  },

  // ── Notifications ──────────────────────────────────────────────────────────
  {
    id: 'connection-health-banner',
    name: 'Connection-health banner',
    feature: 'Notifications',
    status: 'built',
    blurb:
      "An app-wide warning when a source (Airtable) or destination (Drive, etc.) connection breaks, so a silently-failing backup can't go unnoticed, plus a one-click reconnect. A graded state (auth validity + backup staleness) drives the colour; the full-width bar sits under the topbar, and a broken bar collapses into a persistent pill by the notification bell. Playground — click through every state — at /connection-banner (open it with “Open flow →”).",
    specs: [],
    code: [
      'apps/web/src/components/layout/ConnectionHealthBanner.astro',
      'apps/web/src/components/layout/ConnectionHealthPill.astro',
      'apps/web/src/components/layout/connection-health-banner.ts',
      'apps/web/src/layouts/SidebarLayout.astro',
      'apps/web/src/components/layout/Header.astro',
    ],
    steps: [
      {
        label: 'Broken — source (Airtable)',
        href: '/connection-banner',
        caption:
          'As someone whose backups silently stopped the moment Airtable revoked our token, I want an unmissable bar the instant it breaks — not a failed row buried in history — so I find out before I need a restore, and can fix it in one click.',
      },
      {
        label: 'Broken — destination (Drive)',
        href: '/connection-banner?state=broken-dest',
        caption:
          'As an admin whose Google Drive access was pulled, I want the warning to name the destination (and tell me the source is fine) so I reconnect the right side instead of guessing.',
      },
      {
        label: 'Multiple broken — grouped',
        href: '/connection-banner?state=multiple',
        caption:
          'As an org with several connections, when 2+ break at once I want one grouped roll-up — not a stack of bars — so the shell stays calm and I can review them together.',
      },
      {
        label: 'Expiring soon (proactive)',
        href: '/connection-banner?state=expiring',
        caption:
          'As a user whose token will expire in a few days, I want a calm amber heads-up before it dies so I reconnect with zero interruption. Conditional on the provider API exposing a TTL — see note.',
      },
      {
        label: 'Degraded (staleness)',
        href: '/connection-banner?state=degraded',
        caption:
          'As a user, when no backup has succeeded in 24h but it is not yet a hard auth failure, I want a quiet "we are auto-retrying" heads-up — warned before total silence, without crying wolf on a transient blip.',
      },
      {
        label: 'Reconnecting (verifying)',
        href: '/connection-banner?state=reconnecting',
        caption:
          'As a user who just clicked Reconnect, I want to watch verification happen (Authorization ✓ · Read access ✓) rather than stare at silence, so I trust it actually worked.',
      },
      {
        label: 'Restored (+ missed run re-queued)',
        href: '/connection-banner?state=restored',
        caption:
          'As a user who fixed it, I want confirmation that backups resumed AND that the run we missed was re-queued, so I am not left wondering about the gap.',
      },
      {
        label: 'Collapsed → topbar pill',
        href: '/connection-banner?state=broken-dest',
        caption:
          'As a user who has already seen the warning, I want to tuck the bar into a small pill by the bell (collapse, not dismiss) so it stays a persistent reminder while I keep working — one click on the pill brings the full bar back. Click the chevron on the bar to try it.',
      },
      {
        label: 'Healthy — no banner',
        href: '/connection-banner?state=healthy',
        caption:
          'As a user with everything working, I want no banner at all — a clean shell — so that when one does appear, it actually means something.',
      },
    ],
    note: 'BUILT 2026-06-26 (feat/notifications) from the connection-health research (research/connection-health/index.html) — recommended model: graded health + banner-led surfacing + Plaid-style one-click reconnect + verify + re-queue the missed backup. Documented in the Storybook (/styleguide → Connection-health banner). Placement: top of the work area via an app-banner slot in SidebarLayout (NOT above the sidebar); a broken bar collapses to a topbar-status pill in Header by the bell. STILL PRESENTATIONAL — driven by props/fixtures on /connection-banner, not yet wired to the real connection state ($integrations: active/refreshing/pending_reauth/invalid). "Expires in N days" ships only if the Airtable/Drive token APIs expose a TTL (research §8.2, unverified). No OpenSpec change yet — the research doc is the contract.',
  },
];
