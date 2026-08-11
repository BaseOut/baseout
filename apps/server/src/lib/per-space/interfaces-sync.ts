// MCP interface-pages capture → normalized per-Space interface entities — PURE
// (no I/O), unit-tested. (server-interfaces-normalize, supersedes the one-table
// server-mcp-interface-pages model.)
//
// The workflows backup task captures a base's Interface apps, pages, and
// standalone forms from the Airtable MCP server and forwards the raw envelope on
// the schema-sync callback as the optional `interfacePages` field (wire contract
// UNCHANGED — workflows forwards it verbatim). This module owns:
//   - the wire type of that field,
//   - extraction into THREE entity kinds (apps / pages / forms) plus ID-only
//     link rows (page↔table, page↔field with is_editable),
//   - the run-over-run diff against the prior MCP-sourced working set.
//
// The drizzle read/apply live in space-db-pg.ts (readInterfaceWorkingSet /
// applyInterfaceDiff), which target the six normalized tables. The schema-sync
// route wires the two together inside the same withSpaceSchema transaction as the
// schema diff.
//
// Model (change specs "interface-entity-model" / "interface-pages-sync"):
//   - bo_at_interfaces holds apps (pbd…) ONLY — no `type` discriminator.
//   - bo_at_pages holds non-form pages; bo_at_forms holds anything with
//     pageType==='form' (standalone OR interface-owned), routed by entity kind
//     not envelope location.
//   - Table/field usage is stored as ID links (bo_at_page_tables/_fields), never
//     duplicating names/types/options (join bo_at_tables/bo_at_fields on read).
//     bo_at_form_fields ships EMPTY (no get_form_schema capture path yet).
//   - Persisted definitions strip keys normalized into columns/links (`pages`,
//     `tablesByTableId`, `interfaceId`, `pageType`, `sourceTableId`,
//     `sourceTableName`) but keep unknown keys (envelope tolerance).
//
// Diff rules:
//   - add/remove are lifecycle (status + run stamps), NOT bo_at_schema_updates.
//   - removal ONLY on a successful capture (route never calls this when the field
//     is absent/skipped); a removed parent cascades to child pages/forms/links in
//     the same run; reappearing ids resurrect to active.
//   - name changes → schema_updates (entity_type interface|page|form,
//     change_type='name'); composition (page_type, source_table_id, link
//     add/remove, is_editable flips) → change_type='config' storing the DELTA,
//     comparing IDs only — a schema-side field rename echoes into payload field
//     NAMES but not ids, and must produce zero interface rows.
//   - an identical capture (hash of the normalized representation) short-circuits
//     the diff; the writer still stamps last_seen_run. The hash excludes field
//     names/options, so a schema-side field rename does not invalidate it.

export type InterfaceEntityKind = "app" | "page" | "form";

/**
 * Wire shape of the optional `interfacePages` field on the schema-sync POST body.
 * `raw` is the MCP `list_pages_for_base` envelope, forwarded verbatim by
 * workflows (which validates only that `interfaces[]` / `standaloneForms[]`
 * exist). Absent field = no interface processing whatsoever.
 */
export interface InterfacePagesCapture {
  /** ISO-8601 — when the MCP call resolved on the workflows side. */
  capturedAt: string;
  raw: unknown;
}

// ───────────────────────── extracted entities + links ─────────────────────────

export interface ExtractedInterface {
  airtableEntityId: string;
  name: string;
  /** Slimmed definition — normalized keys stripped, unknown keys preserved. */
  definition: Record<string, unknown>;
}

export interface ExtractedPage {
  airtableEntityId: string;
  interfaceId: string | null;
  name: string;
  pageType: string | null;
  sourceTableId: string | null;
  definition: Record<string, unknown>;
}

export interface ExtractedForm {
  airtableEntityId: string;
  interfaceId: string | null;
  name: string;
  sourceTableId: string | null;
  definition: Record<string, unknown>;
}

/** page ↔ table usage (ids only). */
export interface PageTableLink {
  pageId: string;
  tableId: string;
}

/** page ↔ field usage (ids only) + the page-scoped is_editable flag. */
export interface PageFieldLink {
  pageId: string;
  tableId: string;
  fieldId: string;
  isEditable: boolean | null;
}

export interface ExtractedCapture {
  apps: ExtractedInterface[];
  pages: ExtractedPage[];
  forms: ExtractedForm[];
  pageTables: PageTableLink[];
  pageFields: PageFieldLink[];
  /** entities dropped for want of a string id + name (counted, not fatal). */
  dropped: number;
}

export type ExtractResult =
  | { ok: true; capture: ExtractedCapture }
  | { ok: false; reason: "invalid_envelope" };

export type ParsedInterfaceCapture =
  | { kind: "absent" }
  | { kind: "invalid"; reason: "invalid_capture" | "invalid_envelope" }
  | { kind: "ok"; capturedAt: Date; capture: ExtractedCapture };

/**
 * Parse the optional `interfacePages` field off the schema-sync body.
 * `undefined` (field absent — old workflows, skipped captures) means NO
 * interface processing whatsoever; a present-but-malformed field is reported
 * (`invalid`) without ever failing the sync.
 */
export function parseInterfacePagesField(field: unknown): ParsedInterfaceCapture {
  if (field === undefined) return { kind: "absent" };
  const capture = field as Partial<InterfacePagesCapture> | null;
  const capturedAt = new Date(String(capture?.capturedAt ?? ""));
  if (!capture || Number.isNaN(capturedAt.getTime())) {
    return { kind: "invalid", reason: "invalid_capture" };
  }
  const extracted = extractInterfaceEntities(capture.raw);
  if (!extracted.ok) return { kind: "invalid", reason: extracted.reason };
  return { kind: "ok", capturedAt, capture: extracted.capture };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const idAndName = (v: unknown): v is Record<string, unknown> & { id: string; name: string } =>
  isRecord(v) && typeof v.id === "string" && typeof v.name === "string";

const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

// Keys that normalize into real columns or link tables — stripped from the
// persisted definition (interface-entity-model "Persisted definitions exclude
// data normalized into columns and links").
const NORMALIZED_KEYS = new Set([
  "pages",
  "tablesByTableId",
  "interfaceId",
  "pageType",
  "sourceTableId",
  "sourceTableName",
]);

/** Copy a raw entity's UNKNOWN keys into a slimmed definition (drops id/name too — those are columns). */
function slimDefinition(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === "id" || k === "name") continue;
    if (NORMALIZED_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

/** Pull page↔table / page↔field links out of a page's tablesByTableId. */
function extractPageLinks(
  pageId: string,
  raw: Record<string, unknown>,
): { pageTables: PageTableLink[]; pageFields: PageFieldLink[] } {
  const pageTables: PageTableLink[] = [];
  const pageFields: PageFieldLink[] = [];
  if (!isRecord(raw.tablesByTableId)) return { pageTables, pageFields };
  for (const [tableId, tableRaw] of Object.entries(raw.tablesByTableId)) {
    // A table entry is meaningful even with zero listed fields (design Decision 4).
    pageTables.push({ pageId, tableId });
    if (isRecord(tableRaw) && Array.isArray(tableRaw.fields)) {
      for (const f of tableRaw.fields) {
        if (isRecord(f) && typeof f.id === "string") {
          pageFields.push({
            pageId,
            tableId,
            fieldId: f.id,
            isEditable: typeof f.isEditable === "boolean" ? f.isEditable : null,
          });
        }
      }
    }
  }
  return { pageTables, pageFields };
}

/**
 * Flatten the MCP envelope into normalized entities + links. Envelope-tolerant:
 * unknown keys pass through into slimmed `definition`; entities without a string
 * id + name are dropped (counted). Routing: any entity with `pageType === 'form'`
 * becomes a form (standalone OR interface-owned); every other page becomes a page.
 */
export function extractInterfaceEntities(raw: unknown): ExtractResult {
  if (!isRecord(raw) || !Array.isArray(raw.interfaces) || !Array.isArray(raw.standaloneForms)) {
    return { ok: false, reason: "invalid_envelope" };
  }

  const apps: ExtractedInterface[] = [];
  const pages: ExtractedPage[] = [];
  const forms: ExtractedForm[] = [];
  const pageTables: PageTableLink[] = [];
  const pageFields: PageFieldLink[] = [];
  let dropped = 0;

  const routeForm = (rawEntity: Record<string, unknown>, id: string, name: string, interfaceId: string | null) => {
    forms.push({
      airtableEntityId: id,
      interfaceId,
      name,
      sourceTableId: strOrNull(rawEntity.sourceTableId),
      definition: slimDefinition(rawEntity),
    });
    // bo_at_form_fields ships empty — no get_form_schema capture path yet.
  };

  for (const appRaw of raw.interfaces) {
    const parentId = isRecord(appRaw) && typeof appRaw.id === "string" ? appRaw.id : null;
    if (idAndName(appRaw)) {
      apps.push({
        airtableEntityId: appRaw.id,
        name: appRaw.name,
        definition: slimDefinition(appRaw),
      });
    } else {
      dropped++;
    }
    const childPages = isRecord(appRaw) && Array.isArray(appRaw.pages) ? appRaw.pages : [];
    for (const pageRaw of childPages) {
      if (!idAndName(pageRaw)) {
        dropped++;
        continue;
      }
      const interfaceId = strOrNull(pageRaw.interfaceId) ?? parentId;
      if (strOrNull(pageRaw.pageType) === "form") {
        routeForm(pageRaw, pageRaw.id, pageRaw.name, interfaceId);
        continue;
      }
      pages.push({
        airtableEntityId: pageRaw.id,
        interfaceId,
        name: pageRaw.name,
        pageType: strOrNull(pageRaw.pageType),
        sourceTableId: strOrNull(pageRaw.sourceTableId),
        definition: slimDefinition(pageRaw),
      });
      const links = extractPageLinks(pageRaw.id, pageRaw);
      pageTables.push(...links.pageTables);
      pageFields.push(...links.pageFields);
    }
  }

  for (const formRaw of raw.standaloneForms) {
    if (!idAndName(formRaw)) {
      dropped++;
      continue;
    }
    // Standalone forms carry interfaceId: null; keep any explicit value defensively.
    routeForm(formRaw, formRaw.id, formRaw.name, strOrNull(formRaw.interfaceId));
  }

  return { ok: true, capture: { apps, pages, forms, pageTables, pageFields, dropped } };
}

// ───────────────────────── prior working set ─────────────────────────
// What readInterfaceWorkingSet returns (submitted_via='mcp' rows for one base).
// Entity rows carry their row `id` (no unique entity index yet — writes target
// the id). Link rows are keyed by their natural unique columns.

export interface PriorInterfaceEntity {
  id: string;
  airtableEntityId: string | null;
  name: string | null;
  definition: unknown;
  status: string;
}
export interface PriorPage {
  id: string;
  airtableEntityId: string | null;
  interfaceId: string | null;
  name: string | null;
  pageType: string | null;
  sourceTableId: string | null;
  definition: unknown;
  status: string;
}
export interface PriorForm {
  id: string;
  airtableEntityId: string | null;
  interfaceId: string | null;
  name: string | null;
  sourceTableId: string | null;
  definition: unknown;
  status: string;
}
export interface PriorPageTable {
  pageId: string;
  tableId: string;
  status: string;
}
export interface PriorPageField {
  pageId: string;
  tableId: string;
  fieldId: string;
  isEditable: boolean | null;
  status: string;
}
export interface PriorInterfaceWorkingSet {
  interfaces: PriorInterfaceEntity[];
  pages: PriorPage[];
  forms: PriorForm[];
  pageTables: PriorPageTable[];
  pageFields: PriorPageField[];
}

// ───────────────────────── diff result ─────────────────────────

export interface InterfaceUpdateOp {
  entityType: "interface" | "page" | "form";
  entityId: string;
  changeType: "name" | "config";
  beforeValue: unknown;
  afterValue: unknown;
}

interface EntityOps<E> {
  inserts: E[];
  seen: { rowId: string; entity: E }[];
  removals: { rowId: string; entityId: string }[];
}
interface LinkOps<Upsert, RemovalKey> {
  upserts: Upsert[];
  removals: RemovalKey[];
}

export interface InterfaceDiffResult {
  captureHash: string;
  /** Identical capture — writer stamps last_seen_run on active rows and stops. */
  unchanged: boolean;
  interfaces: EntityOps<ExtractedInterface>;
  pages: EntityOps<ExtractedPage>;
  forms: EntityOps<ExtractedForm>;
  pageTables: LinkOps<PageTableLink, { pageId: string; tableId: string }>;
  pageFields: LinkOps<PageFieldLink, { pageId: string; fieldId: string }>;
  updates: InterfaceUpdateOp[];
}

// ───────────────────────── capture hash (short-circuit detector) ─────────────
// Key-order-insensitive (JSONB round-trips canonicalize object key order — the
// 2026-07-10 changelog-spam lesson) and collection-order-insensitive via sorting.
// The prior hash is RECONSTRUCTED from the stored working set, so no hash column
// is needed. Excludes field names/options (link rows are ids only, definitions
// are slimmed), so a schema-side field rename does not invalidate it.

const canonicalJson = (v: unknown): string => {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
    .join(",")}}`;
};

function fnv1a64(str: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

interface NormalizedShape {
  interfaces: { id: string; name: string; definition: unknown }[];
  pages: {
    id: string;
    interfaceId: string | null;
    name: string;
    pageType: string | null;
    sourceTableId: string | null;
    definition: unknown;
  }[];
  forms: {
    id: string;
    interfaceId: string | null;
    name: string;
    sourceTableId: string | null;
    definition: unknown;
  }[];
  pageTables: { pageId: string; tableId: string }[];
  pageFields: { pageId: string; tableId: string; fieldId: string; isEditable: boolean | null }[];
}

function hashNormalized(shape: NormalizedShape): string {
  const sortBy = <T>(arr: T[], key: (t: T) => string): T[] =>
    [...arr].sort((a, b) => key(a).localeCompare(key(b)));
  return fnv1a64(
    canonicalJson({
      interfaces: sortBy(shape.interfaces, (i) => i.id).map((i) => ({
        id: i.id,
        name: i.name,
        definition: i.definition ?? null,
      })),
      pages: sortBy(shape.pages, (p) => p.id).map((p) => ({
        id: p.id,
        interfaceId: p.interfaceId,
        name: p.name,
        pageType: p.pageType,
        sourceTableId: p.sourceTableId,
        definition: p.definition ?? null,
      })),
      forms: sortBy(shape.forms, (f) => f.id).map((f) => ({
        id: f.id,
        interfaceId: f.interfaceId,
        name: f.name,
        sourceTableId: f.sourceTableId,
        definition: f.definition ?? null,
      })),
      pageTables: sortBy(shape.pageTables, (l) => `${l.pageId}:${l.tableId}`),
      pageFields: sortBy(shape.pageFields, (l) => `${l.pageId}:${l.fieldId}`).map((l) => ({
        pageId: l.pageId,
        tableId: l.tableId,
        fieldId: l.fieldId,
        isEditable: l.isEditable,
      })),
    }),
  );
}

function hashCapture(c: ExtractedCapture): string {
  return hashNormalized({
    interfaces: c.apps.map((a) => ({ id: a.airtableEntityId, name: a.name, definition: a.definition })),
    pages: c.pages.map((p) => ({
      id: p.airtableEntityId,
      interfaceId: p.interfaceId,
      name: p.name,
      pageType: p.pageType,
      sourceTableId: p.sourceTableId,
      definition: p.definition,
    })),
    forms: c.forms.map((f) => ({
      id: f.airtableEntityId,
      interfaceId: f.interfaceId,
      name: f.name,
      sourceTableId: f.sourceTableId,
      definition: f.definition,
    })),
    pageTables: c.pageTables,
    pageFields: c.pageFields,
  });
}

function hashPrior(prior: PriorInterfaceWorkingSet): string {
  const active = <T extends { status: string }>(rows: T[]) => rows.filter((r) => r.status === "active");
  return hashNormalized({
    interfaces: active(prior.interfaces)
      .filter((i) => i.airtableEntityId !== null)
      .map((i) => ({ id: i.airtableEntityId!, name: i.name ?? "", definition: i.definition })),
    pages: active(prior.pages)
      .filter((p) => p.airtableEntityId !== null)
      .map((p) => ({
        id: p.airtableEntityId!,
        interfaceId: p.interfaceId,
        name: p.name ?? "",
        pageType: p.pageType,
        sourceTableId: p.sourceTableId,
        definition: p.definition,
      })),
    forms: active(prior.forms)
      .filter((f) => f.airtableEntityId !== null)
      .map((f) => ({
        id: f.airtableEntityId!,
        interfaceId: f.interfaceId,
        name: f.name ?? "",
        sourceTableId: f.sourceTableId,
        definition: f.definition,
      })),
    pageTables: active(prior.pageTables).map((l) => ({ pageId: l.pageId, tableId: l.tableId })),
    pageFields: active(prior.pageFields).map((l) => ({
      pageId: l.pageId,
      tableId: l.tableId,
      fieldId: l.fieldId,
      isEditable: l.isEditable,
    })),
  });
}

// ───────────────────────── field-usage delta (config rows) ─────────────────────

interface FieldUsageDelta {
  added: { tableId: string; fieldIds: string[] }[];
  removed: { tableId: string; fieldIds: string[] }[];
  editableFlips: { tableId: string; fieldId: string; isEditable: boolean }[];
  tablesAdded: string[];
  tablesRemoved: string[];
}

/** Compare a single page's prior link rows to its next link rows (ids only). */
function fieldUsageDelta(
  prevFields: PageFieldLink[],
  nextFields: PageFieldLink[],
  prevTables: string[],
  nextTables: string[],
): FieldUsageDelta | null {
  const byTable = (fields: PageFieldLink[]) => {
    const m = new Map<string, Map<string, boolean | null>>();
    for (const f of fields) {
      if (!m.has(f.tableId)) m.set(f.tableId, new Map());
      m.get(f.tableId)!.set(f.fieldId, f.isEditable);
    }
    return m;
  };
  const prev = byTable(prevFields);
  const next = byTable(nextFields);

  const added: FieldUsageDelta["added"] = [];
  const removed: FieldUsageDelta["removed"] = [];
  const editableFlips: FieldUsageDelta["editableFlips"] = [];

  const tableIds = [...new Set([...prev.keys(), ...next.keys()])].sort();
  for (const tableId of tableIds) {
    const p = prev.get(tableId) ?? new Map<string, boolean | null>();
    const n = next.get(tableId) ?? new Map<string, boolean | null>();
    const addedIds = [...n.keys()].filter((id) => !p.has(id)).sort();
    const removedIds = [...p.keys()].filter((id) => !n.has(id)).sort();
    if (addedIds.length) added.push({ tableId, fieldIds: addedIds });
    if (removedIds.length) removed.push({ tableId, fieldIds: removedIds });
    for (const [fieldId, wasEditable] of p) {
      const isEditable = n.get(fieldId);
      if (
        typeof isEditable === "boolean" &&
        typeof wasEditable === "boolean" &&
        isEditable !== wasEditable
      ) {
        editableFlips.push({ tableId, fieldId, isEditable });
      }
    }
  }

  const prevTableSet = new Set(prevTables);
  const nextTableSet = new Set(nextTables);
  const tablesAdded = nextTables.filter((t) => !prevTableSet.has(t)).sort();
  const tablesRemoved = prevTables.filter((t) => !nextTableSet.has(t)).sort();

  if (
    !added.length &&
    !removed.length &&
    !editableFlips.length &&
    !tablesAdded.length &&
    !tablesRemoved.length
  ) {
    return null;
  }
  return { added, removed, editableFlips, tablesAdded, tablesRemoved };
}

// ───────────────────────── diff ─────────────────────────

/**
 * Match "next" entities against prior rows by airtable id → lifecycle ops. A
 * prior active row is removed when absent from the capture OR when
 * `cascadeRemoved(priorRow)` is true (its parent was removed this run); the
 * latter also drops it from `seen` so no row is both seen and removed.
 */
function diffEntities<
  P extends { id: string; airtableEntityId: string | null; status: string },
  N extends { airtableEntityId: string },
>(
  priorRows: P[],
  next: N[],
  cascadeRemoved: (priorRow: P) => boolean,
): { ops: EntityOps<N>; removedIds: Set<string> } {
  const prior = priorRows.filter((r) => r.airtableEntityId !== null);
  const priorActive = prior.filter((r) => r.status === "active");
  const priorById = new Map(prior.map((r) => [r.airtableEntityId!, r]));
  const nextById = new Map(next.map((e) => [e.airtableEntityId, e]));

  const inserts: N[] = [];
  const seen: { rowId: string; entity: N }[] = [];
  for (const entity of next) {
    const prev = priorById.get(entity.airtableEntityId);
    if (!prev) inserts.push(entity);
    else seen.push({ rowId: prev.id, entity });
  }

  const removedIds = new Set<string>();
  const removals: { rowId: string; entityId: string }[] = [];
  for (const row of priorActive) {
    const absent = !nextById.has(row.airtableEntityId!);
    const parentGone = cascadeRemoved(row);
    if (!absent && !parentGone) continue;
    removals.push({ rowId: row.id, entityId: row.airtableEntityId! });
    removedIds.add(row.airtableEntityId!);
    if (!absent) {
      // Present in the capture but parent removed: cascade wins over seen.
      const idx = seen.findIndex((s) => s.entity.airtableEntityId === row.airtableEntityId);
      if (idx >= 0) seen.splice(idx, 1);
    }
  }

  return { ops: { inserts, seen, removals }, removedIds };
}

export function diffInterfaces(args: {
  prior: PriorInterfaceWorkingSet;
  next: ExtractedCapture;
}): InterfaceDiffResult {
  const { prior, next } = args;

  const captureHash = hashCapture(next);
  const priorHash = hashPrior(prior);
  const empty: InterfaceDiffResult = {
    captureHash,
    unchanged: true,
    interfaces: { inserts: [], seen: [], removals: [] },
    pages: { inserts: [], seen: [], removals: [] },
    forms: { inserts: [], seen: [], removals: [] },
    pageTables: { upserts: [], removals: [] },
    pageFields: { upserts: [], removals: [] },
    updates: [],
  };
  if (captureHash === priorHash) return empty;

  const updates: InterfaceUpdateOp[] = [];

  // ── apps (interfaces) — name-only config; no cascade parent. ──
  const appDiff = diffEntities(prior.interfaces, next.apps, () => false);
  const removedInterfaceIds = appDiff.removedIds;
  for (const { entity } of appDiff.ops.seen) {
    const prev = prior.interfaces.find((r) => r.airtableEntityId === entity.airtableEntityId);
    if (prev && prev.name !== null && prev.name !== entity.name) {
      updates.push({
        entityType: "interface",
        entityId: entity.airtableEntityId,
        changeType: "name",
        beforeValue: prev.name,
        afterValue: entity.name,
      });
    }
  }

  // ── pages — cascade-removed when their parent interface is removed. ──
  const pageDiff = diffEntities(
    prior.pages,
    next.pages,
    (row) => row.interfaceId != null && removedInterfaceIds.has(row.interfaceId),
  );
  const removedPageIds = pageDiff.removedIds;

  // ── forms — same interface cascade (standalone forms have null interfaceId). ──
  const formDiff = diffEntities(
    prior.forms,
    next.forms,
    (row) => row.interfaceId != null && removedInterfaceIds.has(row.interfaceId),
  );

  // Per-page config deltas (page_type / source_table_id / link add-remove / editable flips).
  const priorPageFieldsByPage = groupBy(prior.pageFields, (l) => l.pageId);
  const priorPageTablesByPage = groupBy(prior.pageTables, (l) => l.pageId);
  const nextPageFieldsByPage = groupBy(next.pageFields, (l) => l.pageId);
  const nextPageTablesByPage = groupBy(next.pageTables, (l) => l.pageId);

  for (const { entity } of pageDiff.ops.seen) {
    const prev = prior.pages.find((r) => r.airtableEntityId === entity.airtableEntityId);
    if (!prev) continue;
    if (prev.name !== null && prev.name !== entity.name) {
      updates.push({
        entityType: "page",
        entityId: entity.airtableEntityId,
        changeType: "name",
        beforeValue: prev.name,
        afterValue: entity.name,
      });
    }
    const pageTypeChanged = (prev.pageType ?? null) !== (entity.pageType ?? null);
    const sourceChanged = (prev.sourceTableId ?? null) !== (entity.sourceTableId ?? null);
    const fu = fieldUsageDelta(
      (priorPageFieldsByPage.get(entity.airtableEntityId) ?? []).filter((l) => (l as PriorPageField).status === "active"),
      nextPageFieldsByPage.get(entity.airtableEntityId) ?? [],
      (priorPageTablesByPage.get(entity.airtableEntityId) ?? []).filter((l) => (l as PriorPageTable).status === "active").map((l) => l.tableId),
      (nextPageTablesByPage.get(entity.airtableEntityId) ?? []).map((l) => l.tableId),
    );
    if (pageTypeChanged || sourceChanged || fu) {
      updates.push({
        entityType: "page",
        entityId: entity.airtableEntityId,
        changeType: "config",
        beforeValue: { pageType: prev.pageType ?? null, sourceTableId: prev.sourceTableId ?? null },
        afterValue: {
          pageType: entity.pageType ?? null,
          sourceTableId: entity.sourceTableId ?? null,
          ...(fu ? { fieldUsage: fu } : {}),
        },
      });
    }
  }

  // Form config deltas (source_table_id only — no page_type, no field links yet).
  for (const { entity } of formDiff.ops.seen) {
    const prev = prior.forms.find((r) => r.airtableEntityId === entity.airtableEntityId);
    if (!prev) continue;
    if (prev.name !== null && prev.name !== entity.name) {
      updates.push({
        entityType: "form",
        entityId: entity.airtableEntityId,
        changeType: "name",
        beforeValue: prev.name,
        afterValue: entity.name,
      });
    }
    if ((prev.sourceTableId ?? null) !== (entity.sourceTableId ?? null)) {
      updates.push({
        entityType: "form",
        entityId: entity.airtableEntityId,
        changeType: "config",
        beforeValue: { sourceTableId: prev.sourceTableId ?? null },
        afterValue: { sourceTableId: entity.sourceTableId ?? null },
      });
    }
  }

  // ── link lifecycle (page_tables / page_fields) ──
  const pageTables = diffLinks(
    prior.pageTables,
    next.pageTables,
    (l) => `${l.pageId}:${l.tableId}`,
    removedPageIds,
    (l) => ({ pageId: l.pageId, tableId: l.tableId }),
  );
  const pageFields = diffLinks(
    prior.pageFields,
    next.pageFields,
    (l) => `${l.pageId}:${l.fieldId}`,
    removedPageIds,
    (l) => ({ pageId: l.pageId, fieldId: l.fieldId }),
  );

  return {
    captureHash,
    unchanged: false,
    interfaces: appDiff.ops,
    pages: pageDiff.ops,
    forms: formDiff.ops,
    pageTables,
    pageFields,
    updates,
  };
}

function groupBy<T, K>(arr: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const item of arr) {
    const k = key(item);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(item);
  }
  return m;
}

/**
 * Link lifecycle: upsert every link present in the capture (resurrects removed
 * ones on conflict); remove prior active links that are absent from a
 * still-present page OR whose page was removed this run (cascade).
 */
function diffLinks<
  Prior extends { pageId: string; status: string },
  Next extends { pageId: string },
  RemovalKey,
>(
  priorRows: Prior[],
  nextRows: Next[],
  natKey: (l: Prior | Next) => string,
  removedPageIds: Set<string>,
  toRemovalKey: (l: Prior) => RemovalKey,
): LinkOps<Next, RemovalKey> {
  const nextKeys = new Set(nextRows.map(natKey));
  // Never (re)activate a link under a cascade-removed page.
  const upserts = nextRows.filter((l) => !removedPageIds.has(l.pageId));
  const removals: RemovalKey[] = [];
  for (const row of priorRows) {
    if (row.status !== "active") continue;
    const gone = removedPageIds.has(row.pageId) || !nextKeys.has(natKey(row));
    if (gone) removals.push(toRemovalKey(row));
  }
  return { upserts, removals };
}
