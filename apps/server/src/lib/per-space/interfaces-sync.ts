// MCP interface-pages capture → per-Space interface entities — PURE (no I/O),
// unit-tested. (server-mcp-interface-pages)
//
// The workflows backup task captures a base's Interface apps, pages, and
// standalone forms from the Airtable MCP server and forwards the raw envelope
// on the schema-sync callback as the optional `interfacePages` field. This
// module owns:
//   - the wire type of that field (contract source for the paired
//     workflows-mcp-interface-pages change, its task 4.1),
//   - entity extraction (one entity per app / page / form),
//   - the run-over-run diff against the prior MCP-sourced working set.
//
// The drizzle read/apply live in space-db-pg.ts (readInterfaceWorkingSet /
// applyInterfaceDiff); the schema-sync route wires the two together inside the
// same withSpaceSchema transaction as the schema diff.
//
// Diff rules (change spec "interface-pages-sync"):
//   - added/removed are lifecycle (first_seen_at / status='removed'), NOT
//     bo_at_schema_updates rows — mirrors schema-diff.
//   - removal happens ONLY on a successful capture (the route never calls this
//     module when `interfacePages` is absent or skipped).
//   - name changes → schema_updates (entity_type='interface', change_type='name').
//   - composition changes (pageType, sourceTableId, per-page field-id usage
//     incl. isEditable flips) → change_type='config' rows storing the DELTA,
//     comparing field ids only — a schema-side field rename echoes into page
//     payloads' field NAMES but not ids, and must produce zero interface rows.
//   - an identical capture (hash of the extracted entities) short-circuits the
//     diff entirely; the writer still stamps last_seen_at.

export type InterfaceEntityKind = "app" | "page" | "form";

/**
 * Wire shape of the optional `interfacePages` field on the schema-sync POST
 * body. `raw` is the MCP `list_pages_for_base` envelope, forwarded verbatim by
 * workflows (which validates only that `interfaces[]` / `standaloneForms[]`
 * exist). Absent field = no interface processing whatsoever.
 */
export interface InterfacePagesCapture {
  /** ISO-8601 — when the MCP call resolved on the workflows side. */
  capturedAt: string;
  raw: unknown;
}

export interface InterfaceEntity {
  airtableEntityId: string;
  name: string;
  /** → bo_at_interfaces.type ('app' | 'page' | 'form'). */
  kind: InterfaceEntityKind;
  /** Raw payload, preserved verbatim (unknown keys pass through). */
  definition: Record<string, unknown>;
}

export type ExtractResult =
  | { ok: true; entities: InterfaceEntity[]; dropped: number }
  | { ok: false; reason: "invalid_envelope" };

export type ParsedInterfaceCapture =
  | { kind: "absent" }
  | { kind: "invalid"; reason: "invalid_capture" | "invalid_envelope" }
  | { kind: "ok"; capturedAt: Date; entities: InterfaceEntity[]; dropped: number };

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
  return { kind: "ok", capturedAt, entities: extracted.entities, dropped: extracted.dropped };
}

/** Prior MCP-sourced rows (submitted_via='mcp') for one base. */
export interface PriorInterfaceRow {
  /** bo_at_interfaces.id — targets updates without a unique entity index. */
  id: string;
  airtableEntityId: string | null;
  name: string | null;
  type: string | null;
  definition: unknown;
  status: string; // active | removed | unknown
}

export interface InterfaceUpdateOp {
  entityId: string;
  changeType: "name" | "config";
  beforeValue: unknown;
  afterValue: unknown;
}

export interface InterfaceDiffResult {
  captureHash: string;
  /** Identical capture — writer stamps last_seen_at on active rows and stops. */
  unchanged: boolean;
  inserts: InterfaceEntity[];
  seen: { rowId: string; entity: InterfaceEntity }[];
  removals: { rowId: string; entityId: string; name: string | null }[];
  updates: InterfaceUpdateOp[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const idAndName = (v: unknown): v is Record<string, unknown> & { id: string; name: string } =>
  isRecord(v) && typeof v.id === "string" && typeof v.name === "string";

/**
 * Flatten the MCP envelope into entities. Envelope-tolerant per the design:
 * unknown keys pass through into `definition`; entities without a string
 * id + name are dropped (counted); everything else is preserved verbatim.
 * App definitions keep their `pages` array so the raw capture survives
 * verbatim in the per-Space DB (design "Raw capture retention").
 */
export function extractInterfaceEntities(raw: unknown): ExtractResult {
  if (!isRecord(raw) || !Array.isArray(raw.interfaces) || !Array.isArray(raw.standaloneForms)) {
    return { ok: false, reason: "invalid_envelope" };
  }

  const entities: InterfaceEntity[] = [];
  let dropped = 0;

  for (const appRaw of raw.interfaces) {
    const parentId = isRecord(appRaw) && typeof appRaw.id === "string" ? appRaw.id : undefined;
    if (idAndName(appRaw)) {
      entities.push({
        airtableEntityId: appRaw.id,
        name: appRaw.name,
        kind: "app",
        definition: appRaw,
      });
    } else {
      dropped++;
    }
    const pages = isRecord(appRaw) && Array.isArray(appRaw.pages) ? appRaw.pages : [];
    for (const pageRaw of pages) {
      if (idAndName(pageRaw)) {
        entities.push({
          airtableEntityId: pageRaw.id,
          name: pageRaw.name,
          kind: "page",
          definition: {
            ...pageRaw,
            // Parentage lives in the definition (plain-columns convention —
            // no FK column; design Decision 1).
            interfaceId: typeof pageRaw.interfaceId === "string" ? pageRaw.interfaceId : parentId,
          },
        });
      } else {
        dropped++;
      }
    }
  }

  for (const formRaw of raw.standaloneForms) {
    if (idAndName(formRaw)) {
      entities.push({
        airtableEntityId: formRaw.id,
        name: formRaw.name,
        kind: "form",
        // Treated as a page with pageType 'form' until a real sample says
        // otherwise (open question S1/W3).
        definition: {
          ...formRaw,
          pageType: typeof formRaw.pageType === "string" ? formRaw.pageType : "form",
        },
      });
    } else {
      dropped++;
    }
  }

  return { ok: true, entities, dropped };
}

// ---- Capture hash (short-circuit detector) ----
//
// Local copies of schema-diff.ts's canonicalJson + FNV-1a (not exported
// there). Key-order-insensitive because JSONB round-trips canonicalize object
// key order (the 2026-07-10 changelog-spam lesson); array-order-insensitive at
// the entity level via sorting. The prior hash is RECONSTRUCTED from the
// stored rows (name/type/definition are refreshed verbatim on every `seen`),
// so no hash column or migration is needed.

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

interface HashableEntity {
  airtableEntityId: string;
  name: string;
  kind: string;
  definition: unknown;
}

function hashEntities(entities: HashableEntity[]): string {
  const sorted = [...entities].sort((a, b) =>
    `${a.kind}:${a.airtableEntityId}`.localeCompare(`${b.kind}:${b.airtableEntityId}`),
  );
  return fnv1a64(
    canonicalJson(
      sorted.map((e) => ({
        id: e.airtableEntityId,
        name: e.name,
        kind: e.kind,
        definition: e.definition ?? null,
      })),
    ),
  );
}

// ---- Field-usage extraction (ids + isEditable only — never names/options) ----

type FieldUsage = Map<string, Map<string, boolean | null>>;

function fieldUsageOf(definition: unknown): FieldUsage {
  const usage: FieldUsage = new Map();
  if (!isRecord(definition) || !isRecord(definition.tablesByTableId)) return usage;
  for (const [tableId, tableRaw] of Object.entries(definition.tablesByTableId)) {
    const fields: Map<string, boolean | null> = new Map();
    if (isRecord(tableRaw) && Array.isArray(tableRaw.fields)) {
      for (const f of tableRaw.fields) {
        if (isRecord(f) && typeof f.id === "string") {
          fields.set(f.id, typeof f.isEditable === "boolean" ? f.isEditable : null);
        }
      }
    }
    usage.set(tableId, fields);
  }
  return usage;
}

interface FieldUsageDelta {
  added: { tableId: string; fieldIds: string[] }[];
  removed: { tableId: string; fieldIds: string[] }[];
  editableFlips: { tableId: string; fieldId: string; isEditable: boolean }[];
}

function diffFieldUsage(prev: FieldUsage, next: FieldUsage): FieldUsageDelta | null {
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

  if (!added.length && !removed.length && !editableFlips.length) return null;
  return { added, removed, editableFlips };
}

const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function diffInterfaces(args: {
  prior: PriorInterfaceRow[];
  next: InterfaceEntity[];
}): InterfaceDiffResult {
  const { next } = args;
  // Rows without an entity id can't be matched or hashed — defensive; MCP
  // inserts always carry one.
  const prior = args.prior.filter((r) => r.airtableEntityId !== null);
  const priorActive = prior.filter((r) => r.status === "active");

  const captureHash = hashEntities(next);
  const priorHash = hashEntities(
    priorActive.map((r) => ({
      airtableEntityId: r.airtableEntityId!,
      name: r.name ?? "",
      kind: r.type ?? "",
      definition: r.definition,
    })),
  );

  if (captureHash === priorHash) {
    return { captureHash, unchanged: true, inserts: [], seen: [], removals: [], updates: [] };
  }

  const priorById = new Map(prior.map((r) => [r.airtableEntityId!, r]));
  const nextById = new Map(next.map((e) => [e.airtableEntityId, e]));

  const inserts: InterfaceEntity[] = [];
  const seen: InterfaceDiffResult["seen"] = [];
  const updates: InterfaceUpdateOp[] = [];

  for (const entity of next) {
    const prev = priorById.get(entity.airtableEntityId);
    if (!prev) {
      inserts.push(entity);
      continue;
    }
    seen.push({ rowId: prev.id, entity });

    if (prev.name !== null && prev.name !== entity.name) {
      updates.push({
        entityId: entity.airtableEntityId,
        changeType: "name",
        beforeValue: prev.name,
        afterValue: entity.name,
      });
    }

    if (entity.kind === "page" || entity.kind === "form") {
      const prevDef = isRecord(prev.definition) ? prev.definition : {};
      const nextDef = entity.definition;
      const pageTypeChanged = strOrNull(prevDef.pageType) !== strOrNull(nextDef.pageType);
      const sourceChanged =
        strOrNull(prevDef.sourceTableId) !== strOrNull(nextDef.sourceTableId);
      const fieldUsage = diffFieldUsage(fieldUsageOf(prevDef), fieldUsageOf(nextDef));

      if (pageTypeChanged || sourceChanged || fieldUsage) {
        updates.push({
          entityId: entity.airtableEntityId,
          changeType: "config",
          beforeValue: {
            pageType: strOrNull(prevDef.pageType),
            sourceTableId: strOrNull(prevDef.sourceTableId),
          },
          afterValue: {
            pageType: strOrNull(nextDef.pageType),
            sourceTableId: strOrNull(nextDef.sourceTableId),
            ...(fieldUsage ? { fieldUsage } : {}),
          },
        });
      }
    }
  }

  const removals = priorActive
    .filter((r) => !nextById.has(r.airtableEntityId!))
    .map((r) => ({ rowId: r.id, entityId: r.airtableEntityId!, name: r.name }));

  return { captureHash, unchanged: false, inserts, seen, removals, updates };
}
