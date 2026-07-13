// Pure tests for the engine-side Workers AI health scorer
// (all-Cloudflare POC, 2026-07-10): response validation/sanitization + prompt
// shape. The per-metric loop mirrors the workflows task (tested there); the
// engine wiring is exercised by the rerun smoke.

import { describe, expect, it } from "vitest";
import { buildMetricPrompt, parseScoreResponse } from "../../../src/lib/per-space/health-score-run";

describe("parseScoreResponse", () => {
  it("clamps the score and sanitizes findings", () => {
    const out = parseScoreResponse({
      score: 130,
      findings: [
        { severity: "high", targetType: "field", targetId: "fld1", message: "  Missing description  " },
        { severity: "catastrophic", targetType: "spaceship", message: "weird enums fall back" },
        { message: 42 }, // non-string message dropped
        "garbage",
      ],
    });
    expect(out.score).toBe(100);
    expect(out.findings).toEqual([
      { severity: "high", targetType: "field", targetId: "fld1", message: "Missing description" },
      { severity: "low", targetType: null, targetId: null, message: "weird enums fall back" },
    ]);
  });

  it("caps finding messages at 500 chars and rounds/floors scores", () => {
    const out = parseScoreResponse({ score: 71.6, findings: [{ severity: "low", message: "x".repeat(900) }] });
    expect(out.score).toBe(72);
    expect(out.findings[0]!.message.length).toBe(500);
  });

  it("throws on unusable output so the metric counts as failed", () => {
    expect(() => parseScoreResponse(null)).toThrow();
    expect(() => parseScoreResponse({ findings: [] })).toThrow();
    expect(() => parseScoreResponse({ score: "eighty" })).toThrow();
  });
});

describe("buildMetricPrompt", () => {
  it("carries the metric prompt + schema context and demands strict JSON", () => {
    const p = buildMetricPrompt({ prompt: "Flag fields without descriptions", schemaContext: "Table Deals: Amount (currency)" });
    expect(p).toContain("Flag fields without descriptions");
    expect(p).toContain("Table Deals");
    expect(p).toContain('"score"');
    expect(p).toContain('"findings"');
    expect(p.toLowerCase()).toContain("only a json object");
  });
});
