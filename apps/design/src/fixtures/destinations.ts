import type { DestinationSummary } from '@web/stores/destinations';

// Account-level destinations (design harness). A connected Drive + S3, plus a
// Postgres in a "reconnect" state to exercise the broken-destination surface.
export const FIXTURE_DESTINATIONS: DestinationSummary[] = [
  {
    id: 'company-drive',
    name: 'Company Drive',
    kind: 'file',
    provider: 'google_drive',
    providerLabel: 'Google Drive',
    status: 'connected',
    detail: 'folder /Baseout',
    inUseBy: ['Core CRM', 'Marketing', 'Ops'],
    lastWrite: '2h ago',
    addedAt: 'Apr 15, 2026',
  },
  {
    id: 'ops-s3',
    name: 'Ops S3',
    kind: 'file',
    provider: 's3',
    providerLabel: 'Amazon S3',
    status: 'connected',
    detail: 'bucket baseout-ops',
    inUseBy: ['Ops'],
    lastWrite: '2h ago',
    addedAt: 'May 2, 2026',
  },
  {
    id: 'analytics-db',
    name: 'Analytics DB',
    kind: 'database',
    provider: 'postgres',
    providerLabel: 'Postgres',
    status: 'reconnect',
    detail: 'database ops_mirror',
    inUseBy: ['Core CRM', 'Marketing'],
    lastWrite: 'failed',
    addedAt: 'May 10, 2026',
  },
];

export const FIXTURE_DESTINATIONS_EMPTY: DestinationSummary[] = [];

export function findDestination(id: string | null): DestinationSummary {
  return FIXTURE_DESTINATIONS.find((d) => d.id === id) ?? FIXTURE_DESTINATIONS[0];
}

const PROVIDER_META: Record<string, { label: string; kind: 'file' | 'database'; detail: string; managed?: boolean }> = {
  r2: { label: 'Baseout R2', kind: 'file', detail: 'managed storage', managed: true },
  google_drive: { label: 'Google Drive', kind: 'file', detail: 'folder /Baseout' },
  dropbox: { label: 'Dropbox', kind: 'file', detail: 'folder /Baseout' },
  box: { label: 'Box', kind: 'file', detail: 'folder /Baseout' },
  s3: { label: 'Amazon S3', kind: 'file', detail: 'your S3 bucket' },
  postgres: { label: 'Postgres', kind: 'database', detail: 'your database' },
  neon: { label: 'Neon', kind: 'database', detail: 'your Neon project' },
  supabase: { label: 'Supabase', kind: 'database', detail: 'your Supabase database' },
  byodb: { label: 'Database', kind: 'database', detail: 'your database' },
};

// A freshly-created destination (design harness): the object exists but isn't
// authorized yet, so it lands in the registry as "Needs connection" (managed R2
// needs no connection, so it lands connected).
export function newDestination(type: string | null): DestinationSummary {
  const m = PROVIDER_META[type ?? ''] ?? { label: 'New destination', kind: 'file' as const, detail: '—' };
  return {
    id: 'new-destination',
    name: m.label,
    kind: m.kind,
    provider: type ?? 'new',
    providerLabel: m.label,
    status: m.managed ? 'connected' : 'needs_connection',
    detail: m.detail,
    inUseBy: [],
    lastWrite: null,
    addedAt: 'just now',
  };
}
