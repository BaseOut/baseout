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
      'apps/web/src/components/patterns/SpacePipelineHero.astro',
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
    code: ['apps/web/src/views/IntegrationsSetupWizard.astro', 'apps/web/src/components/patterns/BaseSelectionTable.astro'],
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
    code: ['apps/web/src/components/patterns/BaseSelectionTable.astro'],
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
    note: 'The slide-over\'s "Retry failed" button is present but its outcome is undefined — see backups-actions.',
  },

  // ── Backups — gaps from the /my-edge analysis (decisions captured, not built) ─
  {
    id: 'backups-actions',
    name: 'Run actions: Pause / Restart, Cancel',
    feature: 'Backups',
    status: 'planned',
    blurb: 'A run is an immutable log. The ONLY actions are Pause/Restart and Cancel while it is in flight — no Delete, no Run-again. Backed-up data is never deleted here; only the cleanup schedule removes data.',
    specs: [],
    code: ['apps/web/src/views/BackupRunDetailView.astro', 'apps/web/src/views/BackupRunBaseView.astro'],
    steps: [
      {
        label: 'Running run → Pause / Cancel',
        href: '/backups/run?state=running',
        caption: 'While a run is in flight the header shows Pause (pause/restart the in-flight run) and Cancel run (a quieter destructive). A finished or failed run is a read-only log — no actions in its header.',
      },
      {
        label: 'Define the two behaviours',
        href: null,
        caption: 'Decisions to lock before building: Cancel — keep the partial backup written so far, or discard it (Cancel always confirms first). Pause/Restart — pause the in-flight run and resume from where it stopped vs restart from scratch. Retry failed (the failed-attachments slide-over) — a small in-place re-fetch of only the failed files, shown in the same run. Gate by role (viewer = read-only).',
      },
    ],
    note: 'Client Q4 (2026-06-19): only Pause/Restart + Cancel on a run; NO Delete (a run is just a log of what happened); NO Run-again at the history level. Data is only ever removed by the cleanup schedule (see cleanup-schedule). The header buttons are already built per this; the partial-keep-vs-discard + pause-resume semantics are the open spec.',
  },
  {
    id: 'run-backup-now',
    name: 'Run Backup Now (on-demand + credits confirm)',
    feature: 'Backups',
    status: 'built',
    blurb: 'A top-level "Run Backup Now" fires an immediate backup instead of waiting for the next scheduled run — it first warns that additional credits will be used and asks the user to confirm.',
    specs: [],
    code: ['apps/web/src/components/backups/RunBackupNowModal.astro', 'apps/web/src/views/SpaceHomeView.astro', 'apps/web/src/views/BackupsListView.astro'],
    steps: [
      {
        label: 'Run Backup Now → credits confirm',
        href: '/backups',
        caption: 'Click "Run backup now" (Backups header / empty state, or the Space Home rail). It opens a credits-warning confirm modal — "Off-schedule runs use additional credits" — with Cancel / Run anyway. Only "Run anyway" kicks off the run (Space flips to "first/next backup running"). On-demand runs are top-level only — there is no per-history "run again".',
      },
    ],
    note: 'Client Q4 (2026-06-19). BUILT: components/backups/RunBackupNowModal.astro (catalog Modal + soft-warning Alert + md buttons), wired on Home rail + Backups header + empty state. Off-schedule on-demand runs cost extra credits, hence the explicit acknowledgement.',
  },
  {
    id: 'backups-running-refresh',
    name: 'Live run refresh',
    feature: 'Backups',
    status: 'planned',
    blurb: 'An in-progress run is a load-time snapshot; it needs a manual Refresh + "updated Ns ago", transitioning to done/failed when it finishes.',
    specs: [],
    code: ['apps/web/src/views/BackupRunDetailView.astro', 'apps/web/src/views/BackupsListView.astro'],
    steps: [
      {
        label: 'Manual refresh + freshness',
        href: null,
        caption: 'Decision (chosen): a Refresh control + an "updated Ns ago" stamp, NOT auto-poll — the old auto-polling history widget lagged and was removed. On the next refresh a finished run flips to done/failed.',
      },
    ],
    note: 'From /my-edge: addresses staleness on both the list row and the run detail.',
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
    status: 'planned',
    blurb: 'A deep link to a deleted or missing run / base (from an email or a support link) needs a clear not-found state, not a broken page.',
    specs: [],
    code: ['apps/web/src/views/BackupRunDetailView.astro', 'apps/web/src/views/BackupRunBaseView.astro'],
    steps: [
      {
        label: 'Run / base no longer exists',
        href: null,
        caption: 'Entry from "your backup failed" emails or support links can land on a run/base that was deleted or a base removed from the Space. Show a scoped not-found ("this run was deleted") with a path back to Backups.',
      },
    ],
  },
  {
    id: 'restore-from-backup',
    name: 'Restore from a backup (base → tables → new tables)',
    feature: 'Backups',
    status: 'built',
    blurb: 'Rare, last-resort, best-effort. Base-by-base: pick a base, pick which tables to restore (all by default), then restore — ALWAYS into NEW tables, never overwriting the original, in an existing base or a brand-new base.',
    specs: [],
    code: ['apps/web/src/views/RestoreView.astro', 'apps/web/src/views/BackupRunDetailView.astro', 'apps/web/src/views/BackupRunBaseView.astro'],
    steps: [
      {
        label: 'Restore entry point',
        href: '/backups/run?state=done',
        caption: 'A "Restore" action on the run detail (succeeded runs) and on the base detail. Restore is a secondary affordance — the product\'s primary value is the external backup + documentation + insights, not restore. Failed runs don\'t offer it.',
      },
      {
        label: 'Base → tables → target',
        href: '/restore',
        caption: 'The restore flow: (1) choose ONE base from the backup; (2) choose its tables — all selected by default, with Select all / a red Clear; (3) choose the target — into an EXISTING base (a select) or a NEW base (a name). A persistent best-effort alert sets expectations up top.',
      },
    ],
    note: 'Client Q3 (2026-06-19). BUILT: views/RestoreView.astro + the /restore route + entry points on the run/base detail. Always creates new tables (never overwrites). Records recreate well; structure rebuild is partial (Airtable API limit) → best-effort + guidance. Restore is a very rare, last-resort need, not the headline.',
  },
  {
    id: 'cleanup-schedule',
    name: 'Cleanup schedule (tiered retention)',
    feature: 'Backups',
    status: 'built',
    blurb: 'The ONLY thing that deletes backed-up data. A rolling, tiered retention (GFS-style) that progressively thins older backup versions to cap storage — keyed to the backup frequency, with a configurable cutoff (5 years default).',
    specs: [],
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
    note: 'From On2Air docs (client link, 2026-06-19): on2air.com/.../incremental-backups-schedule-and-cleanup-schedule. BUILT in the wizard Options step (CLEANUP_TIERS map + a JS ladder that rebuilds on frequency change). Cleanup keeps storage bounded; it is the only mechanism that removes backed-up data (no per-run Delete).',
  },
];
