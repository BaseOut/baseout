import type { SourceSummary } from '@web/stores/sources';

// Account-level Airtable sources (design harness). An OAuth source used by two
// Spaces, plus a PAT source in a "reconnect" state to exercise the broken surface.
export const FIXTURE_SOURCES: SourceSummary[] = [
  {
    id: 'src-ops',
    name: 'Ops Airtable',
    provider: 'airtable',
    account: 'ops@demo.co',
    auth: 'oauth',
    status: 'connected',
    basesAvailable: 50,
    lastChecked: '5 min ago',
    addedAt: 'Apr 15, 2026',
    inUseBy: [
      { spaceId: 'core-crm', spaceName: 'Core CRM', baseCount: 8, destinations: 'Company Drive', schedule: 'Daily', lastBackup: '2h ago', status: 'ok' },
      { spaceId: 'marketing', spaceName: 'Marketing', baseCount: 5, destinations: 'Company Drive', schedule: 'Weekly', lastBackup: '1d ago', status: 'ok' },
    ],
  },
  {
    id: 'src-founder',
    name: 'Founder Airtable',
    provider: 'airtable',
    account: 'usrF0UNDER00000',
    auth: 'pat',
    status: 'reconnect',
    basesAvailable: 12,
    lastChecked: '1h ago',
    addedAt: 'May 2, 2026',
    inUseBy: [
      { spaceId: 'product', spaceName: 'Product', baseCount: 3, destinations: 'Ops S3 + Analytics DB', schedule: 'Daily', lastBackup: 'failed', status: 'failed' },
    ],
  },
];

export const FIXTURE_SOURCES_EMPTY: SourceSummary[] = [];

export function findSource(id: string | null): SourceSummary {
  return FIXTURE_SOURCES.find((s) => s.id === id) ?? FIXTURE_SOURCES[0];
}

// A freshly-added source (harness): not authorized yet → "Needs connection".
export function newSource(method: string | null): SourceSummary {
  const auth = method === 'pat' ? 'pat' : 'oauth';
  return {
    id: 'new-source',
    name: 'New Airtable source',
    provider: 'airtable',
    account: auth === 'pat' ? 'token ••••' : 'pending authorization',
    auth,
    status: 'needs_connection',
    basesAvailable: 0,
    lastChecked: null,
    addedAt: 'just now',
    inUseBy: [],
  };
}
