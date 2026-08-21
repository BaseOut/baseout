import { describe, expect, it } from "vitest";
import { assembleReport, type AssembleInput } from "../../../src/lib/reports/assemble";
import { REPORT_SCHEMA_VERSION } from "../../../src/lib/reports/types";

const baseInput = (over: Partial<AssembleInput> = {}): AssembleInput => ({
  run: { id: "run-1", adHoc: false },
  trigger: { kind: "manual", by: "Autumn" },
  window: { start: new Date("2026-03-01T00:00:00Z"), end: new Date("2026-04-01T00:00:00Z") },
  sections: ["backups", "connections", "schema", "docs"],
  data: {},
  prior: null,
  now: new Date("2026-04-01T00:05:00Z"),
  ...over,
});

describe("assembleReport — document shape", () => {
  it("stamps schemaVersion, window ISO, and trigger", () => {
    const doc = assembleReport(baseInput());
    expect(doc.schemaVersion).toBe(REPORT_SCHEMA_VERSION);
    expect(doc.windowStart).toBe("2026-03-01T00:00:00.000Z");
    expect(doc.windowEnd).toBe("2026-04-01T00:00:00.000Z");
    expect(doc.trigger).toEqual({ kind: "manual", by: "Autumn" });
    expect(doc.generatedAt).toBe("2026-04-01T00:05:00.000Z");
  });

  it("scoped definition carries only its requested sections", () => {
    const doc = assembleReport(
      baseInput({
        sections: ["schema"],
        data: { schema: { changes: [] } },
      }),
    );
    expect(doc.schemaHealth).toBeDefined();
    expect(doc.backupSummary).toBeUndefined();
    expect(doc.connectionHealth).toBeUndefined();
    expect(doc.documentation).toBeUndefined();
    // Strip has exactly one stat (schema).
    expect(doc.strip.map((s) => s.label)).toEqual(["Schema"]);
  });
});

describe("assembleReport — verdict + counts", () => {
  it("healthy when every section is clean", () => {
    const doc = assembleReport(baseInput());
    expect(doc.status).toBe("healthy");
    expect(doc.backupsOk).toBe(0);
    expect(doc.backupsFailed).toBe(0);
  });

  it("issues + headline counts when a backup failed; other sections still assemble", () => {
    const doc = assembleReport(
      baseInput({
        data: {
          backups: [
            { baseName: "Sales CRM", outcome: "ok", records: 10, volumeBytes: 1024 },
            { baseName: "Ops", outcome: "failed", records: 0, volumeBytes: 0, error: "429" },
          ],
        },
      }),
    );
    expect(doc.status).toBe("issues");
    expect(doc.backupsOk).toBe(1);
    expect(doc.backupsFailed).toBe(1);
    expect(doc.backupSummary?.rows).toHaveLength(2);
    // Other requested sections still present (clean).
    expect(doc.connectionHealth?.rows).toEqual([]);
    expect(doc.documentation?.rows).toEqual([]);
  });
});

describe("assembleReport — strip deltas vs prior run", () => {
  it("computes a good delta when failures dropped since the prior run", () => {
    const doc = assembleReport(
      baseInput({
        data: { backups: [{ baseName: "A", outcome: "ok", records: 1, volumeBytes: 1 }] },
        prior: { backupsFailed: 2 },
      }),
    );
    const backupsStat = doc.strip.find((s) => s.label === "Backups");
    // failures now 0, prior 2 → down, and down is good for failures.
    expect(backupsStat?.delta).toMatchObject({ dir: "down", text: "-2", goodWhenUp: false });
  });

  it("omits deltas when there is no prior run", () => {
    const doc = assembleReport(baseInput({ data: { backups: [] } }));
    expect(doc.strip.find((s) => s.label === "Backups")?.delta).toBeUndefined();
  });
});

describe("assembleReport — trends / dataHealth stubs", () => {
  it("attaches unavailable stubs when requested", () => {
    const doc = assembleReport(
      baseInput({ sections: ["trends", "dataHealth"], data: {} }),
    );
    expect(doc.trends?.available).toBe(false);
    expect(doc.dataHealth?.available).toBe(false);
    // No core sections requested → none present.
    expect(doc.backupSummary).toBeUndefined();
  });
});
