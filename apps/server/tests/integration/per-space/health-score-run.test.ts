// Pure tests for the engine-side Workers AI health scorer
// (all-Cloudflare POC, 2026-07-10): response validation/sanitization + prompt
// shape. The per-metric loop mirrors the workflows task (tested there); the
// engine wiring is exercised by the rerun smoke.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMetricPrompt,
  parseScoreResponse,
  workersAiScoreMetric,
} from "../../../src/lib/per-space/health-score-run";
import type { Env } from "../../../src/env";

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

// shared-ai-byok 4.2 — the score adapter's pool/byok branch.
describe("workersAiScoreMetric", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns null when the AI binding is absent or disabled", () => {
    expect(workersAiScoreMetric({} as unknown as Env)).toBeNull();
    expect(
      workersAiScoreMetric({ AI: { run: vi.fn() }, AI_DESCRIPTIONS_ENABLED: "false" } as unknown as Env),
    ).toBeNull();
  });

  it("pool path (no byok): scores via env.AI.run through parseScoreResponse", async () => {
    const run = vi.fn(async () => ({ response: '{"score": 80, "findings": []}' }));
    const scoreMetric = workersAiScoreMetric({ AI: { run } } as unknown as Env);
    expect(scoreMetric).not.toBeNull();
    const out = await scoreMetric!({ prompt: "m", entityTier: "base", schemaContext: "ctx" });
    expect(run).toHaveBeenCalledOnce();
    expect(out).toEqual({ score: 80, findings: [] });
  });

  it("byok path: scores via the customer provider (fetch), never env.AI", async () => {
    const run = vi.fn(async () => ({ response: '{"score": 1}' }));
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: '{"score": 55, "findings": []}' } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const scoreMetric = workersAiScoreMetric({ AI: { run } } as unknown as Env, {
      provider: "openai",
      model: "gpt-x",
      apiKey: "sk-openai",
    });
    const out = await scoreMetric!({ prompt: "m", entityTier: "base", schemaContext: "ctx" });
    expect(out).toEqual({ score: 55, findings: [] });
    expect(run).not.toHaveBeenCalled();
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[0]).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });
});
