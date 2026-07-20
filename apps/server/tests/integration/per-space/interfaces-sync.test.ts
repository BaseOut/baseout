// Pure-logic tests for extractInterfaceEntities + diffInterfaces
// (server-interfaces-normalize). No DB — the drizzle read/apply live in
// space-db-pg.ts and are exercised by the deployed smoke, mirroring the
// schema-diff test split. Placed under tests/integration/** so the server test
// runner picks it up.
//
// Fixture is the owner-verified MCP envelope (interfaces[] → pages[] →
// tablesByTableId, standaloneForms[]).

import { describe, expect, it } from "vitest";
import {
  diffInterfaces,
  extractInterfaceEntities,
  parseInterfacePagesField,
  type ExtractedCapture,
  type InterfaceDiffResult,
  type PriorInterfaceWorkingSet,
} from "../../../src/lib/per-space/interfaces-sync";

// ───────────────────────── fixtures ─────────────────────────

const IF_ID = "pbdXECeOl94vHbpLi";
const PAGE_ID = "pagDbJfEBPEsMIqI6";
const TBL_ID = "tblHr3WJrQiMJu4P5";

const field = (id: string, name: string, isEditable = false) => ({
  id,
  name,
  type: "singleSelect",
  isEditable,
  options: {},
});

const page = (over: Record<string, unknown> = {}) => ({
  id: PAGE_ID,
  interfaceId: IF_ID,
  name: "Podcast Roundup 2",
  pageType: "list",
  sourceTableId: TBL_ID,
  tablesByTableId: {
    [TBL_ID]: {
      id: TBL_ID,
      name: "Podcast Roundup",
      fields: [field("fldStatus", "Status"), field("fldName", "Name", true)],
    },
  },
  ...over,
});

const app = (over: Record<string, unknown> = {}) => ({
  id: IF_ID,
  name: "Interface",
  pages: [page()],
  ...over,
});

const envelope = (over: Record<string, unknown> = {}) => ({
  interfaces: [app()],
  standaloneForms: [],
  ...over,
});

function extractOk(raw: unknown): ExtractedCapture {
  const result = extractInterfaceEntities(raw);
  if (!result.ok) throw new Error(`expected ok extraction, got ${result.reason}`);
  return result.capture;
}

const emptyPrior = (): PriorInterfaceWorkingSet => ({
  interfaces: [],
  pages: [],
  forms: [],
  pageTables: [],
  pageFields: [],
});

/** Prior working set as readInterfaceWorkingSet would return it after a first insert. */
function priorFrom(cap: ExtractedCapture, status = "active"): PriorInterfaceWorkingSet {
  return {
    interfaces: cap.apps.map((a, i) => ({
      id: `if-${i}`,
      airtableEntityId: a.airtableEntityId,
      name: a.name,
      definition: a.definition,
      status,
    })),
    pages: cap.pages.map((p, i) => ({
      id: `pg-${i}`,
      airtableEntityId: p.airtableEntityId,
      interfaceId: p.interfaceId,
      name: p.name,
      pageType: p.pageType,
      sourceTableId: p.sourceTableId,
      definition: p.definition,
      status,
    })),
    forms: cap.forms.map((f, i) => ({
      id: `fm-${i}`,
      airtableEntityId: f.airtableEntityId,
      interfaceId: f.interfaceId,
      name: f.name,
      sourceTableId: f.sourceTableId,
      definition: f.definition,
      status,
    })),
    pageTables: cap.pageTables.map((l) => ({ pageId: l.pageId, tableId: l.tableId, status })),
    pageFields: cap.pageFields.map((l) => ({
      pageId: l.pageId,
      tableId: l.tableId,
      fieldId: l.fieldId,
      isEditable: l.isEditable,
      status,
    })),
  };
}

// ───────────────────────── extraction (task 2.1/2.2) ─────────────────────────

describe("extractInterfaceEntities", () => {
  it("splits the sample envelope into one app + one page (no form)", () => {
    const c = extractOk(envelope());
    expect(c.apps).toHaveLength(1);
    expect(c.pages).toHaveLength(1);
    expect(c.forms).toHaveLength(0);

    expect(c.apps[0]).toMatchObject({ airtableEntityId: IF_ID, name: "Interface" });
    expect(c.pages[0]).toMatchObject({
      airtableEntityId: PAGE_ID,
      interfaceId: IF_ID,
      name: "Podcast Roundup 2",
      pageType: "list",
      sourceTableId: TBL_ID,
    });
  });

  it("normalizes page columns OUT of the stored definition (no schema detail)", () => {
    const c = extractOk(envelope());
    const def = c.pages[0]!.definition;
    expect(def).not.toHaveProperty("tablesByTableId");
    expect(def).not.toHaveProperty("pageType");
    expect(def).not.toHaveProperty("sourceTableId");
    expect(def).not.toHaveProperty("interfaceId");
    // and no field names/types survive anywhere in the slimmed definition
    expect(JSON.stringify(def)).not.toContain("Status");
    // app definition drops its `pages` array
    expect(c.apps[0]!.definition).not.toHaveProperty("pages");
  });

  it("extracts page↔table and page↔field links (ids + isEditable only)", () => {
    const c = extractOk(envelope());
    expect(c.pageTables).toEqual([{ pageId: PAGE_ID, tableId: TBL_ID }]);
    expect(c.pageFields).toEqual([
      { pageId: PAGE_ID, tableId: TBL_ID, fieldId: "fldStatus", isEditable: false },
      { pageId: PAGE_ID, tableId: TBL_ID, fieldId: "fldName", isEditable: true },
    ]);
  });

  it("keeps a page↔table row even when the table lists zero fields", () => {
    const c = extractOk(
      envelope({
        interfaces: [
          app({
            pages: [page({ tablesByTableId: { tblEmpty: { id: "tblEmpty", name: "Empty", fields: [] } } })],
          }),
        ],
      }),
    );
    expect(c.pageTables).toEqual([{ pageId: PAGE_ID, tableId: "tblEmpty" }]);
    expect(c.pageFields).toEqual([]);
  });

  it("routes a standalone form (interfaceId null) to forms, not pages", () => {
    const c = extractOk(
      envelope({ standaloneForms: [{ id: "pagFormXYZ", name: "Intake", interfaceId: null, pageType: "form", sourceTableId: "tblForm" }] }),
    );
    expect(c.forms).toHaveLength(1);
    expect(c.forms[0]).toMatchObject({ airtableEntityId: "pagFormXYZ", interfaceId: null, sourceTableId: "tblForm" });
    expect(c.pages.find((p) => p.airtableEntityId === "pagFormXYZ")).toBeUndefined();
  });

  it("routes an interface-owned form page (pageType 'form') to forms with interface_id set", () => {
    const formPage = { id: "pagFormOwned", name: "Owned form", pageType: "form", sourceTableId: "tblOwned" };
    const c = extractOk(envelope({ interfaces: [app({ pages: [page(), formPage] })] }));
    expect(c.forms).toHaveLength(1);
    expect(c.forms[0]).toMatchObject({ airtableEntityId: "pagFormOwned", interfaceId: IF_ID });
    expect(c.pages.map((p) => p.airtableEntityId)).toEqual([PAGE_ID]); // form is NOT a page
  });

  it("stamps parent interfaceId onto pages that omit it", () => {
    const c = extractOk(envelope({ interfaces: [app({ pages: [page({ interfaceId: undefined })] })] }));
    expect(c.pages[0]!.interfaceId).toBe(IF_ID);
  });

  it("drops entities without id+name, keeps valid siblings, and counts drops", () => {
    const c = extractOk(
      envelope({
        interfaces: [
          app(),
          { name: "No id here" }, // dropped app
          app({ id: "pbdSecond", name: "Second", pages: [{ pageType: "list" }] }), // dropped page
        ],
        standaloneForms: [{ name: "no id form" }], // dropped form
      }),
    );
    expect(c.dropped).toBe(3);
    expect(c.apps.map((a) => a.airtableEntityId)).toEqual([IF_ID, "pbdSecond"]);
    expect(c.pages.map((p) => p.airtableEntityId)).toEqual([PAGE_ID]);
  });

  it("passes unknown keys through into slimmed definitions", () => {
    const c = extractOk(envelope({ interfaces: [app({ futureFlag: { nested: true } })] }));
    expect((c.apps[0]!.definition as Record<string, unknown>).futureFlag).toEqual({ nested: true });
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

// ───────────────────────── diff (task 3.1/3.2/3.3) ─────────────────────────

describe("diffInterfaces", () => {
  it("first capture: every entity + link is an insert/upsert, no updates", () => {
    const d = diffInterfaces({ prior: emptyPrior(), next: extractOk(envelope()) });
    expect(d.unchanged).toBe(false);
    expect(d.interfaces.inserts).toHaveLength(1);
    expect(d.pages.inserts).toHaveLength(1);
    expect(d.forms.inserts).toHaveLength(0);
    expect(d.pageTables.upserts).toHaveLength(1);
    expect(d.pageFields.upserts).toHaveLength(2);
    expect(d.updates).toEqual([]);
    expect(d.pages.removals).toEqual([]);
  });

  it("identical capture short-circuits via the capture hash", () => {
    const cap = extractOk(envelope());
    const d = diffInterfaces({ prior: priorFrom(cap), next: cap });
    expect(d.unchanged).toBe(true);
    expect(d.pages.inserts).toEqual([]);
    expect(d.pageFields.upserts).toEqual([]);
    expect(d.updates).toEqual([]);
  });

  it("hash is insensitive to array order and JSONB key-order round-trips", () => {
    const twoApps = envelope({
      interfaces: [app(), app({ id: "pbdSecond", name: "Second", pages: [] })],
    });
    const prior = priorFrom(extractOk(twoApps));
    const reordered = envelope({
      interfaces: [{ name: "Second", id: "pbdSecond", pages: [] }, app()],
    });
    expect(diffInterfaces({ prior, next: extractOk(reordered) }).unchanged).toBe(true);
  });

  it("a schema-side field RENAME does not break the short-circuit (ids/isEditable unchanged)", () => {
    const prior = priorFrom(extractOk(envelope()));
    const renamed = page({
      tablesByTableId: {
        [TBL_ID]: {
          id: TBL_ID,
          name: "Podcast Roundup",
          fields: [field("fldStatus", "Status RENAMED"), field("fldName", "Name", true)],
        },
      },
    });
    const d = diffInterfaces({ prior, next: extractOk(envelope({ interfaces: [app({ pages: [renamed] })] })) });
    expect(d.unchanged).toBe(true);
    expect(d.updates).toEqual([]);
  });

  it("a page missing from the capture is removed WITH its link rows (cascade); survivors seen", () => {
    const prior = priorFrom(extractOk(envelope()));
    const d = diffInterfaces({ prior, next: extractOk(envelope({ interfaces: [app({ pages: [] })] })) });
    expect(d.pages.removals.map((r) => r.entityId)).toEqual([PAGE_ID]);
    expect(d.interfaces.seen.map((s) => s.entity.airtableEntityId)).toEqual([IF_ID]);
    // the removed page's link rows cascade to removed (not upserted)
    expect(d.pageTables.upserts).toEqual([]);
    expect(d.pageFields.upserts).toEqual([]);
    expect(d.pageTables.removals).toEqual([{ pageId: PAGE_ID, tableId: TBL_ID }]);
    expect(d.pageFields.removals).toEqual([
      { pageId: PAGE_ID, fieldId: "fldStatus" },
      { pageId: PAGE_ID, fieldId: "fldName" },
    ]);
  });

  it("removing the interface cascades to its pages AND their links in the same run", () => {
    const prior = priorFrom(extractOk(envelope()));
    const d = diffInterfaces({ prior, next: extractOk(envelope({ interfaces: [] })) });
    expect(d.interfaces.removals.map((r) => r.entityId)).toEqual([IF_ID]);
    expect(d.pages.removals.map((r) => r.entityId)).toEqual([PAGE_ID]);
    expect(d.pageFields.removals).toHaveLength(2);
    expect(d.pageTables.removals).toHaveLength(1);
  });

  it("an empty successful capture removes every prior MCP entity", () => {
    const prior = priorFrom(extractOk(envelope()));
    const d = diffInterfaces({ prior, next: extractOk(envelope({ interfaces: [], standaloneForms: [] })) });
    expect(d.interfaces.removals).toHaveLength(1);
    expect(d.pages.removals).toHaveLength(1);
  });

  it("an already-removed page absent again is NOT re-removed", () => {
    const prior = priorFrom(extractOk(envelope()));
    prior.pages[0]!.status = "removed";
    prior.pageTables[0]!.status = "removed";
    for (const l of prior.pageFields) l.status = "removed";
    const d = diffInterfaces({ prior, next: extractOk(envelope({ interfaces: [app({ pages: [] })] })) });
    expect(d.pages.removals).toEqual([]);
    expect(d.pageFields.removals).toEqual([]);
  });

  it("a reappearing removed page is seen (not re-inserted) and its links upsert (resurrect)", () => {
    const prior = priorFrom(extractOk(envelope()));
    prior.pages[0]!.status = "removed";
    for (const l of prior.pageFields) l.status = "removed";
    const d = diffInterfaces({ prior, next: extractOk(envelope()) });
    expect(d.pages.inserts).toEqual([]);
    expect(d.pages.seen.map((s) => s.entity.airtableEntityId)).toContain(PAGE_ID);
    expect(d.pages.seen[0]!.rowId).toBe("pg-0"); // same row → first_seen_run preserved on UPDATE
    expect(d.pageFields.upserts).toHaveLength(2); // resurrected via upsert
  });

  it("a page rename writes one name update (entity_type page)", () => {
    const prior = priorFrom(extractOk(envelope()));
    const d = diffInterfaces({
      prior,
      next: extractOk(envelope({ interfaces: [app({ pages: [page({ name: "Roundup v3" })] })] })),
    });
    expect(d.updates).toEqual([
      { entityType: "page", entityId: PAGE_ID, changeType: "name", beforeValue: "Podcast Roundup 2", afterValue: "Roundup v3" },
    ]);
  });

  it("an app rename writes one name update (entity_type interface); page membership is lifecycle", () => {
    const prior = priorFrom(extractOk(envelope()));
    const d = diffInterfaces({
      prior,
      next: extractOk(
        envelope({ interfaces: [app({ name: "Renamed", pages: [page(), page({ id: "pagNew", name: "New" })] })] }),
      ),
    });
    expect(d.updates).toEqual([
      { entityType: "interface", entityId: IF_ID, changeType: "name", beforeValue: "Interface", afterValue: "Renamed" },
    ]);
    expect(d.pages.inserts.map((e) => e.airtableEntityId)).toEqual(["pagNew"]);
  });

  it("a form rename writes one name update (entity_type form)", () => {
    const base = envelope({ standaloneForms: [{ id: "pagF", name: "Intake", interfaceId: null, pageType: "form" }] });
    const prior = priorFrom(extractOk(base));
    const d = diffInterfaces({
      prior,
      next: extractOk(envelope({ standaloneForms: [{ id: "pagF", name: "Intake v2", interfaceId: null, pageType: "form" }] })),
    });
    const formUpdate = d.updates.find((u) => u.entityType === "form");
    expect(formUpdate).toMatchObject({ entityId: "pagF", changeType: "name", beforeValue: "Intake", afterValue: "Intake v2" });
  });

  it("a field id added to a page writes one config delta + a link upsert", () => {
    const prior = priorFrom(extractOk(envelope()));
    const withExtra = page();
    (withExtra.tablesByTableId[TBL_ID].fields as unknown[]).push(field("fldNew", "Priority"));
    const d = diffInterfaces({ prior, next: extractOk(envelope({ interfaces: [app({ pages: [withExtra] })] })) });
    const config = d.updates.filter((u) => u.changeType === "config");
    expect(config).toHaveLength(1);
    expect(config[0]!.entityType).toBe("page");
    const after = config[0]!.afterValue as { fieldUsage: { added: unknown[] } };
    expect(after.fieldUsage.added).toEqual([{ tableId: TBL_ID, fieldIds: ["fldNew"] }]);
    expect(d.pageFields.upserts.map((l) => l.fieldId)).toContain("fldNew");
  });

  it("an isEditable flip writes a config delta", () => {
    const prior = priorFrom(extractOk(envelope()));
    const flipped = page({
      tablesByTableId: {
        [TBL_ID]: { id: TBL_ID, name: "Podcast Roundup", fields: [field("fldStatus", "Status", true), field("fldName", "Name", true)] },
      },
    });
    const d = diffInterfaces({ prior, next: extractOk(envelope({ interfaces: [app({ pages: [flipped] })] })) });
    const config = d.updates.find((u) => u.changeType === "config")!;
    const after = config.afterValue as { fieldUsage: { editableFlips: unknown[] } };
    expect(after.fieldUsage.editableFlips).toEqual([{ tableId: TBL_ID, fieldId: "fldStatus", isEditable: true }]);
  });

  it("pageType and sourceTableId changes write a config row with before/after", () => {
    const prior = priorFrom(extractOk(envelope()));
    const d = diffInterfaces({
      prior,
      next: extractOk(envelope({ interfaces: [app({ pages: [page({ pageType: "record", sourceTableId: "tblOther" })] })] })),
    });
    const config = d.updates.filter((u) => u.changeType === "config");
    expect(config).toHaveLength(1);
    expect(config[0]!.beforeValue).toMatchObject({ pageType: "list", sourceTableId: TBL_ID });
    expect(config[0]!.afterValue).toMatchObject({ pageType: "record", sourceTableId: "tblOther" });
  });

  it("never touches rows it was not given (manual rows stay parallel: empty prior → all inserts)", () => {
    const d = diffInterfaces({ prior: emptyPrior(), next: extractOk(envelope()) });
    expect(d.pages.inserts.map((e) => e.airtableEntityId)).toEqual([PAGE_ID]);
    expect(d.pages.seen).toEqual([]);
    expect(d.updates).toEqual([]);
  });

  it("ignores prior entity rows with a null airtable_entity_id (defensive)", () => {
    const cap = extractOk(envelope());
    const prior = priorFrom(cap);
    prior.interfaces.unshift({ id: "row-x", airtableEntityId: null, name: "??", definition: {}, status: "active" });
    const d = diffInterfaces({ prior, next: cap });
    expect(d.unchanged).toBe(true);
    expect(d.interfaces.removals).toEqual([]);
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
    expect(parseInterfacePagesField(field)).toEqual({ kind: "invalid", reason: "invalid_capture" });
  });

  it("bad envelope inside a well-formed capture → invalid_envelope", () => {
    expect(
      parseInterfacePagesField({ capturedAt: "2026-07-14T10:00:00.000Z", raw: { nope: true } }),
    ).toEqual({ kind: "invalid", reason: "invalid_envelope" });
  });

  it("valid capture → parsed Date + extracted capture", () => {
    const parsed = parseInterfacePagesField({ capturedAt: "2026-07-14T10:00:00.000Z", raw: envelope() });
    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.capturedAt.toISOString()).toBe("2026-07-14T10:00:00.000Z");
    expect(parsed.capture.apps).toHaveLength(1);
    expect(parsed.capture.pages).toHaveLength(1);
  });
});

// ───────────────── full sync cycle (pure twin of applyInterfaceDiff) ─────────────────

type StoreWS = PriorInterfaceWorkingSet & {
  interfaces: (PriorInterfaceWorkingSet["interfaces"][number] & { firstSeenRun: string })[];
  pages: (PriorInterfaceWorkingSet["pages"][number] & { firstSeenRun: string })[];
  pageTables: (PriorInterfaceWorkingSet["pageTables"][number] & { firstSeenRun: string })[];
  pageFields: (PriorInterfaceWorkingSet["pageFields"][number] & { firstSeenRun: string })[];
};

function emptyStore(): StoreWS {
  return { interfaces: [], pages: [], forms: [], pageTables: [], pageFields: [] };
}

/** Fold a diff into an in-memory store with exactly applyInterfaceDiff semantics. */
function foldDiff(store: StoreWS, diff: InterfaceDiffResult, runId: string): void {
  if (diff.unchanged) return; // stamp-only; irrelevant to these assertions
  for (const e of diff.interfaces.inserts)
    store.interfaces.push({ id: `if-${runId}-${e.airtableEntityId}`, airtableEntityId: e.airtableEntityId, name: e.name, definition: e.definition, status: "active", firstSeenRun: runId });
  for (const s of diff.interfaces.seen) {
    const row = store.interfaces.find((r) => r.id === s.rowId)!;
    row.name = s.entity.name;
    row.definition = s.entity.definition;
    row.status = "active";
  }
  for (const rm of diff.interfaces.removals) store.interfaces.find((r) => r.id === rm.rowId)!.status = "removed";

  for (const e of diff.pages.inserts)
    store.pages.push({ id: `pg-${runId}-${e.airtableEntityId}`, airtableEntityId: e.airtableEntityId, interfaceId: e.interfaceId, name: e.name, pageType: e.pageType, sourceTableId: e.sourceTableId, definition: e.definition, status: "active", firstSeenRun: runId });
  for (const s of diff.pages.seen) {
    const row = store.pages.find((r) => r.id === s.rowId)!;
    Object.assign(row, { name: s.entity.name, pageType: s.entity.pageType, sourceTableId: s.entity.sourceTableId, definition: s.entity.definition, status: "active" });
  }
  for (const rm of diff.pages.removals) store.pages.find((r) => r.id === rm.rowId)!.status = "removed";

  for (const l of diff.pageTables.upserts) {
    const existing = store.pageTables.find((r) => r.pageId === l.pageId && r.tableId === l.tableId);
    if (existing) existing.status = "active";
    else store.pageTables.push({ pageId: l.pageId, tableId: l.tableId, status: "active", firstSeenRun: runId });
  }
  for (const k of diff.pageTables.removals)
    store.pageTables.filter((r) => r.pageId === k.pageId && r.tableId === k.tableId).forEach((r) => (r.status = "removed"));

  for (const l of diff.pageFields.upserts) {
    const existing = store.pageFields.find((r) => r.pageId === l.pageId && r.fieldId === l.fieldId);
    if (existing) Object.assign(existing, { tableId: l.tableId, isEditable: l.isEditable, status: "active" });
    else store.pageFields.push({ pageId: l.pageId, tableId: l.tableId, fieldId: l.fieldId, isEditable: l.isEditable, status: "active", firstSeenRun: runId });
  }
  for (const k of diff.pageFields.removals)
    store.pageFields.filter((r) => r.pageId === k.pageId && r.fieldId === k.fieldId).forEach((r) => (r.status = "removed"));
}

describe("full sync cycle: capture → mutate → remove → resurrect → identical", () => {
  it("sequences lifecycle + preserves first_seen_run on resurrection", () => {
    const store = emptyStore();

    // Run 1 — first capture inserts app + page + links.
    foldDiff(store, diffInterfaces({ prior: store, next: extractOk(envelope()) }), "run-1");
    expect(store.pages).toHaveLength(1);
    expect(store.pages[0]!.firstSeenRun).toBe("run-1");
    expect(store.pageFields.filter((f) => f.status === "active")).toHaveLength(2);

    // Run 2 — page renamed AND a new field appears.
    const withExtra = page({ name: "Roundup v3" });
    (withExtra.tablesByTableId[TBL_ID].fields as unknown[]).push(field("fldNew", "Priority"));
    const d2 = diffInterfaces({ prior: store, next: extractOk(envelope({ interfaces: [app({ pages: [withExtra] })] })) });
    expect(d2.updates.some((u) => u.changeType === "name")).toBe(true);
    foldDiff(store, d2, "run-2");
    expect(store.pages[0]!.name).toBe("Roundup v3");
    expect(store.pageFields.filter((f) => f.status === "active")).toHaveLength(3);

    // Run 3 — page deleted: page + all its links go removed (cascade).
    const d3 = diffInterfaces({ prior: store, next: extractOk(envelope({ interfaces: [app({ pages: [] })] })) });
    foldDiff(store, d3, "run-3");
    expect(store.pages[0]!.status).toBe("removed");
    expect(store.pageFields.every((f) => f.status === "removed")).toBe(true);

    // Run 4 — page republished: resurrect, first_seen_run preserved.
    const d4 = diffInterfaces({ prior: store, next: extractOk(envelope()) });
    expect(d4.pages.inserts).toEqual([]);
    foldDiff(store, d4, "run-4");
    expect(store.pages[0]!.status).toBe("active");
    expect(store.pages[0]!.firstSeenRun).toBe("run-1"); // preserved
    expect(store.pageFields.filter((f) => f.status === "active")).toHaveLength(2);
    expect(store.pageFields.find((f) => f.fieldId === "fldStatus")!.firstSeenRun).toBe("run-1");

    // Run 5 — identical capture: hash short-circuit, no ops.
    const d5 = diffInterfaces({ prior: store, next: extractOk(envelope()) });
    expect(d5.unchanged).toBe(true);
  });
});
