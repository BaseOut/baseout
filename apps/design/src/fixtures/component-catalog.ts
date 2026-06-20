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

export const appShellHeaderFixture = {
  notificationCount: 2,
};

export const appShellSidebarFixture = {
  currentSpace: 'Operations',
  spaces: [
    { id: '00000000-0000-4000-8000-000000000001', name: 'Operations' },
    { id: '00000000-0000-4000-8000-000000000002', name: 'Sandbox' },
  ],
  user: { name: 'Alex Morgan', email: 'alex@example.com', role: 'owner' },
  organization: { id: 'org-1', name: 'Acme Corp', slug: 'acme' },
};
