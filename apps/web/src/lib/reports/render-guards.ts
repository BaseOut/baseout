import type { ReportDataHealth, ReportTrends } from './types'

export function getTrendBases(trends: ReportTrends | null | undefined): string[] {
  return trends?.metrics[0]?.byBase?.map((b) => b.baseName) ?? []
}

export function hasRenderableDataHealth(raw: unknown): raw is ReportDataHealth {
  if (!raw || typeof raw !== 'object') return false
  const value = raw as Partial<ReportDataHealth>
  return Array.isArray(value.records?.byBase) && Array.isArray(value.attachments?.byBase)
}
