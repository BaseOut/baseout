import { describe, expect, it } from "vitest";
import { renderHtml } from "../trigger/tasks/_lib/report-html";
import type { ReportDetail } from "../trigger/tasks/_lib/report-types";

function issuesDoc(): ReportDetail {
  return {
    schemaVersion: 1,
    id: "run-1",
    windowStart: "2026-03-01T00:00:00Z",
    windowEnd: "2026-04-01T00:00:00Z",
    generatedAt: "2026-04-01T00:05:00Z",
    generationState: "generated",
    trigger: { kind: "scheduled", by: "data_backup" },
    status: "issues",
    backupsOk: 1,
    backupsFailed: 1,
    delivery: null,
    strip: [{ label: "Backups", icon: "database", value: "1/2", tone: "error" }],
    backupSummary: {
      tone: "error",
      statusLabel: "1 issue",
      stats: [{ label: "Failed", value: "1", tone: "error" }],
      rows: [
        { baseName: "Sales CRM", outcome: "ok", records: 10, volume: "1.9 MB", runId: "r-ok" },
        { baseName: "Ops", outcome: "failed", records: 0, volume: "0 B", runId: "r-bad", error: "Airtable 429 rate limit" },
      ],
      emptyLine: "No backups ran this period.",
    },
    connectionHealth: {
      tone: "success",
      statusLabel: "Healthy",
      stats: [],
      rows: [],
      emptyLine: "No connection issues this period.",
    },
  };
}

function cleanDoc(): ReportDetail {
  return {
    schemaVersion: 1,
    id: "run-2",
    windowStart: "2026-03-01T00:00:00Z",
    windowEnd: "2026-04-01T00:00:00Z",
    generatedAt: "2026-04-01T00:05:00Z",
    generationState: "generated",
    trigger: { kind: "manual" },
    status: "healthy",
    backupsOk: 0,
    backupsFailed: 0,
    delivery: null,
    strip: [],
    backupSummary: { tone: "success", statusLabel: "Healthy", stats: [], rows: [], emptyLine: "No backups ran this period." },
    connectionHealth: { tone: "success", statusLabel: "Healthy", stats: [], rows: [], emptyLine: "No connection issues this period." },
    trends: { available: false, note: "Trends appear once snapshots are captured.", metrics: [] },
  };
}

describe("renderHtml — issues document", () => {
  const html = renderHtml(issuesDoc(), { appBaseUrl: "https://app", spaceId: "s1" });

  it("is a self-contained document with inline CSS and no external assets", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<style>");
    expect(html).not.toMatch(/<link[^>]+href/i);
    expect(html).not.toMatch(/<script/i);
  });

  it("lists the failed base with its error text", () => {
    expect(html).toContain("Ops");
    expect(html).toContain("Airtable 429 rate limit");
  });

  it("resolves typed refs to absolute app deep-links", () => {
    expect(html).toContain('href="https://app/spaces/s1/backups/r-bad"');
  });

  it("renders the clean line for the empty connection section", () => {
    expect(html).toContain("No connection issues this period.");
  });
});

describe("renderHtml — clean document", () => {
  it("shows clean lines and the trends-unavailable note", () => {
    const html = renderHtml(cleanDoc());
    expect(html).toContain("No backups ran this period.");
    expect(html).toContain("Trends appear once snapshots are captured.");
  });

  it("renders refs as plain text when no base URL is given", () => {
    const html = renderHtml(issuesDoc()); // no ctx
    expect(html).toContain("Ops");
    expect(html).not.toContain("href=");
  });
});
