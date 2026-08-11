// Shared config for the Integrations prototype panel (ScenarioSwitcher).
// One source of truth so the same Flow + page index renders on every
// integration route (overview, configure, authorizing).

export interface ScreenItem {
  label: string;
  path: string;
  fixture?: string;
  status?: string;
  reason?: string;
  first?: boolean;   // → ?first=1 (configure setup mode)
  static?: boolean;  // → ?static=1 (authorizing loader without auto-redirect)
  desc?: string;
}
export interface ScreenPage { label: string; items: ScreenItem[]; }

export const INTEGRATION_FLOW = {
  blurb: "Walk a new user's first-time setup, end to end. Click the primary button on each screen.",
  steps: ['Connect Airtable', 'Authorize', 'Set up the backup', 'Save & run first backup', 'Connected — running'],
  startHref: '/integrations?fixture=empty',
};

export const INTEGRATION_PAGES: ScreenPage[] = [
  {
    label: '1 · Overview',
    items: [
      { label: 'Empty', path: '/integrations', fixture: 'empty', desc: 'No Airtable connection yet — a focused Connect card with the read-only access promise. (spec: No connection yet)' },
      { label: 'Connect error', path: '/integrations', fixture: 'empty', status: 'error', reason: 'access_denied', desc: 'A connect attempt failed (e.g. access declined). The Connect card shows the reason inline and lets the user retry. (spec: Connection fails)' },
      { label: 'Protected', path: '/integrations', desc: 'Returning visit: connected and protected — a calm status summary with configuration behind Configure. (spec: Protected and settled)' },
      { label: 'Setup running', path: '/integrations', status: 'running', desc: 'Final after first-time setup: connected and the first backup is running. (spec: First backup running confirmation)' },
      { label: 'Refreshing', path: '/integrations', fixture: 'refreshing', desc: 'Connection briefly refreshing its tokens — transient amber badge, backups keep working. (spec: Refreshing tokens)' },
      { label: 'Reconnect required', path: '/integrations', fixture: 'reauth', desc: 'pending_reauth — amber, backups paused, Reconnect is primary. (spec: Reconnect required)' },
      { label: 'Disconnected', path: '/integrations', fixture: 'invalid', desc: 'invalid — red, backups will not run until reconnected. (spec: Disconnected)' },
      { label: 'Not configured', path: '/integrations', fixture: 'setup', desc: 'EDGE: connected but no bases selected. Prompts to finish setup. (spec: Connected but not configured)' },
      { label: 'No bases', path: '/integrations', fixture: 'nobases', desc: 'EDGE: zero bases selected — not protected. (spec: No bases selected)' },
      { label: 'At base cap', path: '/integrations', fixture: 'capped', desc: 'EDGE: at the plan base limit. Fully manifests on the Configure route. (spec: Tier limit)' },
    ],
  },
  {
    label: '2 · Configure',
    items: [
      { label: 'First-time setup', path: '/integrations/configure', first: true, desc: '"Set up your Airtable backup" — footer is "Save & run first backup" → loader → running final.' },
      { label: 'Configured', path: '/integrations/configure', desc: 'Returning edit mode — footer is "Save changes" → back to the overview.' },
      { label: 'No bases', path: '/integrations/configure', fixture: 'nobases', desc: 'Configure with zero bases selected — warns and blocks the first backup until one is chosen.' },
      { label: 'At base cap', path: '/integrations/configure', fixture: 'capped', desc: 'Configure at the plan limit — extra bases blocked with an upgrade affordance.' },
      { label: 'Auto-add demo', path: '/integrations/configure/bases', fixture: 'fits', desc: 'Manage bases with fewer bases than the plan cap (8 of 10). "Select all" is reachable, so the "Automatically back up new bases" toggle appears above the table; clear the selection and it hides again.' },
    ],
  },
  {
    label: '3 · Loader',
    items: [
      { label: 'Authorizing', path: '/integrations/authorizing', static: true, desc: 'The interstitial shown after Connect, while returning from Airtable auth. In the flow it auto-advances; here it is held static for preview.' },
    ],
  },
];
