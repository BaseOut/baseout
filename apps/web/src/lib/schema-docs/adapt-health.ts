/**
 * Map engine health-overview JSON → tip SchemaHealth BaseHealth.
 */
export type HealthBand = 'green' | 'amber' | 'red'
export type HealthTier = 'Base' | 'Table' | 'Field'

export interface TipHealthMetric {
  name: string
  tiers: HealthTier[]
  score: number
  weight: number
  enabled?: boolean
  lastGenerated?: string
  /** Engine rule id — used when wiring Pro+ prompt/rerun proxies. */
  ruleId?: string
}

export interface TipHealthIssue {
  severity: 'high' | 'med' | 'low'
  text: string
  airtableUrl?: string
}

export interface TipBaseHealth {
  baseId: string
  baseName: string
  score: number
  band: HealthBand
  /** True when there is no real grade (null/zero score and zero issues). */
  unscored?: boolean
  metrics: TipHealthMetric[]
  issues: TipHealthIssue[]
  assessedAt?: string
  insights?: []
}

export type EngineHealthOverview = {
  grade: { score: number; band: string } | null
  metrics: Array<{
    ruleId: string
    name: string
    weight: number
    severity: string | null
    entityTier: string | null
    score: number
    lastGeneratedAt: string | null
  }>
  issues: Array<{
    ruleId: string
    severity: string
    tableId: string | null
    fieldId: string | null
    message: string
    airtableDeeplink: string | null
  }>
}

function bandOf(raw: string | undefined, score: number): HealthBand {
  const b = raw === 'yellow' ? 'amber' : raw
  if (b === 'green' || b === 'amber' || b === 'red') return b
  if (score >= 90) return 'green'
  if (score >= 60) return 'amber'
  return 'red'
}

function sevOf(raw: string): 'high' | 'med' | 'low' {
  if (raw === 'high' || raw === 'critical') return 'high'
  if (raw === 'medium' || raw === 'warning' || raw === 'med') return 'med'
  return 'low'
}

function tiersOf(entityTier: string | null): HealthTier[] {
  if (!entityTier) return ['Base']
  const parts = entityTier.split(/[,|/]/).map((s) => s.trim().toLowerCase())
  const out: HealthTier[] = []
  for (const p of parts) {
    if (p === 'base' || p === 'bases') out.push('Base')
    else if (p === 'table' || p === 'tables') out.push('Table')
    else if (p === 'field' || p === 'fields') out.push('Field')
  }
  return out.length ? out : ['Base']
}

export function adaptHealthOverview(
  baseId: string,
  baseName: string,
  payload: EngineHealthOverview,
): TipBaseHealth {
  const issues: TipHealthIssue[] = payload.issues.map((i) => ({
    severity: sevOf(i.severity),
    text: i.message,
    airtableUrl: i.airtableDeeplink ?? undefined,
  }))
  // A missing or zero grade with nothing on the punch-list is "not scored",
  // not an emergency. Banding that as red 0 next to "No issues" contradicts itself.
  const rawScore = payload.grade?.score
  const unscored = issues.length === 0 && (payload.grade == null || rawScore == null || rawScore === 0)
  const score = unscored ? 0 : (rawScore ?? 0)
  const band: HealthBand = unscored ? 'green' : bandOf(payload.grade?.band, score)
  const metrics: TipHealthMetric[] = payload.metrics.map((m) => ({
    name: m.name,
    tiers: tiersOf(m.entityTier),
    score: m.score,
    weight: m.weight,
    lastGenerated: m.lastGeneratedAt ?? undefined,
    ruleId: m.ruleId,
  }))
  const latest = payload.metrics
    .map((m) => m.lastGeneratedAt)
    .filter((x): x is string => Boolean(x))
    .sort()
    .at(-1)
  return {
    baseId,
    baseName,
    score,
    band,
    unscored: unscored || undefined,
    metrics,
    issues,
    assessedAt: latest,
    insights: [],
  }
}
