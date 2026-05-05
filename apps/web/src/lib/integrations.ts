/**
 * Server-side data loader for the /integrations page.
 *
 * Returns a client-safe summary of the active Space's connections + bases —
 * explicitly omits access/refresh token ciphertext so the payload is safe to
 * hydrate into a nanostore and render in the browser.
 */

import { and, eq, inArray } from 'drizzle-orm'
import type { AppDb } from '../db'
import {
  atBases,
  backupConfigurationBases,
  backupConfigurations,
  connections,
  platforms,
} from '../db/schema'
import { resolveCapabilities } from './capabilities/resolve'
import type { BaseSummary, ConnectionSummary, IntegrationsState } from '../stores/connections'

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
    .select({ id: backupConfigurations.id })
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

  return {
    connections: connectionSummaries,
    bases,
    tierBasesPerSpace: caps.capabilities.basesPerSpace,
    hasBackupConfig: Boolean(config),
  }
}
