/**
 * Server-side data loader for the /integrations page.
 *
 * Returns a client-safe summary of the active Space's connections + bases —
 * explicitly omits access/refresh token ciphertext so the payload is safe to
 * hydrate into a nanostore and render in the browser.
 */

import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { AppDb } from '../db'
import {
  atBases,
  backupConfigurationBases,
  backupConfigurations,
  connections,
  platforms,
  spaceEvents,
} from '../db/schema'
import { resolveCapabilities } from './capabilities/resolve'
import type { Frequency } from './capabilities/tier-capabilities'
import type {
  BackupPolicy,
  BaseSummary,
  ConnectionSummary,
  IntegrationsState,
  SpaceEventSummary,
} from '../stores/connections'

const VALID_FREQUENCIES: ReadonlySet<Frequency> = new Set([
  'monthly',
  'weekly',
  'daily',
  'instant',
])

function asFrequency(raw: string | null | undefined): Frequency {
  return raw && VALID_FREQUENCIES.has(raw as Frequency)
    ? (raw as Frequency)
    : 'monthly'
}

interface PlatformConfig {
  at_user_id?: string
  is_enterprise_scope?: boolean
}

export async function getIntegrationsState(
  db: AppDb,
  organizationId: string,
  spaceId: string,
): Promise<IntegrationsState> {
  const connectionRows = await db
    .select({
      id: connections.id,
      status: connections.status,
      displayName: connections.displayName,
      platformConfig: connections.platformConfig,
      createdAt: connections.createdAt,
      platformSlug: platforms.slug,
      platformName: platforms.name,
    })
    .from(connections)
    .innerJoin(platforms, eq(platforms.id, connections.platformId))
    .where(
      and(
        eq(connections.organizationId, organizationId),
        eq(platforms.slug, 'airtable'),
      ),
    )

  const baseRows = await db
    .select({
      id: atBases.id,
      atBaseId: atBases.atBaseId,
      name: atBases.name,
    })
    .from(atBases)
    .where(eq(atBases.spaceId, spaceId))

  const [config] = await db
    .select({
      id: backupConfigurations.id,
      frequency: backupConfigurations.frequency,
      storageType: backupConfigurations.storageType,
      nextScheduledAt: backupConfigurations.nextScheduledAt,
      autoAddFutureBases: backupConfigurations.autoAddFutureBases,
    })
    .from(backupConfigurations)
    .where(eq(backupConfigurations.spaceId, spaceId))
    .limit(1)

  const includedSet = new Set<string>()
  if (config && baseRows.length > 0) {
    const includedRows = await db
      .select({ atBaseId: backupConfigurationBases.atBaseId })
      .from(backupConfigurationBases)
      .where(
        and(
          eq(backupConfigurationBases.backupConfigurationId, config.id),
          eq(backupConfigurationBases.isIncluded, true),
          inArray(
            backupConfigurationBases.atBaseId,
            baseRows.map((r) => r.id),
          ),
        ),
      )
    for (const r of includedRows) includedSet.add(r.atBaseId)
  }

  const bases: BaseSummary[] = baseRows.map((r) => ({
    id: r.id,
    atBaseId: r.atBaseId,
    name: r.name,
    isIncluded: includedSet.has(r.id),
  }))

  const caps = await resolveCapabilities(db, organizationId, 'airtable')

  const connectionSummaries: ConnectionSummary[] = connectionRows.map((row) => {
    const cfg = (row.platformConfig as PlatformConfig | null) ?? {}
    return {
      id: row.id,
      platformSlug: row.platformSlug,
      platformName: row.platformName,
      status: row.status,
      displayName: row.displayName,
      airtableUserId: cfg.at_user_id ?? null,
      isEnterprise: Boolean(cfg.is_enterprise_scope),
      basesCount: bases.length,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
    }
  })

  const policy: BackupPolicy = {
    frequency: asFrequency(config?.frequency ?? null),
    storageType: config?.storageType ?? 'r2_managed',
    nextScheduledAt:
      config?.nextScheduledAt instanceof Date
        ? config.nextScheduledAt.toISOString()
        : (config?.nextScheduledAt as string | null | undefined) ?? null,
    autoAddFutureBases: config?.autoAddFutureBases ?? false,
  }

  // Unread space_events for the banner. Workspace rediscovery is the only
  // writer today (kind = 'bases_discovered'); other kinds will be additive.
  const eventRows = await db
    .select({
      id: spaceEvents.id,
      kind: spaceEvents.kind,
      payload: spaceEvents.payload,
      createdAt: spaceEvents.createdAt,
    })
    .from(spaceEvents)
    .where(
      and(
        eq(spaceEvents.spaceId, spaceId),
        isNull(spaceEvents.dismissedAt),
      ),
    )
    .orderBy(desc(spaceEvents.createdAt))
    .limit(10)

  const unreadEvents: SpaceEventSummary[] = []
  for (const row of eventRows) {
    if (row.kind !== 'bases_discovered') continue
    const p = (row.payload ?? {}) as Record<string, unknown>
    unreadEvents.push({
      id: row.id,
      kind: 'bases_discovered',
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
      payload: {
        discovered: Array.isArray(p.discovered) ? (p.discovered as string[]) : [],
        autoAdded: Array.isArray(p.autoAdded) ? (p.autoAdded as string[]) : [],
        blockedByTier: Array.isArray(p.blockedByTier)
          ? (p.blockedByTier as string[])
          : [],
        tierCap:
          typeof p.tierCap === 'number'
            ? p.tierCap
            : p.tierCap === null
              ? null
              : null,
      },
    })
  }

  return {
    connections: connectionSummaries,
    bases,
    tierBasesPerSpace: caps.capabilities.basesPerSpace,
    availableFrequencies: caps.capabilities.frequencies,
    hasBackupConfig: Boolean(config),
    policy,
    unreadEvents,
  }
}
