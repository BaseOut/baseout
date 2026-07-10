// Orchestration tests for runDescribeBase (server-schema-descriptions). Pure —
// load/save/generate are injected fakes; the real drizzle load/save live in
// describe-schema-io.ts and are exercised by the smoke. Placed under
// tests/integration/** so the server test runner picks it up.

import { describe, expect, it } from "vitest";
import { runDescribeBase, type DescribeBaseData } from "../../../src/lib/per-space/describe-schema-io";

const data = (over?: Partial<DescribeBaseData>): DescribeBaseData => ({
  base: { baseId: "appX", name: "Sales CRM", description: null, aiDescription: null, status: "active" },
  tables: [
    { tableId: "tblA", baseId: "appX", name: "Deals", description: null, aiDescription: null, status: "active" },
    { tableId: "tblB", baseId: "appX", name: "Contacts", description: "People", aiDescription: null, status: "active" },
  ],
  fields: [
    { fieldId: "fld1", tableId: "tblA", name: "Amount", type: "currency", description: null, aiDescription: null, status: "active" },
    { fieldId: "fld2", tableId: "tblB", name: "Email", type: "email", description: null, aiDescription: null, status: "active" },
  ],
  ...over,
});

describe("runDescribeBase", () => {
  it("generates base + per-table batches and saves only cleaned target updates", async () => {
    const prompts: string[] = [];
    const saved: unknown[] = [];
    const result = await runDescribeBase({
      baseId: "appX",
      load: async () => data(),
      save: async (updates) => {
        saved.push(...updates);
      },
      generate: async (prompt) => {
        prompts.push(prompt);
        if (prompt.includes('{"base"')) return '{"base": "A sales CRM."}';
        if (prompt.includes("Deals")) return '```json\n{"table": "Tracks deals.", "fields": {"fld1": "Deal value."}}\n```';
        return '{"table": "ignored — not a target", "fields": {"fld2": "Contact email address."}}';
      },
    });

    expect(result.described).toBe(4); // base + Deals table + fld1 + fld2
    expect(saved).toContainEqual({ kind: "base", id: "appX", description: "A sales CRM." });
    expect(saved).toContainEqual({ kind: "table", id: "tblA", description: "Tracks deals." });
    expect(saved).toContainEqual({ kind: "field", id: "fld1", description: "Deal value." });
    expect(saved).toContainEqual({ kind: "field", id: "fld2", description: "Contact email address." });
    // Contacts table has a human description → never described
    expect(saved.some((u) => (u as { id: string }).id === "tblB")).toBe(false);
    // one base prompt + one prompt per table that has targets
    expect(prompts).toHaveLength(3);
  });

  it("no-ops (no generate calls, no save) when everything is described", async () => {
    let generateCalls = 0;
    let saveCalls = 0;
    const result = await runDescribeBase({
      baseId: "appX",
      load: async () =>
        data({
          base: { baseId: "appX", name: "Sales CRM", description: null, aiDescription: "done", status: "active" },
          tables: [{ tableId: "tblB", baseId: "appX", name: "Contacts", description: "People", aiDescription: null, status: "active" }],
          fields: [{ fieldId: "fld2", tableId: "tblB", name: "Email", type: "email", description: "x", aiDescription: null, status: "active" }],
        }),
      save: async () => {
        saveCalls++;
      },
      generate: async () => {
        generateCalls++;
        return "{}";
      },
    });
    expect(result.described).toBe(0);
    expect(generateCalls).toBe(0);
    expect(saveCalls).toBe(0);
  });

  it("survives a throwing generate for one batch — other batches still save", async () => {
    const saved: { id: string }[] = [];
    const result = await runDescribeBase({
      baseId: "appX",
      load: async () => data(),
      save: async (updates) => {
        saved.push(...(updates as { id: string }[]));
      },
      generate: async (prompt) => {
        if (prompt.includes('{"base"')) return '{"base": "A sales CRM."}';
        if (prompt.includes("Deals")) throw new Error("model exploded");
        return '{"fields": {"fld2": "Contact email address."}}';
      },
    });
    expect(result.described).toBe(2); // base + fld2 — Deals batch lost, run survived
    expect(saved.map((u) => u.id).sort()).toEqual(["appX", "fld2"]);
  });

  it("drops garbage model output without saving anything for that batch", async () => {
    let saveCalls = 0;
    const result = await runDescribeBase({
      baseId: "appX",
      load: async () => data(),
      save: async () => {
        saveCalls++;
      },
      generate: async () => "I am unable to help with that.",
    });
    expect(result.described).toBe(0);
    expect(saveCalls).toBe(0);
  });
});
