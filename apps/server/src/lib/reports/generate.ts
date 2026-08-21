// Report generation orchestrator (pure, deps-injected) — server-reports task 3.2/3.4 core.
//
// Given a definition + trigger (+ optional ad-hoc window override), this:
//   1. resolves the window (window math, unless overridden),
//   2. inserts a `running` run under the one-running-per-definition guard,
//   3. assembles the ReportDetail (section builders), persists it, and
//   4. enqueues the workflow render leg.
// A failure after the run row exists flips it to `failed` (chain not advanced).
// All I/O is injected so this is unit-tested with fakes; productionGenerateDeps
// wires the real master-DB reads + Trigger.dev enqueue.

import { assembleReport, type AssemblePriorCounts } from "./assemble";
import {
  type BackupBaseOutcome,
  type BuildConnectionsInput,
  type BuildSchemaInput,
  type DocInput,
} from "./sections";
import { computeWindow, selectChainAnchor, type PriorRun } from "./window";
import type {
  ReportDetail,
  ReportSectionKey,
  ReportTrigger,
  ReportWindowKind,
} from "./types";

/** The definition fields generation needs (subset of the mirror row). */
export interface DefinitionForGen {
  id: string;
  spaceId: string;
  name: string;
  sections: ReportSectionKey[];
  baseScope: string[] | null;
  windowKind: ReportWindowKind;
  windowDays: number | null;
  scheduleFormats: string[];
}

export interface SectionData {
  backups?: BackupBaseOutcome[];
  connections?: BuildConnectionsInput;
  schema?: BuildSchemaInput;
  docs?: DocInput[];
}

export interface GenerateInput {
  definitionId: string;
  spaceId: string;
  trigger: ReportTrigger;
  /** Explicit ad-hoc override; when set, the window chain is NOT advanced. */
  windowOverride?: { start: Date; end: Date } | null;
  now: Date;
}

export interface GenerateDeps {
  fetchDefinition(spaceId: string, defId: string): Promise<DefinitionForGen | null>;
  fetchPriorRuns(defId: string): Promise<PriorRun[]>;
  fetchFirstBackupStart(spaceId: string, baseScope: string[] | null): Promise<Date | null>;
  fetchSectionData(args: {
    spaceId: string;
    sections: ReportSectionKey[];
    baseScope: string[] | null;
    window: { start: Date; end: Date };
  }): Promise<SectionData>;
  fetchPriorCounts(defId: string): Promise<AssemblePriorCounts | null>;
  /**
   * Insert a `running` run. Returns { ok:false } when the one-running guard
   * (partial-unique index) rejects a concurrent generation.
   */
  insertRunningRun(row: {
    spaceId: string;
    reportDefinitionId: string;
    windowStart: Date;
    windowEnd: Date;
    adHoc: boolean;
    triggerKind: "scheduled" | "manual";
    triggerBy: string | null;
  }): Promise<{ ok: boolean; runId?: string }>;
  /** Store the JSON document + update the run row (location, counts, verdict). */
  persistDocument(runId: string, doc: ReportDetail): Promise<void>;
  /**
   * Enqueue the render leg. The assembled document is passed INLINE (small JSON)
   * so the Node render task needs no cross-app storage read.
   */
  enqueueRender(args: {
    runId: string;
    spaceId: string;
    document: ReportDetail;
    formats: string[];
    reportName: string;
  }): Promise<void>;
  markFailed(runId: string, error: string): Promise<void>;
}

export type GenerateReason =
  | "no_definition"
  | "already_running"
  | "error";

export interface GenerateResult {
  ok: boolean;
  runId?: string;
  reason?: GenerateReason;
}

export async function generateReport(
  input: GenerateInput,
  deps: GenerateDeps,
): Promise<GenerateResult> {
  const def = await deps.fetchDefinition(input.spaceId, input.definitionId);
  if (!def) return { ok: false, reason: "no_definition" };

  const adHoc = !!input.windowOverride;
  let window: { start: Date; end: Date };
  if (input.windowOverride) {
    window = input.windowOverride;
  } else {
    const priorRuns = await deps.fetchPriorRuns(def.id);
    const chainAnchor = selectChainAnchor(priorRuns);
    const firstBackupStart = await deps.fetchFirstBackupStart(def.spaceId, def.baseScope);
    window = computeWindow({
      windowKind: def.windowKind,
      windowDays: def.windowDays,
      now: input.now,
      chainAnchor,
      firstBackupStart,
    });
  }

  const inserted = await deps.insertRunningRun({
    spaceId: def.spaceId,
    reportDefinitionId: def.id,
    windowStart: window.start,
    windowEnd: window.end,
    adHoc,
    triggerKind: input.trigger.kind,
    triggerBy: input.trigger.by ?? null,
  });
  if (!inserted.ok || !inserted.runId) {
    return { ok: false, reason: "already_running" };
  }
  const runId = inserted.runId;

  try {
    const [data, prior] = await Promise.all([
      deps.fetchSectionData({
        spaceId: def.spaceId,
        sections: def.sections,
        baseScope: def.baseScope,
        window,
      }),
      deps.fetchPriorCounts(def.id),
    ]);

    const doc = assembleReport({
      run: { id: runId, adHoc },
      trigger: input.trigger,
      window,
      sections: def.sections,
      data,
      prior,
      now: input.now,
    });

    await deps.persistDocument(runId, doc);
    await deps.enqueueRender({
      runId,
      spaceId: def.spaceId,
      document: doc,
      formats: normalizeFormats(def.scheduleFormats),
      reportName: def.name,
    });
    return { ok: true, runId };
  } catch (err) {
    await deps.markFailed(runId, err instanceof Error ? err.message : String(err));
    return { ok: false, runId, reason: "error" };
  }
}

/** At least one format; only pdf/html allowed. */
function normalizeFormats(formats: string[]): string[] {
  const allowed = formats.filter((f) => f === "pdf" || f === "html");
  return allowed.length > 0 ? allowed : ["pdf"];
}
