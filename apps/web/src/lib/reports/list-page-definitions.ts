import { and, desc, eq, inArray } from 'drizzle-orm'
import type {
  GetReportResult,
  GetReportRunResult,
  ListReportsResult,
  ReportDefinitionView,
  ReportDefinitionWithLatestRun,
  ReportRunView,
} from '../backup-engine'
import { reportDefinitions, reportRuns, type ReportDefinitionRow, type ReportRunRow } from '../../db/schema'
import type { AppDb } from '../../db'
import { mapDefinitionFromEngine, mapDetailFromEngine } from './mapFromEngine'
import type { ReportDefinition, ReportDetail, ReportSectionKey } from './types'

export interface ReportDefinitionEngine {
  listReportDefinitions(spaceId: string): Promise<ListReportsResult>
}

export interface ReportDetailEngine {
  getReportDefinition(spaceId: string, definitionId: string): Promise<GetReportResult>
}

export interface ReportRunEngine {
  getReportRun(spaceId: string, runId: string): Promise<GetReportRunResult>
  getReportDefinition(spaceId: string, definitionId: string): Promise<GetReportResult>
}

export interface ReportDefinitionRepository {
  listDefinitions(spaceId: string): Promise<ReportDefinitionWithLatestRun[]>
  getDefinition(
    spaceId: string,
    definitionId: string,
  ): Promise<{ definition: ReportDefinitionView; runs: ReportRunView[] } | null>
  getRun(
    spaceId: string,
    runId: string,
  ): Promise<{ run: ReportRunView; document: Record<string, unknown> | null } | null>
}

function wireDate(value: Date | string | null): string | null {
  return value instanceof Date ? value.toISOString() : value
}

function definitionToWire(row: ReportDefinitionRow): ReportDefinitionView {
  return {
    ...row,
    nextRunAt: wireDate(row.nextRunAt),
    createdAt: wireDate(row.createdAt) ?? '',
    modifiedAt: wireDate(row.modifiedAt) ?? '',
  }
}

function runToWire(row: ReportRunRow): ReportRunView {
  return {
    ...row,
    windowStart: wireDate(row.windowStart) ?? '',
    windowEnd: wireDate(row.windowEnd) ?? '',
    createdAt: wireDate(row.createdAt) ?? '',
    generatedAt: wireDate(row.generatedAt),
  }
}

export function createMasterDbReportDefinitionRepository(
  db: AppDb,
): ReportDefinitionRepository {
  return {
    async listDefinitions(spaceId) {
      const defs = await db
        .select()
        .from(reportDefinitions)
        .where(eq(reportDefinitions.spaceId, spaceId))
        .orderBy(desc(reportDefinitions.isDefault), reportDefinitions.name)

      if (defs.length === 0) return []

      const runs = await db
        .select()
        .from(reportRuns)
        .where(
          inArray(
            reportRuns.reportDefinitionId,
            defs.map((d) => d.id),
          ),
        )
        .orderBy(desc(reportRuns.windowEnd))

      const latestByDefinition = new Map<string, ReportRunRow>()
      for (const run of runs) {
        if (!latestByDefinition.has(run.reportDefinitionId)) {
          latestByDefinition.set(run.reportDefinitionId, run)
        }
      }

      return defs.map((definition) => ({
        definition: definitionToWire(definition),
        latestRun: latestByDefinition.has(definition.id)
          ? runToWire(latestByDefinition.get(definition.id)!)
          : null,
      }))
    },

    async getDefinition(spaceId, definitionId) {
      const [definition] = await db
        .select()
        .from(reportDefinitions)
        .where(and(eq(reportDefinitions.spaceId, spaceId), eq(reportDefinitions.id, definitionId)))
        .limit(1)

      if (!definition) return null

      const runs = await db
        .select()
        .from(reportRuns)
        .where(
          and(
            eq(reportRuns.spaceId, spaceId),
            eq(reportRuns.reportDefinitionId, definitionId),
          ),
        )
        .orderBy(desc(reportRuns.windowEnd))

      return {
        definition: definitionToWire(definition),
        runs: runs.map(runToWire),
      }
    },

    async getRun(spaceId, runId) {
      const [row] = await db
        .select()
        .from(reportRuns)
        .where(and(eq(reportRuns.spaceId, spaceId), eq(reportRuns.id, runId)))
        .limit(1)

      if (!row) return null
      // Assembled JSON lives in R2 (`document_location`), not in Postgres. The
      // page mapper synthesizes a shell when the engine cannot fetch it.
      return { run: runToWire(row), document: null }
    },
  }
}

export async function listReportDefinitionsForPage(input: {
  spaceId: string
  engine: ReportDefinitionEngine | null
  repository: Pick<ReportDefinitionRepository, 'listDefinitions'>
}): Promise<ReportDefinition[]> {
  if (input.engine) {
    try {
      const res = await input.engine.listReportDefinitions(input.spaceId)
      if (res.ok) {
        return res.definitions.map(({ definition, latestRun }) =>
          mapDefinitionFromEngine(definition, latestRun ? [latestRun] : []),
        )
      }
    } catch {
      // Fall back to the master DB below. Report definitions are web-owned.
    }
  }

  const items = await input.repository.listDefinitions(input.spaceId)
  return items.map(({ definition, latestRun }) =>
    mapDefinitionFromEngine(definition, latestRun ? [latestRun] : []),
  )
}

export async function getReportDefinitionForPage(input: {
  spaceId: string
  definitionId: string
  engine: ReportDetailEngine | null
  repository: Pick<ReportDefinitionRepository, 'getDefinition'>
}): Promise<{ definition: ReportDefinition; runs: ReportRunView[] } | null> {
  if (input.engine) {
    try {
      const res = await input.engine.getReportDefinition(input.spaceId, input.definitionId)
      if (res.ok) {
        return {
          definition: mapDefinitionFromEngine(res.definition, res.runs),
          runs: res.runs,
        }
      }
    } catch {
      // Fall back to the master DB below. Report definitions are web-owned.
    }
  }

  const item = await input.repository.getDefinition(input.spaceId, input.definitionId)
  if (!item) return null
  return {
    definition: mapDefinitionFromEngine(item.definition, item.runs),
    runs: item.runs,
  }
}

export interface ReportRunPage {
  report: ReportDetail
  parentReportId: string
  parentReportName: string | null
  parentSections: ReportSectionKey[] | null
  parentWindow: ReportDefinition['window'] | null
  parentBaseScope: string[] | null
}

async function parentFromDefinition(
  spaceId: string,
  definitionId: string,
  engine: ReportRunEngine | null,
  repository: Pick<ReportDefinitionRepository, 'getDefinition'>,
): Promise<Omit<ReportRunPage, 'report'>> {
  const fallback = {
    parentReportId: definitionId,
    parentReportName: null as string | null,
    parentSections: null as ReportSectionKey[] | null,
    parentWindow: null as ReportDefinition['window'] | null,
    parentBaseScope: null as string[] | null,
  }
  const loaded = await getReportDefinitionForPage({
    spaceId,
    definitionId,
    engine,
    repository,
  })
  if (!loaded) return fallback
  return {
    parentReportId: loaded.definition.id,
    parentReportName: loaded.definition.name,
    parentSections: loaded.definition.sections,
    parentWindow: loaded.definition.window,
    parentBaseScope: loaded.definition.baseScope,
  }
}

export async function getReportRunForPage(input: {
  spaceId: string
  runId: string
  engine: ReportRunEngine | null
  repository: Pick<ReportDefinitionRepository, 'getRun' | 'getDefinition'>
}): Promise<ReportRunPage | null> {
  if (input.engine) {
    try {
      const res = await input.engine.getReportRun(input.spaceId, input.runId)
      if (res.ok) {
        const report = mapDetailFromEngine(res.document, res.run)
        if (report) {
          const parent = await parentFromDefinition(
            input.spaceId,
            res.run.reportDefinitionId,
            input.engine,
            input.repository,
          )
          return { report, ...parent }
        }
      }
    } catch {
      // Fall back to the master DB below. Report runs are web-readable.
    }
  }

  const item = await input.repository.getRun(input.spaceId, input.runId)
  if (!item) return null
  const report = mapDetailFromEngine(item.document, item.run)
  if (!report) return null
  const parent = await parentFromDefinition(
    input.spaceId,
    item.run.reportDefinitionId,
    null,
    input.repository,
  )
  return { report, ...parent }
}
