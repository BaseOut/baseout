// Report document types — workflows-local copy.
//
// A matching copy of apps/server/src/lib/reports/types.ts (the render-relevant
// subset). The engine ASSEMBLES the document; this task only RENDERS it, so we
// keep our own copy rather than import across apps (same mirror philosophy as
// the DB schema mirrors — CLAUDE.md §6). Keep in lockstep with the engine copy.

export const REPORT_SCHEMA_VERSION = 1;

export interface Delta {
  dir: "up" | "down" | "flat";
  goodWhenUp?: boolean;
  text: string;
}

export type Tone = "success" | "warning" | "error" | "neutral" | "primary";
export type SectionTone = "success" | "warning" | "error";

export interface ReportStat {
  label: string;
  icon: string;
  value: string;
  sub?: string;
  delta?: Delta;
  tone?: Tone;
}

export interface SectionStat {
  label: string;
  value: string;
  delta?: Delta;
  tone?: SectionTone;
}

export interface ReportSection<Row> {
  tone: SectionTone;
  statusLabel: string;
  stats: SectionStat[];
  rows: Row[];
  emptyLine: string;
}

export type ReportGenerationState = "running" | "generated" | "failed";
export type ReportStatus = "healthy" | "issues" | "failed";

export interface ReportTrigger {
  kind: "scheduled" | "manual";
  by?: string;
}

export interface ReportDeliverySummary {
  lastSentAt: string;
  sent: number;
  delivered: number;
  failures?: { email: string; reason: string }[];
}

export interface ReportSummary {
  id: string;
  windowStart: string;
  windowEnd: string;
  adHoc?: boolean;
  generatedAt: string | null;
  generationState: ReportGenerationState;
  trigger: ReportTrigger;
  status: ReportStatus;
  backupsOk: number;
  backupsFailed: number;
  delivery: ReportDeliverySummary | null;
}

export interface BackupRow {
  baseName: string;
  outcome: "ok" | "failed" | "partial";
  tables?: number;
  fields?: number;
  records: number;
  volume: string;
  runId?: string;
  error?: string;
  destinationUrl?: string;
  destinationName?: string;
}

export interface ConnectionRow {
  name: string;
  kind: "source" | "destination";
  status: "connected" | "auth_failed" | "broken";
  incident?: string;
  reconnect?: boolean;
  connectionId?: string;
}

export interface SchemaChangeRow {
  entityId: string;
  entityName: string;
  location: string;
  change: string;
  tone: "neutral" | "warning" | "error";
}

export interface DocRow {
  docId: string;
  title: string;
  action: "created" | "updated";
  at: string;
  by?: string;
}

export interface ReportTrendPoint {
  at: string;
  value: number;
}

export interface ReportTrendMetric {
  label: string;
  unit?: string;
  points: ReportTrendPoint[];
  delta?: Delta;
}

export interface ReportTrends {
  available: boolean;
  note?: string;
  metrics: ReportTrendMetric[];
}

export interface DataHealthRow {
  baseId: string;
  baseName: string;
  records: number;
  attachments: number;
}

export interface ReportDataHealth {
  available: boolean;
  note?: string;
  stats: SectionStat[];
  rows: DataHealthRow[];
}

export interface ReportDetail extends ReportSummary {
  schemaVersion: number;
  strip: ReportStat[];
  backupSummary?: ReportSection<BackupRow>;
  connectionHealth?: ReportSection<ConnectionRow>;
  schemaHealth?: ReportSection<SchemaChangeRow>;
  documentation?: ReportSection<DocRow>;
  trends?: ReportTrends;
  dataHealth?: ReportDataHealth;
}
