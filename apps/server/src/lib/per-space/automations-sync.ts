// MCP automations capture → per-Space automation entities — PURE (no I/O),
// unit-tested. (server-mcp-automations, the automation twin of
// interfaces-sync.ts.)
//
// The workflows backup task captures a base's automations from the Airtable MCP
// server (`list_automations`, spike 2026-07-24) and forwards the raw envelope on
// the schema-sync callback as the optional `automations` field. This module owns:
//   - the wire type of that field,
//   - extraction into automation entities,
//   - the run-over-run diff against the prior MCP-sourced working set.
//
// The drizzle read/apply live in space-db-pg.ts (readAutomationWorkingSet /
// applyAutomationDiff), wired by the schema-sync route inside the same
// withSpaceSchema transaction as the schema diff.
//
// Model (change spec "automations-sync") — REUSES the existing
// bo_at_automations table (created by the manual-intake work) with NO
// migration:
//   - MCP rows carry submitted_via='mcp' and the table's submission-driven
//     TIMESTAMP lifecycle (first_seen_at / last_seen_at + status) — not the
//     run-based set interfaces use. The existing changelog automation-removals
//     reader (schema-changelog-io.ts) already consumes exactly that shape
//     (status='removed' + last_seen_at), so removals surface with zero
//     changelog work.
//   - Manual rows (submitted_via ≠ 'mcp') are parallel and never touched:
//     readAutomationWorkingSet filters to MCP rows only.
//
// Envelope tolerance: the top-level shape ({ automations: [] }) is pinned by
// the spike; the PER-ENTRY shape is unverified until a populated capture
// exists. Extraction requires a string id + name (entities without them are
// dropped and counted) and passes every other key through into the slimmed
// definition — deployment status, trigger info, and graph nodes live there
// until a real consumer needs them as columns.
//
// Diff rules (mirroring interfaces-sync):
//   - add/remove/resurrect are lifecycle (status + stamps), NOT schema_updates.
//   - removal ONLY on a successful capture (the route never calls this when the
//     field is absent/skipped); reappearing ids resurrect to active via `seen`.
//   - name changes → schema_updates (entity_type='automation',
//     change_type='name'); definition changes → change_type='config' with the
//     full before/after definitions (automations have no link tables — the
//     definition IS the config).
//   - an identical capture (key-order-insensitive hash of the normalized
//     representation) short-circuits the diff; the writer still stamps
//     last_seen_at.

export interface AutomationsCapture {
  /** ISO-8601 — when the MCP call resolved on the workflows side. */
  capturedAt: string;
  /** The MCP `list_automations` envelope, forwarded verbatim by workflows. */
  raw: unknown;
}

export interface ExtractedAutomation {
  airtableEntityId: string;
  name: string;
  /** Slimmed definition — id/name stripped, every unknown key preserved. */
  definition: Record<string, unknown>;
}

export interface ExtractedAutomationCapture {
  automations: ExtractedAutomation[];
  /** entities dropped for want of a string id + name (counted, not fatal). */
  dropped: number;
}

export type AutomationExtractResult =
  | { ok: true; capture: ExtractedAutomationCapture }
  | { ok: false; reason: "invalid_envelope" };

export type ParsedAutomationsCapture =
  | { kind: "absent" }
  | { kind: "invalid"; reason: "invalid_capture" | "invalid_envelope" }
  | { kind: "ok"; capturedAt: Date; capture: ExtractedAutomationCapture };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const idAndName = (v: unknown): v is Record<string, unknown> & { id: string; name: string } =>
  isRecord(v) && typeof v.id === "string" && typeof v.name === "string";

/**
 * Parse the optional `automations` field off the schema-sync body. `undefined`
 * (field absent — old workflows, skipped/below-tier captures) means NO
 * automation processing whatsoever; a present-but-malformed field is reported
 * (`invalid`) without ever failing the sync.
 */
export function parseAutomationsField(field: unknown): ParsedAutomationsCapture {
  if (field === undefined) return { kind: "absent" };
  const capture = field as Partial<AutomationsCapture> | null;
  const capturedAt = new Date(String(capture?.capturedAt ?? ""));
  if (!capture || Number.isNaN(capturedAt.getTime())) {
    return { kind: "invalid", reason: "invalid_capture" };
  }
  const extracted = extractAutomationEntities(capture.raw);
  if (!extracted.ok) return { kind: "invalid", reason: extracted.reason };
  return { kind: "ok", capturedAt, capture: extracted.capture };
}

/** Copy a raw entity's keys into a slimmed definition (id/name are columns). */
function slimDefinition(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === "id" || k === "name") continue;
    out[k] = v;
  }
  return out;
}

/**
 * Flatten the MCP envelope into automation entities. Envelope-tolerant:
 * unknown keys pass through into the slimmed `definition`; entities without a
 * string id + name are dropped (counted).
 */
export function extractAutomationEntities(raw: unknown): AutomationExtractResult {
  if (!isRecord(raw) || !Array.isArray(raw.automations)) {
    return { ok: false, reason: "invalid_envelope" };
  }
  const automations: ExtractedAutomation[] = [];
  let dropped = 0;
  for (const entry of raw.automations) {
    if (!idAndName(entry)) {
      dropped++;
      continue;
    }
    automations.push({
      airtableEntityId: entry.id,
      name: entry.name,
      definition: slimDefinition(entry),
    });
  }
  return { ok: true, capture: { automations, dropped } };
}

// ───────────────────────── prior working set ─────────────────────────
// What readAutomationWorkingSet returns (submitted_via='mcp' rows for one
// base). Rows carry their row `id` — writes target the id (no unique
// (base_id, airtable_entity_id) index, same deferral as interfaces).

export interface PriorAutomationRow {
  id: string;
  airtableEntityId: string | null;
  name: string | null;
  definition: unknown;
  status: string;
}

export interface PriorAutomationWorkingSet {
  automations: PriorAutomationRow[];
}

// ───────────────────────── diff result ─────────────────────────

export interface AutomationUpdateOp {
  entityType: "automation";
  entityId: string;
  changeType: "name" | "config";
  beforeValue: unknown;
  afterValue: unknown;
}

export interface AutomationEntityOps {
  inserts: ExtractedAutomation[];
  seen: { rowId: string; entity: ExtractedAutomation }[];
  removals: { rowId: string; entityId: string }[];
}

export interface AutomationDiffResult {
  captureHash: string;
  /** Identical capture — writer stamps last_seen_at on active rows and stops. */
  unchanged: boolean;
  automations: AutomationEntityOps;
  updates: AutomationUpdateOp[];
}

// ───────────────────────── capture hash (short-circuit detector) ─────────────
// Key-order-insensitive (JSONB round-trips canonicalize object key order) and
// collection-order-insensitive via sorting — same rules as interfaces-sync.
// The prior hash is RECONSTRUCTED from the stored ACTIVE working set, so no
// hash column is needed and a resurrection never short-circuits.

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

interface NormalizedAutomation {
  id: string;
  name: string;
  definition: unknown;
}

function hashNormalized(automations: NormalizedAutomation[]): string {
  const sorted = [...automations].sort((a, b) => a.id.localeCompare(b.id));
  return fnv1a64(
    canonicalJson(sorted.map((a) => ({ id: a.id, name: a.name, definition: a.definition ?? null }))),
  );
}

function hashCapture(c: ExtractedAutomationCapture): string {
  return hashNormalized(
    c.automations.map((a) => ({ id: a.airtableEntityId, name: a.name, definition: a.definition })),
  );
}

function hashPrior(prior: PriorAutomationWorkingSet): string {
  return hashNormalized(
    prior.automations
      .filter((r) => r.status === "active" && r.airtableEntityId !== null)
      .map((r) => ({ id: r.airtableEntityId!, name: r.name ?? "", definition: r.definition })),
  );
}

// ───────────────────────── diff ─────────────────────────

export function diffAutomations(args: {
  prior: PriorAutomationWorkingSet;
  next: ExtractedAutomationCapture;
}): AutomationDiffResult {
  const { prior, next } = args;

  const captureHash = hashCapture(next);
  if (captureHash === hashPrior(prior)) {
    return {
      captureHash,
      unchanged: true,
      automations: { inserts: [], seen: [], removals: [] },
      updates: [],
    };
  }

  const priorRows = prior.automations.filter((r) => r.airtableEntityId !== null);
  const priorById = new Map(priorRows.map((r) => [r.airtableEntityId!, r]));
  const nextById = new Map(next.automations.map((a) => [a.airtableEntityId, a]));

  const inserts: ExtractedAutomation[] = [];
  const seen: { rowId: string; entity: ExtractedAutomation }[] = [];
  const updates: AutomationUpdateOp[] = [];

  for (const entity of next.automations) {
    const prev = priorById.get(entity.airtableEntityId);
    if (!prev) {
      inserts.push(entity);
      continue;
    }
    seen.push({ rowId: prev.id, entity });
    // Update ops compare against what was stored, regardless of prior status —
    // but only rows that were visibly active produce changelog rows (a
    // resurrection is a lifecycle event, not a rename/config event).
    if (prev.status !== "active") continue;
    if (prev.name !== null && prev.name !== entity.name) {
      updates.push({
        entityType: "automation",
        entityId: entity.airtableEntityId,
        changeType: "name",
        beforeValue: prev.name,
        afterValue: entity.name,
      });
    }
    if (canonicalJson(prev.definition ?? null) !== canonicalJson(entity.definition ?? null)) {
      updates.push({
        entityType: "automation",
        entityId: entity.airtableEntityId,
        changeType: "config",
        beforeValue: prev.definition ?? null,
        afterValue: entity.definition,
      });
    }
  }

  const removals: { rowId: string; entityId: string }[] = [];
  for (const row of priorRows) {
    if (row.status !== "active") continue;
    if (!nextById.has(row.airtableEntityId!)) {
      removals.push({ rowId: row.id, entityId: row.airtableEntityId! });
    }
  }

  return {
    captureHash,
    unchanged: false,
    automations: { inserts, seen, removals },
    updates,
  };
}
