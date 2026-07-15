// Pure-logic tests for extractInterfaceEntities + diffInterfaces
// (server-mcp-interface-pages). No DB — the drizzle read/apply live in
// space-db-pg.ts and are exercised by the staging smoke, mirroring the
// schema-diff / describe-schema-io test split. Placed under
// tests/integration/** so the server test runner picks it up.
//
// Fixture is the owner-verified MCP envelope from the workflows change's
// design.md (interfaces[] → pages[] → tablesByTableId, standaloneForms[]).

import { describe, expect, it } from "vitest";
import {
  diffInterfaces,
  extractInterfaceEntities,
  parseInterfacePagesField,
  type InterfaceDiffResult,
  type InterfaceEntity,
  type PriorInterfaceRow,
} from "../../../src/lib/per-space/interfaces-sync";

// ───────────────────────── fixtures ─────────────────────────

const field = (id: string, name: string, isEditable = false) => ({
  id,
  name,
  type: "singleSelect",
  isEditable,
  options: {},
});

const page = (over: Record<string, unknown> = {}) => ({
  id: "pagDbJfEBPEsMIqI6",
  interfaceId: "pbdXECeOl94vHbpLi",
  name: "Podcast Roundup 2",
  pageType: "list",
  sourceTableId: "tblHr3WJrQiMJu4P5",
  tablesByTableId: {
    tblHr3WJrQiMJu4P5: {
      id: "tblHr3WJrQiMJu4P5",
      name: "Podcast Roundup",
      fields: [field("fldStatus", "Status"), field("fldName", "Name", true)],
    },
  },
  ...over,
});

const app = (over: Record<string, unknown> = {}) => ({
  id: "pbdXECeOl94vHbpLi",
  name: "Interface",
  pages: [page()],
  ...over,
});

const envelope = (over: Record<string, unknown> = {}) => ({
  interfaces: [app()],
  standaloneForms: [],
  ...over,
});

function extractOk(raw: unknown): InterfaceEntity[] {
  const result = extractInterfaceEntities(raw);
  if (!result.ok) throw new Error(`expected ok extraction, got ${result.reason}`);
  return result.entities;
}

/** Prior rows as space-db-pg's readInterfaceWorkingSet would return them. */
function priorFrom(entities: InterfaceEntity[]): PriorInterfaceRow[] {
  return entities.map((e, i) => ({
    id: `row-${i}`,
    airtableEntityId: e.airtableEntityId,
    name: e.name,
    type: e.kind,
    definition: e.definition,
    status: "active",
  }));
}

// ───────────────────────── extraction (task 1.2/1.3) ─────────────────────────

describe("extractInterfaceEntities", () => {
  it("extracts one app entity and one page entity from the sample envelope", () => {
    const entities = extractOk(envelope());
    expect(entities).toHaveLength(2);

    const appEntity = entities.find((e) => e.kind === "app")!;
    expect(appEntity.airtableEntityId).toBe("pbdXECeOl94vHbpLi");
    expect(appEntity.name).toBe("Interface");

    const pageEntity = entities.find((e) => e.kind === "page")!;
    expect(pageEntity.airtableEntityId).toBe("pagDbJfEBPEsMIqI6");
    expect(pageEntity.name).toBe("Podcast Roundup 2");
    const def = pageEntity.definition as Record<string, unknown>;
    expect(def.pageType).toBe("list");
    expect(def.sourceTableId).toBe("tblHr3WJrQiMJu4P5");
    expect(def.tablesByTableId).toBeDefined();
    expect(def.interfaceId).toBe("pbdXECeOl94vHbpLi");
  });

  it("stamps parent interfaceId onto pages that omit it", () => {
    const raw = envelope({ interfaces: [app({ pages: [page({ interfaceId: undefined })] })] });
    const pageEntity = extractOk(raw).find((e) => e.kind === "page")!;
    expect((pageEntity.definition as Record<string, unknown>).interfaceId).toBe(
      "pbdXECeOl94vHbpLi",
    );
  });

  it("treats standalone forms as pages with pageType 'form'", () => {
    const raw = envelope({
      standaloneForms: [{ id: "pagFormXYZ", name: "Intake form" }],
    });
    const form = extractOk(raw).find((e) => e.kind === "form")!;
    expect(form.airtableEntityId).toBe("pagFormXYZ");
    expect((form.definition as Record<string, unknown>).pageType).toBe("form");
  });

  it("preserves an explicit pageType on standalone forms", () => {
    const raw = envelope({
      standaloneForms: [{ id: "pagFormXYZ", name: "Intake", pageType: "customForm" }],
    });
    const form = extractOk(raw).find((e) => e.kind === "form")!;
    expect((form.definition as Record<string, unknown>).pageType).toBe("customForm");
  });

  it("drops entities without id+name, keeps valid siblings, and counts drops", () => {
    const raw = envelope({
      interfaces: [
        app(),
        { name: "No id here" }, // dropped app
        app({ id: "pbdSecond", name: "Second", pages: [{ pageType: "list" }] }), // dropped page
      ],
    });
    const result = extractInterfaceEntities(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dropped).toBe(2);
    const ids = result.entities.map((e) => e.airtableEntityId);
    expect(ids).toContain("pbdXECeOl94vHbpLi");
    expect(ids).toContain("pagDbJfEBPEsMIqI6");
    expect(ids).toContain("pbdSecond");
  });

  it("passes unknown keys through into the definition", () => {
    const raw = envelope({
      interfaces: [app({ futureFlag: { nested: true } })],
    });
    const appEntity = extractOk(raw).find((e) => e.kind === "app")!;
    expect((appEntity.definition as Record<string, unknown>).futureFlag).toEqual({
      nested: true,
    });
  });

  it.each([
    ["not an object", "nope"],
    ["null", null],
    ["interfaces not an array", { interfaces: {}, standaloneForms: [] }],
    ["standaloneForms not an array", { interfaces: [], standaloneForms: "x" }],
  ])("rejects an invalid envelope: %s", (_label, raw) => {
    expect(extractInterfaceEntities(raw)).toEqual({ ok: false, reason: "invalid_envelope" });
  });
});

// ───────────────────────── diff (task 2.1/2.2) ─────────────────────────

describe("diffInterfaces", () => {
  it("first capture: everything is an insert, no updates", () => {
    const next = extractOk(envelope());
    const d = diffInterfaces({ prior: [], next });
    expect(d.unchanged).toBe(false);
    expect(d.inserts).toHaveLength(2);
    expect(d.seen).toEqual([]);
    expect(d.removals).toEqual([]);
    expect(d.updates).toEqual([]);
  });

  it("identical capture short-circuits via the capture hash", () => {
    const next = extractOk(envelope());
    const d = diffInterfaces({ prior: priorFrom(next), next });
    expect(d.unchanged).toBe(true);
    expect(d.inserts).toEqual([]);
    expect(d.updates).toEqual([]);
  });

  it("hash is insensitive to array order and JSONB key-order round-trips", () => {
    const twoApps = envelope({
      interfaces: [app(), app({ id: "pbdSecond", name: "Second", pages: [] })],
    });
    const prior = priorFrom(extractOk(twoApps));
    // Reversed array order + re-keyed definition objects (JSONB canonicalizes
    // key order; a textual compare would spuriously re-diff every run).
    const reordered = envelope({
      interfaces: [
        { name: "Second", id: "pbdSecond", pages: [] },
        app(),
      ],
    });
    const d = diffInterfaces({ prior, next: extractOk(reordered) });
    expect(d.unchanged).toBe(true);
  });

  it("a page missing from the capture is removed; survivors are seen", () => {
    const prior = priorFrom(extractOk(envelope()));
    const next = extractOk(envelope({ interfaces: [app({ pages: [] })] }));
    const d = diffInterfaces({ prior, next });
    expect(d.removals).toHaveLength(1);
    expect(d.removals[0]).toMatchObject({ entityId: "pagDbJfEBPEsMIqI6" });
    expect(d.seen.map((s) => s.entity.airtableEntityId)).toEqual(["pbdXECeOl94vHbpLi"]);
    expect(d.inserts).toEqual([]);
  });

  it("an empty successful capture removes every prior MCP entity", () => {
    const prior = priorFrom(extractOk(envelope()));
    const d = diffInterfaces({ prior, next: [] });
    expect(d.removals).toHaveLength(2);
  });

  it("an already-removed row absent again is NOT re-removed", () => {
    const prior = priorFrom(extractOk(envelope()));
    prior[1] = { ...prior[1]!, status: "removed" };
    const next = extractOk(envelope({ interfaces: [app({ pages: [] })] }));
    const d = diffInterfaces({ prior, next });
    expect(d.removals).toEqual([]);
  });

  it("a reappearing removed row is seen again, not re-inserted", () => {
    const prior = priorFrom(extractOk(envelope()));
    prior[1] = { ...prior[1]!, status: "removed" };
    const d = diffInterfaces({ prior, next: extractOk(envelope()) });
    expect(d.inserts).toEqual([]);
    expect(d.seen.map((s) => s.entity.airtableEntityId)).toContain("pagDbJfEBPEsMIqI6");
  });

  it("a rename writes one name update with before/after", () => {
    const prior = priorFrom(extractOk(envelope()));
    const next = extractOk(envelope({ interfaces: [app({ pages: [page({ name: "Roundup v3" })] })] }));
    const d = diffInterfaces({ prior, next });
    expect(d.updates).toEqual([
      {
        entityId: "pagDbJfEBPEsMIqI6",
        changeType: "name",
        beforeValue: "Podcast Roundup 2",
        afterValue: "Roundup v3",
      },
    ]);
  });

  it("a field id added to a page's tablesByTableId writes one config delta row", () => {
    const prior = priorFrom(extractOk(envelope()));
    const withExtraField = page();
    (withExtraField.tablesByTableId.tblHr3WJrQiMJu4P5.fields as unknown[]).push(
      field("fldNew", "Priority"),
    );
    const next = extractOk(envelope({ interfaces: [app({ pages: [withExtraField] })] }));
    const d = diffInterfaces({ prior, next });
    expect(d.updates).toHaveLength(1);
    const u = d.updates[0]!;
    expect(u.changeType).toBe("config");
    expect(u.entityId).toBe("pagDbJfEBPEsMIqI6");
    const after = u.afterValue as { fieldUsage: { added: unknown[] } };
    expect(after.fieldUsage.added).toEqual([
      { tableId: "tblHr3WJrQiMJu4P5", fieldIds: ["fldNew"] },
    ]);
  });

  it("a schema-side field RENAME does not echo into interface config rows", () => {
    const prior = priorFrom(extractOk(envelope()));
    const renamedField = page({
      tablesByTableId: {
        tblHr3WJrQiMJu4P5: {
          id: "tblHr3WJrQiMJu4P5",
          name: "Podcast Roundup",
          fields: [field("fldStatus", "Status RENAMED"), field("fldName", "Name", true)],
        },
      },
    });
    const next = extractOk(envelope({ interfaces: [app({ pages: [renamedField] })] }));
    const d = diffInterfaces({ prior, next });
    expect(d.unchanged).toBe(false); // definition changed → rows refresh…
    expect(d.updates).toEqual([]); // …but no changelog noise (ids unchanged)
  });

  it("an isEditable flip writes a config delta", () => {
    const prior = priorFrom(extractOk(envelope()));
    const flipped = page({
      tablesByTableId: {
        tblHr3WJrQiMJu4P5: {
          id: "tblHr3WJrQiMJu4P5",
          name: "Podcast Roundup",
          fields: [field("fldStatus", "Status", true), field("fldName", "Name", true)],
        },
      },
    });
    const next = extractOk(envelope({ interfaces: [app({ pages: [flipped] })] }));
    const d = diffInterfaces({ prior, next });
    expect(d.updates).toHaveLength(1);
    const after = d.updates[0]!.afterValue as {
      fieldUsage: { editableFlips: unknown[] };
    };
    expect(after.fieldUsage.editableFlips).toEqual([
      { tableId: "tblHr3WJrQiMJu4P5", fieldId: "fldStatus", isEditable: true },
    ]);
  });

  it("pageType and sourceTableId changes write a config row with before/after", () => {
    const prior = priorFrom(extractOk(envelope()));
    const next = extractOk(
      envelope({
        interfaces: [app({ pages: [page({ pageType: "record", sourceTableId: "tblOther" })] })],
      }),
    );
    const d = diffInterfaces({ prior, next });
    const config = d.updates.filter((u) => u.changeType === "config");
    expect(config).toHaveLength(1);
    expect(config[0]!.beforeValue).toMatchObject({
      pageType: "list",
      sourceTableId: "tblHr3WJrQiMJu4P5",
    });
    expect(config[0]!.afterValue).toMatchObject({
      pageType: "record",
      sourceTableId: "tblOther",
    });
  });

  it("app entities only diff on name — page membership is lifecycle, not config", () => {
    const prior = priorFrom(extractOk(envelope()));
    const next = extractOk(
      envelope({
        interfaces: [
          app({ name: "Renamed App", pages: [page(), page({ id: "pagNew", name: "New page" })] }),
        ],
      }),
    );
    const d = diffInterfaces({ prior, next });
    expect(d.updates).toEqual([
      {
        entityId: "pbdXECeOl94vHbpLi",
        changeType: "name",
        beforeValue: "Interface",
        afterValue: "Renamed App",
      },
    ]);
    expect(d.inserts.map((e) => e.airtableEntityId)).toEqual(["pagNew"]);
  });

  it("never touches rows it was not given (manual rows stay parallel)", () => {
    // A manual submission for the SAME entity id lives in a separate row that
    // readInterfaceWorkingSet never returns (submitted_via filter). The diff
    // therefore inserts a fresh MCP row instead of updating anything.
    const next = extractOk(envelope());
    const d = diffInterfaces({ prior: [], next });
    expect(d.inserts.map((e) => e.airtableEntityId)).toContain("pagDbJfEBPEsMIqI6");
    expect(d.seen).toEqual([]);
    expect(d.updates).toEqual([]);
    expect(d.removals).toEqual([]);
  });

  it("ignores prior rows with a null airtable_entity_id (defensive)", () => {
    const next = extractOk(envelope());
    const prior: PriorInterfaceRow[] = [
      { id: "row-x", airtableEntityId: null, name: "??", type: "page", definition: {}, status: "active" },
      ...priorFrom(next),
    ];
    const d = diffInterfaces({ prior, next });
    expect(d.unchanged).toBe(true);
    expect(d.removals).toEqual([]);
  });
});

// ───────────────── schema-sync field parsing (route contract) ─────────────────

describe("parseInterfacePagesField", () => {
  it("absent field → absent (no interface processing whatsoever)", () => {
    expect(parseInterfacePagesField(undefined)).toEqual({ kind: "absent" });
  });

  it.each([
    ["null capture", null],
    ["missing capturedAt", { raw: envelope() }],
    ["unparseable capturedAt", { capturedAt: "not-a-date", raw: envelope() }],
  ])("malformed capture is reported, never thrown: %s", (_label, field) => {
    expect(parseInterfacePagesField(field)).toEqual({
      kind: "invalid",
      reason: "invalid_capture",
    });
  });

  it("bad envelope inside a well-formed capture → invalid_envelope", () => {
    expect(
      parseInterfacePagesField({ capturedAt: "2026-07-14T10:00:00.000Z", raw: { nope: true } }),
    ).toEqual({ kind: "invalid", reason: "invalid_envelope" });
  });

  it("valid capture → parsed Date + extracted entities", () => {
    const parsed = parseInterfacePagesField({
      capturedAt: "2026-07-14T10:00:00.000Z",
      raw: envelope(),
    });
    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.capturedAt.toISOString()).toBe("2026-07-14T10:00:00.000Z");
    expect(parsed.entities).toHaveLength(2);
  });
});

// ───────────────── full sync cycle (task 4.1, pure twin of applyInterfaceDiff) ─────────────────

/**
 * Fold a diff into an in-memory row store using exactly the write semantics of
 * space-db-pg's applyInterfaceDiff (insert / seen-refresh / removed+stamp).
 * The real SQL is a thin mapper over these ops, exercised by the staging
 * hand-POST (task 4.2) — the run-over-run sequencing lives here.
 */
function foldDiff(
  store: PriorInterfaceRow[],
  diff: InterfaceDiffResult,
  seq: number,
): PriorInterfaceRow[] {
  if (diff.unchanged) return store;
  const next = store.map((row) => {
    const seen = diff.seen.find((s) => s.rowId === row.id);
    if (seen) {
      return {
        ...row,
        name: seen.entity.name,
        type: seen.entity.kind,
        definition: seen.entity.definition,
        status: "active",
      };
    }
    if (diff.removals.some((r) => r.rowId === row.id)) return { ...row, status: "removed" };
    return row;
  });
  return [
    ...next,
    ...diff.inserts.map((e, i) => ({
      id: `row-${seq}-${i}`,
      airtableEntityId: e.airtableEntityId,
      name: e.name,
      type: e.kind,
      definition: e.definition,
      status: "active",
    })),
  ];
}

describe("full sync cycle: capture → mutate → absent → identical", () => {
  it("sequences lifecycle + updates across runs and leaves state untouched on absent/identical", () => {
    // Run 1 — first capture: app + page inserted.
    const first = extractOk(envelope());
    const d1 = diffInterfaces({ prior: [], next: first });
    expect(d1.inserts).toHaveLength(2);
    let store = foldDiff([], d1, 1);

    // Run 2 — page renamed AND a new page appears.
    const second = extractOk(
      envelope({
        interfaces: [
          app({ pages: [page({ name: "Roundup v3" }), page({ id: "pagNew", name: "Fresh" })] }),
        ],
      }),
    );
    const d2 = diffInterfaces({ prior: store, next: second });
    expect(d2.inserts.map((e) => e.airtableEntityId)).toEqual(["pagNew"]);
    expect(d2.updates).toEqual([
      {
        entityId: "pagDbJfEBPEsMIqI6",
        changeType: "name",
        beforeValue: "Podcast Roundup 2",
        afterValue: "Roundup v3",
      },
    ]);
    store = foldDiff(store, d2, 2);

    // Run 3 — the new page is deleted in Airtable.
    const third = extractOk(envelope({ interfaces: [app({ pages: [page({ name: "Roundup v3" })] })] }));
    const d3 = diffInterfaces({ prior: store, next: third });
    expect(d3.removals.map((r) => r.entityId)).toEqual(["pagNew"]);
    store = foldDiff(store, d3, 3);
    expect(store.find((r) => r.airtableEntityId === "pagNew")?.status).toBe("removed");

    // Run 4 — capture skipped (absent field): the route never diffs, so the
    // store is untouched by construction.
    expect(parseInterfacePagesField(undefined)).toEqual({ kind: "absent" });

    // Run 5 — identical capture: hash short-circuit, zero ops, removed row
    // is NOT resurrected or re-removed.
    const d5 = diffInterfaces({ prior: store, next: extractOk(
      envelope({ interfaces: [app({ pages: [page({ name: "Roundup v3" })] })] }),
    ) });
    expect(d5.unchanged).toBe(true);
    expect(foldDiff(store, d5, 5)).toEqual(store);
  });
});
