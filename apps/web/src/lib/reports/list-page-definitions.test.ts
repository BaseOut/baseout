import { describe, expect, it, vi } from 'vitest'
import {
  getReportDefinitionForPage,
  getReportRunForPage,
  listReportDefinitionsForPage,
} from './list-page-definitions'
import type { ReportDefinitionWithLatestRun, ReportRunView } from '../backup-engine'

const defaultDefinition = {
  id: 'def-1',
  spaceId: 'space-1',
  name: 'Full Staging Report',
  sections: ['backups', 'connections', 'schema', 'docs'],
  baseScope: null,
  windowKind: 'since_last',
  windowDays: null,
  isDefault: true,
  scheduleCadence: null,
  scheduleDay: null,
  scheduleTime: null,
  scheduleFormats: ['pdf'],
  scheduleRecipients: [],
  scheduleSuppressEmpty: true,
  scheduleEnabled: true,
  nextRunAt: null,
  createdBy: null,
  createdAt: '2026-08-17T14:50:42.950Z',
  modifiedAt: '2026-08-17T14:50:42.950Z',
}

describe('listReportDefinitionsForPage', () => {
  it('uses master DB definitions when the engine list is unavailable', async () => {
    const fallbackItems: ReportDefinitionWithLatestRun[] = [
      { definition: defaultDefinition, latestRun: null },
    ]

    const definitions = await listReportDefinitionsForPage({
      spaceId: 'space-1',
      engine: {
        listReportDefinitions: async () => ({ ok: false, code: 'engine_unreachable', status: 0 }),
      },
      repository: {
        listDefinitions: async () => fallbackItems,
      },
    })

    expect(definitions).toEqual([
      expect.objectContaining({
        id: 'def-1',
        name: 'Full Staging Report',
        isDefault: true,
      }),
    ])
  })
})

describe('getReportDefinitionForPage', () => {
  it('uses the master DB definition when the engine detail lookup is unavailable', async () => {
    const definition = await getReportDefinitionForPage({
      spaceId: 'space-1',
      definitionId: 'def-1',
      engine: {
        getReportDefinition: async () => ({ ok: false, code: 'not_found', status: 404 }),
      },
      repository: {
        getDefinition: async () => ({ definition: defaultDefinition, runs: [] }),
      },
    })

    expect(definition).toEqual({
      definition: expect.objectContaining({
        id: 'def-1',
        name: 'Full Staging Report',
        isDefault: true,
      }),
      runs: [],
    })
  })
})

const defaultRun: ReportRunView = {
  id: 'run-1',
  spaceId: 'space-1',
  reportDefinitionId: 'def-1',
  windowStart: '2026-08-01T00:00:00.000Z',
  windowEnd: '2026-08-17T00:00:00.000Z',
  adHoc: false,
  triggerKind: 'manual',
  triggerBy: 'Ada',
  generationState: 'generated',
  status: 'healthy',
  backupsOk: 3,
  backupsFailed: 0,
  documentLocation: 'reports/space-1/run-1/document.json',
  artifactPdfLocation: null,
  artifactHtmlLocation: null,
  error: null,
  createdAt: '2026-08-17T14:50:42.950Z',
  generatedAt: '2026-08-17T14:51:00.000Z',
}

const engineDocument = {
  id: 'run-1',
  strip: [{ label: 'Backups', value: '3', icon: 'database-backup' }],
}

describe('getReportRunForPage', () => {
  it('uses the engine document when the engine lookup succeeds', async () => {
    const getRun = vi.fn()
    const page = await getReportRunForPage({
      spaceId: 'space-1',
      runId: 'run-1',
      engine: {
        getReportRun: async () => ({ ok: true, run: defaultRun, document: engineDocument }),
        getReportDefinition: async () => ({
          ok: true,
          definition: defaultDefinition,
          runs: [defaultRun],
        }),
      },
      repository: {
        getRun,
        getDefinition: async () => ({ definition: defaultDefinition, runs: [defaultRun] }),
      },
    })

    expect(page?.report.strip).toEqual([
      expect.objectContaining({ label: 'Backups', value: '3' }),
    ])
    expect(page?.parentReportName).toBe('Full Staging Report')
    expect(getRun).not.toHaveBeenCalled()
  })

  it('renders from the master-DB run when the engine misses it', async () => {
    const page = await getReportRunForPage({
      spaceId: 'space-1',
      runId: 'run-1',
      engine: {
        getReportRun: async () => ({ ok: false, code: 'not_found', status: 404 }),
        getReportDefinition: async () => ({ ok: false, code: 'not_found', status: 404 }),
      },
      repository: {
        getRun: async () => ({ run: defaultRun, document: engineDocument }),
        getDefinition: async () => ({ definition: defaultDefinition, runs: [defaultRun] }),
      },
    })

    expect(page).not.toBeNull()
    expect(page?.report.id).toBe('run-1')
    expect(page?.report.generationState).toBe('generated')
    expect(page?.parentReportName).toBe('Full Staging Report')
    expect(page?.parentReportId).toBe('def-1')
  })

  it('returns null when neither the engine nor the master DB has the run', async () => {
    const page = await getReportRunForPage({
      spaceId: 'space-1',
      runId: 'run-missing',
      engine: {
        getReportRun: async () => ({ ok: false, code: 'not_found', status: 404 }),
        getReportDefinition: async () => ({ ok: false, code: 'not_found', status: 404 }),
      },
      repository: {
        getRun: async () => null,
        getDefinition: async () => null,
      },
    })

    expect(page).toBeNull()
  })
})
