// Section builders (pure, unit-tested) — server-reports task 2.3.
//
// Each builder takes already-fetched, typed input (the assembler owns the DB
// reads) and produces a ReportSection<Row>. Empty sections emit their clean
// state — never omitted. Entity refs on rows are typed, never prose. Trends and
// dataHealth are stubbed until the per-backup snapshot capture lands (task 6).

import type {
  BackupRow,
  ConnectionRow,
  DocRow,
  ReportDataHealth,
  ReportSection,
  ReportTrends,
  SchemaChangeRow,
  SectionStat,
  SectionTone,
} from "./types";

/** Human-readable byte size, e.g. 12_500_000 → "11.9 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
}

/** Worst tone wins: error > warning > success. */
function worstTone(tones: readonly SectionTone[]): SectionTone {
  if (tones.includes("error")) return "error";
  if (tones.includes("warning")) return "warning";
  return "success";
}

function issuesLabel(count: number): string {
  if (count <= 0) return "Healthy";
  return `${count} ${count === 1 ? "issue" : "issues"}`;
}

// --- backups --------------------------------------------------------------

export interface BackupBaseOutcome {
  baseName: string;
  outcome: "ok" | "failed" | "partial";
  tables?: number;
  fields?: number;
  records: number;
  volumeBytes: number;
  runId?: string;
  error?: string;
  destinationName?: string;
  destinationUrl?: string;
}

/** { ok, failed } headline counts — also written to report_runs. */
export function summarizeBackups(bases: readonly BackupBaseOutcome[]): {
  ok: number;
  failed: number;
} {
  let ok = 0;
  let failed = 0;
  for (const b of bases) {
    if (b.outcome === "ok") ok += 1;
    else failed += 1; // failed | partial both count as not-ok for the headline
  }
  return { ok, failed };
}

export function buildBackupsSection(
  bases: readonly BackupBaseOutcome[],
): ReportSection<BackupRow> {
  const rows: BackupRow[] = bases.map((b) => ({
    baseName: b.baseName,
    outcome: b.outcome,
    tables: b.tables,
    fields: b.fields,
    records: b.records,
    volume: formatBytes(b.volumeBytes),
    runId: b.runId,
    error: b.error,
    destinationName: b.destinationName,
    destinationUrl: b.destinationUrl,
  }));
  const { ok, failed } = summarizeBackups(bases);
  const stats: SectionStat[] = [
    { label: "Bases", value: String(bases.length) },
    { label: "Succeeded", value: String(ok), tone: "success" },
    { label: "Failed", value: String(failed), tone: failed > 0 ? "error" : "success" },
  ];
  const tone: SectionTone = failed > 0 ? "error" : "success";
  return {
    tone,
    statusLabel: issuesLabel(failed),
    stats,
    rows,
    emptyLine: "No backups ran this period.",
  };
}

// --- connections ----------------------------------------------------------

export interface ConnectionSnapshot {
  name: string;
  kind: "source" | "destination";
  status: "connected" | "auth_failed" | "broken";
  /** in-window incident description, e.g. "Token expired 3d ago" */
  incident?: string;
  connectionId?: string;
}

export interface BuildConnectionsInput {
  connections: readonly ConnectionSnapshot[];
  /** true when status-transition history is thinner than the window — note it. */
  historyThin?: boolean;
}

export function buildConnectionsSection(
  input: BuildConnectionsInput,
): ReportSection<ConnectionRow> {
  const problems = input.connections.filter(
    (c) => c.status !== "connected" || c.incident,
  );
  const rows: ConnectionRow[] = problems.map((c) => ({
    name: c.name,
    kind: c.kind,
    status: c.status,
    incident: c.incident,
    reconnect: c.status === "auth_failed" || c.status === "broken",
    connectionId: c.connectionId,
  }));
  const failed = rows.filter((r) => r.status !== "connected").length;
  const stats: SectionStat[] = [
    { label: "Connections", value: String(input.connections.length) },
    { label: "Issues", value: String(rows.length), tone: rows.length > 0 ? "error" : "success" },
  ];
  const emptyLine = input.historyThin
    ? "No connection issues observed this period (limited transition history)."
    : "No connection issues this period.";
  return {
    tone: failed > 0 ? "error" : rows.length > 0 ? "warning" : "success",
    statusLabel: issuesLabel(rows.length),
    stats,
    rows,
    emptyLine,
  };
}

// --- schema ---------------------------------------------------------------

export interface SchemaChangeInput {
  entityId: string;
  entityName: string;
  location: string;
  change: string;
  tone: "neutral" | "warning" | "error";
}

export interface BuildSchemaInput {
  changes: readonly SchemaChangeInput[];
  /** Health score snapshot for the delta stat, when available. */
  healthScore?: { current: number; previous?: number | null } | null;
}

export function buildSchemaSection(
  input: BuildSchemaInput,
): ReportSection<SchemaChangeRow> {
  const rows: SchemaChangeRow[] = input.changes.map((c) => ({
    entityId: c.entityId,
    entityName: c.entityName,
    location: c.location,
    change: c.change,
    tone: c.tone,
  }));
  const stats: SectionStat[] = [];
  if (input.healthScore) {
    const { current, previous } = input.healthScore;
    const stat: SectionStat = { label: "Health score", value: `${current}` };
    if (previous != null) {
      const diff = current - previous;
      stat.delta = {
        dir: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
        goodWhenUp: true,
        text: diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "±0",
      };
    }
    stats.push(stat);
  }
  stats.push({ label: "Changes", value: String(rows.length) });
  const tone = worstTone(rows.map((r) => (r.tone === "neutral" ? "success" : r.tone)));
  const problemCount = rows.filter((r) => r.tone !== "neutral").length;
  return {
    tone,
    statusLabel: rows.length === 0 ? "Healthy" : issuesLabel(problemCount),
    stats,
    rows,
    emptyLine: "No schema changes this period.",
  };
}

// --- docs -----------------------------------------------------------------

export interface DocInput {
  docId: string;
  title: string;
  action: "created" | "updated";
  at: string;
  by?: string;
}

export function buildDocsSection(
  docs: readonly DocInput[],
): ReportSection<DocRow> {
  const rows: DocRow[] = docs.map((d) => ({
    docId: d.docId,
    title: d.title,
    action: d.action,
    at: d.at,
    by: d.by,
  }));
  const created = rows.filter((r) => r.action === "created").length;
  const updated = rows.filter((r) => r.action === "updated").length;
  const stats: SectionStat[] = [
    { label: "Created", value: String(created) },
    { label: "Updated", value: String(updated) },
  ];
  return {
    // Documentation activity is informational, never an "issue".
    tone: "success",
    statusLabel: rows.length === 0 ? "No updates" : `${rows.length} update${rows.length === 1 ? "" : "s"}`,
    stats,
    rows,
    emptyLine: "No documentation updates this period.",
  };
}

// --- trends / dataHealth (stubbed until task 6) ---------------------------

export function buildTrendsStub(): ReportTrends {
  return {
    available: false,
    note: "Trends appear once per-backup metric snapshots are captured.",
    metrics: [],
  };
}

export function buildDataHealthStub(): ReportDataHealth {
  return {
    available: false,
    note: "Data health appears once per-base record and attachment capture lands.",
    stats: [],
    rows: [],
  };
}
