export const registryColumns = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'count', label: 'Spaces', align: 'right' as const },
];

export const registryRows = [
  { href: '/sources/detail', cells: { name: 'Airtable production', type: 'OAuth', status: 'Connected', count: '3' } },
  { href: '/sources/detail', cells: { name: 'Airtable sandbox', type: 'PAT', status: 'Reconnect', count: '1' } },
];

export const backupPipelineFixture = {
  source: { label: 'Airtable', detail: 'ops@example.com', status: 'Connected', tone: 'success' as const },
  bases: { label: '3 bases', detail: 'schema + data + attachments', status: 'Active', tone: 'primary' as const },
  destination: { label: 'Google Drive', detail: '/Baseout/Backups', status: 'Connected', tone: 'success' as const },
};

export const definitionItems = [
  { term: 'Authorized as', description: 'ops@example.com (OAuth)' },
  { term: 'Bases available', description: '4 bases this connection can see' },
  { term: 'Status checked', description: '2 minutes ago' },
];

export const metaBlockItems = [
  { label: 'Records', value: '12,407' },
  { label: 'Attachments', value: '218', tone: 'success' as const },
  { label: 'Duration', value: '7m' },
];

export const setupSteps = [
  { label: 'Source', status: 'complete' as const },
  { label: 'Destination', status: 'current' as const },
  { label: 'Bases', status: 'upcoming' as const },
  { label: 'Depth', status: 'upcoming' as const },
  { label: 'Schedule', status: 'upcoming' as const },
];

export const connectorRowFixture = {
  name: 'Google Drive',
  description: 'Managed file storage for backup CSVs and attachments.',
  icon: 'lucide--folder',
  statusLabel: 'Connected',
  statusVariant: 'success' as const,
  checked: true,
};

export const entityHeaderFixture = {
  title: 'Airtable production',
  description: 'Airtable · OAuth · ops@example.com · added Mar 12',
  backHref: '/sources',
  backLabel: 'Back to sources',
  statusLabel: 'Reconnect required',
  statusVariant: 'warning' as const,
};

export const spacePipelineFixture = {
  spaceName: 'Operations',
};

export const runBackupButtonFixture = {
  spaceId: '00000000-0000-4000-8000-000000000001',
  connectionStatus: 'active' as const,
};

export const frequencyPickerFixture = {
  spaceId: '00000000-0000-4000-8000-000000000001',
  selectedFrequency: 'weekly' as const,
  availableFrequencies: ['monthly', 'weekly'] as const,
};

export const storagePickerFixture = {
  spaceId: '00000000-0000-4000-8000-000000000001',
  selectedStorageType: 'r2_managed',
  connectedType: null,
  connectedAccountEmail: null,
};

export const baseSelectionFixture = {
  bases: [
    { id: 'base-1', name: 'Marketing', isIncluded: true },
    { id: 'base-2', name: 'Sales CRM', isIncluded: false },
    { id: 'base-3', name: 'Product roadmap', isIncluded: true },
  ],
  cap: 5,
  spaceId: '00000000-0000-4000-8000-000000000001',
  embedded: true,
  autoAdd: false,
};

export const backupHistoryFixture = {
  spaceId: '00000000-0000-4000-8000-000000000001',
  runs: [
    {
      id: 'run-1',
      status: 'succeeded',
      isTrial: false,
      triggeredBy: 'manual',
      recordCount: 12407,
      tableCount: 18,
      attachmentCount: 218,
      startedAt: '2026-06-18T14:30:00.000Z',
      completedAt: '2026-06-18T14:37:00.000Z',
      errorMessage: null,
      triggerRunIds: ['tr-1'],
      createdAt: '2026-06-18T14:30:00.000Z',
      connection: { id: 'conn-1', displayName: 'Airtable production' },
      configuration: { storageType: 'r2_managed', mode: 'full' },
      includedBases: [{ name: 'Marketing' }, { name: 'Sales CRM' }],
    },
  ],
};

export const createSpaceModalFixture = {};

// The topbar lost its bell to the sidebar Inbox trigger (pattern-inbox) — it
// takes no props now.
export const appShellHeaderFixture = {};

export const appShellSidebarFixture = {
  currentSpace: 'Operations',
  spaces: [
    { id: '00000000-0000-4000-8000-000000000001', name: 'Operations' },
    { id: '00000000-0000-4000-8000-000000000002', name: 'Sandbox' },
  ],
  user: { name: 'Alex Morgan', email: 'alex@example.com', role: 'owner' },
  organization: { id: 'org-1', name: 'Acme Corp', slug: 'acme' },
};

// ConnectionHealthBanner / ConnectionHealthPill — props are plain objects so the
// shared catalog stays import-free (it's read from both apps). `state` strings
// match ConnectionBannerState in components/patterns/connection-health-banner.ts.
export const connectionHealthBannerFixture = {
  state: 'broken',
  provider: 'Airtable',
  side: 'source',
  lastBackup: '2 days ago',
  reconnectHref: '/sources',
};

export const connectionHealthPillFixture = connectionHealthBannerFixture;

export const connectionHealthStates = [
  { key: 'broken', label: 'Broken · source', props: connectionHealthBannerFixture },
  { key: 'broken-dest', label: 'Broken · destination', props: { state: 'broken', provider: 'Google Drive', side: 'destination', reconnectHref: '/destinations' } },
  { key: 'multiple', label: 'Multiple broken', props: { state: 'broken', count: 3, names: ['Airtable', 'Google Drive', 'Dropbox'], reconnectHref: '/sources' } },
  { key: 'expiring', label: 'Expiring soon', props: { state: 'expiring', provider: 'Google Drive', daysToExpiry: 5, reconnectHref: '/destinations' } },
  { key: 'degraded', label: 'Degraded', props: { state: 'degraded', provider: 'Airtable', reconnectHref: '/sources' } },
  { key: 'reconnecting', label: 'Reconnecting', props: { state: 'reconnecting', provider: 'Airtable' } },
  { key: 'restored', label: 'Restored', props: { state: 'restored' } },
];

// ExportControl (pattern-export-control) — one export affordance per Schema tab.
// Variants cover the story matrix: csv vs pdf, small vs heavy (total > heavyAbove),
// with vs without a rowSelector (no rows ⇒ current view === everything).
export const exportControlFixture = {
  tab: 'browse',
  format: 'csv',
  noun: 'entities',
  total: 108,
  rowSelector: '.br-row',
  space: 'Core CRM',
};

export const exportControlVariants = [
  { key: 'csv', label: 'CSV · small', props: exportControlFixture },
  { key: 'pdf', label: 'PDF · no rows', props: { tab: 'health', format: 'pdf', noun: 'bases', total: 3, space: 'Core CRM' } },
  { key: 'heavy', label: 'CSV · heavy (async degrade)', props: { tab: 'changelog', format: 'csv', noun: 'changes', total: 1200, rowSelector: '[data-cl-open]', space: 'Core CRM' } },
  { key: 'image', label: 'Image · diagram', props: { tab: 'visualize', format: 'image', noun: 'diagram', total: 1, space: 'Core CRM' } },
];

// Inbox (pattern-inbox) — the notification-center panel. Rows live in the shared
// fixture module (fixtures/inbox.ts) so the design harness and the Storybook
// story render the same feed.
export { inboxItems as inboxFixture, inboxEmpty as inboxEmptyFixture } from './inbox';

/** Workspace-grouped variant of the base picker (integrations/BaseSelectionTable). */
export const baseSelectionGroupedFixture = {
  bases: [
    { id: 'base-1', atBaseId: 'appMkt1', name: 'Marketing', isIncluded: true, workspaceId: 'wspMkt', workspaceName: 'Marketing' },
    { id: 'base-2', atBaseId: 'appMkt2', name: 'Campaign calendar', isIncluded: false, workspaceId: 'wspMkt', workspaceName: 'Marketing' },
    { id: 'base-3', atBaseId: 'appOps1', name: 'Inventory', isIncluded: true, workspaceId: 'wspOps', workspaceName: 'Operations' },
    { id: 'base-4', atBaseId: 'appNone', name: 'Scratch', isIncluded: false, workspaceId: null, workspaceName: null },
  ],
  cap: 5,
  spaceId: '00000000-0000-4000-8000-000000000001',
  embedded: true,
  enrolledWorkspaces: [
    { workspaceId: 'wspMkt', workspaceName: 'Marketing', autoAdd: true, enrolledVia: 'manual', includedBaseCount: 1, lastCheckedAt: null },
    { workspaceId: 'wspOps', workspaceName: 'Operations', autoAdd: false, enrolledVia: 'auto', includedBaseCount: 1, lastCheckedAt: null },
  ],
  autoEnrollNewWorkspaces: false,
  wsResolve: 'off',
  groupByWorkspace: true,
  workspaceAliases: [],
};

/** One base row of the grouped picker (integrations/BasePickerRow). */
export const basePickerRowFixture = {
  base: { id: 'base-1', atBaseId: 'appMkt1', name: 'Marketing', isIncluded: true, workspaceId: 'wspMkt', workspaceName: 'Marketing' },
  tables: 12,
  fieldsText: '1,204',
  fields: 1204,
  groupId: 'wspMkt',
  wsName: 'marketing',
};

/** Shared entity typeahead (schema/EntitySearch) on host-built rows. */
export const entitySearchFixture = {
  items: [
    { kind: 'workspace', id: 'wspMkt', label: 'Marketing', context: '2 bases' },
    { kind: 'base', id: 'appMkt1', label: 'Marketing', context: 'Marketing workspace' },
    { kind: 'base', id: 'appOps1', label: 'Inventory', context: 'Operations workspace' },
  ],
  groups: { workspace: 'Workspaces', base: 'Bases' },
  placeholder: 'Search bases and workspaces',
  pickHint: 'select',
};
