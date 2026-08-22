/**
 * Short-TTL in-isolate schema snapshot so Data and Schema can skip a repeat
 * getSchema in the same Worker isolate. L2 Cache API lookups are not used on
 * the request path — a hanging caches.default.match blocked /data entirely.
 */
import type { GetSchemaResult } from '../backup-engine'

export const SCHEMA_SNAPSHOT_TTL_MS = 15_000

export type SchemaSnapshot = Extract<GetSchemaResult, { ok: true }>

type Entry = {
  schema: SchemaSnapshot
  landingTableId: string | undefined
  expiresAt: number
}

const L1 = new Map<string, Entry>()

export function landingTableIdFromSchema(schema: SchemaSnapshot): string | undefined {
  return schema.tables.find((t) => t.removedAt === null && t.status !== 'removed')?.tableId
}

export function rememberSchemaSnapshot(spaceId: string, schema: SchemaSnapshot): void {
  L1.set(spaceId, {
    schema,
    landingTableId: landingTableIdFromSchema(schema),
    expiresAt: Date.now() + SCHEMA_SNAPSHOT_TTL_MS,
  })
}

export function peekLandingTableId(spaceId: string): string | undefined {
  const hit = L1.get(spaceId)
  if (!hit || hit.expiresAt <= Date.now()) return undefined
  return hit.landingTableId
}

export function peekSchemaSnapshot(spaceId: string): SchemaSnapshot | undefined {
  const hit = L1.get(spaceId)
  if (!hit || hit.expiresAt <= Date.now()) return undefined
  return hit.schema
}

export function clearSchemaSnapshots(): void {
  L1.clear()
}

export async function getSchemaCached(
  spaceId: string,
  fetchSchema: () => Promise<GetSchemaResult>,
): Promise<GetSchemaResult> {
  const cached = peekSchemaSnapshot(spaceId)
  if (cached) return cached
  const res = await fetchSchema()
  if (res.ok) rememberSchemaSnapshot(spaceId, res)
  return res
}
