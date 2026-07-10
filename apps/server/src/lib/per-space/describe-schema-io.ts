// AI schema descriptions — orchestration + per-Space DB I/O
// (server-schema-descriptions).
//
// `runDescribeBase` is pure orchestration over injected load/save/generate so
// it tests without a DB or model. The drizzle load/save + the Workers AI
// generate adapter live below and are wired by the schema-sync hook. AI calls
// happen OUTSIDE any DB transaction — a generation batch can take seconds and
// must not hold a pooled connection open.

import { and, eq, isNull } from "drizzle-orm";
import { spacePg } from "@baseout/db-schema/space";
import type { Env } from "../../env";
import type { SpaceTx } from "./space-db-pg";
import {
  applyBaseResponse,
  applyTableResponse,
  buildBasePrompt,
  buildTablePrompt,
  parseModelJson,
  planDescriptionTargets,
  type DescribeEntityBase,
  type DescribeEntityField,
  type DescribeEntityTable,
} from "./describe-schema";

export interface DescribeBaseData {
  base: DescribeEntityBase | null;
  tables: DescribeEntityTable[];
  fields: DescribeEntityField[];
}

export interface DescriptionUpdate {
  kind: "base" | "table" | "field";
  id: string;
  description: string;
}

export type GenerateFn = (prompt: string) => Promise<string>;

/**
 * Describe one base's undescribed entities: plan → one base prompt + one prompt
 * per table carrying targets → parse → save. Each batch is independent — a
 * failing/garbage generation drops that batch, never the run.
 */
export async function runDescribeBase(args: {
  baseId: string;
  load: () => Promise<DescribeBaseData>;
  save: (updates: DescriptionUpdate[]) => Promise<void>;
  generate: GenerateFn;
}): Promise<{ described: number }> {
  const { base, tables, fields } = await args.load();
  if (!base) return { described: 0 };

  const plan = planDescriptionTargets({ base, tables, fields });
  const targetTableIds = new Set(plan.tableIds);
  const targetFieldIds = new Set(plan.fieldIds);
  if (!plan.describeBase && targetTableIds.size === 0 && targetFieldIds.size === 0) {
    return { described: 0 };
  }

  const liveTables = tables.filter((t) => t.status === "active");
  const updates: DescriptionUpdate[] = [];

  if (plan.describeBase) {
    try {
      const text = await args.generate(
        buildBasePrompt({ base: { baseId: base.baseId, name: base.name }, tableNames: liveTables.map((t) => t.name) }),
      );
      const d = applyBaseResponse(parseModelJson(text));
      if (d) updates.push({ kind: "base", id: base.baseId, description: d });
    } catch (err) {
      // Batch lost — advisory; the next sync retries. Logged so silent model/
      // binding failures are visible in dev output and `wrangler tail`.
      // eslint-disable-next-line no-console -- background-batch failure would otherwise be invisible
      console.error("describe-schema base batch failed:", err instanceof Error ? err.message : String(err));
    }
  }

  for (const table of liveTables) {
    const tableFields = fields.filter((f) => f.tableId === table.tableId && f.status === "active");
    const batchFieldIds = tableFields.filter((f) => targetFieldIds.has(f.fieldId)).map((f) => f.fieldId);
    const describeTable = targetTableIds.has(table.tableId);
    if (!describeTable && batchFieldIds.length === 0) continue;
    try {
      const text = await args.generate(
        buildTablePrompt({
          baseName: base.name,
          table: { tableId: table.tableId, name: table.name },
          fields: tableFields.map((f) => ({ fieldId: f.fieldId, name: f.name, type: f.type, description: f.description })),
          targetFieldIds: batchFieldIds,
          describeTable,
        }),
      );
      const parsed = applyTableResponse(parseModelJson(text), { targetFieldIds: batchFieldIds, describeTable });
      if (parsed.tableDescription) updates.push({ kind: "table", id: table.tableId, description: parsed.tableDescription });
      for (const [fieldId, description] of Object.entries(parsed.fieldDescriptions)) {
        updates.push({ kind: "field", id: fieldId, description });
      }
    } catch (err) {
      // eslint-disable-next-line no-console -- background-batch failure would otherwise be invisible
      console.error("describe-schema table batch failed:", err instanceof Error ? err.message : String(err));
    }
  }

  if (updates.length > 0) await args.save(updates);
  return { described: updates.length };
}

// ───────────────────────── drizzle load / save ─────────────────────────

export async function loadDescribeBaseData(tx: SpaceTx, baseId: string): Promise<DescribeBaseData> {
  const bases = await tx
    .select({ baseId: spacePg.bases.baseId, name: spacePg.bases.name, description: spacePg.bases.description, aiDescription: spacePg.bases.aiDescription, status: spacePg.bases.status })
    .from(spacePg.bases)
    .where(eq(spacePg.bases.baseId, baseId));
  const tables = await tx
    .select({ tableId: spacePg.tables.tableId, baseId: spacePg.tables.baseId, name: spacePg.tables.name, description: spacePg.tables.description, aiDescription: spacePg.tables.aiDescription, status: spacePg.tables.status })
    .from(spacePg.tables)
    .where(eq(spacePg.tables.baseId, baseId));
  const fields = await tx
    .select({ fieldId: spacePg.fields.fieldId, tableId: spacePg.fields.tableId, name: spacePg.fields.name, type: spacePg.fields.type, description: spacePg.fields.description, aiDescription: spacePg.fields.aiDescription, status: spacePg.fields.status })
    .from(spacePg.fields)
    .where(eq(spacePg.fields.baseId, baseId));
  return { base: bases[0] ?? null, tables, fields };
}

/** Fill ai_description — only where still NULL (guards a concurrent fill). */
export async function saveDescriptionUpdates(tx: SpaceTx, updates: DescriptionUpdate[]): Promise<void> {
  for (const u of updates) {
    if (u.kind === "base") {
      await tx.update(spacePg.bases).set({ aiDescription: u.description }).where(and(eq(spacePg.bases.baseId, u.id), isNull(spacePg.bases.aiDescription)));
    } else if (u.kind === "table") {
      await tx.update(spacePg.tables).set({ aiDescription: u.description }).where(and(eq(spacePg.tables.tableId, u.id), isNull(spacePg.tables.aiDescription)));
    } else {
      await tx.update(spacePg.fields).set({ aiDescription: u.description }).where(and(eq(spacePg.fields.fieldId, u.id), isNull(spacePg.fields.aiDescription)));
    }
  }
}

// ───────────────────────── Workers AI adapter ─────────────────────────

/**
 * POC default — current catalog id verified via `wrangler ai models` 2026-07-10
 * (the original llama-3.1-8b pick was deprecated 2026-05-30 — error 5028).
 * Override via AI_DESCRIPTIONS_MODEL.
 */
const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/** Build a GenerateFn over the Workers AI binding, or null when absent/disabled. */
export function workersAiGenerate(env: Env): GenerateFn | null {
  const ai = env.AI;
  if (!ai || env.AI_DESCRIPTIONS_ENABLED === "false") return null;
  const model = env.AI_DESCRIPTIONS_MODEL || DEFAULT_MODEL;
  return async (prompt: string) => {
    const res = (await ai.run(model as Parameters<Ai["run"]>[0], {
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
    })) as { response?: unknown };
    // `response` is a string for prose output but an ALREADY-PARSED object when
    // the model emits pure JSON — hand either to parseModelJson unchanged.
    const r = res?.response;
    return typeof r === "string" ? r : r == null ? "" : (r as never);
  };
}
