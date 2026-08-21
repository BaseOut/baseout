import { describe, expect, it } from 'vitest'
import { mapDetailFromEngine } from './mapFromEngine'
import type { ReportRunView } from '../backup-engine'

const run: ReportRunView = {
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

describe('mapDetailFromEngine', () => {
  it('still renders a generated run when the assembled document is missing', () => {
    const detail = mapDetailFromEngine(null, run)
    expect(detail).not.toBeNull()
    expect(detail?.id).toBe('run-1')
    expect(detail?.generationState).toBe('generated')
    expect(detail?.backupSummary.emptyLine).toBeTruthy()
  })
})
