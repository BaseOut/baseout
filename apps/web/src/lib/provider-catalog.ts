/**
 * Provider catalog — the single source of truth for which storage destinations
 * and source Platforms exist and whether each can be connected now or is coming
 * soon. Both the account-level Destinations/Sources registries and the per-Space
 * StoragePicker read from here, so they can never disagree on what's available.
 *
 * Availability is a function of two things:
 *  - a static default (managed storage + Google Drive ship now; the rest are
 *    coming soon), and
 *  - runtime env-gating for bring-your-own-storage providers whose OAuth client
 *    id may or may not be configured in a given deploy (Box / Dropbox / OneDrive).
 *
 * Tier-gated providers (S3 = Growth+) carry a `tier` for a static "Growth+" note
 * and stay coming-soon until that capability ships. Dynamic gating by the
 * viewer's resolved tier is a follow-up.
 */

export type Availability = 'available' | 'coming_soon'
export type DestinationKind = 'file' | 'database'
export type ProviderTier = 'growth' | 'pro'
export type EnvGate = 'box' | 'dropbox' | 'onedrive'

export interface DestinationProvider {
  slug: string
  label: string
  kind: DestinationKind
  note: string
  /** Availability after env-gating is applied (see getDestinationProviders). */
  availability: Availability
  /** Managed storage needs no authorization → lands connected. */
  managed?: boolean
  /** Minimum tier when tier-gated; rendered as a static note (e.g. "Growth+"). */
  tier?: ProviderTier
  /** When set, availability is governed by the matching OAuth client id. */
  envGated?: EnvGate
}

export interface SourcePlatform {
  slug: string
  label: string
  note: string
  availability: Availability
}

/** OAuth client-id env vars that gate the bring-your-own-storage providers. */
export interface DestinationEnv {
  BOX_OAUTH_CLIENT_ID?: string
  DROPBOX_OAUTH_CLIENT_ID?: string
  MICROSOFT_OAUTH_CLIENT_ID?: string
}

/** Managed storage types — no third-party authorization, so they land connected. */
const MANAGED_DESTINATION_TYPES = new Set(['r2_managed', 'local_fs'])

export function isManagedDestination(slug: string): boolean {
  return MANAGED_DESTINATION_TYPES.has(slug)
}

/**
 * Static catalog. `availability` here is the DEFAULT before env-gating; an
 * `envGated` provider's final availability is computed by getDestinationProviders.
 */
const DESTINATION_CATALOG: readonly DestinationProvider[] = [
  {
    slug: 'local_fs',
    label: 'Local disk (dev)',
    kind: 'file',
    note: 'Development — backups write to the local disk. No account, no setup.',
    availability: 'available',
    managed: true,
  },
  {
    slug: 'r2_managed',
    label: 'Cloudflare R2',
    kind: 'file',
    note: 'Managed by Baseout — encrypted at rest, no setup.',
    availability: 'available',
    managed: true,
  },
  {
    slug: 'google_drive',
    label: 'Google Drive',
    kind: 'file',
    note: 'Your own Drive — a per-Space Baseout folder.',
    availability: 'available',
  },
  {
    slug: 'dropbox',
    label: 'Dropbox',
    kind: 'file',
    note: 'Your own Dropbox — a per-Space Baseout folder.',
    availability: 'coming_soon',
    envGated: 'dropbox',
  },
  {
    slug: 'box',
    label: 'Box',
    kind: 'file',
    note: 'Your own Box — a per-Space Baseout folder.',
    availability: 'coming_soon',
    envGated: 'box',
  },
  {
    slug: 'onedrive',
    label: 'OneDrive',
    kind: 'file',
    note: 'Your own OneDrive — a per-Space Baseout folder.',
    availability: 'coming_soon',
    envGated: 'onedrive',
  },
  {
    slug: 's3',
    label: 'Amazon S3',
    kind: 'file',
    note: 'Your own S3 bucket.',
    availability: 'coming_soon',
    tier: 'growth',
  },
  {
    slug: 'postgres',
    label: 'Postgres',
    kind: 'database',
    note: 'Self-hosted or cloud.',
    availability: 'coming_soon',
  },
  {
    slug: 'neon',
    label: 'Neon',
    kind: 'database',
    note: 'Serverless Postgres.',
    availability: 'coming_soon',
  },
  {
    slug: 'supabase',
    label: 'Supabase',
    kind: 'database',
    note: 'Postgres + APIs.',
    availability: 'coming_soon',
  },
  {
    slug: 'byodb',
    label: 'Other database',
    kind: 'database',
    note: 'Any Postgres-compatible connection string.',
    availability: 'coming_soon',
  },
]

/**
 * Source Platforms (Features §1). V1 is Airtable-only; the rest are future
 * Platforms shown as coming soon so users know more sources are planned.
 */
export const SOURCE_PLATFORMS: readonly SourcePlatform[] = [
  { slug: 'airtable', label: 'Airtable', note: 'Bases, tables, records, and attachments.', availability: 'available' },
  { slug: 'notion', label: 'Notion', note: 'Pages, databases, and blocks.', availability: 'coming_soon' },
  { slug: 'hubspot', label: 'HubSpot', note: 'Contacts, companies, and deals.', availability: 'coming_soon' },
  { slug: 'salesforce', label: 'Salesforce', note: 'Objects, flows, and metadata.', availability: 'coming_soon' },
]

/**
 * Destination providers with final availability: an env-gated bring-your-own
 * provider is `available` only when its OAuth client id is configured; otherwise
 * it stays `coming_soon`. Tier-gated and other providers keep their default.
 */
export function getDestinationProviders(env: DestinationEnv = {}): DestinationProvider[] {
  const gate: Record<EnvGate, boolean> = {
    box: Boolean(env.BOX_OAUTH_CLIENT_ID),
    dropbox: Boolean(env.DROPBOX_OAUTH_CLIENT_ID),
    onedrive: Boolean(env.MICROSOFT_OAUTH_CLIENT_ID),
  }
  return DESTINATION_CATALOG.map((p) =>
    p.envGated ? { ...p, availability: gate[p.envGated] ? 'available' : 'coming_soon' } : { ...p },
  )
}

/** Catalog metadata for a destination provider slug (label, kind, managed, …). */
export function destinationMeta(slug: string): DestinationProvider | undefined {
  const found = DESTINATION_CATALOG.find((p) => p.slug === slug)
  return found ? { ...found } : undefined
}
