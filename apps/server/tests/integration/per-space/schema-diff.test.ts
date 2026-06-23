import { describe, it, expect } from "vitest";
import {
  diffSchema,
  hashSchema,
  type CapturedBase,
  type PriorWorkingSet,
} from "../../../src/lib/per-space/schema-diff";

const RUN = "run-1";

function base(overrides: Partial<CapturedBase> = {}): CapturedBase {
  return {
    baseId: "appX",
    name: "Sales",
    description: null,
    tables: [
      {
        tableId: "tblA",
        name: "Deals",
        primaryFieldId: "fld1",
        description: null,
        fields: [
          { fieldId: "fld1", name: "Name", type: "singleLineText", isPrimary: true },
          { fieldId: "fld2", name: "Amount", type: "number", options: { precision: 2 } },
        ],
        views: [{ viewId: "viwA", name: "Grid", type: "grid" }],
      },
    ],
    ...overrides,
  };
}

const EMPTY_PRIOR: PriorWorkingSet = { base: null, tables: [], fields: [], views: [] };

// Build a prior working set that exactly matches a captured base (all active).
function priorFrom(b: CapturedBase): PriorWorkingSet {
  return {
    base: { baseId: b.baseId, name: b.name, description: b.description ?? null, status: "active" },
    tables: b.tables.map((t) => ({
      tableId: t.tableId,
      name: t.name,
      primaryFieldId: t.primaryFieldId ?? null,
      description: t.description ?? null,
      status: "active",
    })),
    fields: b.tables.flatMap((t) =>
      t.fields.map((f) => ({
        fieldId: f.fieldId,
        tableId: t.tableId,
        name: f.name,
        type: f.type,
        options: f.options ?? null,
        isPrimary: f.isPrimary ?? false,
        description: f.description ?? null,
        status: "active",
      })),
    ),
    views: b.tables.flatMap((t) =>
      t.views.map((v) => ({
        viewId: v.viewId,
        tableId: t.tableId,
        name: v.name,
        type: v.type ?? null,
        status: "active",
      })),
    ),
  };
}

const actionFor = (r: ReturnType<typeof diffSchema>, entity: string, id: string) =>
  r.lifecycle.find((o) => o.entity === entity && o.id === id)?.action;

describe("hashSchema", () => {
  it("is stable + order-independent", () => {
    const a = base();
    const reordered = base({
      tables: [
        {
          ...base().tables[0]!,
          fields: [base().tables[0]!.fields[1]!, base().tables[0]!.fields[0]!], // swapped
        },
      ],
    });
    expect(hashSchema(a)).toBe(hashSchema(reordered));
  });

  it("changes when a field type changes", () => {
    const a = base();
    const b = base({
      tables: [
        {
          ...base().tables[0]!,
          fields: [
            base().tables[0]!.fields[0]!,
            { ...base().tables[0]!.fields[1]!, type: "currency" },
          ],
        },
      ],
    });
    expect(hashSchema(a)).not.toBe(hashSchema(b));
  });
});

describe("diffSchema — first capture", () => {
  const r = diffSchema({ captured: base(), prior: EMPTY_PRIOR, runId: RUN, confident: true });
  it("inserts base + table + fields + view; no modifications", () => {
    expect(actionFor(r, "base", "appX")).toBe("insert");
    expect(actionFor(r, "table", "tblA")).toBe("insert");
    expect(actionFor(r, "field", "fld1")).toBe("insert");
    expect(actionFor(r, "field", "fld2")).toBe("insert");
    expect(actionFor(r, "view", "viwA")).toBe("insert");
    expect(r.schemaUpdates).toHaveLength(0);
    expect(r.schemaChanged).toBe(true);
  });
});

describe("diffSchema — unchanged re-capture", () => {
  const b = base();
  const r = diffSchema({
    captured: b,
    prior: priorFrom(b),
    runId: RUN,
    confident: true,
    priorSchemaHash: hashSchema(b),
  });
  it("marks everything seen, no updates, schemaChanged=false", () => {
    expect(r.lifecycle.every((o) => o.action === "seen")).toBe(true);
    expect(r.schemaUpdates).toHaveLength(0);
    expect(r.schemaChanged).toBe(false);
  });
});

describe("diffSchema — modifications", () => {
  it("field type change → schema_update with breaks_data=true", () => {
    const b = base();
    const next = base({
      tables: [
        { ...b.tables[0]!, fields: [b.tables[0]!.fields[0]!, { ...b.tables[0]!.fields[1]!, type: "currency" }] },
      ],
    });
    const r = diffSchema({ captured: next, prior: priorFrom(b), runId: RUN, confident: true });
    const upd = r.schemaUpdates.find((u) => u.entityId === "fld2" && u.changeType === "type");
    expect(upd).toBeTruthy();
    expect(upd!.beforeValue).toBe("number");
    expect(upd!.afterValue).toBe("currency");
    expect(upd!.breaksData).toBe(true);
  });

  it("field rename → schema_update with breaks_data=false", () => {
    const b = base();
    const next = base({
      tables: [
        { ...b.tables[0]!, fields: [b.tables[0]!.fields[0]!, { ...b.tables[0]!.fields[1]!, name: "Total" }] },
      ],
    });
    const r = diffSchema({ captured: next, prior: priorFrom(b), runId: RUN, confident: true });
    const upd = r.schemaUpdates.find((u) => u.entityId === "fld2" && u.changeType === "name");
    expect(upd?.breaksData).toBe(false);
    expect(upd?.afterValue).toBe("Total");
  });
});

describe("diffSchema — additions + removals", () => {
  it("new field is inserted, existing seen", () => {
    const b = base();
    const next = base({
      tables: [
        {
          ...b.tables[0]!,
          fields: [...b.tables[0]!.fields, { fieldId: "fld3", name: "Stage", type: "singleSelect" }],
        },
      ],
    });
    const r = diffSchema({ captured: next, prior: priorFrom(b), runId: RUN, confident: true });
    expect(actionFor(r, "field", "fld3")).toBe("insert");
    expect(actionFor(r, "field", "fld1")).toBe("seen");
  });

  it("absent field on a CONFIDENT capture → removed", () => {
    const b = base();
    const next = base({
      tables: [{ ...b.tables[0]!, fields: [b.tables[0]!.fields[0]!] }], // dropped fld2
    });
    const r = diffSchema({ captured: next, prior: priorFrom(b), runId: RUN, confident: true });
    expect(actionFor(r, "field", "fld2")).toBe("removed");
  });

  it("absent field on a PARTIAL capture → unknown (never false-delete)", () => {
    const b = base();
    const next = base({
      tables: [{ ...b.tables[0]!, fields: [b.tables[0]!.fields[0]!] }],
    });
    const r = diffSchema({ captured: next, prior: priorFrom(b), runId: RUN, confident: false });
    expect(actionFor(r, "field", "fld2")).toBe("unknown");
  });

  it("an already-removed prior entity that stays absent emits no op", () => {
    const b = base();
    const prior = priorFrom(b);
    prior.fields = prior.fields.map((f) =>
      f.fieldId === "fld2" ? { ...f, status: "removed" } : f,
    );
    const next = base({ tables: [{ ...b.tables[0]!, fields: [b.tables[0]!.fields[0]!] }] });
    const r = diffSchema({ captured: next, prior, runId: RUN, confident: true });
    expect(r.lifecycle.find((o) => o.id === "fld2")).toBeUndefined();
  });
});
