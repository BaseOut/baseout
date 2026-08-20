// The versioned report document + definition model.
//
// Reverse-engineered from the fork's apps/web/src/lib/reports/types.ts (the v2
// model confirmed 2026-07-13) so the engine's assembled document, the web view,
// the HTML export, and the PDF all render from ONE shape and can never disagree
// (server-reports/design.md §"The versioned report document"). apps/web and
// apps/workflows keep their own matching copies; keep the shapes in lockstep.

/** Bump when the document shape changes in a way renderers must branch on. */
export const REPORT_SCHEMA_VERSION = 1;

// --- Primitives -----------------------------------------------------------

export interface Delta {
  dir: "up" | "down" | "flat";
  /** When true, an "up" delta is good (green); when false/undefined, up is bad. */
  goodWhenUp?: boolean;
  /** Pre-formatted, e.g. "+2", "-1", "±0". */
  text: string;
}

export type Tone = "success" | "warning" | "error" | "neutral" | "primary";
export type SectionTone = "success" | "warning" | "error";

export interface ReportStat {
  label: string;
  /** lucide icon id */
  icon: string;
  /** pre-formatted value */
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

/** A typed entity reference — never prose. Opens the relevant web surface. */
export interface EntityRef {
  kind: "backupRun" | "connection" | "schemaEntity" | "document";
  id: string;
  label: string;
}

export interface ReportSection<Row> {
  tone: SectionTone;
  /** e.g. "Healthy", "1 issue" */
  statusLabel: string;
  stats: SectionStat[];
  rows: Row[];
  /** Clean-state line shown when rows is empty, e.g. "No connection issues this period." */
  emptyLine: string;
}

// --- Run / summary --------------------------------------------------------

export type ReportGenerationState = "running" | "generated" | "failed";
export type ReportStatus = "healthy" | "issues" | "failed";

export interface ReportTrigger {
  kind: "scheduled" | "manual";
  /** snapshot of member / schedule name at generation time */
  by?: string;
}

export interface ReportDeliverySummary {
  lastSentAt: string; // ISO
  sent: number;
  delivered: number;
  failures?: { email: string; reason: string }[];
}

export interface ReportSummary {
  id: string;
  windowStart: string; // ISO, half-open [start, end)
  windowEnd: string; // ISO
  adHoc?: boolean;
  generatedAt: string | null;
  generationState: ReportGenerationState;
  trigger: ReportTrigger;
  status: ReportStatus;
  backupsOk: number;
  backupsFailed: number;
  delivery: ReportDeliverySummary | null;
}

// --- Section row shapes ---------------------------------------------------

export interface BackupRow {
  baseName: string;
  outcome: "ok" | "failed" | "partial";
  tables?: number;
  fields?: number;
  records: number;
  /** pre-formatted, e.g. "12.4 MB" */
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
  /** in-window incident description, e.g. "Token expired 3d ago" */
  incident?: string;
  reconnect?: boolean;
  connectionId?: string;
}

export interface SchemaChangeRow {
  entityId: string;
  entityName: string;
  /** where in the schema, e.g. "Sales CRM · Contacts" */
  location: string;
  change: string;
  tone: "neutral" | "warning" | "error";
}

export interface DocRow {
  docId: string;
  title: string;
  action: "created" | "updated";
  at: string; // ISO
  by?: string;
}

// --- Trends / data health (new capture — stubbed until task 6 lands) ------

export interface ReportTrendPoint {
  at: string; // ISO
  value: number;
}

export interface ReportTrendMetric {
  label: string;
  unit?: string;
  points: ReportTrendPoint[];
  delta?: Delta;
}

export interface ReportTrends {
  /** false until per-backup metric snapshots exist (server-reports task 6). */
  available: boolean;
  /** clean-state / gap note, e.g. "Not enough history captured yet." */
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

// --- The top-level document ----------------------------------------------

export interface ReportDetail extends ReportSummary {
  schemaVersion: number;
  /** header status strip */
  strip: ReportStat[];
  // Section fields are optional: a scoped definition carries ONLY the sections
  // it requested (spec scenario "Scoped definition renders only its sections").
  backupSummary?: ReportSection<BackupRow>;
  connectionHealth?: ReportSection<ConnectionRow>;
  schemaHealth?: ReportSection<SchemaChangeRow>;
  documentation?: ReportSection<DocRow>;
  trends?: ReportTrends;
  dataHealth?: ReportDataHealth;
}

// --- Definition model (what report_definitions stores) --------------------

export type ReportSectionKey =
  | "backups"
  | "connections"
  | "schema"
  | "docs"
  | "trends"
  | "dataHealth";

export type ReportWindowKind = "since_last" | "rolling" | "all_time";

export type ReportWindow =
  | { kind: "since_last" }
  | { kind: "rolling"; days: number }
  | { kind: "all_time" };

export type ReportCadence =
  | "data_backup"
  | "schema_backup"
  | "weekly"
  | "monthly";

export const REPORT_SECTION_KEYS: readonly ReportSectionKey[] = [
  "backups",
  "connections",
  "schema",
  "docs",
  "trends",
  "dataHealth",
] as const;
