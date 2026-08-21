import { describe, expect, it, vi } from "vitest";
import {
  generateReport,
  type DefinitionForGen,
  type GenerateDeps,
} from "../../../src/lib/reports/generate";

const DEF: DefinitionForGen = {
  id: "def-1",
  spaceId: "space-1",
  name: "Full Report",
  sections: ["backups", "connections"],
  baseScope: null,
  windowKind: "since_last",
  windowDays: null,
  scheduleFormats: ["pdf"],
};

function makeDeps(over: Partial<GenerateDeps> = {}): GenerateDeps {
  return {
    fetchDefinition: vi.fn(async () => DEF),
    fetchPriorRuns: vi.fn(async () => []),
    fetchFirstBackupStart: vi.fn(async () => new Date("2026-01-01T00:00:00Z")),
    fetchSectionData: vi.fn(async () => ({ backups: [], connections: { connections: [] } })),
    fetchPriorCounts: vi.fn(async () => null),
    insertRunningRun: vi.fn(async () => ({ ok: true, runId: "run-1" })),
    persistDocument: vi.fn(async () => {}),
    enqueueRender: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
    ...over,
  };
}

const now = new Date("2026-04-01T00:00:00Z");

describe("generateReport", () => {
  it("returns no_definition when the definition is missing", async () => {
    const deps = makeDeps({ fetchDefinition: vi.fn(async () => null) });
    const res = await generateReport(
      { definitionId: "x", spaceId: "space-1", trigger: { kind: "manual" }, now },
      deps,
    );
    expect(res).toEqual({ ok: false, reason: "no_definition" });
  });

  it("inserts a running run, persists the document, and enqueues render", async () => {
    const deps = makeDeps();
    const res = await generateReport(
      { definitionId: "def-1", spaceId: "space-1", trigger: { kind: "manual", by: "Autumn" }, now },
      deps,
    );
    expect(res).toEqual({ ok: true, runId: "run-1" });
    expect(deps.persistDocument).toHaveBeenCalledOnce();
    const renderArg = (deps.enqueueRender as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(renderArg).toMatchObject({
      runId: "run-1",
      spaceId: "space-1",
      formats: ["pdf"],
      reportName: "Full Report",
    });
    expect(renderArg.document.schemaVersion).toBeDefined();
    expect(deps.markFailed).not.toHaveBeenCalled();
    // Window came from window math (since_last, no prior → firstBackupStart).
    const insertArg = (deps.insertRunningRun as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(insertArg.windowStart).toEqual(new Date("2026-01-01T00:00:00Z"));
    expect(insertArg.windowEnd).toEqual(now);
    expect(insertArg.adHoc).toBe(false);
  });

  it("honours the one-running guard", async () => {
    const deps = makeDeps({ insertRunningRun: vi.fn(async () => ({ ok: false })) });
    const res = await generateReport(
      { definitionId: "def-1", spaceId: "space-1", trigger: { kind: "manual" }, now },
      deps,
    );
    expect(res).toEqual({ ok: false, reason: "already_running" });
    expect(deps.persistDocument).not.toHaveBeenCalled();
  });

  it("marks the run failed (chain not advanced) when assembly throws", async () => {
    const deps = makeDeps({
      fetchSectionData: vi.fn(async () => {
        throw new Error("per-space DB unreachable");
      }),
    });
    const res = await generateReport(
      { definitionId: "def-1", spaceId: "space-1", trigger: { kind: "scheduled" }, now },
      deps,
    );
    expect(res).toEqual({ ok: false, runId: "run-1", reason: "error" });
    expect(deps.markFailed).toHaveBeenCalledWith("run-1", "per-space DB unreachable");
  });

  it("uses the ad-hoc override window and marks the run ad_hoc", async () => {
    const deps = makeDeps();
    const override = { start: new Date("2026-03-01T00:00:00Z"), end: new Date("2026-03-15T00:00:00Z") };
    await generateReport(
      { definitionId: "def-1", spaceId: "space-1", trigger: { kind: "manual" }, windowOverride: override, now },
      deps,
    );
    const insertArg = (deps.insertRunningRun as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(insertArg.adHoc).toBe(true);
    expect(insertArg.windowStart).toEqual(override.start);
    expect(insertArg.windowEnd).toEqual(override.end);
    // Ad-hoc must not read the prior-run chain.
    expect(deps.fetchPriorRuns).not.toHaveBeenCalled();
  });
});
