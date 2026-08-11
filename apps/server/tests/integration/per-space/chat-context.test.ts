// Pure-logic tests for assembleChatContext (server-schema-chat). No DB/AI.

import { describe, expect, it } from "vitest";
import {
  assembleChatContext,
  type CtxBase,
  type CtxField,
  type CtxTable,
} from "../../../src/lib/per-space/chat-context";

const bases: CtxBase[] = [
  { baseId: "appA", name: "CRM" },
  { baseId: "appB", name: "Ops" },
];
const tables: CtxTable[] = [
  { tableId: "tblA1", baseId: "appA", name: "Contacts" },
  { tableId: "tblA2", baseId: "appA", name: "Deals" },
  { tableId: "tblB1", baseId: "appB", name: "Tasks" },
];
const fields: CtxField[] = [
  { fieldId: "f1", tableId: "tblA1", baseId: "appA", name: "Name", type: "singleLineText" },
  { fieldId: "f2", tableId: "tblA1", baseId: "appA", name: "Email", type: "email" },
  { fieldId: "f3", tableId: "tblA2", baseId: "appA", name: "Amount", type: "currency" },
  { fieldId: "f4", tableId: "tblB1", baseId: "appB", name: "Due", type: "date" },
];

describe("assembleChatContext", () => {
  it("includes the whole Space when scope is empty", () => {
    const ctx = assembleChatContext({ scope: null, bases, tables, fields });
    expect(ctx).toContain("whole Space");
    expect(ctx).toContain("Base: CRM");
    expect(ctx).toContain("Base: Ops");
    expect(ctx).toContain("Contacts");
    expect(ctx).toContain("Tasks");
    expect(ctx).toContain("Name (singleLineText)");
  });

  it("scopes to a single table", () => {
    const ctx = assembleChatContext({
      scope: { tableIds: ["tblA1"] },
      bases,
      tables,
      fields,
    });
    expect(ctx).toContain("scoped");
    expect(ctx).toContain("Contacts");
    expect(ctx).not.toContain("Deals");
    expect(ctx).not.toContain("Tasks");
    expect(ctx).toContain("Email (email)");
    expect(ctx).not.toContain("Amount");
  });

  it("scopes to a base (all its tables)", () => {
    const ctx = assembleChatContext({ scope: { baseIds: ["appB"] }, bases, tables, fields });
    expect(ctx).toContain("Tasks");
    expect(ctx).not.toContain("Contacts");
    expect(ctx).not.toContain("Base: CRM");
  });

  it("includes a field's table when only a field is scoped", () => {
    const ctx = assembleChatContext({ scope: { fieldIds: ["f3"] }, bases, tables, fields });
    expect(ctx).toContain("Deals");
    expect(ctx).toContain("Amount (currency)");
    // sibling field in the same table is filtered out (field-level scope)
    expect(ctx).not.toContain("Name (singleLineText)");
  });

  it("appends attached docs", () => {
    const ctx = assembleChatContext({
      scope: null,
      bases,
      tables,
      fields,
      docs: [{ title: "Data Dictionary", excerpt: "Field meanings" }],
    });
    expect(ctx).toContain("Attached docs:");
    expect(ctx).toContain("Data Dictionary");
    expect(ctx).toContain("Field meanings");
  });

  it("caps fields with a truncation note", () => {
    const many: CtxField[] = Array.from({ length: 10 }, (_, i) => ({
      fieldId: `g${i}`,
      tableId: "tblA1",
      baseId: "appA",
      name: `F${i}`,
      type: "singleLineText",
    }));
    const ctx = assembleChatContext({ scope: null, bases, tables, fields: many, maxFields: 4 });
    expect(ctx).toContain("6 more fields omitted");
  });

  it("renders descriptions when present", () => {
    const ctx = assembleChatContext({
      scope: { tableIds: ["tblA1"] },
      bases: [{ baseId: "appA", name: "CRM", description: "Customer data" }],
      tables: [{ tableId: "tblA1", baseId: "appA", name: "Contacts", description: "People" }],
      fields: [
        { fieldId: "f1", tableId: "tblA1", baseId: "appA", name: "Name", type: "singleLineText", description: "Full name" },
      ],
    });
    expect(ctx).toContain("CRM — Customer data");
    expect(ctx).toContain("Contacts — People");
    expect(ctx).toContain("Name (singleLineText): Full name");
  });
});
