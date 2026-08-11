// Pure logic behind the Browse "Include deleted" filter
// (openspec/changes/web-deleted-items-filter). No DOM / Astro imports.
//
// Schema entities carry a lifecycle `status` from the engine
// (system-per-space-db): 'active' | 'removed' | 'unknown'. Only 'removed'
// (deleted in Airtable) is hidden by default; 'unknown' (couldn't-confirm
// this run) stays visible — it is NOT treated as deleted.

/** Minimal shape this module needs from a schema entity. */
export interface StatusedEntity {
  status: string
}

export interface SchemaEntities {
  bases: StatusedEntity[]
  tables: StatusedEntity[]
  fields: StatusedEntity[]
  views: StatusedEntity[]
}

/** True only for entities deleted from Airtable (status='removed'). */
export function isRemoved(status: string | null | undefined): boolean {
  return status === 'removed'
}

/** Total number of `removed` entities across all four entity levels. */
export function countDeleted(schema: SchemaEntities): number {
  return (
    schema.bases.filter((e) => isRemoved(e.status)).length +
    schema.tables.filter((e) => isRemoved(e.status)).length +
    schema.fields.filter((e) => isRemoved(e.status)).length +
    schema.views.filter((e) => isRemoved(e.status)).length
  )
}

/**
 * The "no longer in Airtable" note for a removed entity, with the removal date
 * appended only when the engine provides one (forward-compatible with the
 * paired server-removed-item-filtering follow-up).
 */
export function removalNote(since?: string | null): string {
  const base = 'no longer in Airtable'
  return since ? `${base} since ${since}` : base
}
