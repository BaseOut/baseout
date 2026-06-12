import type { IntegrationsState } from '@web/stores/connections';

export const FIXTURE_INTEGRATIONS_STATE: IntegrationsState = {
  connections: [
    {
      id: 'conn_design_airtable',
      platformSlug: 'airtable',
      platformName: 'Airtable',
      status: 'active',
      displayName: 'Demo Airtable Workspace',
      airtableUserId: 'usrDESIGN0000000',
      isEnterprise: false,
      basesCount: 3,
      createdAt: '2026-04-15T14:22:00.000Z',
    },
  ],
  bases: [
    {
      id: 'base_design_marketing',
      atBaseId: 'appMarketing00001',
      name: 'Marketing Calendar',
      isIncluded: true,
    },
    {
      id: 'base_design_ops',
      atBaseId: 'appOps000000002',
      name: 'Operations Pipeline',
      isIncluded: true,
    },
    {
      id: 'base_design_archive',
      atBaseId: 'appArchive00003',
      name: '2025 Archive',
      isIncluded: false,
    },
  ],
  tierBasesPerSpace: 25,
  availableFrequencies: ['monthly', 'weekly', 'daily', 'instant'] as const,
  hasBackupConfig: true,
  policy: {
    frequency: 'daily',
    storageType: 'byos_google_drive',
    nextScheduledAt: new Date(
      new Date('2026-06-04T09:00:00.000Z').getTime() + 6 * 60 * 60 * 1000,
    ).toISOString(),
    autoAddFutureBases: false,
  },
  storageDestination: {
    type: 'google_drive',
    accountEmail: 'ops@demo.co',
    connectedAt: '2026-04-15T14:25:00.000Z',
  },
  unreadEvents: [
    {
      id: 'evt_design_bases_discovered',
      kind: 'bases_discovered',
      createdAt: '2026-06-03T18:14:00.000Z',
      payload: {
        discovered: ['app2025Archive003', 'app2025Brand0004'],
        autoAdded: [],
        blockedByTier: [],
        tierCap: 25,
      },
    },
  ],
};

export const FIXTURE_INTEGRATIONS_STATE_EMPTY: IntegrationsState = {
  connections: [],
  bases: [],
  tierBasesPerSpace: 25,
  availableFrequencies: ['monthly', 'weekly', 'daily', 'instant'] as const,
  hasBackupConfig: false,
  policy: {
    frequency: 'monthly',
    storageType: 'r2_managed',
    nextScheduledAt: null,
    autoAddFutureBases: false,
  },
  storageDestination: null,
  unreadEvents: [],
};

// ── Preview-only state variants (design harness; never shipped to prod) ──
// Added to visualize states the base fixtures hardcode away, so the UX state
// inventory can be reviewed against real renders. Reachable via ?fixture=.
const AIRTABLE_CONN = FIXTURE_INTEGRATIONS_STATE.connections[0];

// Connection needs re-auth (Mode 3 recovery): amber "Reconnect required" alert.
export const FIXTURE_INTEGRATIONS_STATE_REAUTH: IntegrationsState = {
  ...FIXTURE_INTEGRATIONS_STATE,
  connections: [{ ...AIRTABLE_CONN, status: 'pending_reauth' }],
  unreadEvents: [],
};

// Connection broken (Mode 3 recovery): red "Disconnected" alert.
export const FIXTURE_INTEGRATIONS_STATE_INVALID: IntegrationsState = {
  ...FIXTURE_INTEGRATIONS_STATE,
  connections: [{ ...AIRTABLE_CONN, status: 'invalid' }],
  unreadEvents: [],
};

// Connection briefly refreshing its tokens (transient): amber "Refreshing" badge,
// backups keep working — protected summary unchanged.
export const FIXTURE_INTEGRATIONS_STATE_REFRESHING: IntegrationsState = {
  ...FIXTURE_INTEGRATIONS_STATE,
  connections: [{ ...AIRTABLE_CONN, status: 'refreshing' }],
  unreadEvents: [],
};

// Connected but zero bases (edge: nothing to protect yet).
export const FIXTURE_INTEGRATIONS_STATE_NOBASES: IntegrationsState = {
  ...FIXTURE_INTEGRATIONS_STATE,
  connections: [{ ...AIRTABLE_CONN, basesCount: 0 }],
  bases: [],
  unreadEvents: [],
};

// Just connected, not yet configured — what the Connect button lands on. Bases
// discovered but none selected, no schedule/history yet → drives the setup flow
// (v3 wizard auto-opens, v2 config auto-expands).
export const FIXTURE_INTEGRATIONS_STATE_SETUP: IntegrationsState = {
  ...FIXTURE_INTEGRATIONS_STATE,
  bases: FIXTURE_INTEGRATIONS_STATE.bases.map((b) => ({ ...b, isIncluded: false })),
  hasBackupConfig: false,
  policy: { ...FIXTURE_INTEGRATIONS_STATE.policy, nextScheduledAt: null },
  unreadEvents: [],
};

// Tier-capped: low limit, more bases than allowed, discovery banner with blocked bases.
export const FIXTURE_INTEGRATIONS_STATE_CAPPED: IntegrationsState = {
  ...FIXTURE_INTEGRATIONS_STATE,
  tierBasesPerSpace: 2,
  connections: [{ ...AIRTABLE_CONN, basesCount: 5 }],
  bases: [
    { id: 'base_design_marketing', atBaseId: 'appMarketing00001', name: 'Marketing Calendar', isIncluded: true },
    { id: 'base_design_ops', atBaseId: 'appOps000000002', name: 'Operations Pipeline', isIncluded: true },
    { id: 'base_design_sales', atBaseId: 'appSales00000003', name: 'Sales CRM', isIncluded: false },
    { id: 'base_design_archive', atBaseId: 'appArchive00004', name: '2025 Archive', isIncluded: false },
    { id: 'base_design_brand', atBaseId: 'appBrand00000005', name: 'Brand Assets', isIncluded: false },
  ],
  unreadEvents: [
    {
      id: 'evt_capped_discovered',
      kind: 'bases_discovered',
      createdAt: '2026-06-03T18:14:00.000Z',
      payload: {
        discovered: ['appSales00000003', 'appArchive00004', 'appBrand00000005'],
        autoAdded: [],
        blockedByTier: ['appSales00000003', 'appArchive00004', 'appBrand00000005'],
        tierCap: 2,
      },
    },
  ],
};

// Happy-path first-time setup with MANY bases over the cap — drives the
// cap-first picker (search · select-all-up-to-limit · show-selected · mode
// toggle). Persona: an ops team whose whole company lives in Airtable.
// cap 10, nothing included yet.
const MANY_BASE_NAMES = [
  'Marketing Calendar', 'Sales CRM', 'Customer Success', 'Product Roadmap',
  'Engineering Bugs', 'Support Tickets', 'Content Library', 'Inventory',
  'Vendors & Suppliers', 'Recruiting Pipeline', 'Employee Directory', 'Time Off Requests',
  'Expense Reports', 'Budget 2026', 'OKRs & Goals', 'Partnerships',
  'Press & PR', 'Event Planning', 'Design Assets', 'Contracts',
  'Client Onboarding', 'Office Inventory', 'Q1 Campaigns', '2025 Archive',
  'Feature Requests', 'Release Notes', 'QA Test Runs', 'Incident Log',
  'Customer Feedback', 'NPS Surveys', 'Sales Leads', 'Deal Pipeline',
  'Invoices', 'Purchase Orders', 'Asset Register', 'Brand Guidelines',
  'Social Calendar', 'Blog Posts', 'SEO Keywords', 'Webinars',
  'Partner CRM', 'Legal Documents', 'Compliance Tracker', 'Onboarding Tasks',
  'Team Directory', 'Meeting Notes', 'Product Analytics', 'Roadmap Q2',
  'Support Macros', 'Knowledge Base',
];

export const FIXTURE_INTEGRATIONS_STATE_SETUP_MANY: IntegrationsState = {
  ...FIXTURE_INTEGRATIONS_STATE,
  connections: [{ ...AIRTABLE_CONN, basesCount: MANY_BASE_NAMES.length }],
  bases: MANY_BASE_NAMES.map((name, i) => ({
    id: `base_many_${i}`,
    atBaseId: `appMany${String(i).padStart(8, '0')}`,
    name,
    isIncluded: false,
  })),
  tierBasesPerSpace: 10,
  hasBackupConfig: false,
  policy: {
    ...FIXTURE_INTEGRATIONS_STATE.policy,
    storageType: 'r2_managed',
    nextScheduledAt: null,
    autoAddFutureBases: false,
  },
  storageDestination: null,
  unreadEvents: [],
};

// First-time setup where the account has FEWER bases than the plan cap (8 of 10).
// This is the only case where "Select all" is actually reachable, and the
// auto-add-future-bases toggle shows ONLY when every base is selected. Use this
// fixture to preview/click that toggle (with the many-bases fixture, cap 10 < 24,
// "all selected" is impossible, so the toggle correctly never appears).
export const FIXTURE_INTEGRATIONS_STATE_SETUP_FITS: IntegrationsState = {
  ...FIXTURE_INTEGRATIONS_STATE,
  connections: [{ ...AIRTABLE_CONN, basesCount: 8 }],
  bases: MANY_BASE_NAMES.slice(0, 8).map((name, i) => ({
    id: `base_fits_${i}`,
    atBaseId: `appFits${String(i).padStart(8, '0')}`,
    name,
    isIncluded: false,
  })),
  tierBasesPerSpace: 10,
  hasBackupConfig: false,
  policy: {
    ...FIXTURE_INTEGRATIONS_STATE.policy,
    storageType: 'r2_managed',
    nextScheduledAt: null,
    autoAddFutureBases: false,
  },
  storageDestination: null,
  unreadEvents: [],
};
