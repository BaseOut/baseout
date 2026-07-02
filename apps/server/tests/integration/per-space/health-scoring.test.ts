// Pure logic for AI Health scoring (openspec/changes/server-schema-health-scoring).
// Prompt resolution + grade math + staleness — no DB / AI, unit-testable.

import { describe, it, expect } from "vitest";
import {
  aggregateGrade,
  band,
  isMetricStale,
  resolveMetricPrompt,
} from "../../../src/lib/per-space/health-scoring";

describe("resolveMetricPrompt", () => {
  it("prefers a per-entity override", () => {
    expect(
      resolveMetricPrompt({ override: "O", space: "S", systemDefault: "D" }),
    ).toEqual({ prompt: "O", source: "override" });
  });
  it("falls back to the space-level prompt", () => {
    expect(
      resolveMetricPrompt({ override: null, space: "S", systemDefault: "D" }),
    ).toEqual({ prompt: "S", source: "space" });
  });
  it("falls back to the system default", () => {
    expect(
      resolveMetricPrompt({ override: null, space: null, systemDefault: "D" }),
    ).toEqual({ prompt: "D", source: "system" });
  });
  it("treats blank/whitespace prompts as absent", () => {
    expect(
      resolveMetricPrompt({ override: "   ", space: "", systemDefault: "D" }),
    ).toEqual({ prompt: "D", source: "system" });
  });
});

describe("band", () => {
  it("bands by score with clamping", () => {
    expect(band(100)).toBe("green");
    expect(band(90)).toBe("green");
    expect(band(89)).toBe("yellow");
    expect(band(60)).toBe("yellow");
    expect(band(59)).toBe("red");
    expect(band(0)).toBe("red");
    expect(band(120)).toBe("green");
    expect(band(-5)).toBe("red");
  });
});

describe("aggregateGrade", () => {
  it("is the weighted average of enabled metrics", () => {
    expect(
      aggregateGrade([
        { score: 100, weight: 3, enabled: true },
        { score: 0, weight: 1, enabled: true },
      ]),
    ).toEqual({ score: 75, band: "yellow" });
  });
  it("excludes disabled metrics", () => {
    expect(
      aggregateGrade([
        { score: 100, weight: 1, enabled: true },
        { score: 0, weight: 1, enabled: false },
      ]),
    ).toEqual({ score: 100, band: "green" });
  });
  it("falls back to a simple average when all weights are zero", () => {
    expect(
      aggregateGrade([
        { score: 80, weight: 0, enabled: true },
        { score: 60, weight: 0, enabled: true },
      ]),
    ).toEqual({ score: 70, band: "yellow" });
  });
  it("returns null when no metric is enabled", () => {
    expect(aggregateGrade([{ score: 100, weight: 1, enabled: false }])).toBeNull();
    expect(aggregateGrade([])).toBeNull();
  });
});

describe("isMetricStale", () => {
  const older = new Date("2026-06-01T00:00:00Z");
  const newer = new Date("2026-06-10T00:00:00Z");
  it("is stale when never generated", () => {
    expect(isMetricStale(older, null)).toBe(true);
    expect(isMetricStale(null, null)).toBe(true);
  });
  it("is stale when the prompt changed after the last generation", () => {
    expect(isMetricStale(newer, older)).toBe(true);
  });
  it("is fresh when the prompt is unchanged since generation", () => {
    expect(isMetricStale(older, newer)).toBe(false);
    expect(isMetricStale(null, newer)).toBe(false);
  });
});
