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
  unreadEvents: [],
};
