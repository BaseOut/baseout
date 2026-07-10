// AI schema descriptions — pure planning/prompt/parse logic
// (server-schema-descriptions). No DB, no AI SDK: the generate call is injected
// by describe-schema-io.ts, so this module unit-tests without either.
//
// POC rules (proposal): describe only entities that are ACTIVE and carry
// neither a human (Airtable) description nor an existing ai_description —
// human prose always wins, and already-generated text is never churned.
// Existing human descriptions still ride along in prompts as context.

export interface DescribeEntityBase {
  baseId: string;
  name: string;
  description: string | null;
  aiDescription: string | null;
  status: string;
}
export interface DescribeEntityTable {
  tableId: string;
  baseId: string;
  name: string;
  description: string | null;
  aiDescription: string | null;
  status: string;
}
export interface DescribeEntityField {
  fieldId: string;
  tableId: string;
  name: string;
  type: string;
  description: string | null;
  aiDescription: string | null;
  status: string;
}

const needsDescription = (e: { description: string | null; aiDescription: string | null; status: string }) =>
  e.status === "active" && !e.description && !e.aiDescription;

export interface DescriptionPlan {
  describeBase: boolean;
  tableIds: string[];
  fieldIds: string[];
}

/** Which of one base's entities need an AI description. */
export function planDescriptionTargets(args: {
  base: DescribeEntityBase;
  tables: DescribeEntityTable[];
  fields: DescribeEntityField[];
}): DescriptionPlan {
  return {
    describeBase: needsDescription(args.base),
    tableIds: args.tables.filter(needsDescription).map((t) => t.tableId),
    fieldIds: args.fields.filter(needsDescription).map((f) => f.fieldId),
  };
}

/** Max stored description length — model output beyond this is truncated. */
const MAX_DESCRIPTION = 500;

/**
 * One prompt per table: full live-field list as context (names, types, any
 * human descriptions), asking for JSON keyed by the TARGET field ids only
 * (+ optionally the table itself).
 */
export function buildTablePrompt(args: {
  baseName: string;
  table: { tableId: string; name: string };
  fields: { fieldId: string; name: string; type: string; description: string | null }[];
  targetFieldIds: string[];
  describeTable: boolean;
}): string {
  const fieldLines = args.fields
    .map((f) => `- ${f.fieldId}: "${f.name}" (type: ${f.type})${f.description ? ` — existing description: ${f.description}` : ""}`)
    .join("\n");
  const targets = args.targetFieldIds.map((id) => `"${id}"`).join(", ");
  const wantTable = args.describeTable
    ? `a one-sentence "table" description of what the "${args.table.name}" table holds, and `
    : "";
  return [
    `You document Airtable schemas. Base: "${args.baseName}". Table: "${args.table.name}".`,
    `Fields:`,
    fieldLines,
    ``,
    `Write ${wantTable}a concise one-sentence description for each of these field ids: ${targets || "(none)"}.`,
    `Descriptions state what the data IS and how it's used — plain language, no fluff, under 25 words each.`,
    `Respond with ONLY a JSON object, no prose, shaped exactly like:`,
    `{"table": "…", "fields": {${args.targetFieldIds.map((id) => `"${id}": "…"`).join(", ")}}}`,
  ].join("\n");
}

/** One prompt per base: table names as context, one overview sentence back. */
export function buildBasePrompt(args: {
  base: { baseId: string; name: string };
  tableNames: string[];
}): string {
  return [
    `You document Airtable schemas. Base: "${args.base.name}" containing the tables: ${args.tableNames.map((n) => `"${n}"`).join(", ")}.`,
    `Write a one-to-two-sentence plain-language description of what this base is for.`,
    `Respond with ONLY a JSON object, no prose: {"base": "…"}`,
  ].join("\n");
}

/**
 * Defensive JSON extraction from model output — tolerates code fences and
 * surrounding prose; returns null (never throws) when nothing parses.
 * Non-string input (some Workers AI models return `response` as an ALREADY
 * PARSED object when the output is pure JSON) passes through as-is.
 */
export function parseModelJson(text: unknown): unknown | null {
  if (text != null && typeof text === "object") return text;
  if (!text || typeof text !== "string") return null;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidates = [fenced?.[1], text];
  for (const c of candidates) {
    if (!c) continue;
    const start = c.indexOf("{");
    const end = c.lastIndexOf("}");
    if (start === -1 || end <= start) continue;
    try {
      return JSON.parse(c.slice(start, end + 1));
    } catch {
      // fall through to the next candidate
    }
  }
  return null;
}

const cleanDescription = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.length > MAX_DESCRIPTION ? t.slice(0, MAX_DESCRIPTION) : t;
};

export interface TableResponse {
  tableDescription?: string;
  fieldDescriptions: Record<string, string>;
}

/** Filter a parsed table response down to the requested targets, cleaned. */
export function applyTableResponse(
  parsed: unknown,
  args: { targetFieldIds: string[]; describeTable: boolean },
): TableResponse {
  const out: TableResponse = { fieldDescriptions: {} };
  if (parsed == null || typeof parsed !== "object") return out;
  const p = parsed as { table?: unknown; fields?: unknown };
  if (args.describeTable) out.tableDescription = cleanDescription(p.table);
  if (p.fields && typeof p.fields === "object") {
    const wanted = new Set(args.targetFieldIds);
    for (const [id, v] of Object.entries(p.fields as Record<string, unknown>)) {
      if (!wanted.has(id)) continue;
      const d = cleanDescription(v);
      if (d) out.fieldDescriptions[id] = d;
    }
  }
  return out;
}

/** Extract the base description from a parsed base response. */
export function applyBaseResponse(parsed: unknown): string | undefined {
  if (parsed == null || typeof parsed !== "object") return undefined;
  return cleanDescription((parsed as { base?: unknown }).base);
}
