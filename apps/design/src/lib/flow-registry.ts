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
      'apps/web/src/views/SpaceOverviewView.astro',
      'apps/web/src/components/integrations/SpacePipelineHero.astro',
      'apps/web/src/views/IntegrationsSetupWizard.astro',
    ],
    steps: [
      {
        label: 'Empty Space',
        href: '/integrations?fixture=empty',
        caption: "A brand-new Space — nothing set up yet. Click 'Set up backup' to begin.",
      },
      {
        label: 'Set up (all empty)',
        href: '/integrations/configure?first=1',
        caption:
          'No source or destination on the account yet. Connect a source in the drawer, pick bases, add a destination in its drawer, choose options, then Run — walk it with the wizard step buttons.',
      },
      {
        label: 'First backup running',
        href: '/integrations?status=running',
        caption: 'Saved — the Space is protected and the first backup is running.',
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
        href: '/integrations',
        caption: 'A working Space. Click Configure to change its backup.',
      },
      {
        label: 'Edit tabs',
        href: '/integrations/configure',
        caption:
          'Source / Bases / Destination / Options as free tabs, pre-filled with the current config. Jump in any order, then Save changes — no Review/Run step.',
      },
      {
        label: 'Back on overview',
        href: '/integrations',
        caption: 'Saved — changes apply on the next scheduled run.',
      },
    ],
  },

  // ── Space overview (states) ────────────────────────────────────────────────
  {
    id: 'healthy-overview',
    name: 'Healthy Space overview',
    feature: 'Space overview',
    status: 'built',
    blurb: 'A configured Space as a backup pipeline with a green-check status connector.',
    specs: [
      { change: 'space-setup-wizard', capability: 'integrations', scenario: 'Healthy pipeline' },
      { change: 'nav-ia-restructure', capability: 'navigation', scenario: 'Configured Space overview' },
    ],
    code: ['apps/web/src/views/SpaceOverviewView.astro'],
    steps: [
      {
        label: 'Overview',
        href: '/integrations',
        caption:
          'Source → bases → Destination, joined by a green check: connected and flowing. Schedule plus last / next run.',
      },
    ],
  },
  {
    id: 'paused-overview',
    name: 'Paused Space (broken connection)',
    feature: 'Space overview',
    status: 'built',
    blurb: 'When a Source or Destination loses access, the connector turns amber and the overview links to reconnect.',
    specs: [
      { change: 'space-setup-wizard', capability: 'integrations', scenario: 'Paused pipeline' },
      { change: 'nav-ia-restructure', capability: 'navigation', scenario: 'A source or destination is broken' },
    ],
    code: ['apps/web/src/views/SpaceOverviewView.astro'],
    steps: [
      {
        label: 'Paused overview',
        href: '/integrations?broken=src',
        caption:
          'A "Backups paused" badge + an alert naming the broken Source/Destination with a Reconnect link, and the pipeline connectors turn amber. Try ?broken=dest or ?broken=both.',
      },
    ],
    note: 'Demo via ?broken=src|dest|both on /integrations. The view already renders the paused state from status; the harness just flips the referenced object to lost-access.',
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

  // ── Account registries (availability) ──────────────────────────────────────
  {
    id: 'destination-availability',
    name: 'Destinations: available vs coming soon',
    feature: 'Account registries',
    status: 'built',
    inSwitcher: true,
    blurb: 'The account Destinations registry shows honest connection status plus which providers you can connect now vs coming soon.',
    specs: [
      { change: 'account-destinations', capability: 'destinations', scenario: 'Honest connection status' },
      { change: 'account-destinations', capability: 'destinations', scenario: 'Coming-soon providers visible on the registry' },
      { change: 'account-destinations', capability: 'destinations', scenario: 'Available vs coming-soon in the add flow' },
    ],
    code: [
      'apps/web/src/lib/provider-catalog.ts',
      'apps/web/src/views/DestinationsView.astro',
      'apps/web/src/views/DestinationAddView.astro',
    ],
    steps: [
      {
        label: 'Registry + availability',
        href: '/destinations',
        caption:
          'Connected destinations in the table; below, "What you can connect" lists available providers (Drive, managed R2) and coming-soon ones (Box/Dropbox/OneDrive, S3 Growth+). Try ?fixture=empty.',
      },
      {
        label: 'Add — coming soon disabled',
        href: '/destinations/new',
        caption:
          'The Add picker marks coming-soon / tier-gated providers disabled with a "Coming soon" badge; only available providers are clickable. Try ?avail=all to see them all connectable.',
      },
    ],
    note: 'Availability comes from the shared provider catalog (apps/web/src/lib/provider-catalog.ts); env-gated BYOS providers are coming-soon until their OAuth client id is configured — in the design app all of them, since the cloudflare:workers stub carries no env.',
  },
  {
    id: 'source-availability',
    name: 'Sources: more platforms coming soon',
    feature: 'Account registries',
    status: 'built',
    inSwitcher: true,
    blurb: 'The account Sources registry connects Airtable now and teases the future source Platforms.',
    specs: [
      { change: 'account-sources', capability: 'sources', scenario: 'Coming-soon Platforms on the registry' },
      { change: 'account-sources', capability: 'sources', scenario: 'Coming-soon Platforms in the add flow' },
    ],
    code: [
      'apps/web/src/lib/provider-catalog.ts',
      'apps/web/src/views/SourcesView.astro',
      'apps/web/src/views/SourceAddView.astro',
    ],
    steps: [
      {
        label: 'Sources registry',
        href: '/sources',
        caption:
          'Airtable sources in the table (a connected one + a reconnect); below, "More sources coming soon" teases Notion / HubSpot / Salesforce.',
      },
      {
        label: 'Add — Airtable now',
        href: '/sources/new',
        caption: 'Airtable connects via OAuth or token; the future Platforms appear as disabled "Coming soon" cards.',
      },
    ],
  },

  // ── Dashboard (client direction) ───────────────────────────────────────────
  {
    id: 'configured-dashboard',
    name: 'Configured Overview → dashboard',
    feature: 'Dashboard',
    status: 'discussion',
    blurb:
      'Once a Space has a backup, the Overview becomes a dashboard (last run, metrics, history, alerts) with a "Config Overview" link to the pipeline.',
    specs: [
      { change: 'integrations-redesign', capability: 'integrations', scenario: 'Protected and settled' },
      { change: 'integrations-redesign', capability: 'integrations', scenario: 'Connected but not configured' },
      { change: 'nav-ia-restructure', capability: 'navigation', scenario: 'Configured Space overview' },
    ],
    code: ['apps/web/src/views/SpaceOverviewView.astro'],
    steps: [
      {
        label: 'Dashboard overview',
        href: null,
        caption:
          'Client direction (fellars). Overview becomes dynamic by config status: dashboard once backed up, empty-state diagram before. Overlaps Backups history.',
      },
    ],
    note: 'Client direction. The empty-state diagram stays for the not-set-up state.',
  },
];
