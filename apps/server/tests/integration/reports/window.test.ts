import { describe, expect, it } from "vitest";
import {
  computeWindow,
  selectChainAnchor,
  type PriorRun,
} from "../../../src/lib/reports/window";

const d = (iso: string) => new Date(iso);

describe("selectChainAnchor — ad-hoc / failed no-advance", () => {
  it("returns null when there are no prior runs", () => {
    expect(selectChainAnchor([])).toBeNull();
  });

  it("picks the most recent non-ad-hoc generated run's window_end", () => {
    const runs: PriorRun[] = [
      { windowEnd: d("2026-01-01T00:00:00Z"), adHoc: false, generationState: "generated" },
      { windowEnd: d("2026-02-01T00:00:00Z"), adHoc: false, generationState: "generated" },
    ];
    expect(selectChainAnchor(runs)).toEqual(d("2026-02-01T00:00:00Z"));
  });

  it("ignores ad-hoc runs even if they are the most recent", () => {
    const runs: PriorRun[] = [
      { windowEnd: d("2026-02-01T00:00:00Z"), adHoc: false, generationState: "generated" },
      { windowEnd: d("2026-03-01T00:00:00Z"), adHoc: true, generationState: "generated" },
    ];
    // The ad-hoc run does not advance the chain — anchor stays at Feb.
    expect(selectChainAnchor(runs)).toEqual(d("2026-02-01T00:00:00Z"));
  });

  it("ignores failed and running runs", () => {
    const runs: PriorRun[] = [
      { windowEnd: d("2026-02-01T00:00:00Z"), adHoc: false, generationState: "generated" },
      { windowEnd: d("2026-03-01T00:00:00Z"), adHoc: false, generationState: "failed" },
      { windowEnd: d("2026-03-15T00:00:00Z"), adHoc: false, generationState: "running" },
    ];
    expect(selectChainAnchor(runs)).toEqual(d("2026-02-01T00:00:00Z"));
  });
});

describe("computeWindow — since_last", () => {
  const now = d("2026-04-01T12:00:00Z");

  it("uses the chain anchor as the start", () => {
    const w = computeWindow({
      windowKind: "since_last",
      now,
      chainAnchor: d("2026-03-01T00:00:00Z"),
      firstBackupStart: d("2026-01-01T00:00:00Z"),
    });
    expect(w).toEqual({ start: d("2026-03-01T00:00:00Z"), end: now });
  });

  it("first report falls back to the first backup start", () => {
    const w = computeWindow({
      windowKind: "since_last",
      now,
      chainAnchor: null,
      firstBackupStart: d("2026-01-15T00:00:00Z"),
    });
    expect(w).toEqual({ start: d("2026-01-15T00:00:00Z"), end: now });
  });

  it("collapses to an empty [now, now) when there is nothing prior", () => {
    const w = computeWindow({
      windowKind: "since_last",
      now,
      chainAnchor: null,
      firstBackupStart: null,
    });
    expect(w).toEqual({ start: now, end: now });
  });
});

describe("computeWindow — rolling", () => {
  const now = d("2026-04-10T00:00:00Z");

  it("covers [now - N days, now) and ignores the chain anchor", () => {
    const w = computeWindow({
      windowKind: "rolling",
      windowDays: 7,
      now,
      chainAnchor: d("2026-01-01T00:00:00Z"),
      firstBackupStart: d("2025-01-01T00:00:00Z"),
    });
    expect(w).toEqual({ start: d("2026-04-03T00:00:00Z"), end: now });
  });

  it("throws when windowDays is missing", () => {
    expect(() =>
      computeWindow({
        windowKind: "rolling",
        windowDays: null,
        now,
        chainAnchor: null,
        firstBackupStart: null,
      }),
    ).toThrow(/windowDays/);
  });
});

describe("computeWindow — all_time", () => {
  const now = d("2026-04-01T00:00:00Z");

  it("starts at the first backup", () => {
    const w = computeWindow({
      windowKind: "all_time",
      now,
      chainAnchor: d("2026-03-01T00:00:00Z"),
      firstBackupStart: d("2025-06-01T00:00:00Z"),
    });
    expect(w).toEqual({ start: d("2025-06-01T00:00:00Z"), end: now });
  });

  it("collapses to empty when there are no backups", () => {
    const w = computeWindow({
      windowKind: "all_time",
      now,
      chainAnchor: null,
      firstBackupStart: null,
    });
    expect(w).toEqual({ start: now, end: now });
  });
});
