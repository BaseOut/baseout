import { describe, expect, it } from "vitest";
import {
  buildBackupsSection,
  buildConnectionsSection,
  buildDataHealthStub,
  buildDocsSection,
  buildSchemaSection,
  buildTrendsStub,
  formatBytes,
  summarizeBackups,
  type BackupBaseOutcome,
} from "../../../src/lib/reports/sections";

describe("formatBytes", () => {
  it("formats across units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(12_500_000)).toBe("11.9 MB");
  });
});

describe("buildBackupsSection", () => {
  it("emits the clean state when no backups ran", () => {
    const s = buildBackupsSection([]);
    expect(s.rows).toEqual([]);
    expect(s.tone).toBe("success");
    expect(s.statusLabel).toBe("Healthy");
    expect(s.emptyLine).toMatch(/No backups/);
  });

  it("lists a failed base with its error text and turns the section error-toned", () => {
    const bases: BackupBaseOutcome[] = [
      { baseName: "Sales CRM", outcome: "ok", tables: 5, fields: 40, records: 1200, volumeBytes: 2_000_000, runId: "r1" },
      { baseName: "Ops", outcome: "failed", records: 0, volumeBytes: 0, runId: "r2", error: "Airtable 429 rate limit" },
    ];
    const s = buildBackupsSection(bases);
    expect(s.tone).toBe("error");
    expect(s.statusLabel).toBe("1 issue");
    const failedRow = s.rows.find((r) => r.baseName === "Ops");
    expect(failedRow?.outcome).toBe("failed");
    expect(failedRow?.error).toBe("Airtable 429 rate limit");
    expect(failedRow?.runId).toBe("r2");
    expect(s.rows.find((r) => r.baseName === "Sales CRM")?.volume).toBe("1.9 MB");
  });

  it("summarizeBackups counts ok vs not-ok (partial counts as failed headline)", () => {
    const bases: BackupBaseOutcome[] = [
      { baseName: "A", outcome: "ok", records: 1, volumeBytes: 1 },
      { baseName: "B", outcome: "partial", records: 1, volumeBytes: 1 },
      { baseName: "C", outcome: "failed", records: 0, volumeBytes: 0 },
    ];
    expect(summarizeBackups(bases)).toEqual({ ok: 1, failed: 2 });
  });
});

describe("buildConnectionsSection", () => {
  it("clean state lists no rows and a healthy tone", () => {
    const s = buildConnectionsSection({
      connections: [{ name: "Airtable", kind: "source", status: "connected" }],
    });
    expect(s.rows).toEqual([]);
    expect(s.tone).toBe("success");
  });

  it("surfaces a broken connection with reconnect + connectionId", () => {
    const s = buildConnectionsSection({
      connections: [
        { name: "Airtable", kind: "source", status: "broken", incident: "Token expired 3d ago", connectionId: "c1" },
      ],
    });
    expect(s.tone).toBe("error");
    expect(s.rows[0]).toMatchObject({ status: "broken", reconnect: true, connectionId: "c1" });
  });

  it("notes the gap when transition history is thin", () => {
    const s = buildConnectionsSection({
      connections: [{ name: "Airtable", kind: "source", status: "connected" }],
      historyThin: true,
    });
    expect(s.emptyLine).toMatch(/limited transition history/);
  });
});

describe("buildSchemaSection", () => {
  it("clean state with no changes", () => {
    const s = buildSchemaSection({ changes: [] });
    expect(s.rows).toEqual([]);
    expect(s.statusLabel).toBe("Healthy");
  });

  it("includes a health-score delta and error tone on a breaking change", () => {
    const s = buildSchemaSection({
      changes: [
        { entityId: "e1", entityName: "Contacts", location: "Sales CRM", change: "Field 'Email' deleted", tone: "error" },
      ],
      healthScore: { current: 82, previous: 90 },
    });
    expect(s.tone).toBe("error");
    const scoreStat = s.stats.find((st) => st.label === "Health score");
    expect(scoreStat?.value).toBe("82");
    expect(scoreStat?.delta).toMatchObject({ dir: "down", text: "-8", goodWhenUp: true });
  });
});

describe("buildDocsSection", () => {
  it("counts created vs updated and is never an issue", () => {
    const s = buildDocsSection([
      { docId: "d1", title: "Runbook", action: "created", at: "2026-04-01T00:00:00Z", by: "Dan" },
      { docId: "d2", title: "Schema notes", action: "updated", at: "2026-04-02T00:00:00Z" },
    ]);
    expect(s.tone).toBe("success");
    expect(s.stats).toEqual([
      { label: "Created", value: "1" },
      { label: "Updated", value: "1" },
    ]);
    expect(s.rows).toHaveLength(2);
  });

  it("clean state when nothing changed", () => {
    const s = buildDocsSection([]);
    expect(s.emptyLine).toMatch(/No documentation/);
    expect(s.statusLabel).toBe("No updates");
  });
});

describe("trends / dataHealth stubs", () => {
  it("report unavailable with a note", () => {
    expect(buildTrendsStub().available).toBe(false);
    expect(buildTrendsStub().note).toBeTruthy();
    expect(buildDataHealthStub().available).toBe(false);
    expect(buildDataHealthStub().rows).toEqual([]);
  });
});
