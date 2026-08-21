/**
 * Map engine / backup-engine wire shapes onto the ui-only Reports view types.
 * Views stay fixture-compatible; swapping mock → live touches this module only.
 */
import type {
  ReportDefinitionView,
  ReportRunView,
  ReportRecipient,
} from '../backup-engine'
import type {
  ReportDefinition,
  ReportDetail,
  ReportRun,
  ReportCadence,
  ReportSectionKey,
  ReportWindow,
  EmbeddedSchedule,
  ReportDelivery,
  ReportSection,
  ReportTrigger,
  ReportStatus,
  ReportGenerationState,
} from './types'
import { lucideStripIcon } from './strip-icons'

const SECTION_KEYS = new Set<ReportSectionKey>([
  'backups',
  'connections',
  'schema',
  'docs',
  'trends',
  'dataHealth',
])

function asSectionKey(raw: string): ReportSectionKey | null {
  return SECTION_KEYS.has(raw as ReportSectionKey) ? (raw as ReportSectionKey) : null
}

function windowFromWire(kind: string, days: number | null): ReportWindow {
  if (kind === 'rolling' && days != null) return { kind: 'rolling', days }
  if (kind === 'all_time') return { kind: 'all_time' }
  return { kind: 'since_last' }
}

function cadenceFromWire(raw: string | null): ReportCadence | null {
  if (raw === 'data_backup' || raw === 'schema_backup' || raw === 'weekly' || raw === 'monthly') {
    return raw
  }
  return null
}

function deliveryFromRun(run: ReportRunView | null): ReportDelivery | null {
  // Engine stores per-recipient rows separately; list wire only carries counts on the run.
  // Until we hydrate deliveries, leave null (UI shows "—" / no delivery chip).
  void run
  return null
}

function runFromWire(run: ReportRunView): ReportRun {
  const generationState = (['generated', 'running', 'failed'].includes(run.generationState)
    ? run.generationState
    : 'failed') as ReportGenerationState
  const status = (['healthy', 'issues', 'failed'].includes(run.status ?? '')
    ? run.status
    : generationState === 'failed'
      ? 'failed'
      : 'healthy') as ReportStatus
  return {
    id: run.id,
    windowStart: run.windowStart,
    windowEnd: run.windowEnd,
    adHoc: run.adHoc || undefined,
    generatedAt: run.generatedAt,
    generationState,
    trigger: {
      kind: run.triggerKind === 'manual' ? 'manual' : 'scheduled',
      by: run.triggerBy ?? undefined,
    } satisfies ReportTrigger,
    status,
    backupsOk: run.backupsOk,
    backupsFailed: run.backupsFailed,
    delivery: deliveryFromRun(run),
  }
}

function scheduleFromDef(def: ReportDefinitionView): EmbeddedSchedule | null {
  const cadence = cadenceFromWire(def.scheduleCadence)
  if (!cadence) return null
  const formats = (def.scheduleFormats ?? []).filter(
    (f): f is 'pdf' | 'html' => f === 'pdf' || f === 'html',
  )
  return {
    cadence,
    day: def.scheduleDay ?? undefined,
    time: def.scheduleTime ?? undefined,
    recipients: (def.scheduleRecipients ?? []).map((r: ReportRecipient) => ({
      kind: r.kind,
      email: r.email,
      name: r.name,
    })),
    formats: formats.length > 0 ? formats : ['pdf'],
    suppressEmpty: def.scheduleSuppressEmpty,
    enabled: def.scheduleEnabled,
    lastDelivery: null,
  }
}

/** Wire definition + optional runs → ui-only ReportDefinition. */
export function mapDefinitionFromEngine(
  def: ReportDefinitionView,
  runs: ReportRunView[] = [],
): ReportDefinition {
  const sections = def.sections
    .map(asSectionKey)
    .filter((s): s is ReportSectionKey => s != null)
  return {
    id: def.id,
    name: def.name,
    sections: sections.length > 0 ? sections : ['backups', 'connections', 'schema', 'docs'],
    baseScope: def.baseScope,
    window: windowFromWire(def.windowKind, def.windowDays),
    schedule: scheduleFromDef(def),
    isDefault: def.isDefault || undefined,
    createdBy: def.createdBy ?? undefined,
    createdAt: def.createdAt,
    runs: runs.map(runFromWire),
  }
}

const EMPTY_SECTION = (emptyLine: string): ReportSection<never> => ({
  tone: 'success',
  statusLabel: 'Healthy',
  stats: [],
  rows: [],
  emptyLine,
})

/**
 * Coerce an engine-assembled document JSON (or null while generating) into the
 * ui-only ReportDetail the views render. Missing sections get clean empty lines.
 */
export function mapDetailFromEngine(
  document: Record<string, unknown> | null,
  run: ReportRunView,
): ReportDetail | null {
  if (!document) {
    // Engine or storage missed the assembled JSON — still render the run shell so
    // `/reports/run/:id` is not a 404 when the run row itself exists.
    const emptyLine =
      run.generationState === 'running'
        ? 'Generating…'
        : run.generationState === 'failed'
          ? 'This run failed to generate.'
          : 'No details stored for this run.'
    return {
      ...runFromWire(run),
      strip: [],
      backupSummary: EMPTY_SECTION(emptyLine),
      connectionHealth: EMPTY_SECTION(emptyLine),
      schemaHealth: EMPTY_SECTION(emptyLine),
      documentation: EMPTY_SECTION(emptyLine),
    }
  }

  const summary = runFromWire(run)
  const asSec = <T,>(raw: unknown, emptyLine: string): ReportSection<T> => {
    if (!raw || typeof raw !== 'object') return EMPTY_SECTION(emptyLine) as ReportSection<T>
    const s = raw as Partial<ReportSection<T>>
    return {
      tone: (s.tone as ReportSection<T>['tone']) ?? 'success',
      statusLabel: s.statusLabel ?? 'Healthy',
      stats: Array.isArray(s.stats) ? s.stats : [],
      rows: Array.isArray(s.rows) ? s.rows : [],
      emptyLine: s.emptyLine ?? emptyLine,
    }
  }

  return {
    ...summary,
    id: typeof document.id === 'string' ? document.id : summary.id,
    windowStart:
      typeof document.windowStart === 'string' ? document.windowStart : summary.windowStart,
    windowEnd: typeof document.windowEnd === 'string' ? document.windowEnd : summary.windowEnd,
    strip: Array.isArray(document.strip)
      ? (document.strip as ReportDetail['strip']).map((s) => ({
          ...s,
          icon: lucideStripIcon(typeof s.icon === 'string' ? s.icon : 'circle-help'),
        }))
      : [],
    backupSummary: asSec(document.backupSummary, 'No backup issues this period.'),
    connectionHealth: asSec(document.connectionHealth, 'No connection issues this period.'),
    schemaHealth: asSec(document.schemaHealth, 'No schema issues this period.'),
    documentation: asSec(document.documentation, 'No documentation updates this period.'),
    trends: document.trends as ReportDetail['trends'],
    dataHealth: document.dataHealth as ReportDetail['dataHealth'],
  }
}
