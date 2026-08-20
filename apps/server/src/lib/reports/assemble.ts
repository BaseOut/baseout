// Document assembler (pure, unit-tested) — server-reports task 2.4.
//
// Composes the section builders into one versioned ReportDetail JSON: the header
// status strip (with per-metric deltas vs the prior run), the report verdict,
// and only the sections the definition requested (base-scope is applied upstream
// when the assembler's data is fetched). This one document is the single source
// for the web view, the HTML export, and the PDF.

import {
  buildBackupsSection,
  buildConnectionsSection,
  buildDataHealthStub,
  buildDocsSection,
  buildSchemaSection,
  buildTrendsStub,
  summarizeBackups,
  type BackupBaseOutcome,
  type BuildConnectionsInput,
  type BuildSchemaInput,
  type DocInput,
} from "./sections";
import {
  REPORT_SCHEMA_VERSION,
  type Delta,
  type ReportDetail,
  type ReportSection,
  type ReportSectionKey,
  type ReportStat,
  type ReportStatus,
  type ReportTrigger,
} from "./types";

export interface AssemblePriorCounts {
  backupsOk?: number;
  backupsFailed?: number;
  connectionIssues?: number;
  docUpdates?: number;
}

export interface AssembleInput {
  run: { id: string; adHoc: boolean };
  trigger: ReportTrigger;
  window: { start: Date; end: Date };
  /** The definition's requested sections; drives what the document carries. */
  sections: readonly ReportSectionKey[];
  data: {
    backups?: readonly BackupBaseOutcome[];
    connections?: BuildConnectionsInput;
    schema?: BuildSchemaInput;
    docs?: readonly DocInput[];
  };
  /** Prior run's headline counts for the strip deltas, if any. */
  prior?: AssemblePriorCounts | null;
  now: Date;
}

function countDelta(
  current: number,
  previous: number | undefined,
  goodWhenUp: boolean,
): Delta | undefined {
  if (previous == null) return undefined;
  const diff = current - previous;
  return {
    dir: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
    goodWhenUp,
    text: diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "±0",
  };
}

/**
 * Assemble the versioned report document. Sections not in `input.sections` are
 * omitted entirely; requested sections always render (clean state when empty).
 */
export function assembleReport(input: AssembleInput): ReportDetail {
  const wants = new Set(input.sections);
  const strip: ReportStat[] = [];

  const doc: ReportDetail = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    id: input.run.id,
    windowStart: input.window.start.toISOString(),
    windowEnd: input.window.end.toISOString(),
    adHoc: input.run.adHoc,
    generatedAt: input.now.toISOString(),
    generationState: "generated",
    trigger: input.trigger,
    status: "healthy",
    backupsOk: 0,
    backupsFailed: 0,
    delivery: null,
    strip,
  };

  // backups — also produces the run's headline counts.
  if (wants.has("backups")) {
    const bases = input.data.backups ?? [];
    const { ok, failed } = summarizeBackups(bases);
    doc.backupsOk = ok;
    doc.backupsFailed = failed;
    doc.backupSummary = buildBackupsSection(bases);
    strip.push({
      label: "Backups",
      icon: "database",
      value: `${ok}/${bases.length}`,
      tone: failed > 0 ? "error" : "success",
      delta: countDelta(failed, input.prior?.backupsFailed, false),
    });
  }

  if (wants.has("connections")) {
    const section = buildConnectionsSection(
      input.data.connections ?? { connections: [] },
    );
    doc.connectionHealth = section;
    const issues = section.rows.length;
    strip.push({
      label: "Connections",
      icon: "plug",
      value: String(issues),
      tone: section.tone,
      delta: countDelta(issues, input.prior?.connectionIssues, false),
    });
  }

  if (wants.has("schema")) {
    const schemaInput = input.data.schema ?? { changes: [] };
    const section = buildSchemaSection(schemaInput);
    doc.schemaHealth = section;
    strip.push({
      label: "Schema",
      icon: "layers",
      value: schemaInput.healthScore
        ? String(schemaInput.healthScore.current)
        : String(section.rows.length),
      tone: section.tone,
    });
  }

  if (wants.has("docs")) {
    const section = buildDocsSection(input.data.docs ?? []);
    doc.documentation = section;
    strip.push({
      label: "Docs",
      icon: "file-text",
      value: String(section.rows.length),
      tone: "neutral",
      delta: countDelta(section.rows.length, input.prior?.docUpdates, true),
    });
  }

  if (wants.has("trends")) doc.trends = buildTrendsStub();
  if (wants.has("dataHealth")) doc.dataHealth = buildDataHealthStub();

  doc.status = deriveVerdict(doc);
  return doc;
}

/** Report verdict: issues if any requested section is warning/error, else healthy. */
function deriveVerdict(doc: ReportDetail): ReportStatus {
  const sections: (ReportSection<unknown> | undefined)[] = [
    doc.backupSummary,
    doc.connectionHealth,
    doc.schemaHealth,
    doc.documentation,
  ];
  const hasIssue = sections.some((s) => s && s.tone !== "success");
  return hasIssue ? "issues" : "healthy";
}
