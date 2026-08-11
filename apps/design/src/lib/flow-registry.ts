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
    id: 'first-setup-full-access',
    name: 'First setup · full access',
    feature: 'Space setup',
    status: 'built',
    inSwitcher: true,
    blurb: 'Zero to a running backup, step by step — the reference journey when Airtable gives us everything.',
    specs: [
      { change: 'space-setup-wizard', capability: 'integrations', scenario: 'Empty Space overview' },
      { change: 'space-setup-wizard', capability: 'integrations', scenario: 'Ordered setup' },
      { change: 'base-picker-workspace-grouping', capability: 'base-picker-workspace-grouping', scenario: 'Full access shows real workspace names' },
      { change: 'workspace-auto-enroll', capability: 'workspace-auto-enroll', scenario: 'Enroll one of three workspaces' },
      { change: 'integrations-redesign', capability: 'integrations', scenario: 'First backup running confirmation' },
    ],
    code: [
      'apps/web/src/views/SpaceHomeView.astro',
      'apps/web/src/views/IntegrationsSetupWizard.astro',
      'apps/web/src/components/integrations/BaseSelectionTable.astro',
    ],
    steps: [
      {
        label: '1 · Nothing here yet',
        href: '/?fixture=empty&scenario=reset',
        caption: 'A brand-new Space. No source, no bases, no history — one way forward: Set up backup.',
      },
      {
        label: '2 · Connect Airtable',
        href: '/integrations/configure?first=1&step=source',
        caption: 'Step one of the wizard. The account has no source yet, so the panel opens on its empty state and the connect drawer is the only move. Everything after this depends on it, which is why the stepper gates the later steps.',
      },
      {
        label: '3 · Bases — list first, workspaces still arriving',
        href: '/integrations/configure?first=1&step=bases&wsresolve=resolving',
        caption: 'The moment that shapes this whole screen. The base list is ONE call, so it is here immediately and fully usable — search it, tick bases, move on. Workspaces need one call PER BASE, so they arrive behind a quiet counter in the toolbar. Watch it climb for ~15s and select while it runs: nothing is disabled and nothing moves.',
      },
      {
        label: '4 · Workspaces matched — an offer',
        href: '/integrations/configure?first=1&step=bases&wsresolve=offered',
        caption: 'The counter becomes "Workspaces matched · Group by workspace". It is an OFFER, not an action: the table has not regrouped, because rearranging rows under someone mid-selection is the thing this design exists to prevent. Ignore it and the flat table is still a complete answer.',
      },
      {
        label: '5 · Grouped, with auto-add',
        href: '/integrations/configure?first=1&step=bases&wsresolve=grouped',
        caption: 'Accepted. Real Airtable workspace names, per-group select-all, and the Auto-add column with its master toggle — decide once per workspace what happens to bases created later. The toolbar line goes silent; the user pressed the control a second ago and does not need it narrated.',
      },
      {
        label: '6 · Branch — the lookup fails',
        href: '/integrations/configure?first=1&step=bases&wsresolve=failed',
        caption: 'Not every run succeeds. "Couldn\'t match · Retry" — a fact about the connection, not the user\'s mistake, and deliberately not in a warning colour. The table stays flat and fully usable, because failing to group has no bearing on choosing bases. This branch rejoins the flow at step 7.',
      },
      {
        label: '7 · Destination',
        href: '/integrations/configure?first=1&step=dest',
        caption: 'Where the backups land. Same empty-state shape as the source step: nothing on the account yet, so the drawer is the way in.',
      },
      {
        label: '8 · Options',
        href: '/integrations/configure?first=1&step=options',
        caption: 'Cadence and scope. Defaults are chosen so this step can be passed through without a decision — power stays available, but is not demanded of someone who has been here two minutes.',
      },
      {
        label: '9 · Review and run',
        href: '/integrations/configure?first=1&step=review',
        caption: 'Everything just decided, in one list, before anything runs. The final CTA is "Run first backup" — the one moment in the wizard where the button is the point.',
      },
      {
        label: '10 · Protected, first backup running',
        href: '/?status=running',
        caption: 'Home again, now with a pipeline. The first run is in flight and there is no completed history yet — the state a real user lands in seconds after finishing.',
      },
    ],
    note:
      'This is the journey to walk first; the other two first-setup flows change only what happens at the Bases step. `?step=` moves the wizard\'s stepper rather than bypassing it, so every gate behaves as if you had clicked through.',
  },
  {
    id: 'first-setup-limited-access',
    name: 'First setup · limited access',
    feature: 'Space setup',
    status: 'built',
    inSwitcher: true,
    blurb: 'The same journey when the user shared only specific bases — Airtable withholds workspace NAMES but still returns their IDs.',
    specs: [
      { change: 'base-picker-workspace-grouping', capability: 'base-picker-workspace-grouping', scenario: 'Limited access shows generic workspace names' },
      { change: 'base-picker-workspace-grouping', capability: 'base-picker-workspace-grouping', scenario: 'Renaming a placeholder workspace' },
      { change: 'workspace-auto-enroll', capability: 'workspace-auto-enroll', scenario: 'Enroll one of three workspaces' },
    ],
    code: [
      'apps/web/src/components/integrations/BaseSelectionTable.astro',
      'apps/web/src/stores/connections.ts',
    ],
    steps: [
      {
        label: '1 · Nothing here yet',
        href: '/?fixture=empty&wsnames=none',
        caption: 'Identical start. Nothing about the empty Space hints at which access scope the user is about to grant.',
      },
      {
        label: '2 · Connect Airtable',
        href: '/integrations/configure?first=1&step=source&wsnames=none',
        caption: 'The fork happens inside Airtable\'s own consent screen, not ours: the user shares specific bases rather than the whole environment. We find out afterwards, by what comes back.',
      },
      {
        label: '3 · Bases — same wait, same freedom',
        href: '/integrations/configure?first=1&step=bases&wsnames=none&wsresolve=resolving',
        caption: 'Indistinguishable from full access at this point, and that is correct — the base list is complete either way. Limited access costs names, not bases.',
      },
      {
        label: '4 · Grouped, but nameless',
        href: '/integrations/configure?first=1&step=bases&wsnames=none&wsresolve=grouped',
        caption: 'The IDs came back, so the grouping is real — only the labels are missing. Groups read "Workspace 1 · name unavailable", and the explanation lives in the header itself with the full sentence in its tooltip. There is no warning band above the table: an explanation belongs beside the thing it explains, not stacked over everything.',
      },
      {
        label: '5 · Name them yourself',
        href: '/integrations/configure?first=1&step=bases&wsnames=none&wsresolve=grouped',
        caption: 'Same screen, now use it: the pencil on a group header renames it in place. The name is stored against the workspace ID, so it survives a reconnect. The route to real names — reconnect with full access — sits on the auto-enroll rule, the capability that limited access actually blocks.',
      },
      {
        label: '6 · After reconnecting with full access',
        href: '/integrations/configure?first=1&step=bases&wsresolve=grouped&wsalias=arrived',
        caption: 'NOTE — access has CHANGED by this step: the user reconnected with full access, so this screen deliberately shows real workspace names, not placeholders. That is the point of the step. Airtable\'s own name has landed for every workspace at once (access is all-or-nothing), and for the one the user had named by hand it now takes over — but not silently: one reversible prompt names both and offers "Keep mine". A label typed only because the field was blank is a workaround, not an opinion, so it yields; but it is never destroyed without a word.',
      },
      {
        label: '7 · Review and run',
        href: '/integrations/configure?first=1&step=review&wsnames=none',
        caption: 'From here the journey is identical to full access. Limited access changed how bases were LABELLED, never which ones could be protected.',
      },
      {
        label: '8 · Protected, first backup running',
        href: '/?status=running&wsnames=none',
        caption: 'Same destination. Worth noticing: nothing downstream of the picker knows or cares which access scope this connection had.',
      },
    ],
    note:
      'Access is ALL-OR-NOTHING per connection (founder, 2026-07-28): either every workspace shows its real name or none does, so there is no mixed screen here. The "Still matching" bucket in the picker is about TIME, not permissions — a different fact with a different label.',
  },
  {
    id: 'first-setup-small-account',
    name: 'First setup · small account',
    feature: 'Space setup',
    status: 'built',
    inSwitcher: true,
    blurb: 'One workspace, a handful of bases — the most common case, where none of the workspace machinery ever appears.',
    specs: [
      { change: 'base-picker-workspace-grouping', capability: 'base-picker-workspace-grouping', scenario: 'Single workspace stays flat' },
      { change: 'space-setup-wizard', capability: 'integrations', scenario: 'Ordered setup' },
    ],
    code: [
      'apps/web/src/components/integrations/BaseSelectionTable.astro',
    ],
    steps: [
      {
        label: '1 · Nothing here yet',
        href: '/?fixture=empty&ws=single',
        caption: 'Same empty Space.',
      },
      {
        label: '2 · Connect Airtable',
        href: '/integrations/configure?first=1&step=source&ws=single',
        caption: 'Same connect step.',
      },
      {
        label: '3 · Bases — and that is all',
        href: '/integrations/configure?first=1&step=bases&ws=single&wsresolve=offered',
        caption: 'Everything lives in one workspace, so grouping would add a header and nothing else. No offer is made, no counter appears, no line exists in the toolbar at all — one group is not grouping. This is the point of the whole design: the machinery is invisible to the people who do not need it.',
      },
      {
        label: '4 · Review and run',
        href: '/integrations/configure?first=1&step=review&ws=single',
        caption: 'Straight through. For this user the picker was simply a list of bases with checkboxes, which is exactly what it should have been.',
      },
      {
        label: '5 · Protected, first backup running',
        href: '/?status=running&ws=single',
        caption: 'Done. Compare the number of decisions this user made with the full-access flow — same product, proportional demands.',
      },
    ],
    note:
      'Walk this one LAST. Read against the other two it shows the restraint the design is aiming for: the workspace features exist for large estates and cost nothing to everyone else.',
  },
  {
    id: 'workspace-grouped-picker',
    name: 'Bases picker — every state',
    feature: 'Space setup',
    status: 'built',
    blurb: 'State-by-state reference for the picker — walk this when you need one specific state, not the whole journey.',
    specs: [
      { change: 'base-picker-workspace-grouping', capability: 'base-picker-workspace-grouping', scenario: 'Multi-workspace estate' },
      { change: 'base-picker-workspace-grouping', capability: 'base-picker-workspace-grouping', scenario: 'Full access shows real workspace names' },
      { change: 'base-picker-workspace-grouping', capability: 'base-picker-workspace-grouping', scenario: 'Limited access shows generic workspace names' },
      { change: 'base-picker-workspace-grouping', capability: 'base-picker-workspace-grouping', scenario: 'Renaming a placeholder workspace' },
      { change: 'base-picker-workspace-grouping', capability: 'base-picker-workspace-grouping', scenario: 'Single workspace stays flat' },
      { change: 'workspace-auto-enroll', capability: 'workspace-auto-enroll', scenario: 'Enroll one of three workspaces' },
      { change: 'workspace-auto-enroll', capability: 'workspace-auto-enroll', scenario: 'Global toggle as macro' },
    ],
    code: [
      'apps/web/src/components/integrations/BaseSelectionTable.astro',
      'apps/web/src/components/integrations/BasePickerRow.astro',
      'apps/web/src/stores/connections.ts',
      'apps/design/src/lib/wsResolve.ts',
    ],
    steps: [
      {
        label: '1 · Nothing running',
        href: '/integrations/configure?wsresolve=flat&step=bases',
        caption:
          'The baseline the whole design rests on: a flat table that is COMPLETE on its own. Search, select, save — nothing disabled, no skeleton, and the toolbar says nothing about workspaces at all. A user who picks three bases and presses Next in five seconds never learns grouping exists, and that is a finished path, not a degraded one.',
      },
      {
        label: '2 · Resolving',
        href: '/integrations/configure?wsresolve=resolving&step=bases',
        caption:
          'The workspace lookup is running — one Airtable call per base, so on a large estate this takes a while. A spinner and a counter ("Matching workspaces… 31 / 50") sit INSIDE the toolbar row with no band of their own. Watch the number climb for ~15s, and select bases while it does: the table never moves, never regroups, never blocks.',
      },
      {
        label: '3 · Resumed after a reload',
        href: '/integrations/configure?wsresolve=resumed&step=bases',
        caption:
          'Reload mid-run and the counter picks up around two thirds through, not at zero. Progress is never thrown away — the work already paid for in API calls belongs to the user, not to the page view.',
      },
      {
        label: '4 · Ready — an offer, not an action',
        href: '/integrations/configure?wsresolve=offered&step=bases',
        caption:
          'The line becomes "Workspaces matched · Group by workspace". Nothing has regrouped: rearranging rows under a cursor that is mid-selection is exactly the failure this design exists to avoid. The answer is remembered per connection, so the question is asked once, not every visit.',
      },
      {
        label: '5 · Grouped',
        href: '/integrations/configure?wsresolve=grouped&step=bases',
        caption:
          'Accepted. Groups, the Auto-add column with its master toggle, Ungroup and Collapse all — and the toolbar line goes SILENT. No caption explaining what happened: the user pressed the control a second ago, restating it is noise. Reload and it stays grouped; Ungroup and that sticks too.',
      },
      {
        label: '6 · Partial',
        href: '/integrations/configure?wsresolve=partial&step=bases',
        caption:
          'Matched workspaces group, and the bases still awaiting their own call land in "Still matching" — never in "No workspace". Both groups render at once here, on purpose: a lookup that has not returned and a base that genuinely has no workspace are different facts, so they get different buckets, labels and tooltips.',
      },
      {
        label: '7 · Failed',
        href: '/integrations/configure?wsresolve=failed&step=bases',
        caption:
          '"Couldn\'t match · Retry". Stated as a fact about the connection, never as the user\'s mistake — no apology, no warning colour. The table stays flat and fully usable, because failing to group has no bearing on choosing bases. Retry re-runs the lookup and the counter comes back.',
      },
      {
        label: '8 · Full access',
        href: '/integrations/configure?wsresolve=grouped&step=bases',
        caption:
          'Real Airtable workspace names, each group collapsible with its own select-all and Auto-add switch. Nothing to explain — this is what full-environment access looks like.',
      },
      {
        label: '9 · Limited access',
        href: '/integrations/configure?wsnames=none&wsresolve=grouped&step=bases',
        caption:
          'Airtable withholds the NAMES but still returns the IDs, so grouping survives. Groups read "Workspace 1 · name unavailable", renameable in place. Note where the explanation lives: in the group header itself, with the sentence in its tooltip — the full-width warning band that used to sit above the table is gone, because an explanation belongs next to the thing it explains. The "reconnect with full access" route now sits on the auto-enroll rule, the capability limited access actually blocks.',
      },
      {
        label: '10 · A real name arrives',
        href: '/integrations/configure?wsresolve=grouped&wsalias=arrived&step=bases',
        caption:
          'The user had typed a name for a blank workspace; Airtable\'s real one has now landed. It takes over — but not silently. One reversible prompt says which name is in use and what they had called it, with "Keep mine". A name typed only because the field was empty is a workaround, not an opinion.',
      },
      {
        label: '11 · Both names, earned',
        href: '/integrations/configure?wsresolve=grouped&wsalias=custom&step=bases',
        caption:
          'They pressed "Keep mine", so the alias is now a deliberate choice rather than a placeholder fill — and ONLY now do both names show: theirs leading, Airtable\'s muted beside it. Dual display is earned, never the resting state; showing both by default would assume every typed name was an opinion.',
      },
    ],
    note:
      'Founder answers, 2026-07-28. Access is ALL-OR-NOTHING per connection — either every workspace shows its real name or none does — so there is deliberately no mixed-ACCESS screen. The pending bucket in step 6 is about TIME, not permissions. Auto-add only ever covers bases inside the access granted, and a workspace enrolled by the standing rule defaults its own Auto-add to ON. Confirmed cost: the workspace ID needs one extra API call per base, which is what turned grouping from the page\'s frame into an enhancement that arrives. Still open with Dan: whether Retry should re-run only the failed bases or the whole sweep (needs the engine to report which failed). Harness states not walked here: ?grouped=0 (no workspace data at all) and ?ws=single (one workspace → no offer is ever made, since one group is not grouping).',
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
    feature: 'Space setup',
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
    feature: 'Space setup',
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
    feature: 'Space setup',
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
    id: 'view-fields-depth',
    name: 'Views — what we can see, and what we cannot',
    feature: 'Schema',
    status: 'built',
    blurb: 'Airtable tells us which fields a view shows only in one case. Both depths ship, and the two silences are worded apart.',
    specs: [
      { change: 'view-schema-details', capability: 'view-schema-details', scenario: 'Views are first-class Browse entities' },
      { change: 'view-schema-details', capability: 'view-schema-details', scenario: 'The view panel is honest about capture depth' },
      { change: 'view-schema-details', capability: 'view-schema-details', scenario: 'View with captured configuration' },
      { change: 'view-schema-details', capability: 'view-schema-details', scenario: 'Name/type-only view' },
    ],
    code: [
      'apps/web/src/components/schema/EntityPanel.astro',
      'apps/web/src/components/schema/SchemaBrowse.astro',
      'apps/web/src/components/schema/schemaEntities.ts',
    ],
    steps: [
      {
        label: '1 · Fields captured — the good case',
        href: '/panels?open=v-co-all&scenario=reset',
        caption: 'Open the view "All companies" (v-co-all). "Fields shown · 4 of 11" with the fields NAMED as chips, each one drilling to that field. This is what an Airtable ENTERPRISE account returns through the REST API — the only route that carries which fields a view shows.',
      },
      {
        label: '2 · A realistic table',
        href: '/panels?open=v-co-audit',
        caption: 'Open "Data audit grid" (v-co-audit) — 8 of 11. Then "Full ledger" (v-dl-full) on the 33-field Deal Log — 26 of 33, so the chip box passes its cap of 20 and offers "+6 more" INSIDE the same box. The cap is 20, not the 5 the row-lists use: chips wrap, so twenty of them cost about what four rows cost.',
      },
      {
        label: '3 · The size that hurts',
        href: '/panels?open=v-ol-everything',
        caption: 'Open "Everything" (v-ol-everything) on the 121-field Ops Ledger — 96 of 121. Collapsed: 20 chips + "+76 more", 260px. Expanded: 96 chips in one box, 1099px, which pushes everything below far down. Accepted deliberately (Oleh 2026-07-29): the user asked to see them, and one click closes it again.',
      },
      {
        label: '4 · THE FORK — not an enterprise Airtable account',
        href: '/panels?open=v-co-forecast',
        caption: 'Open "Forecast review" (v-co-forecast). A GRID view, so Airtable could supply the fields — but this connection did not read that deep: "This connection didn\'t include which fields this view shows. Airtable returns that only through its REST API on an enterprise Airtable account." The gate is the CUSTOMER\'S Airtable plan, not ours, so there is no Baseout tier language and no upgrade CTA anywhere on this screen.',
      },
      {
        label: '5 · The other silence — not a grid view',
        href: '/panels?open=v-co-map',
        caption: 'Open "Account gallery" (v-co-map). Airtable never returns visible fields for a Gallery view, for anybody, on any plan: "…so there is nothing to capture for a Gallery view." Deliberately worded apart from step 4 — one is a permanent fact about the view type, the other is about this connection, and collapsing them into one line would misplace the blame.',
      },
      {
        label: '6 · A view whose table we did not capture',
        href: '/panels?open=v-co-orphan',
        caption: 'Open "Untitled view" (v-co-orphan): "We captured this view but not which table it belongs to, so it isn\'t nested under one." Browse gives it its own group beside the tables rather than dropping it. The founder is still researching how views arrive tied to a table (Q7, 2026-07-28) — this is the safe state until that lands.',
      },
      {
        label: '7 · The reverse direction',
        href: '/panels?open=f-co-name',
        caption: 'Open the FIELD "Name" (f-co-name) → Referenced by → Views: All companies · Data audit grid · My accounts. This is the half that was missing when the founder said "I believe we already have reverse dependencies" — automations, interfaces, formulas, rollups, lookups and chats were all there, views were not. Then open "Website" (f-co-website): no views show it, so the group is omitted entirely — never "Views 0".',
      },
      {
        label: '8 · Views in Browse',
        href: '/schema',
        caption: 'Expand a base: views sit under their table in their own "Views (n)" group, capped independently of the fields so four fields are not buried under a hundred views. Sales CRM also carries the "Views · table not resolved" group from step 6.',
      },
    ],
    note:
      'Founder answer, Q6 2026-07-28: "If we get the MCP then we just get ID, name, and type. If the account is an Airtable enterprise account then we would be able to get the fields that are visible… we would have to support both scenarios." FILTERS, SORTS, GROUPING AND COLOURING DO NOT EXIST in any Airtable endpoint — not "not captured yet", there is no source — so they must never appear in this UI or in a fixture. Q8 confirmed the enterprise gate is the CUSTOMER\'S Airtable account, not Baseout\'s.',
  },
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
      { label: 'Base filter (multi-base)', href: '/schema', caption: 'On a Space that backs up several bases, a header base-filter scopes the canvas to one base and its ER diagram (the diagram is per-base; Airtable links never cross bases). Single-base Spaces hide it. The demo Space is always multi-base so the filter is always shown — there is no query-param to force it (the old ?bases=multi href was dead).' },
      { label: 'App-layer mode (Automations & Interfaces)', href: '/schema', caption: 'A second graph mode overlays the captured Automations / Interfaces onto the tables/fields they touch (edge kinds: references / reads / triggers). Below Growth it shows an upsell (not a blank canvas); with nothing captured it shows an empty state pointing to the Automations / Interfaces tabs. PARTIAL: the mode + its empty/upsell render, but locked vs no-credits are not distinguished here. Spec: visualize-automations-interfaces.' },
      { label: 'AI description · ready (Pro+)', href: '/schema', caption: 'In the shared panel, Generate with AI (Pro+, 10 credits, cost shown on the button) seeds a blank Airtable description; it then follows the Draft → Publish lifecycle. AI generation lives on the public Airtable copy only (see schema-descriptions).' },
      { label: 'AI · below Pro+ (locked)', href: '/schema?ai=locked', caption: 'Below Pro+, Generate is a locked upsell (lock + Pro+) that routes to billing, not a dead control — shown in the shared panel opened from a node.' },
      { label: 'AI · out of credits (GAP)', href: '/schema?ai=no-credits', caption: 'HONEST STATE: with ai=no-credits the shared panel currently just HIDES the Generate CTA — there is no dedicated "out of credits · top up" message or route. A distinct out-of-credits affordance is unbuilt — see schema-section-gaps.' },
      { label: 'Empty — never backed up', href: '/schema?fixture=empty', caption: 'Before the first backup, Visualize shows the shared "Schema appears after your first backup" empty (the .sch-empty workflow-icon state SchemaView renders for every tab when there is no schema yet). Reachable via ?fixture=empty.' },
    ],
    note: 'Node-clicks open the SHARED EntityPanel (schema:openEntity), so Visualize, Browse, Docs and Changelog all use one detail surface — descriptions, AI Generate and the Draft/Publish lifecycle live there (see schema-descriptions). The old Visualize-only inline description panel was retired dead code and was DELETED 2026-06-26. The real vendored Airtable field-icon set, focus-mode + search-jump, and the multi-base filter were BUILT 2026-06-23; the app-layer graph mode is PARTIAL (renders, but tier states are coarse). Still open: tier-gated Export + the Fields-visibility filter with counts (field-visibility-filter spec) — see schema-visualize-planned. No query-param forces the single-base or "no schema" canvas; those are fixture-driven.',
  },
  {
    id: 'schema-relationships',
    name: 'Relationships — linked-record map',
    feature: 'Schema',
    status: 'built',
    inSwitcher: true,
    blurb: "The Space's relationships (linked records · formulas · rollups · lookups · last-modified · synced views) as a per-Base table, Tree or Flat, with a Confirm/Dismiss lifecycle for the ones we can only INFER (synced views), removed-history kept reachable, and a shared detail panel.",
    specs: [
      { change: 'relationships-tab', capability: 'schema', scenario: 'Tree grouped by base and type' },
      { change: 'relationships-tab', capability: 'schema', scenario: 'Inspect a formula relationship' },
      { change: 'relationships-tab', capability: 'schema', scenario: 'Confirm an inferred synced view' },
      { change: 'relationships-tab', capability: 'schema', scenario: 'Dismiss an inferred synced view' },
      { change: 'relationships-tab', capability: 'schema', scenario: 'View removed links' },
      { change: 'relationships-tab', capability: 'schema', scenario: 'Invalid relationship still reachable' },
    ],
    code: [
      'apps/web/src/components/schema/SchemaRelationships.astro',
      'apps/web/src/components/schema/schemaRelationships.ts',
      'apps/web/src/components/schema/RelationshipPanel.astro',
      'apps/web/src/components/schema/airtableFieldIcons.ts',
      'apps/web/src/components/schema/FacetFilter.astro',
      'apps/web/src/components/schema/tableSort.ts',
    ],
    steps: [
      { label: 'Tree grouped by base', href: '/schema', caption: 'Open the Relationships tab: one table per Base (collapsible), columns Relationship · Type (legible chip) · Cardinality (mono token + tooltip) · Status, click-to-sort. As a power user I want every link, formula, rollup and lookup in one place — the map Airtable itself never draws.' },
      { label: 'Flat view', href: '/schema', caption: 'Toggle Tree → Flat (.sch-tb-modes): a single de-grouped table (Relationship · Type · Base · Cardinality · actions) for scanning the whole Space at once.' },
      { label: 'Status: Valid / Invalid / Inferred', href: '/schema', caption: 'Field-backed links read Valid; a relationship whose links were all removed reads Invalid (kept, not deleted, so history stays reachable); synced-view relationships we can only INFER read Inferred (sparkles) — Airtable’s API cannot confirm them.' },
      { label: 'Confirm / Dismiss inferred', href: '/schema', caption: 'Only inferred rows get Confirm / Dismiss (+ a "N inferred — Confirm all / Dismiss all" bulk bar). Confirm promotes it to a declared relationship (actions swap to Edit); Dismiss hides it with a 7s undo toast (and tells the engine not to re-propose it).' },
      { label: 'Row → primary field detail', href: '/schema', caption: 'Clicking a field-backed row opens the PRIMARY field’s shared EntityPanel (formula/rollup config + References + per-link changelog); synced / invalid rows open the custom RelationshipPanel detail instead. One vocabulary with Browse / Visualize.' },
      { label: 'Removed history + include-removed', href: '/schema', caption: 'Removed links are hidden by default and revealed by an Include-removed checkbox (shown only when there are any), rendered muted with first-seen / removed dates so a broken link is auditable, never silently gone.' },
      { label: 'Create / edit a synced relationship', href: '/schema', caption: '"New synced relationship" opens a drawer with two searchable table-pickers (synced + source) + a note; the base is derived from the synced table. The one relationship kind a user can author by hand (the rest are engine-derived). Faked client-side here.' },
      { label: 'Filtered-empty', href: '/schema', caption: 'Search + Base / Type / Status / Validity facets narrow the list; when nothing matches, "No relationships match your filters." + Clear — a filtered list never reads as missing data.' },
      { label: 'Empty — none yet', href: '/schema?fixture=empty', caption: 'A Space with no relationships (or never backed up) shows "No relationships yet" rather than an empty table.' },
    ],
    note: 'BUILT (round-2/round-3). NOT tier-gated (unlike Automations/Interfaces/Chat) and NOT viewer-role-gated — Confirm/Dismiss + synced create/edit are always available despite the section’s "read-only" framing (see schema-section-gaps). Detail + undo-toast + the tables/basemap JSON live in the SHARED RelationshipPanel.astro, so this tab depends on it being mounted. All mutations are faked (setTimeout, always succeed) — no error state. Data caveat: synced-view links are inferred, not API-certain (hence Confirm/Dismiss); pairs with server-schema-relationships.',
  },
  {
    id: 'schema-automations',
    name: 'Automations — captured Airtable automations',
    feature: 'Schema',
    status: 'built',
    blurb: "A per-Base list of the Space's Airtable automations — which the API can't export, so they're entered by hand — with a read/edit drawer, dual Airtable/Internal descriptions, email subscriptions, entity tags, and soft-delete. Growth+.",
    specs: [
      { change: 'automations-interfaces-tabs', capability: 'schema', scenario: 'Grouped listing' },
      { change: 'automations-interfaces-tabs', capability: 'schema', scenario: 'Below-Growth upsell' },
      { change: 'automations-interfaces-tabs', capability: 'schema', scenario: 'Create automation' },
      { change: 'automations-interfaces-tabs', capability: 'schema', scenario: 'Delete mutes the row' },
      { change: 'automations-interfaces-tabs', capability: 'schema', scenario: 'Tag click-through' },
      { change: 'automations-interfaces-tabs', capability: 'schema', scenario: 'Manual tag removable, auto tag not' },
    ],
    code: [
      'apps/web/src/components/schema/SchemaAutomations.astro',
      'apps/web/src/components/schema/schemaAutomations.ts',
      'apps/web/src/components/schema/EntitySearch.astro',
      'apps/web/src/components/schema/FacetFilter.astro',
      'apps/web/src/components/schema/tableSort.ts',
      'apps/web/src/components/ui/Drawer.astro',
    ],
    steps: [
      { label: 'Grouped listing', href: '/schema', caption: 'Open the Automations tab: Base-grouped collapsible tables, columns Name · Status · Trigger · Tagged · actions, click-to-sort. Because Airtable can’t export automations, this is the only place a user sees them alongside the tables/fields they touch.' },
      { label: 'Status: Active / Inactive / Removed', href: '/schema', caption: 'Soft + semantic badges — Active (success) · Inactive (neutral, when disabled) · Removed (warning, soft-deleted). Active-before-removed sort.' },
      { label: 'Read drawer', href: '/schema', caption: 'Row → a right drawer: trigger, dual descriptions (Airtable description + Internal note), Touches chips (click through to the tagged tables/fields), Subscribers, a per-automation Changelog, and the opaque definition JSON when present. Edit / Delete in the footer.' },
      { label: 'Create / edit form', href: '/schema', caption: 'Name + Automation ID (required; ID read-only on edit), Base, a fixed Trigger-type select (Airtable’s canonical triggers — free text can’t be trusted), Active toggle, a tag-picker (auto vs manual chips; only manual removable), dual Airtable/Internal description tabs (NO Publish — automations can’t sync back), and an email-subscription editor (validated, chips).' },
      { label: 'Soft-delete', href: '/schema', caption: 'Delete mutes the row to Removed and surfaces an Include-removed checkbox rather than vanishing it — a removed automation stays auditable.' },
      { label: 'Below Growth — upsell', href: '/schema?ai=locked', caption: 'Below Growth the whole tab is an upsell ("Track your Airtable automations… Available on Growth and above" → View plans), not the list or form. locked and no-credits render the SAME gate here (no distinct no-credits state).' },
      { label: 'Filtered-empty', href: '/schema', caption: 'Search + Base / Table / Field facets; "No automations match the current filters." when nothing matches.' },
      { label: 'Empty — none registered', href: '/schema?fixture=empty', caption: 'HONEST CAVEAT: the component’s own "No automations registered yet" + Register-automation empty exists in code but is effectively UNREACHABLE with shipped fixtures — ?fixture=empty zeroes tables too, so SchemaView shows its page-level empty and never mounts this tab. Needs a schema-present-but-no-automations fixture (see schema-section-gaps).' },
    ],
    note: 'BUILT (round-2/round-3). Gating = Growth+ (spec); UI copy says "Growth and above". No error state (faked saves). No viewer-role gating: fully create/edit/delete despite "read-only" framing. Spec’s "Invalid definition JSON blocked" scenario does NOT apply to the shipped form — there is no raw-definition input (API-only, preserved on edit). Data caveat: Airtable API does not expose Automations — manual entry + inbound API (shared-automations-interfaces); definition is opaque JSON.',
  },
  {
    id: 'schema-interfaces',
    name: 'Interfaces — captured interfaces & pages',
    feature: 'Schema',
    status: 'built',
    blurb: "A per-Base list of the Space's Airtable interfaces with their Pages nested one level under each, read/edit drawer, Internal-only note, entity tags, and soft-delete. Growth+.",
    specs: [
      { change: 'automations-interfaces-tabs', capability: 'schema', scenario: 'Pages nested under their interface' },
      { change: 'automations-interfaces-tabs', capability: 'schema', scenario: 'Page requires a parent interface' },
      { change: 'automations-interfaces-tabs', capability: 'schema', scenario: 'Below-Growth upsell' },
      { change: 'automations-interfaces-tabs', capability: 'schema', scenario: 'Reverse surfacing on Browse' },
    ],
    code: [
      'apps/web/src/components/schema/SchemaInterfaces.astro',
      'apps/web/src/components/schema/schemaInterfaces.ts',
      'apps/web/src/components/schema/EntitySearch.astro',
      'apps/web/src/components/schema/FacetFilter.astro',
      'apps/web/src/components/schema/tableSort.ts',
      'apps/web/src/components/ui/Drawer.astro',
    ],
    steps: [
      { label: 'Nested listing (Base ▸ Interface ▸ Pages)', href: '/schema', caption: 'Open the Interfaces tab: Base groups → interface nodes (collapsible, with a page-count badge) → indented page rows. Columns Name · Type · Status · Tagged · actions, click-to-sort while keeping pages nested.' },
      { label: 'Status: Published / Not published / Removed', href: '/schema', caption: 'Soft + semantic badges on interfaces AND pages — Published (success) · Not published (neutral) · Removed (warning).' },
      { label: 'Orphan pages', href: '/schema', caption: 'A page whose parent interface is unresolved is bucketed under a non-clickable "Pages without an interface" heading rather than dropped.' },
      { label: 'Read drawer', href: '/schema', caption: 'Row → a right drawer with clickable Interface ▸ Page breadcrumbs, an Internal note ONLY (interfaces carry no Airtable description — so no dual tabs, unlike Automations), the Pages list, Touches chips, Changelog, and the opaque definition when present. Edit / Delete.' },
      { label: 'Create / edit form', href: '/schema', caption: 'Name + Interface ID (required; read-only on edit), Base, a Type select (interface | page); choosing page reveals a required Parent-interface picker scoped to the chosen base; Published toggle, tag-picker, single Internal note.' },
      { label: 'Soft-delete', href: '/schema', caption: 'Delete mutes the row to Removed + Include-removed toggle — never vanishes.' },
      { label: 'Below Growth — upsell', href: '/schema?ai=locked', caption: 'Below Growth the tab is an upsell ("Track your Airtable interfaces… Growth and above"), not the list/form. locked and no-credits render the same gate.' },
      { label: 'Filtered / empty', href: '/schema?fixture=empty', caption: 'Search + Base / Table / Field facets → "No interfaces match the current filters."; the component’s own "No interfaces registered yet" empty has the same shipped-fixture unreachability caveat as Automations (see schema-section-gaps).' },
    ],
    note: 'BUILT (round-2/round-3). Growth+ (spec). No error state, no viewer-role gating (full create/edit/delete despite "read-only"). No email subscriptions (by design — interfaces don’t have them). The model carries page→automation triggers for the Visualize app-layer graph but does not surface them in this tab’s UI. Data caveat: Airtable API does not expose Interfaces — same manual-intake path as Automations.',
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
    blurb: "Per-base 0–100 composite grade + Green/Yellow/Red band (Green ≥90 · Yellow 60–89 · Red <60), the category breakdown, and the issue punch-list ('where's the rot'). One two-pane console handles any base count.",
    specs: [],
    code: ['apps/web/src/components/schema/SchemaHealth.astro'],
    steps: [
      { label: 'Two-pane console (all base counts)', href: '/schema', caption: "As a power user, I want to know where the rot is and act on it. Open the Health tab: a searchable, sortable (worst-first) base list on the left auto-selecting the worst base; the selected base's report on the right — score ring, category bars, freshness stamp, and issues grouped by severity (Needs attention / Worth a look / Minor) with Open in Airtable to fix where it lives. This ONE console is used for every base count (the earlier ≤6-bases tab-card variant was removed 2026-06-24; ?bases=many is dead)." },
      { label: 'Healthy base (quiet)', href: '/schema', caption: 'A green base shows a high grade and a short/empty issue list — celebrated quietly (no confetti), advisory tone throughout ("12 fields could use clearer names", never "your schema is bad").' },
      { label: 'How this is scored', href: '/schema', caption: 'A Health-level "How this is scored" explainer (a tooltip, not a modal) covers the default rules + the band thresholds, so the score is not a black box. Below Pro+ the defaults still show read-only — never a blank.' },
      { label: 'Configure rules (Pro+)', href: '/settings/billing', caption: 'Configure rules (Pro+) — Space/Org-level, in the Health header — currently routes to billing; the real rule-config + per-metric scoring screens are planned (see schema-health-planned).' },
      { label: 'Schema-only vs dynamic-backup data', href: '/schema', caption: 'Record-level data-quality metrics (empty records, broken links) need a dynamic backup; schema-only Spaces grade on schema-level rules and a category can read as "schema-only" without looking broken or empty.' },
      { label: 'Empty — never backed up', href: '/schema?fixture=empty', caption: 'Before the first backup completes, the Health tab shows its "Health appears after your first backup completes — a per-base 0–100 grade…" empty (the .sch-soon dashed state, gated on health.length). Reachable via ?fixture=empty.' },
    ],
    note: 'Grade dots match the Visualize node dots. Backend produces 0–100 + Green/Yellow/Red (design to that, not a letter grade). Per-metric enable/disable, prompt overrides + stale re-run, the Insights section, and rule configuration are spec-defined but NOT built here — see schema-health-planned.',
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
    id: 'schema-chat',
    name: 'Chat — ask your schema',
    feature: 'Schema',
    status: 'built',
    blurb: "A Claude-style assistant scoped to the Space's schema: a thread rail, streamed replies with clickable entity / doc references, a scoped-context composer, and Convert-to-doc. Faked client-side, Pro+.",
    specs: [
      { change: 'chat-tab', capability: 'schema', scenario: 'Start and continue a conversation' },
      { change: 'chat-tab', capability: 'schema', scenario: 'Scope to a table and attach a doc' },
      { change: 'chat-tab', capability: 'schema', scenario: 'Convert to doc shows a linked reference' },
      { change: 'chat-tab', capability: 'schema', scenario: 'Click an entity tag in a reply' },
      { change: 'chat-tab', capability: 'schema', scenario: 'Below Pro+' },
    ],
    code: [
      'apps/web/src/components/schema/SchemaChat.astro',
      'apps/web/src/components/schema/schemaChat.ts',
      'apps/web/src/components/schema/airtableFieldIcons.ts',
    ],
    steps: [
      { label: 'Conversation', href: '/schema', caption: 'Open the Chat tab (or the header "Ask about your schema" launcher): user bubbles + full-width assistant replies with References chips, Copy / thumbs actions. As a user I want to ask "which tables link to Companies?" in words instead of reading the diagram.' },
      { label: 'Thread rail', href: '/schema', caption: 'New / Rename / Archive threads; an archived section (Restore) is hidden until there are archived threads. Rail-empty reads "No chats yet."' },
      { label: 'Scoped-context composer', href: '/schema', caption: 'The composer carries context chips — "Whole Space" when nothing is scoped — plus an Add-context picker (browsable + searchable Bases / Tables / Fields / Docs) whose chips are removable, a per-message credit estimate ("~2 credits"), and Send (disabled until there’s input).' },
      { label: 'Send / stream / stop', href: '/schema', caption: 'Send appends the message → a "Reading schema…" streaming status → a canned reply that references the thread’s scope; Stop cancels the fake stream. Chat debits credits (shown, not hidden).' },
      { label: 'Convert to doc', href: '/schema', caption: 'A naming popover turns a conversation into a Doc: a "Saved as a doc" card drops into the thread and the doc appears on the Docs tab (Open switches tabs). Reference chips click through — entity → shared EntityPanel, doc → Docs tab.' },
      { label: 'Below Pro+ — gate', href: '/schema?ai=locked', caption: 'Below Pro+ the tab is an upgrade affordance ("Chat with your schema… Upgrade to Pro" → billing), not a live composer. locked and no-credits render the SAME gate — there is no distinct mid-conversation out-of-credits state (see schema-section-gaps).' },
      { label: 'Empty — no threads', href: '/schema', caption: 'With Pro+ but no threads, "Ask anything about your schema" + New chat; a fresh empty thread shows a centered greeting with example prompts.' },
    ],
    note: 'BUILT (schema round). Pro+ (spec). Everything is FAKED: the stream always finishes (no failed-response / retry state), the add-context picker is a self-rendered browsable list (not the EntitySearch component), and no-credits collapses into the locked gate. The chat is scoped to schema data, NOT an app-wide assistant. The same panel is reachable three ways in the live view: the Chat tab, the header launcher, and the launcher’s quick-ask drawer (see schema-nav). Pairs with server-schema-chat.',
  },
  {
    id: 'schema-nav',
    name: 'Schema navigation — grouped bar (live)',
    feature: 'Schema',
    status: 'built',
    blurb: "The shipped SchemaView navigation: 8 tabs grouped into 4 labelled clusters, built on the catalog Tabs primitive, plus a persistent chat launcher → quick-ask drawer → full Chat tab. The Variant-A prototype, ported into the real product.",
    specs: [],
    code: ['apps/web/src/views/SchemaView.astro'],
    steps: [
      { label: 'Grouped tab bar', href: '/schema', caption: 'One tab row, 8 tabs in 4 clusters with a quiet uppercase label above each group and thin dividers between: Explore (Browse · Visualize · Relationships) · App layer (Automations · Interfaces) · Monitor (Changelog · Health) · Knowledge (Docs · Chat). Browse is the landing tab. Built on the catalog tabs/tabs-border primitive (the bespoke .sch-tab class was retired); documented as storybook pattern-section-nav.' },
      { label: 'Ask launcher → quick-ask drawer', href: '/schema', caption: 'A header "Ask about your schema" ghost button (shown once there’s a schema) opens a slim right-side quick-ask DRAWER — a canned Q&A with a scope chip and composer — that dims the background and closes on scrim / × / Esc. Presentational.' },
      { label: 'Expand → full Chat', href: '/schema', caption: 'The drawer’s Expand ⤢ closes it and opens the full Chat tab (under Knowledge); the Chat tab also opens it directly. One chat surface, three entry points (see schema-chat).' },
      { label: 'Keyboard + tab plumbing', href: '/schema', caption: '"/" focuses the visible panel’s search; switching to Visualize fires a resize so the canvas lays out. Tab state is data-tab / data-panel (unchanged from the prototype).' },
      { label: 'Mobile — primitive', href: '/schema', caption: 'On narrow screens the grouped bar just scrolls sideways today. Dan’s idea "on mobile use the groupings AS tabs" (Variant A → two-level via media query) is an explicit follow-up, not built — see schema-nav-grouping.' },
    ],
    note: 'BUILT + shipped 2026-07-03 (commit f0684c0), porting the approved Variant A from the /schema-nav prototype into the LIVE SchemaView. This supersedes the "prototype only — live bar untouched" framing of schema-nav-grouping (now historical). Remaining: the fuller mobile treatment.',
  },
  {
    id: 'panel-lab',
    name: 'Panel Lab — detail-panel review harness',
    feature: 'Schema',
    status: 'built',
    blurb: "A review-only page that opens every Schema detail panel/drawer on a button click — the REAL production components, not mocks — so we can click through, compare and discuss them (incl. worst-case data) before the panel-anatomy canon refactor. A scenario rail grouped by panel type fires each panel's real open path.",
    specs: [],
    code: ['apps/design/src/pages/panels.astro', 'apps/design/src/fixtures/panel-lab-scenarios.ts', 'apps/design/src/fixtures/schema-lab.ts'],
    steps: [
      { label: 'Open the lab', href: '/panels', caption: 'The real SchemaView mounts with the shared fixtures + a lab-only worst-case table; a floating rail lists every scenario grouped by panel type. Click one → the real panel flies out from the right. Nothing here is a mock — what you approve ships.' },
      { label: 'EntityPanel scenarios', href: '/panels', caption: 'field · formula (2 refs) · LARGE formula (50 refs, the worst-case References list) · long paragraph description · rollup · lookup · removed · table · many-children table · base — all via schema:openEntity.' },
      { label: 'RelationshipPanel / Automations / Interfaces', href: '/panels', caption: 'valid / inferred / invalid relationships (schema:openRelationship); automations read/minimal/removed (schema:openAutomation); interface / page-with-breadcrumb / not-published / removed (schema:openInterface).' },
      { label: 'Changelog detail + Chat drawer', href: '/panels', caption: 'changelog entry detail (added · before→after · with-warning — clicks a real feed row); the quick-ask chat drawer (data-chat="drawer").' },
    ],
    note: 'Harness only (apps/design) — mounts the real SchemaView + fixtures and fires the panels\' real open paths. Fixtures were extracted to apps/design/src/fixtures/schema-lab.ts so /schema and the lab share one source; the lab adds a "Kitchen Sink" table (50 fields + a 50-ref Mega Formula) to stress-test the canon. Stage-1 canon: overview/schema/panel-anatomy-canonical.md; the Stage-3 refactor is verified here live.',
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
      { label: 'Never backed up', href: '/schema?fixture=empty', caption: 'As a brand-new user opening Schema before any backup, I see an honest empty state (Schema appears after your first backup) instead of a broken / blank canvas. Rendered once at the VIEW level (.sch-empty) — every tab inherits it, so no tab needs its own never-backed-up copy.' },
      { label: 'No bases connected (spec, not distinguished)', href: null, caption: 'The README calls for a DISTINCT earlier empty — "Connect Airtable to see your schema." → Integrations — for a Space with no source connected at all (before "backed up but empty"). Today only the one never-backed-up state exists; the no-source case is not separated. Small gap — see schema-section-gaps.' },
    ],
  },
  // ── Schema · planned edge-cases (tracked, not built) ──
  {
    id: 'schema-visualize-planned',
    name: 'Visualize — planned edge-cases',
    feature: 'Schema',
    status: 'planned',
    blurb: 'Visualize spec items still unbuilt: tier-gated Export, the Fields-visibility filter with counts, and the coarse tier states on the app-layer mode.',
    specs: [
      { change: 'field-visibility-filter', capability: 'schema', scenario: 'Toggle a single field' },
      { change: 'field-visibility-filter', capability: 'schema', scenario: 'Partial table is indeterminate' },
      { change: 'field-visibility-filter', capability: 'schema', scenario: 'Trigger shows count' },
      { change: 'visualize-automations-interfaces', capability: 'schema', scenario: 'Empty and upsell states' },
    ],
    code: ['apps/web/src/views/SchemaView.astro', 'apps/web/src/components/schema/SchemaCanvas.tsx', 'apps/web/src/components/schema/FieldsFilter.tsx'],
    steps: [
      { label: 'Real Export (not built)', href: null, caption: 'Export is tier-gated PNG (Growth) / SVG (Pro) / PDF (Business) / embed (Enterprise), rendered client-side from the graph. Today the menu shows tier badges only. DEFERRED by decision 2026-06-23: a real raster / PDF render needs new frontend deps (html-to-image for PNG/SVG, jspdf for PDF) not yet in apps/web — a prod-dependency call left to the owner.' },
      { label: 'Fields-visibility filter with counts (not built)', href: null, caption: 'Spec field-visibility-filter: a hierarchical Base ▸ Table ▸ Field multi-select to show/hide field nodes on the canvas — global/base/table show-all-hide-all, indeterminate on partial selection, search-then-bulk-toggle, and a trigger that reads "Fields: 24 of 180". A FieldsFilter.tsx stub exists but is not wired into the canvas.' },
      { label: 'App-layer mode: distinct tier states (polish)', href: null, caption: 'The app-layer graph mode is built (see schema-visualize) but does not distinguish below-Growth (upsell) from Pro+-no-credits, and its empty state is coarse. Spec visualize-automations-interfaces wants a clean upsell vs empty-pointing-to-tabs split.' },
    ],
    note: 'Field-icons, base-filter, focus-mode + search-jump BUILT 2026-06-23; the app-layer graph mode is PARTIAL (see schema-visualize). Export is blocked on the html-to-image / jspdf dependency decision; the Fields filter needs wiring; the app-layer tier states need splitting.',
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
    id: 'schema-health-planned',
    name: 'Health — planned edge-cases (scoring · insights · rules)',
    feature: 'Schema',
    status: 'planned',
    blurb: 'The Pro+ configuration + insight layers behind Health: rule configuration, per-metric enable/disable + prompt overrides + stale re-run, and the Insights section. Today the Health tab shows grades + issues; these controls route to billing or are absent.',
    specs: [
      { change: 'health-tab-scoring', capability: 'schema', scenario: 'Breakdown shown' },
      { change: 'health-tab-scoring', capability: 'schema', scenario: 'Disabling a metric' },
      { change: 'health-tab-scoring', capability: 'schema', scenario: 'Override a field\'s prompt' },
      { change: 'health-tab-scoring', capability: 'schema', scenario: 'Stale metric offers re-run' },
      { change: 'health-tab-scoring', capability: 'schema', scenario: 'Grade dropped since last run' },
      { change: 'schema-insights-ui', capability: 'schema', scenario: 'Insight with clickable tags' },
      { change: 'schema-insights-ui', capability: 'schema', scenario: 'Reveal archived' },
    ],
    code: ['apps/web/src/components/schema/SchemaHealth.astro'],
    steps: [
      { label: 'Configure rules (not built)', href: null, caption: 'As a Pro+ admin, tune the health rules: toggle which checks count + set severity thresholds; the engine defaults show read-only when nothing is configured (and to below-Pro+ with an upgrade affordance). Today the Configure-rules button routes to a billing placeholder.' },
      { label: 'Per-metric enable/disable + prompt override (not built)', href: null, caption: 'Spec health-tab-scoring: per-base disable a metric (muted, "not counted for this base", excluded from the grade); Pro+ per-entity prompt overrides with resolution Override → Space → System default + Reset. Below Pro+ sees prompts read-only.' },
      { label: 'Stale metric → re-run (not built)', href: null, caption: 'When the effective prompt changed after a metric’s last-generated date, offer a Re-run (Pro+); an up-to-date metric shows none. The displayed score can be stale until re-run.' },
      { label: 'Score trend (not built)', href: null, caption: 'Scores append per run → surface "grade dropped since last run" so a regression is visible, not silent.' },
      { label: 'Insights section (not built / partial)', href: null, caption: 'Spec schema-insights-ui: an Insights list on the Health tab — observations with clickable entity tags (→ shared panel) + "generated <date>", Pro+ per-base prompt config, stale re-run, and archived insights hidden by default (toggle reveals them, muted). Insights auto-archive when stale and may graduate to their own tab.' },
    ],
    note: 'Specs: overview/schema/03-health-tab.md §Rule configuration + openspec health-tab-scoring + schema-insights-ui. Gating: Pro+. Defaults are partially surfaced today via the "How this is scored" tooltip (not a modal). None of the metric-config / insights UI is built in this mirror.',
  },

  {
    id: 'schema-browse-planned',
    name: 'Browse — planned edge-cases (deleted-items · Docs tier)',
    feature: 'Schema',
    status: 'planned',
    blurb: 'Browse ships the Tree/Flat explorer, faceted filters and an Include-removed toggle. The remaining spec nuance is the full deleted-items vocabulary and confirming the Docs-tab tier.',
    specs: [
      { change: 'deleted-items-filter', capability: 'schema', scenario: 'Default Browse hides deleted' },
      { change: 'deleted-items-filter', capability: 'schema', scenario: 'Reveal deleted items' },
      { change: 'deleted-items-filter', capability: 'schema', scenario: 'Unknown not hidden' },
    ],
    code: ['apps/web/src/components/schema/SchemaBrowse.astro'],
    steps: [
      { label: '"N deleted — show" affordance (partial)', href: null, caption: 'Include-removed exists as a checkbox; the spec also wants a visible "N deleted — show" hint so a user KNOWS hidden items exist without opening the filter menu. Verify the count hint is surfaced, not just the toggle.' },
      { label: 'Unknown vs removed distinction (not built)', href: null, caption: 'Spec separates removed (confirmed gone since <date>) from unknown ("couldn’t confirm" — shown normally, never hidden). Today only removed is modelled; the unknown state needs the engine flag + a distinct render.' },
      { label: 'Docs-tab tier gate (unconfirmed)', href: null, caption: 'README marks the Docs tab likely Pro+ ("confirm w/ capability matrix"). Browse itself is Launch+. The Docs gate is not enforced in this mirror — lock in the tier before porting.' },
    ],
    note: 'Include-removed + faceted filters + Tree/Flat + filtered-empty are all BUILT (see schema-browse). Pairs with server-removed-item-filtering (pass include_removed to the engine; removed items arrive flagged with a removal date).',
  },
  {
    id: 'schema-automations-interfaces-planned',
    name: 'Automations & Interfaces — planned edge-cases',
    feature: 'Schema',
    status: 'planned',
    blurb: 'The two captured-entity tabs are built (list · drawer · create/edit · soft-delete · tags). What remains is honest error/role handling, a reachable empty fixture, and reconciling the spec’s JSON-validation scenario with the shipped form.',
    specs: [
      { change: 'automations-interfaces-tabs', capability: 'schema', scenario: 'Invalid definition JSON blocked' },
    ],
    code: ['apps/web/src/components/schema/SchemaAutomations.astro', 'apps/web/src/components/schema/SchemaInterfaces.astro'],
    steps: [
      { label: 'Save/error state (not built)', href: null, caption: 'Create/edit/delete are faked with setTimeout and always succeed — no failed-save, no retry, no validation-error surface beyond required fields. A real write needs an error path.' },
      { label: 'Reachable component empty fixture (harness gap)', href: null, caption: 'The "No automations/interfaces registered yet" empties exist in the components but can’t be reached: ?fixture=empty also zeroes tables, so the page-level empty wins. Add a schema-present-but-no-captured-entities fixture to demo them.' },
      { label: 'JSON-validation scenario is N/A to the shipped form', href: null, caption: 'Spec has "Invalid definition JSON blocked", but the shipped edit form has NO raw-definition input (definition is API-only, preserved on edit) — so the scenario doesn’t map. Either the form gains a JSON field or the spec scenario is scoped to the inbound API. Decide before porting.' },
      { label: 'Viewer-role gating (not built)', href: null, caption: 'Both tabs expose full create/edit/delete regardless of role, despite the "read-only" section framing. A viewer should see the lists but not the write affordances — see schema-section-gaps.' },
    ],
    note: 'Gating Growth+ IS built (below-Growth upsell). Bidirectional tags + soft-delete + dual-desc (Automations) / Internal-only (Interfaces) all built (see schema-automations / schema-interfaces).',
  },
  {
    id: 'schema-chat-planned',
    name: 'Chat — planned edge-cases',
    feature: 'Schema',
    status: 'planned',
    blurb: 'Chat is built as a faked assistant. What remains is the unhappy path: a failed / stopped response, a distinct out-of-credits state, and real streaming + thread history from the engine.',
    specs: [],
    code: ['apps/web/src/components/schema/SchemaChat.astro', 'apps/web/src/components/schema/schemaChat.ts'],
    steps: [
      { label: 'Failed / retryable response (not built)', href: null, caption: 'The fake stream always finishes — there is no error bubble, no per-message Retry, no network-failure state. A real backend needs all three.' },
      { label: 'Distinct out-of-credits state (not built)', href: null, caption: 'no-credits currently collapses into the same full Pro+ gate as locked. A Pro+ user who runs out mid-conversation should see an inline "out of credits · top up" affordance on the composer, not the upgrade wall. See schema-section-gaps.' },
      { label: 'Real streaming + thread persistence (backend)', href: null, caption: 'Replies are canned and threads are fixtures — no loading state for thread history, no persistence. Pairs with server-schema-chat.' },
    ],
    note: 'Built happy path + gate + convert-to-doc + scoped context: see schema-chat.',
  },
  {
    id: 'schema-section-gaps',
    name: 'Schema — cross-cutting gaps (all tabs)',
    feature: 'Schema',
    status: 'planned',
    blurb: 'The states that are missing the SAME way across every Schema tab — the highest-value handoff findings because a fix is one shared pattern, not per-tab work.',
    specs: [],
    code: ['apps/web/src/views/SchemaView.astro'],
    steps: [
      { label: 'Loading states (missing everywhere)', href: null, caption: 'Every tab is static SSR — no skeleton/spinner for the initial schema read, thread history, or the ER canvas. Once wired to the real engine each tab needs a loading state so it doesn’t flash empty.' },
      { label: 'API / network error (missing everywhere)', href: null, caption: 'No error boundary or error empty-state in any tab (incl. the React canvas). A failed schema fetch currently has nowhere to land — needs one shared "couldn’t load your schema · retry" pattern.' },
      { label: 'Viewer / read-only role gating (missing)', href: null, caption: 'The section is framed "read-only", yet EntityPanel descriptions, Docs, Automations, Interfaces and Relationships all expose write actions with no role check. A viewer should see the data but not the write affordances (hidden or disabled-with-reason), never fail after the click. Needs a capability flag from the host.' },
      { label: 'Distinct out-of-credits (missing)', href: null, caption: 'aiState is 3-valued (ready / locked / no-credits) but every consumer treats "!== ready" as one gate — so no-credits and locked look identical in Visualize AI, Automations, Interfaces and Chat. A Pro+ user out of credits deserves a top-up affordance, not an upgrade wall.' },
      { label: '"No source connected" empty (missing)', href: null, caption: 'Only the never-backed-up empty exists; the spec’s earlier "Connect Airtable to see your schema." → Integrations state (no source at all) is not distinguished — see schema-empty.' },
    ],
    note: 'Discovered via a full edge-case walk of all 9 tabs (2026-07-03). These are shared shells, not feature work — building the loading + error + viewer-gate patterns once covers every tab. Everything here is honest "not built in the mirror"; most need a real backend/capability flag to wire.',
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

  // ── Schema navigation (prototype) ────────────────────────────────────────────
  {
    id: 'schema-nav-grouping',
    name: 'Schema navigation — A/B (historical)',
    feature: 'Schema',
    status: 'discussion',
    blurb:
      'HISTORICAL A/B: the throwaway prototype that decided the nav. Variant A won and is now SHIPPED in the live SchemaView (see schema-nav) — this row is kept only for the decision trail + as the home of the still-open mobile treatment. The Schema section had grown to 9 tabs; two candidate reworks grouped them into 4 clusters (Explore · App layer · Monitor · Knowledge) and pulled Chat out of the row into a persistent launcher. Flip A/B with the floating switcher.',
    specs: [],
    code: ['apps/web/src/views/SchemaView.astro'],
    steps: [
      {
        label: 'Variant A — grouped bar (dividers + labels)',
        href: '/schema-nav?v=a',
        caption:
          'One tab row, thin dividers + quiet cluster labels between the 4 groups (lowest-risk, everything stays visible). Click "Ask about your schema" → the chat opens as a modal drawer; its Expand ⤢ button blows it up to the full 3-column chat page.',
      },
      {
        label: 'Variant B — two-level bar (clusters → sub-tabs)',
        href: '/schema-nav?v=b',
        caption:
          'Top row = 4 clusters, a lighter second row = the selected cluster\'s tabs (scales best as Schema keeps growing). Same chat surface as A: a modal drawer that Expands to full page. Switch A/B with the floating switcher at the bottom.',
      },
    ],
    note: 'RESOLVED + PORTED. Decisions: Oleh 2026-07-02 — keep A + B (drop Neon-pills+More option C), pull Chat out of the tabs, ONE chat surface everywhere (modal drawer that Expands to full page; inset side-panel dropped). Dan CONFIRMED 2026-07-03 — Variant A (groupings = visual labels above the tabs, NOT tabs); keep the global Ask button AND a Chat item under Knowledge that opens the full chat. Variant A was SHIPPED into the live SchemaView 2026-07-03 (commit f0684c0) — see schema-nav. The prototype survives at /schema-nav for the record. STILL OPEN: the fuller mobile treatment (Dan’s "on mobile use the groupings AS tabs" via a media query) — only primitive sideways-scroll shipped. Rationale + competitor evidence: research/schema-navigation/index.html.',
  },

  // ── Data (browse backed-up data — the /data page, iteration-3) ────────────────
  {
    id: 'data-page',
    name: 'Data page — Browse · Record · Changelog · Docs · Export',
    feature: 'Data',
    status: 'built',
    blurb:
      'The /data page: browse records a backup captured, open a record drawer (Schema multi-panel parity), read the changelog between runs, document with @/@@ tagging, and export what you see. All five surfaces shipped in iteration-3.',
    specs: [],
    code: [
      'apps/web/src/views/DataView.astro',
      'apps/web/src/components/data/DataBrowse.astro',
      'apps/web/src/components/data/RecordPanel.astro',
      'apps/web/src/components/data/DataChangelog.astro',
      'apps/web/src/components/schema/SchemaDocs.astro',
      'apps/web/src/components/schema/ExportControl.astro',
    ],
    steps: [
      { label: 'Browse (default)', href: '/data', caption: 'Fully-onboarded: 3 bases · 13 tables. Presets/tabs, filter builder, Record ID column, column reorder, in-table search. Rows-per-page pager (25/50/100, default 50) below the grid — pattern-table-toolbar, same construction as Backups (Oleh 2026-07-23).' },
      { label: 'Empty (never backed up)', href: '/data?fixture=empty', caption: 'No tables → the whole page degrades to "Data appears after your first backup" with a link to /backups.' },
      { label: 'Big table (sample vs. approx)', href: '/data?fixture=big', caption: 'Lands on Events (~1.24M approx rows vs a small shipped sample). Exercises the sample-vs-total honesty band-aids; the pager reads over the loaded sample, not the true 1.24M (a fixture limit, not a product one).' },
      { label: 'Stale backup', href: '/data?fixture=stale', caption: 'Backup older than the schedule → stale banner.' },
      { label: 'Static (files-only Space)', href: '/data?fixture=static', caption: 'Browse→StaticImport, Changelog/Chat locked, Docs live, RecordPanel History locked.' },
    ],
    note: 'Grounded surface map + edge audit done 2026-07-22. Open frictions are tracked as the "Data · edge cases" group below.',
  },

  // ── Data · Comments (spec #7 comments-explorer) ──────────────────────────────
  {
    id: 'data-comments',
    name: 'Comments — the stream, the two absences, and the thread',
    feature: 'Data',
    status: 'built',
    blurb:
      'Every record comment across the Space in one stream. Airtable has no deleted flag, so the surface says exactly as much as the capture can support — and no more.',
    specs: [
      { change: 'comments-explorer', capability: 'comments-explorer', scenario: 'Cross-base comment stream' },
      { change: 'comments-explorer', capability: 'comments-explorer', scenario: 'A comment that left the source' },
      { change: 'comments-explorer', capability: 'comments-explorer', scenario: 'Comments on a record' },
    ],
    code: [
      'apps/web/src/components/data/DataComments.astro',
      'apps/web/src/components/data/commentText.ts',
      'apps/web/src/components/data/recordReadBody.ts',
      'apps/web/src/components/data/RecordPanel.astro',
    ],
    steps: [
      {
        label: '1 · The stream',
        href: '/data?tab=comments',
        caption:
          'Every captured comment across every base, newest first, grouped by day — 540 of them here. It is the SAME row grid as the Schema changelog, not a second stream primitive: Location (base › table) · Record · Author · Comment · Status · Time. Airtable can only list comments per record, so this view exists only because we captured them; there is no Airtable screen that shows this.',
      },
      {
        label: '2 · A readable set',
        href: '/data?tab=comments&fixture=fewcomments',
        caption:
          '24 comments instead of 540 — the state to read the ROWS in, while the default is the state to stress the pager in. Every edge below lives in this fixture.',
      },
      {
        label: '3 · Deleted — a fact we can prove',
        href: '/data?tab=comments&fixture=fewcomments',
        caption:
          'July 5 and July 10 carry a red "Deleted" badge. This is a claim, and we only make it because the founder corrected our mechanics (2026-07-30): a capture fetches a record\'s WHOLE comment list, so a record that came back WITHOUT the comment proves the comment is gone. No diffing pass of our own, no inference. Hover the badge for the sentence that explains why we can say it.',
      },
      {
        label: '4 · Last seen — the limit of what we know',
        href: '/data?tab=comments&fixture=fewcomments',
        caption:
          'July 3, the amber badge: the comment is gone AND so is its record. With nothing to re-read, a deletion and a record that left backup scope are indistinguishable — so the row states an OBSERVATION ("Last seen Jun 23"), not a diagnosis. Deliberately worded and coloured apart from step 3: collapsing the two would trade a fact for a guess. Filter Status → the three values are separable.',
      },
      {
        label: '5 · The normal case wears nothing',
        href: '/data?tab=comments&fixture=fewcomments',
        caption:
          'Note what is NOT on the other 21 rows. An earlier cut marked "In Airtable" on every present comment — 18 identical badges in a 20-row view, 526 in the full fixture. A column that shouts on every row stops being read, and the one row that matters loses its contrast (measured, Oleh 2026-07-29). Only exceptions are marked.',
      },
      {
        label: '6 · A record name that is a sentence',
        href: '/data?tab=comments&fixture=fewcomments',
        caption:
          'July 12–14, the Operations › Tickets rows. A primary field is often the subject line, not "ORD-1000" — up to 158 characters here. It truncates, the row stays exactly 40px (a stream is scannable because every row is the same height), and hovering gives the full text back. The tooltip is attached ONLY to cells that are actually clipped — 23 of 60 — because a tooltip repeating text you can already read teaches people to ignore the ones that do not.',
      },
      {
        label: '7 · A comment whose record we do not hold',
        href: '/data?tab=comments&fixture=fewcomments',
        caption:
          'July 4: the Record column shows an unlink glyph and the raw id, because that record is not in this backup. It is not hidden and not silently dropped — clicking it lands on the record panel\'s own "This record isn\'t in this backup" state rather than doing nothing.',
      },
      {
        label: '8 · WITH an enterprise Airtable account → real names',
        href: '/data?tab=comments&fixture=fewcomments',
        caption:
          'Open this and step 9 side by side — they are the SAME comments, and the only difference is what the customer\'s Airtable plan lets us read. Here Airtable returns a name, so the Author column shows "Priya Nair" with an initials chip. There is never an avatar: Airtable ships no profile picture on a comment, which the API settles rather than taste. Exactly ONE row breaks the pattern — July 13 reads "Airtable user" with no chip — and it is deliberate: a person can be unresolvable even WITH enterprise, because they were removed from the workspace after commenting, or because an automation wrote it rather than a person (Airtable\'s own mention model has an `appAgent` kind). That is a different fact from "this plan does not return names", so it is not collapsed into it. Everything else here has a name; the email-only case is what step 9 is for, and used to be mixed in here until it blurred the very comparison these two steps exist to make.',
      },
      {
        label: '9 · WITHOUT enterprise → email addresses, and no chips',
        href: '/data?tab=comments&fixture=emailcomments',
        caption:
          'The same rows, every name stripped. Founder, 2026-07-30: "we will only get the email of the user and the ID… we would display the email unless it\'s an enterprise Airtable account then we can get the names" — so for most customers THIS is the screen, not step 8. Three things to look at. (1) The address is shown IN FULL and truncates with an ellipsis like every other long value in the row; an earlier cut rendered only the local part (priya.nair@example.com → priya.nair) and was rejected — it hid the domain with no ellipsis to admit it, and in an agency\'s Space the domain says which client a person belongs to. (2) The initials chips are GONE, because "PN" derived from an email invents a first and last name we do not have; the chip\'s absence now carries information instead of decorating over its lack. (3) Nothing else moves — same columns, same 40px rows — because the column was sized for the address rather than for the comfortable name. The Author FACET still lists full addresses either way; shortening was only ever a question about a dense row, and a dropdown has room a row does not.',
      },
      {
        label: '10 · The thread lives in the record',
        href: '/data?tab=comments&fixture=fewcomments',
        caption:
          'Click any "Ada Okoye" row. The record panel opens, scrolls to its Comments section AND highlights the exact comment you came from — the highlight fades, because nothing here is selectable and a permanent mark would read as state. The section is a CONVERSATION, not a feed: oldest first, full text (the stream shows one line), replies indented under their parent. Founder, 2026-07-30: "comments are always tied to a Record, so the Record sidepage should have a comments section, and from the Comments listing table we could deep link to that section/comment".',
      },
    ],
    note:
      'OPEN: retention. The founder settled the MODEL — deleted in Airtable, kept and marked here — but not the LIFETIME. Our backup cleanup is tiered, and a comment lives inside the backups being thinned, so today we mark a deleted comment as worth keeping and then drop it later on a schedule written for record data. Asked 2026-07-30, unanswered. NOT BUILT and deliberately so: the records "with / without comments" filter (its preset membership is unresolved and would break the Save/Discard lock model), reactions (carried in the type, never rendered, nobody has decided they matter), and comment attachments — the founder put those in the media library with a source of Field or Comment, which is spec #8\'s shape, not this one.',
  },

  // ── Data · Changelog enrichment (make it a trust tool, not just a table) ──────
  {
    id: 'data-changelog-enrichment',
    name: 'Changelog — attention column + change-type segmented control',
    feature: 'Data',
    status: 'built',
    blurb: 'Turning the Changelog into a trust tool: the run table has proper columns — Backup run · Synced · Attention (a "Mass delete" / "Import spike" flag on unusual runs) · Created · Updated · Deleted — and each run drill leads with a big full-width Created/Updated/Deleted segmented control.',
    specs: [],
    code: ['apps/web/src/components/data/DataChangelog.astro'],
    steps: [
      { label: 'Attention column', href: '/data', caption: 'Changelog: a dedicated Attention column flags unusual runs — a red "Mass delete" or amber "Import spike" badge, computed from the true per-run totals. Reference: ProBackup proactive-alerts.' },
      { label: 'Columnar run table', href: '/data', caption: 'Backup run (day + id) · Synced (time) · Attention · Created · Updated · Deleted — clean columns instead of everything crammed by the date.' },
      { label: 'Change-type segmented control', href: '/data', caption: 'Open a run → the Created / Updated / Deleted tabs are a big full-width segmented control below the header (lifted out of it).' },
      { label: 'Search within a backup', href: '/data', caption: 'The run drill has a search box under the segmented control that filters this backup\'s records by name / table.' },
      { label: 'Run-list pager', href: '/data', caption: 'The run table (below the list, was unpaginated/scrolling) now carries the same pager as Backups / the record grid — rows-per-page select (10/20/50, default 20) + range/total + prev/next. Filters and search reset it to page 1.' },
      { label: 'Run-drill pager reconciled', href: '/data', caption: 'Open a run → the record list\'s pager was a bespoke centred "page N of M" with a hardcoded 50/page and no rows control; it now matches the same construction — rows-per-page select (25/50/100, default 25) + range/total + square-ghost prev/next. Page size is a shared preference across every open panel; each panel\'s own page position stays independent.' },
    ],
    note: 'SHIPPED 2026-07-22: A (attention flags in their own column) + a column restructure (Synced/Attention split out) + the drill change-type tabs promoted to a big full-width segmented control. REMOVED per Oleh feedback: B (a trend strip over the table — disliked; TrendChart/storybook reverted) and the C2 in-drill breakdown (its summary just duplicated the segment control). NO "Who" column — snapshot-diff backups have no actor (anti-fabrication; ties to open A1). Refs: Fibery/Basecamp/ProBackup. See [[data-changelog-enrichment-2026-07-22]]. Pager standardization (Oleh 2026-07-23): run list gained a pager (was unpaginated); the drill\'s bespoke pager was reconciled onto the shared pattern-table-toolbar construction (own rows-per-page control, own preference key `dcp-pagesize`).',
  },

  // ── Data · Changelog run drill → record: back-navigation fix ──────────────────
  {
    id: 'data-changelog-record-back',
    name: 'Changelog record drill — back to the run drawer',
    feature: 'Data',
    status: 'built',
    blurb: 'Clicking a record row inside a Changelog run drill opened the RecordPanel drawer (z-62) directly over the run drawer it came from (z-60), same width, both right:0 — the user lost the changelog. The record drawer now carries an `origin` back-link: its Back arrow (previously hidden with nothing to pop) reads "Back to the changelog" and exits to the run drawer once the record\'s own drill stack is exhausted. A record row also grew an explicit ⧉ "open beside" affordance (⌘/Ctrl-click and middle-click already worked) so the run drawer and the record can be compared side by side.',
    specs: [],
    code: ['apps/web/src/components/data/DataChangelog.astro', 'apps/web/src/components/data/RecordPanel.astro'],
    steps: [
      { label: 'Plain click → Back to the changelog', href: '/data', caption: 'Changelog tab → open a run → click a record row. RecordPanel opens on top; its Back arrow (bottom tooltip) now reads "Back to the changelog" and, clicked, closes the record panel back to the run drawer instead of hiding.' },
      { label: '⌘/Ctrl-click / middle-click / hover ⧉ → open beside', href: '/data', caption: 'From the same run drill, ⌘/Ctrl-click, middle-click, or the row-hover ⧉ button all open the record in a SECOND coplanar panel beside the run drawer — same 3 entry points as the run-row list.' },
      { label: 'No back arrow from Browse', href: '/data', caption: 'Browse tab → click a grid row to open a record directly (no changelog origin). The Back arrow stays hidden — RecordPanel\'s own stack has nothing to pop and no `origin` was carried, matching the pre-existing behavior exactly.' },
    ],
    note: 'panelStack.ts (the shared stacking controller) is untouched — the whole fix goes through its existing open()/openBeside() `init` callback param, which runs on every open (reused-panel or fresh), unlike loadInto (fresh panels only). Esc mirrors the Back button\'s origin-exit (silent, no "Panel closed" toast) so keyboard and mouse agree.',
  },

  // ── Data · edge cases (my-edge audit 2026-07-22 — the to-do list) ─────────────
  {
    id: 'data-edge-dangling-record',
    name: 'Dangling record reference opens nothing',
    feature: 'Data · edge cases',
    status: 'built',
    blurb: 'A Changelog run row or a Docs record-chip can point at a record id not in the shipped sample; clicking now surfaces an honest toast instead of silently no-opping.',
    specs: [],
    code: ['apps/web/src/components/data/RecordPanel.astro', 'apps/design/src/fixtures/data-lab.ts'],
    steps: [
      { label: 'See it', href: '/data', caption: 'Changelog → open the Jul 14 run → Deleted tab → click the recDELETED404 row → toast "This record isn\'t in this backup." appears; no panel opens.' },
    ],
    note: '✅ FIXED 2026-07-22. RecordPanel.open() + openBeside() now surface the existing pattern-undo-toast (showToast, info variant) on an unknown id instead of a silent early-return — one funnel covers all entry points (all dispatch data:openRecord). Fixture dc-dangling in data-lab.ts makes it demonstrable. 0 new bespoke UI; ds-lint + typecheck green; Playwright-verified.',
  },
  {
    id: 'data-edge-export-bigtable-count',
    name: 'Big-table export reports ~50, not the real total',
    feature: 'Data · edge cases',
    status: 'built',
    blurb: 'Browse "This tab" export now reports the true logical row count — the approx table size when unfiltered, the full match count when filtered — instead of the ~50-row DOM window, so a big table trips the heavy "Request full export" path.',
    specs: [],
    code: ['apps/web/src/components/schema/ExportControl.astro', 'apps/web/src/components/data/DataBrowse.astro'],
    steps: [
      { label: 'See it', href: '/data?fixture=big', caption: 'Open Export on a big unfiltered table → label reads "Request full export" with the real count (e.g. 61,240 / ~1.24M), not "Export 50 records".' },
    ],
    note: '✅ FIXED 2026-07-22. DataBrowse.renderBody publishes filtering ? rows.length : t.approx to the export control via data-export-livecount + a data:splitchange recount; ExportControl.currentCount prefers that published count over the DOM window. Shared-safe: tabs that don\'t set the attribute keep the old behavior. ds-lint + typecheck green; Playwright: unfiltered big table → "Request full export" (live=61240), filtered→0 → disabled.',
  },
  {
    id: 'data-edge-linked-synth-rows',
    name: 'Fabricated linked rows are not clickable',
    feature: 'Data · edge cases',
    status: 'built',
    blurb: 'Past the sampled ids, synthesized linked rows are now muted + visibly inert, with an honest note that they are shown for scale — no more dead clicks. The real sampled rows stay clickable.',
    specs: [],
    code: ['apps/web/src/components/data/RecordPanel.astro'],
    steps: [
      { label: 'See it', href: '/data', caption: 'Open the Contacts flagship record → Linked orders → Load more past the 12 samples: placeholder rows are dimmed and inert; a note reads "Beyond the first 12, linked records are shown for scale and can\'t be opened in this preview."' },
    ],
    note: '✅ FIXED 2026-07-22. Synthesized rows get .rp-provrow-ph (muted 40%, cursor default, no data-rp-open); a .rp-linknote appears ONLY when total > sample (so production with full data never shows it). Playwright: total=2340, 12 real clickable, 188 placeholders inert, note visible. ds-lint + typecheck green.',
  },
  {
    id: 'data-edge-table-switch-wipes-view',
    name: 'In-place table switching is forbidden on a saved preset',
    feature: 'Data · edge cases',
    status: 'built',
    blurb: 'Superseded by the client\'s Save/Discard/lock/Draft model (Dan 2026-07-23): a Preset\'s Base + Table LOCK the moment it is first saved — the picker renders disabled with a lock glyph + tooltip reason, so there is no silent switch left to wipe anything. To use another table: ＋ New blank preset or Duplicate current, both of which arrive as an UNSAVED Draft with its scope open. Part 2 (2026-07-23): the whole model now survives a reload — a Draft stays a Draft with its edits intact, a saved preset keeps whatever Save last wrote (even if that overwrote the fixture), and any unsaved edits on top of a save reappear as dirty rather than silently vanishing.',
    specs: [],
    code: ['apps/web/src/components/data/DataBrowse.astro', 'apps/web/src/components/schema/FacetFilter.astro'],
    steps: [
      { label: 'See it', href: '/data', caption: 'Every seeded preset opens saved → Base/Table show locked (disabled + lock icon); hover for "Locked — this preset is saved…". Use the tab-bar "+" → New blank preset → the same pickers unlock so you can pick a table before the first Save.' },
      { label: 'Reload — survives intact', href: '/data', caption: '＋ New blank preset, set some filters, do NOT save → refresh the page: the Draft, its open tab, and its filters are all still there. Edit a saved preset without saving → refresh: it reopens dirty with the same unsaved edit and Discard still returns to the real saved baseline. Save an edit → refresh: the new baseline sticks, not the fixture\'s original one.' },
    ],
    note: '✅ REWORKED 2026-07-23 for the stricter model (was: Option A auto-repoint to a per-table preset, built 2026-07-22). switchToTable() is deleted; repointDraftTable() only ever runs against a Draft (saved:false) and resets the table-bound config (filterTree/sort/hiddenCols/colOrder) since they cannot survive a table change — a saved preset never reaches it, the facetchange handler returns early. FacetFilter gained disabled/lockReason props + a `facetlock` event so the SAME trigger can lock/unlock live as the active preset changes. Part 2 (2026-07-23): persistState() (localStorage key `dg-presets-v2`) is now the single writer, called from renderViews() after every mutating action — it persists openIds/activeId + per-fixture-preset `saved`/`edits` overrides + full-state `drafts` for runtime-only presets, with fieldId-based (not Field-object) filter-tree serialization so a stale field is dropped without flattening a nested group. See DataBrowse.astro\'s "PERSISTENCE BLOCK" comment. ds-lint + typecheck green.',
  },
  {
    id: 'data-edge-empty-vs-filtered',
    name: 'Truly-empty table shows the wrong empty copy',
    feature: 'Data · edge cases',
    status: 'built',
    blurb: 'A table with zero records now shows "This table has no records in this backup." (database icon, no Clear button); a filter that matched nothing keeps "No records match your filters." (search-x icon + Clear).',
    specs: [],
    code: ['apps/web/src/components/data/DataBrowse.astro', 'apps/design/src/fixtures/data-lab.ts'],
    steps: [
      { label: 'See it', href: '/data', caption: 'Open the tab-bar "+" → New blank preset (its scope opens unlocked) → pick base Operations, table Archive (0 records) → the true-empty copy shows. Apply a no-match filter on any table → the filtered-empty copy shows instead.' },
    ],
    note: '✅ FIXED 2026-07-22; "See it" step re-routed 2026-07-23 — the old caption ("Switch base to Operations → table to Archive") is impossible once a saved preset\'s scope locks, so it now goes through ＋ New blank preset instead. renderBody swaps the empty state\'s icon + message on `filtering`; the Clear button is already gated by the toolbar rule. Fixture: new tblArchive (approxRecordCount 0) + record-gen respects 0 (Array length t.approx===0?0:60). ds-lint + typecheck green.',
  },
  {
    id: 'data-edge-loading-error-states',
    name: 'Loading skeleton + load error/retry on the Browse grid',
    feature: 'Data · edge cases',
    status: 'built',
    blurb: 'The Browse grid now has a loading skeleton and a load-error state with an in-context Retry — the states production needs when it streams row windows over a cursor. Preview them via ?fixture=loading and ?fixture=error.',
    specs: [],
    code: ['apps/web/src/components/data/DataBrowse.astro', 'apps/web/src/views/DataView.astro', 'apps/design/src/pages/data.astro'],
    steps: [
      { label: 'Loading skeleton', href: '/data?fixture=loading', caption: 'The grid area shows daisyUI skeleton rows while a row-window fetch is in flight; the shell stays live.' },
      { label: 'Load error + Retry', href: '/data?fixture=error', caption: 'A failed fetch shows "Couldn\'t load records." with a Retry button that recovers to the real grid.' },
    ],
    note: '✅ BUILT 2026-07-22 as Option A (Oleh, Browse only). loadState prop (ready|loading|error) threaded data.astro→DataView→DataBrowse; applyLoadState() toggles a skeleton (catalog `skeleton`) / error block (centered, Retry btn) and hides the count while busy. Retry → renderGrid recovers. Playwright: loading (32 skel bars, grid hidden), error (message+Retry→46 rows), default (ready, no regression). ds-lint + typecheck green; screenshots reviewed. Changelog/RecordPanel can reuse this pattern later if desired.',
  },
  {
    id: 'data-edge-changelog-filter-shrink',
    name: 'Filtering a run collapses its numbers',
    feature: 'Data · edge cases',
    status: 'built',
    blurb: 'When a base/table/search filter makes the counts fall back to the sampled entries, an honest note explains it — so the drop from the true totals no longer reads as a bug.',
    specs: [],
    code: ['apps/web/src/components/data/DataChangelog.astro'],
    steps: [
      { label: 'See it', href: '/data', caption: 'Changelog → search or filter by a table → the counts shrink to the sample AND a note appears: "While filtered, counts reflect the sampled changes, not the full run totals." Clear → note gone, true totals return.' },
    ],
    note: '✅ BUILT 2026-07-22 as Option B (Oleh). apply() flags sampledShrink when a base/table/search filter is active AND a visible run\'s true total > its shipped sample; a .dc-samplenote then explains it. Self-gating: production ships full entries (no shrink) so the note never shows. Playwright: unfiltered 2,340 / no note → filtered 133 / note → cleared 2,340 / no note. ds-lint + typecheck green.',
  },
  {
    id: 'data-edge-docs-export-scope',
    name: 'Docs export scope: open doc vs all docs',
    feature: 'Data · edge cases',
    status: 'built',
    blurb: 'Docs export offers "This document" (default, the open doc) or "All documents" (zip of PDFs, when >1). Reviewed on the deployed preview and accepted.',
    specs: [],
    code: ['apps/web/src/components/schema/SchemaDocs.astro'],
    steps: [
      { label: 'See it', href: '/data', caption: 'Docs tab → Export → choose "This document" or "All documents". The control sits on the document bar, tied to the open doc.' },
    ],
    note: '✅ RESOLVED 2026-07-22. The split scope was already built (EXPORT-2); the only open item was Dan\'s blessing on the default (open document) + placement (document bar). Oleh deployed it and Dan reviewed without objection — accepted. Stale "Dan has not answered" code comment updated.',
  },
  {
    id: 'data-edge-timefilter-now',
    name: 'Changelog Time filter drifts with the wall clock',
    feature: 'Data · edge cases',
    status: 'built',
    blurb: 'The Time filter now measures "last N days" from the backup\'s as-of timestamp (an optional `now` prop) rather than the live clock, so a fixed-date preview stays stable — and production anchors to the data, not the wall clock.',
    specs: [],
    code: ['apps/web/src/components/data/DataChangelog.astro', 'apps/web/src/views/DataView.astro'],
    steps: [
      { label: 'See it', href: '/data', caption: 'Changelog → Time → 7 days: measured from the last sync (Jul 14 in the fixture), stable regardless of today\'s date.' },
    ],
    note: '✅ FIXED 2026-07-22. DataChangelog gained an optional `now` prop (defaults to Date.now()); DataView passes lastSyncedAt. Snapshot carries nowMs; the filter uses NOW = snap.nowMs ?? Date.now(). Production unchanged (real recent sync ≈ now). Playwright: nowMs=Jul14 anchor; Time=7 keeps the Jul 14 run visible (Date.now() would have hidden it, 8>7). ds-lint + typecheck green.',
  },
  {
    id: 'data-edge-valuesasof-partial',
    name: 'Time-travel restores only "updated" diffs',
    feature: 'Data · edge cases',
    status: 'built',
    blurb: 'Not a defect after review: "view as of" is bounded to the record\'s own history (creation onward), all field changes are captured as updated diffs (which are reverted), and created/deleted show honest tombstone rows. Reconstruction is correct for every selectable run.',
    specs: [],
    code: ['apps/web/src/components/data/RecordPanel.astro'],
    steps: [
      { label: 'See it', href: '/data', caption: 'Open a record → History → "view as of" any run: field values reconstruct correctly; created = "First captured", deleted = "Record removed from this backup".' },
    ],
    note: '✅ ACCEPTED / no change needed 2026-07-22 (Oleh). The as-of selector only offers runs from the record\'s history, so a pre-creation run is unreachable (no misleading values); field changes are all updated diffs (reverted); created/deleted are honest tombstones. The only uncovered case is exotic delete-then-recreate, which the fixture doesn\'t have and V1 doesn\'t need — building it would require fabricated data.',
  },
];
