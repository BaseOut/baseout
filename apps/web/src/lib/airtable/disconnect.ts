/**
 * Disconnect the org's Airtable connection(s) (user-initiated).
 *
 * Disconnect does NOT delete the row — backup_runs and configurations
 * reference it, and reconnecting must land on the same Connection. It flips
 * the row into the existing `invalid` machinery: the app-shell
 * ConnectionHealthBanner, the /sources "Reconnect" state, and the engine's
 * cron (which skips invalid connections) all take over from there. A later
 * re-Connect (`/api/connections/airtable/start` → callback →
 * `persistAirtableConnection`) upserts fresh tokens onto the same row and
 * restores `status: 'active'`.
 */

import { and, eq, ne, sql } from 'drizzle-orm'
import { connections, platforms } from '../../db/schema'
import type { AppDb } from '../../db'

export const DISCONNECT_REASON = 'user_disconnected'

export async function disconnectAirtableConnection(
  db: AppDb,
  organizationId: string,
): Promise<{ disconnected: number }> {
  const airtablePlatform = db
    .select({ id: platforms.id })
    .from(platforms)
    .where(eq(platforms.slug, 'airtable'))
  const rows = await db
    .update(connections)
    .set({
      status: 'invalid',
      invalidatedAt: new Date(),
      oauthRefreshLastError: DISCONNECT_REASON,
      modifiedAt: new Date(),
    })
    .where(
      and(
        eq(connections.organizationId, organizationId),
        sql`${connections.platformId} in ${airtablePlatform}`,
        ne(connections.status, 'invalid'),
      ),
    )
    .returning({ id: connections.id })
  return { disconnected: rows.length }
}
