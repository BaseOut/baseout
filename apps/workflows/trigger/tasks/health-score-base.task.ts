// Trigger.dev wrapper for runHealthScoreBase (openspec/changes/workflows-health-scoring).
//
// The pure orchestration lives in ./health-score-base.ts; this file wires the
// real Claude call + the engine `health-sync` POST and is what the Trigger.dev
// runner picks up. Runs on Node (process.env is the config source).
//
// Structured output: a forced single tool (`report_score`) returns the
// {score, findings} object — reliable + well-typed across SDK versions, and the
// 4.x model family rejects assistant prefill (the older structured-output hack).
// Model is claude-opus-4-8 per CLAUDE.md (default to the latest/most-capable
// Claude); swap HEALTH_SCORE_MODEL to claude-haiku-4-5 / claude-sonnet-4-6 if
// cost dictates — that's a deliberate downgrade, the operator's call.

import { task } from "@trigger.dev/sdk";
import Anthropic from "@anthropic-ai/sdk";
import {
  runHealthScoreBase,
  type HealthScoreBaseInput,
  type HealthScoreBaseResult,
  type HealthFinding,
  type HealthSyncPayload,
} from "./health-score-base";

/** JSON-serializable payload (mirrors HealthScoreBaseInput — no non-JSON types). */
export type HealthScoreBasePayload = HealthScoreBaseInput;

const HEALTH_SCORE_MODEL = "claude-opus-4-8";

const SCORING_SYSTEM =
  "You are a schema-health auditor. You are given a metric's evaluation " +
  "instructions and a Space's Airtable schema METADATA ONLY (entity names, " +
  "types, descriptions — never record data). Evaluate the metric and report a " +
  "0-100 health sub-score (100 = ideal) plus specific, advisory, non-pejorative " +
  "findings. Phrase findings as opportunities (e.g. '12 fields could use clearer " +
  "descriptions'), never as judgments. Always answer by calling report_score.";

// Tool input schema for the forced structured result. (Numeric range is enforced
// by the pure orchestration's clamp, not the schema — JSON-schema numeric
// constraints aren't reliably honored.)
const REPORT_SCORE_TOOL = {
  name: "report_score",
  description: "Report the metric's 0-100 sub-score and its findings.",
  input_schema: {
    type: "object" as const,
    properties: {
      score: { type: "integer", description: "0-100 health sub-score (100 = ideal)." },
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            severity: { type: "string", enum: ["high", "medium", "low"] },
            targetType: { type: "string", enum: ["base", "table", "field"] },
            targetId: { type: "string", description: "Airtable entity id, if applicable." },
            message: { type: "string", description: "Short advisory finding." },
          },
          required: ["severity", "message"],
          additionalProperties: false,
        },
      },
    },
    required: ["score", "findings"],
    additionalProperties: false,
  },
};

async function scoreMetricWithClaude(
  client: Anthropic,
  args: { prompt: string; entityTier: string; schemaContext: string },
): Promise<{ score: number; findings: HealthFinding[] }> {
  const res = await client.messages.create({
    model: HEALTH_SCORE_MODEL,
    max_tokens: 4096,
    system: SCORING_SYSTEM,
    tools: [REPORT_SCORE_TOOL],
    tool_choice: { type: "tool", name: "report_score" },
    messages: [
      {
        role: "user",
        content:
          `Metric (${args.entityTier}-level) instructions:\n${args.prompt}\n\n` +
          `Schema (metadata only — no record data):\n${args.schemaContext}`,
      },
    ],
  });

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("health scorer: model did not return a report_score tool call");
  }
  const input = toolUse.input as { score?: unknown; findings?: unknown };
  const score = typeof input.score === "number" ? input.score : 0;
  const findings = Array.isArray(input.findings) ? (input.findings as HealthFinding[]) : [];
  return { score, findings };
}

function trimSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

// Engine health-sync POST. 409 (space DB not provisioned) / 501 (not managed_pg)
// degrade to a no-op so a not-ready Space doesn't fail the run; other non-2xx
// throws so the task retries.
async function postHealthSync(
  engineUrl: string,
  internalToken: string,
  spaceId: string,
  payload: HealthSyncPayload,
): Promise<void> {
  const url = `${trimSlash(engineUrl)}/api/internal/spaces/${encodeURIComponent(spaceId)}/health-sync`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-internal-token": internalToken, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 409 || res.status === 501) return;
  if (!res.ok) throw new Error(`health-sync ${res.status}`);
}

export const healthScoreBaseTask = task({
  id: "health-score-base",
  maxDuration: 600,
  run: async (payload: HealthScoreBasePayload): Promise<HealthScoreBaseResult> => {
    const engineUrl = process.env.BACKUP_ENGINE_URL;
    const internalToken = process.env.INTERNAL_TOKEN;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!engineUrl) throw new Error("BACKUP_ENGINE_URL is not set in the Trigger.dev env");
    if (!internalToken) throw new Error("INTERNAL_TOKEN is not set in the Trigger.dev env");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in the Trigger.dev env");

    const client = new Anthropic({ apiKey });

    return runHealthScoreBase(payload, {
      scoreMetric: (args) => scoreMetricWithClaude(client, args),
      postHealthSync: (p) => postHealthSync(engineUrl, internalToken, payload.spaceId, p),
    });
  },
});
