// Context → route resolution for embedded mode (shared-embed-protocol design
// Decision 8). Pure: the embed client applies its output.
import type { EmbedContext } from '@baseout/embed-protocol'

export interface EmbedBaseSummary {
  /** Airtable base id (app…) — integrations BaseSummary.atBaseId. */
  atBaseId: string
  /** Included in the active Space's backup configuration. */
  isIncluded: boolean
}

/**
 * - baseId covered by the active Space's backup configuration → the base's
 *   schema surface (baseId rides as a param for surfaces to adopt).
 * - baseId known to the connection but not backed up, or unknown entirely →
 *   sources with a not-backed-up affordance param.
 * - no baseId → dashboard.
 */
export function resolveEmbedRoute(
  context: EmbedContext,
  bases: EmbedBaseSummary[],
): string {
  if (!context.baseId) return '/'
  const known = bases.find((b) => b.atBaseId === context.baseId)
  if (known?.isIncluded) {
    const params = new URLSearchParams({ baseId: context.baseId })
    if (context.tableId) params.set('tableId', context.tableId)
    return `/schema?${params.toString()}`
  }
  return `/sources?unbackedBase=${encodeURIComponent(context.baseId)}`
}
