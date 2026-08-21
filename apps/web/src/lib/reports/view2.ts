/**
 * Reports v2 view helpers — labels for a report DEFINITION and its embedded schedule. Shared by the
 * Reports list (ReportsView) and the report page (ReportDefinitionView) so the wording never diverges.
 */
import type { ReportDefinition, EmbeddedSchedule, ReportSectionKey, ReportCadence } from './types';

export const SECTION_LABEL: Record<ReportSectionKey, string> = {
  backups: 'Backup summary',
  connections: 'Connection health',
  schema: 'Schema health',
  docs: 'Documentation updates',
  trends: 'Trends',
  dataHealth: 'Data health',
};

export const SECTION_ORDER: ReportSectionKey[] = ['backups', 'connections', 'schema', 'docs', 'trends', 'dataHealth'];

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ord = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][(((n % 100) >> 3) ^ 1) && n % 10] || 'th'}`;

export const CADENCE_LABEL: Record<ReportCadence, string> = {
  data_backup: 'On each data backup',
  schema_backup: 'On each schema backup',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

/** One-line cadence summary for a report's embedded schedule (or "Manual" when unscheduled). */
export function cadenceLabel(s: EmbeddedSchedule | null): string {
  if (!s) return 'Manual';
  if (s.cadence === 'data_backup') return 'On each data backup';
  if (s.cadence === 'schema_backup') return 'On each schema backup';
  if (s.cadence === 'weekly') return `Weekly · ${DOW[s.day ?? 1]} ${s.time ?? '09:00'}`;
  return `Monthly · ${ord(s.day ?? 1)} ${s.time ?? '09:00'}`;
}

/** "N sections · All bases" / "Schema health · Sales CRM" — the compact scope summary. */
export function scopeLabel(def: ReportDefinition, baseNames: Record<string, string> = {}): string {
  const secs = def.sections.length === 1 ? SECTION_LABEL[def.sections[0]] : `${def.sections.length} sections`;
  let bases: string;
  if (!def.baseScope) bases = 'All bases';
  else if (def.baseScope.length === 1) bases = baseNames[def.baseScope[0]] || def.baseScope[0];
  else bases = `${def.baseScope.length} bases`;
  return `${secs} · ${bases}`;
}

/** Plain-English window label. */
export function windowLabel(w: ReportDefinition['window']): string {
  if (w.kind === 'since_last') return 'Since the last report';
  if (w.kind === 'rolling') return `Rolling ${w.days} days`;
  return 'All time';
}
