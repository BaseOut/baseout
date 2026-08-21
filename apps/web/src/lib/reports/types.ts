/**
 * Reports domain types.
 *
 * A report is one consolidated document per period ("what happened since the last report"), NOT a
 * live dashboard. It is its own object with its own lifecycle (generation state), distinct from the
 * backup runs it summarizes. The UI never composes a report client-side — it renders what the engine
 * produced; these types are the read shape.
 *
 * Every headline number carries a delta vs the prior report (see `Delta`), because a number without a
 * comparison is decoration. Every section can be empty and then states so explicitly — no section is
 * ever omitted.
 */

/** A signed change vs the prior report. `dir` colours it; `text` is the already-formatted label. */
export interface Delta {
  dir: 'up' | 'down' | 'flat';
  /** Whether an "up" reads as good (more backups) or bad (more failures) — drives the colour. */
  goodWhenUp?: boolean;
  text: string; // e.g. "+2", "-1", "±0"
}

export type ReportGenerationState = 'generated' | 'running' | 'failed';

/** Overall verdict for the whole report (drives the list status badge + header strip tone). */
export type ReportStatus = 'healthy' | 'issues' | 'failed';

export interface ReportTrigger {
  kind: 'scheduled' | 'manual';
  /** Who ran it (manual) or the schedule's name AT GENERATION TIME (scheduled) — a snapshot, so the
   *  report stays self-describing even if the schedule is later renamed or deleted. */
  by?: string;
  /** The producing schedule's id (scheduled runs only). Links the report back to its schedule; absent
   *  for manual runs and for reports whose schedule was deleted (then `by` shows as plain text). */
  scheduleId?: string;
}

/** Per-send delivery outcome. `null` when a report was never emailed (e.g. a manual run you just viewed). */
export interface ReportDelivery {
  lastSentAt: string; // ISO
  sent: number;
  delivered: number;
  /** The recipients that did not receive it, with the reason — expandable on the row. */
  failures?: { email: string; reason: string }[];
}

/** One row in the report list — the audit trail. */
export interface ReportSummary {
  id: string;
  /** Half-open window [start, end); first report starts at the first backup. */
  windowStart: string; // ISO
  windowEnd: string; // ISO
  /** A manual run that overrode the window — labelled, and does not advance the chain. */
  adHoc?: boolean;
  generatedAt: string | null;
  generationState: ReportGenerationState;
  trigger: ReportTrigger;
  status: ReportStatus;
  /** Headline backup counts for the list row. */
  backupsOk: number;
  backupsFailed: number;
  delivery: ReportDelivery | null;
}

/** A labelled metric for the header status strip. `tone` colours a composite (status-dot) value. */
export interface ReportStat {
  label: string;
  icon: string; // lucide id, e.g. "lucide--database-backup"
  value: string; // pre-formatted (a number, "2.4 GB", or a word like "Healthy")
  sub?: string;
  delta?: Delta;
  tone?: 'success' | 'warning' | 'error' | 'neutral' | 'primary';
}

/** Small aggregate shown at the top of a section card, before its itemized rows. */
export interface SectionStat {
  label: string;
  value: string;
  delta?: Delta;
  tone?: 'success' | 'warning' | 'error' | 'neutral';
}

export type SectionTone = 'success' | 'warning' | 'error';

/** Shared per-section wrapper. When `stats` and every list are empty, the card shows the empty line. */
export interface ReportSection<Row> {
  tone: SectionTone;
  /** Word for the section badge, e.g. "Healthy", "1 issue". */
  statusLabel: string;
  stats: SectionStat[];
  rows: Row[];
  /** The affirmative line shown when `rows` is empty, e.g. "No connection issues this period." */
  emptyLine: string;
}

// ── Section row shapes ──────────────────────────────────────────────────────────────────────

export interface BackupRow {
  baseName: string;
  outcome: 'ok' | 'failed' | 'partial';
  /** Structural counts for the period (client 2026-07-14: surface Tables/Fields per base here too). */
  tables?: number | null;
  fields?: number | null;
  records: number | null;
  volume: string | null;
  /** Where the row drills to: a backup run detail (navigate), or an error view for a failure. */
  runId?: string;
  error?: string;
  /** External Storage Destination location for this base's backup — opens in a new tab (spec R3). */
  destinationUrl?: string;
  destinationName?: string;
}

export interface ConnectionRow {
  name: string;
  kind: 'source' | 'destination';
  status: 'connected' | 'auth_failed' | 'broken';
  /** An explicit broken/auth window ("disconnected Jul 8–9") — an alert row, not a silent gap. */
  incident?: string;
  /** True → show a Reconnect action (broken/auth-failed rows). */
  reconnect?: boolean;
  /** The Source/Destination id — the row links to its detail (C4: connections navigate like every
   *  other reference; the whole row opens /sources|destinations/detail?id=<id>). */
  connectionId?: string;
}

export interface SchemaChangeRow {
  /** Entity id in the schema index — clicking opens the SHARED EntityPanel via schema:openEntity. */
  entityId: string;
  entityName: string;
  location: string; // "Sales CRM ▸ Deals"
  change: string; // "Option added", "Field removed", "Health dropped to amber"
  tone: 'neutral' | 'warning' | 'error';
}

export interface DocRow {
  docId: string;
  title: string;
  action: 'created' | 'updated';
  at: string; // ISO
  by: string;
}

// ── Schedules ───────────────────────────────────────────────────────────────────────────────

/** How often a schedule fires. "after_backup" is an EVENT trigger (no time); the rest are clock-based. */
export type ScheduleCadence = 'after_backup' | 'daily' | 'weekly' | 'monthly';

/** A recipient chip: a Space member (avatar) or an arbitrary external email (envelope). */
export interface Recipient {
  /** 'member' → internal, shown with an avatar; 'external' → free-typed email, shown with an envelope. */
  kind: 'member' | 'external';
  email: string;
  /** Member display name (member chips only). */
  name?: string;
}

/** One automated report-delivery schedule. Multiple per Space, for different audiences. */
export interface ReportSchedule {
  id: string;
  name: string;
  cadence: ScheduleCadence;
  /** 0–6 (Sun–Sat) for weekly; 1–28 for monthly; omitted for after_backup/daily. */
  day?: number;
  /** "HH:MM" for daily/weekly/monthly; omitted for after_backup. */
  time?: string;
  recipients: Recipient[];
  /** At least one of these; both allowed (spec R5). */
  formats: ('pdf' | 'html')[];
  /** Don't send when nothing changed in the period — default on for after_backup. */
  suppressEmpty: boolean;
  enabled: boolean;
  /** Last delivery outcome for this schedule's most recent send. */
  lastDelivery: ReportDelivery | null;
}

/** The full report — a summary plus the four sections. */
export interface ReportDetail extends ReportSummary {
  /** The header status strip (backups · connections · schema health · docs), each with a delta. */
  strip: ReportStat[];
  backupSummary: ReportSection<BackupRow>;
  connectionHealth: ReportSection<ConnectionRow>;
  schemaHealth: ReportSection<SchemaChangeRow>;
  documentation: ReportSection<DocRow>;
  /** Historical growth of the Space's schema/data over time (client 2026-07-14). Optional section. */
  trends?: ReportTrends;
  /** Record-data + attachment-data health (client 2026-07-14). Optional section (shell; refined after Data page). */
  dataHealth?: ReportDataHealth;
}

// ── Trends + Data health (client 2026-07-14 Slack) ────────────────────────────────────────────
// Historical charts (# tables/fields/records/attachments/automations/interfaces over time, overall or
// by base) and a Data health section split into record data + attachment data. Rendered via the one
// TrendChart primitive (ApexCharts). Historical data is engine snapshots per backup (engine concern);
// the UI is fixtured here.

/** One historical metric plotted over time (overall + per-base series). */
export interface ReportTrendMetric {
  key: 'records' | 'tables' | 'fields' | 'attachments' | 'automations' | 'interfaces';
  label: string;
  /** Drives value formatting: a plain count, or a byte size. */
  unit: 'count' | 'bytes';
  /** The latest value + its change vs the start of the window. */
  current: number;
  delta: Delta;
  /** X-axis labels (dates), shared by overall + every base series. */
  categories: string[];
  /** The Space-wide series. */
  overall: number[];
  /** Per-base breakdown (for the "By base" view of the expanded chart). */
  byBase: { baseId: string; baseName: string; data: number[] }[];
}

export interface ReportTrends {
  metrics: ReportTrendMetric[];
}

/** Data health — record data + attachment data, per Space and per base (Zoho "Data / Files" split). */
export interface ReportDataHealth {
  records: {
    total: number;
    byBase: { baseId: string; baseName: string; tableCount: number; fieldCount: number; recordCount: number; storage: string }[];
  };
  attachments: {
    totalFiles: number;
    totalStorage: string;
    byBase: { baseId: string; baseName: string; attachmentFieldCount: number; fileCount: number; storage: string }[];
  };
  /** Optional trend series for a compact chart in each sub-section. */
  recordsOverTime?: { categories: string[]; data: number[] };
  storageOverTime?: { categories: string[]; data: number[] };
}

// ── Reports v2 model (client 2026-07-13) ──────────────────────────────────────────────────────
//
// A report is now a NAMED, SAVED DEFINITION — what to include (sections), which bases, and the window
// of time to show — distinct from the SCHEDULE, which is just when/who/what-format it goes out. One
// schedule per report (duplicate the report for a second cadence). A Space auto-gets a default
// "Full <Space> Report". The old generated artifacts become each definition's RUN HISTORY.
// Validated against Stripe Sigma / Eventbrite scheduled-reports / Sprout Social (named definition +
// section checkboxes + one embedded schedule). Added alongside the v1 types; the v1 surfaces migrate
// onto these incrementally. (dataHealth is a future 5th section — depends on the Data page.)

/** Which sections a report definition renders. */
export type ReportSectionKey = 'backups' | 'connections' | 'schema' | 'docs' | 'trends' | 'dataHealth';

/** How far back each run covers. `since_last` is the rolling default (since the previous run). */
export type ReportWindow =
  | { kind: 'since_last' }
  | { kind: 'rolling'; days: number }
  | { kind: 'all_time' };

/** Cadence vocabulary v2 (client's list): "after backup" split into data vs schema; no Daily. The two
 *  backup cadences are EVENT triggers (no time); weekly/monthly are clock-based. A cadence is only
 *  offered when the Space actually configures that backup kind. */
export type ReportCadence = 'data_backup' | 'schema_backup' | 'weekly' | 'monthly';

/** A generated artifact belonging to a report definition — the run history; a run's rendered document
 *  is still a `ReportDetail`. Same shape as the v1 list row. */
export type ReportRun = ReportSummary;

/** The single schedule embedded in a report definition (1:1). `null` = manual-only (no auto send). */
export interface EmbeddedSchedule {
  cadence: ReportCadence;
  /** 0–6 (Sun–Sat) for weekly; 1–28 for monthly; omitted for the backup-event cadences. */
  day?: number;
  /** "HH:MM" for weekly/monthly; omitted for the backup-event cadences. */
  time?: string;
  recipients: Recipient[];
  /** At least one; both allowed. */
  formats: ('pdf' | 'html')[];
  /** Don't send when nothing changed in the period. */
  suppressEmpty: boolean;
  enabled: boolean;
  /** Last delivery outcome for this schedule's most recent send. */
  lastDelivery: ReportDelivery | null;
}

/** A saved, named report definition — the new top-level Reports object. */
export interface ReportDefinition {
  id: string;
  /** User-named on creation, e.g. "Full Core CRM Report", "Schema Health on Deals". */
  name: string;
  /** The sections this report includes (order fixed by the renderer). */
  sections: ReportSectionKey[];
  /** Base scope: `null` = all bases in the Space; else the specific base ids to include. */
  baseScope: string[] | null;
  window: ReportWindow;
  /** The one embedded schedule (1:1). `null` = manual-only. */
  schedule: EmbeddedSchedule | null;
  /** The Space's auto-created "Full … Report" — always present, not deletable. */
  isDefault?: boolean;
  createdBy?: string;
  createdAt?: string;
  /** Newest-first run history (generated artifacts). */
  runs: ReportRun[];
}
