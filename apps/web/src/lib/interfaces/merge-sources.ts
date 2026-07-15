// Dual-source interface merge rule (web-interfaces-source-badge).
//
// bo_at_interfaces holds up to TWO rows per Airtable entity: an automatic
// MCP-captured row (submitted_via='mcp', server-mcp-interface-pages) and a
// manually-submitted row (intake sources, server-automations-interfaces-
// manual-crud). The engine keeps them parallel BY DESIGN (source-scoped
// writes); presentation merges them here — the canonical read contract for
// every web surface that renders interfaces:
//   - group by airtable_entity_id (null ids pass through ungrouped),
//   - the MCP row is authoritative for existence, name, and composition,
//   - the manual row's richer payload rides along as `manualDetail`,
//   - provenance is always visible (provenanceBadges → the governed Badge
//     primitive; no new variants — the existing soft palette covers it).
//
// Row shape mirrors the engine's bo_at_interfaces read (canonical:
// packages/db-schema/src/space/pg.ts `interfaces`); structural on purpose so
// the manual-crud client types satisfy it when they land.

export interface InterfaceSourceRow {
  id: string
  airtableEntityId: string | null
  name: string | null
  type: string | null
  status: string
  submittedVia: string | null
  definition?: unknown
  firstSeenAt?: string | null
  lastSeenAt?: string | null
}

export type InterfaceSource = 'mcp' | 'manual'

export interface MergedInterfaceEntity {
  airtableEntityId: string | null
  name: string | null
  type: string | null
  /** MCP row's status when present (existence truth); manual's otherwise. */
  status: string
  /** MCP row's definition when present (composition truth); manual's otherwise. */
  definition: unknown
  sources: InterfaceSource[]
  /** The manual row's payload when BOTH sources exist (richer human context). */
  manualDetail: unknown
  /** Underlying row ids, MCP first — mutation surfaces need them. */
  rowIds: string[]
}

const sourceOf = (row: InterfaceSourceRow): InterfaceSource =>
  row.submittedVia === 'mcp' ? 'mcp' : 'manual'

function toEntity(rows: InterfaceSourceRow[]): MergedInterfaceEntity {
  const mcp = rows.find((r) => sourceOf(r) === 'mcp') ?? null
  const manual = rows.find((r) => sourceOf(r) === 'manual') ?? null
  const truth = mcp ?? manual!
  const sources: InterfaceSource[] = []
  if (mcp) sources.push('mcp')
  if (manual) sources.push('manual')
  return {
    airtableEntityId: truth.airtableEntityId,
    name: truth.name,
    type: truth.type,
    status: truth.status,
    definition: truth.definition ?? null,
    sources,
    manualDetail: mcp && manual ? manual.definition ?? null : null,
    rowIds: [...(mcp ? [mcp.id] : []), ...(manual ? [manual.id] : [])],
  }
}

export function mergeInterfaceSources(rows: InterfaceSourceRow[]): MergedInterfaceEntity[] {
  const grouped = new Map<string, InterfaceSourceRow[]>()
  const ungrouped: InterfaceSourceRow[] = []
  for (const row of rows) {
    if (row.airtableEntityId === null) {
      ungrouped.push(row)
      continue
    }
    const bucket = grouped.get(row.airtableEntityId) ?? []
    bucket.push(row)
    grouped.set(row.airtableEntityId, bucket)
  }
  return [
    ...[...grouped.values()].map(toEntity),
    ...ungrouped.map((r) => toEntity([r])),
  ]
}

export interface ProvenanceBadge {
  label: 'Auto' | 'Manual'
  /** Badge.astro variant — existing soft palette, no new variants. */
  variant: 'primary' | 'secondary'
}

export function provenanceBadges(sources: InterfaceSource[]): ProvenanceBadge[] {
  const badges: ProvenanceBadge[] = []
  if (sources.includes('mcp')) badges.push({ label: 'Auto', variant: 'primary' })
  if (sources.includes('manual')) badges.push({ label: 'Manual', variant: 'secondary' })
  return badges
}
