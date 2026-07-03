import { describe, it, expect } from 'vitest'
import { toDestinationSummaries, toSourceSummary } from './registry-mappers'
import type { IntegrationsState, StorageDestinationSummary, ConnectionSummary } from '../stores/connections'

function state(overrides: Partial<IntegrationsState> = {}): IntegrationsState {
  return {
    connections: [],
    bases: [],
    tierBasesPerSpace: null,
    availableFrequencies: ['monthly'],
    hasBackupConfig: false,
    policy: { frequency: 'monthly', scope: 'schema_and_data', schemaFrequency: null, schemaNextScheduledAt: null, storageType: 'r2_managed', nextScheduledAt: null, autoAddFutureBases: false },
    storageDestinations: [],
    unreadEvents: [],
    ...overrides,
  }
}

const dest = (o: Partial<StorageDestinationSummary> = {}): StorageDestinationSummary => ({
  type: 'google_drive',
  accountEmail: 'ops@demo.co',
  connectedAt: '2026-04-15T00:00:00.000Z',
  ...o,
})

const airtable = (o: Partial<ConnectionSummary> = {}): ConnectionSummary => ({
  id: 'c1',
  platformSlug: 'airtable',
  platformName: 'Airtable',
  status: 'active',
  displayName: 'Ops Airtable',
  airtableUserId: 'usr1',
  isEnterprise: false,
  basesCount: 3,
  createdAt: '2026-04-15T00:00:00.000Z',
  ...o,
})

describe('toDestinationSummaries', () => {
  it('returns [] when the Space has no destination', () => {
    expect(toDestinationSummaries(state(), 'space-1', 'Ops')).toEqual([])
  })

  it('maps a persisted destination as Connected (a row exists only post-connect)', () => {
    const [d] = toDestinationSummaries(state({ storageDestinations: [dest()] }), 'space-1', 'Ops')
    expect(d.status).toBe('connected')
    expect(d.providerLabel).toBe('Google Drive') // label comes from the shared catalog
    expect(d.kind).toBe('file')
    expect(d.detail).toContain('ops@demo.co')
  })

  it('treats a managed destination (r2_managed) as Connected with a folder detail', () => {
    const [d] = toDestinationSummaries(
      state({ storageDestinations: [dest({ type: 'r2_managed', accountEmail: null })] }),
      'space-1',
      'Ops',
    )
    expect(d.status).toBe('connected')
    expect(d.providerLabel).toBe('Cloudflare R2')
    expect(d.detail).toContain('Ops')
  })

  it('does NOT downgrade a connected BYOS destination that has no account email', () => {
    const [d] = toDestinationSummaries(
      state({ storageDestinations: [dest({ type: 'box', accountEmail: null })] }),
      'space-1',
      'Ops',
    )
    expect(d.status).toBe('connected')
    expect(d.providerLabel).toBe('Box')
  })

  it('falls back to the raw type for an unknown provider', () => {
    const [d] = toDestinationSummaries(
      state({ storageDestinations: [dest({ type: 'mystery', accountEmail: null })] }),
      'space-1',
      'Ops',
    )
    expect(d.providerLabel).toBe('mystery')
    expect(d.kind).toBe('file')
  })

  it('maps every connected destination with the provider type as its id', () => {
    const ds = toDestinationSummaries(
      state({
        storageDestinations: [dest(), dest({ type: 'box', accountEmail: null })],
      }),
      'space-1',
      'Ops',
    )
    expect(ds).toHaveLength(2)
    expect(ds.map((d) => d.id)).toEqual(['google_drive', 'box'])
  })

  it('flags primary on the destination matching policy.storageType only', () => {
    const ds = toDestinationSummaries(
      state({
        storageDestinations: [dest(), dest({ type: 'box', accountEmail: null })],
        policy: {
          frequency: 'monthly',
          scope: 'schema_and_data',
          schemaFrequency: null,
          schemaNextScheduledAt: null,
          storageType: 'box',
          nextScheduledAt: null,
          autoAddFutureBases: false,
        },
      }),
      'space-1',
      'Ops',
    )
    expect(ds.map((d) => [d.id, d.primary])).toEqual([
      ['google_drive', false],
      ['box', true],
    ])
  })

  it('flags no primary when the config points at row-less r2_managed', () => {
    // state()'s default policy.storageType is 'r2_managed'.
    const ds = toDestinationSummaries(
      state({ storageDestinations: [dest()] }),
      'space-1',
      'Ops',
    )
    expect(ds[0].primary).toBe(false)
  })
})

describe('toSourceSummary', () => {
  it('returns null with no Airtable connection', () => {
    expect(toSourceSummary(state(), 'space-1', 'Ops')).toBeNull()
  })

  it('maps an active Airtable connection as connected', () => {
    const s = toSourceSummary(state({ connections: [airtable()] }), 'space-1', 'Ops')
    expect(s?.status).toBe('connected')
    expect(s?.provider).toBe('airtable')
  })

  it('maps a non-active connection as reconnect', () => {
    const s = toSourceSummary(state({ connections: [airtable({ status: 'invalid' })] }), 'space-1', 'Ops')
    expect(s?.status).toBe('reconnect')
    expect(s?.inUseBy[0].status).toBe('paused')
  })
})
