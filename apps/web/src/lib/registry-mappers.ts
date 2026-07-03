/**
 * Maps the per-Space backend state (IntegrationsState) into the account-level
 * registry shapes the redesigned views expect (SourceSummary / DestinationSummary).
 *
 * baseout connects Airtable per-connection and has one storage destination per
 * Space (storage_destinations.space_id is UNIQUE) — the account-level Sources /
 * Destinations model is a backend follow-up (shared-sources / shared-destinations).
 * Until then these mappers present the current Space's real connection + destination
 * in the registry shape, so /sources, /destinations, and the Space Overview render
 * real data with an honest "account-level registry pending" notice on the registries.
 */
import type { IntegrationsState } from '../stores/connections';
import type { SourceSummary, SourceStatus } from '../stores/sources';
import type { DestinationSummary } from '../stores/destinations';
import { destinationMeta, isManagedDestination } from './provider-catalog';

/** Map the active Space's Airtable connection → one SourceSummary (null if none). */
export function toSourceSummary(
  state: IntegrationsState,
  spaceId: string,
  spaceName: string,
): SourceSummary | null {
  const airtable = state.connections.find((c) => c.platformSlug === 'airtable') ?? null;
  if (!airtable) return null;

  const includedCount = state.bases.filter((b) => b.isIncluded).length;
  const status: SourceStatus = airtable.status === 'active' ? 'connected' : 'reconnect';

  return {
    id: spaceId,
    name: airtable.displayName ?? 'Airtable',
    provider: 'airtable',
    account: airtable.displayName ?? 'Airtable account',
    auth: 'oauth',
    status,
    basesAvailable: state.bases.length,
    inUseBy: [
      {
        spaceId,
        spaceName,
        baseCount: includedCount,
        destinations:
          state.storageDestinations.length > 0
            ? `${state.storageDestinations.length} destination${state.storageDestinations.length === 1 ? '' : 's'}`
            : 'No destination',
        schedule: state.policy?.frequency ?? '—',
        lastBackup: null,
        status: status === 'connected' ? 'ok' : 'paused',
      },
    ],
    lastChecked: null,
    addedAt: '',
  };
}

/** Local disk is the dev-only managed type; otherwise fall back to the raw slug. */
const LOCAL_FS_META = { label: 'Local disk', kind: 'file' as const };

/**
 * Map the active Space's connected storage destinations → DestinationSummary[]
 * (one per provider type). `id` is the provider type — unique per Space under
 * the (space_id, type) constraint — and `primary` marks the one backups write
 * to (type === policy.storageType; false everywhere when the config points at
 * row-less r2_managed).
 */
export function toDestinationSummaries(
  state: IntegrationsState,
  _spaceId: string,
  spaceName: string,
): DestinationSummary[] {
  return state.storageDestinations.map((sd) => {
    // Provider label + kind come from the shared catalog (provider-catalog.ts) so
    // the registry and the per-Space StoragePicker can't disagree; local_fs is
    // dev-only and not in the catalog, and unknown types fall back to the slug.
    const meta =
      sd.type === 'local_fs'
        ? LOCAL_FS_META
        : destinationMeta(sd.type) ?? { label: sd.type, kind: 'file' as const };
    // Status is honestly 'connected': a storage_destinations row exists ONLY once
    // the destination has been connected (the BYOS OAuth callback / managed default
    // writes it), so a present destination is always connected — note a connected
    // BYOS provider may still have a null accountEmail. The account-level
    // needs_connection / reconnect states await real per-destination persistence
    // (shared-destinations "Engineer" handoff); they're exercised in the harness.
    const managed = isManagedDestination(sd.type);
    return {
      id: sd.type,
      name: `${meta.label} backup`,
      kind: meta.kind,
      provider: sd.type,
      providerLabel: meta.label,
      status: 'connected' as const,
      primary: sd.type === state.policy.storageType,
      detail: !managed && sd.accountEmail ? `Connected as ${sd.accountEmail}` : `/Baseout/${spaceName}`,
      inUseBy: [spaceName],
      lastWrite: null,
      addedAt: sd.connectedAt,
    };
  });
}
