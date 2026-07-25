// Pure-logic tests for extractAutomationEntities + diffAutomations
// (server-mcp-automations). No DB — the drizzle read/apply live in
// space-db-pg.ts and are exercised by the deployed smoke, mirroring the
// interfaces-sync test split. Placed under tests/integration/** so the server
// test runner picks it up.
//
// The envelope's top-level shape ({ automations: [] }) is pinned by the
// 2026-07-24 spike (workflows-mcp-automations README). The PER-ENTRY shape is
// unverified until a populated capture exists, so extraction is deliberately
// lenient: string id + name required, every other key passes through into the
// slimmed definition.

import { describe, expect, it } from "vitest";
import {
  diffAutomations,
  extractAutomationEntities,
  parseAutomationsField,
  type ExtractedAutomationCapture,
  type PriorAutomationWorkingSet,
} from "../../../src/lib/per-space/automations-sync";

// ───────────────────────── fixtures ─────────────────────────

const WFL_A = "wflAAAAAAAAAAAAAA";
const WFL_B = "wflBBBBBBBBBBBBBB";

const automation = (over: Record<string, unknown> = {}) => ({
  id: WFL_A,
  name: "Notify on new order",
  deploymentStatus: "enabled",
  trigger: { type: "recordCreated", tableId: "tblX" },
  nodes: [{ kind: "action", action: "sendEmail" }],
  ...over,
});

const envelope = (automations: unknown[]) => ({ automations });

const capture = (automations: unknown[] = [automation()]) => ({
  capturedAt: "2026-07-24T10:00:00.000Z",
  raw: envelope(automations),
});

/** Build a prior working set from an extracted capture, as if applied verbatim. */
function priorFrom(c: ExtractedAutomationCapture, over: Partial<{ status: string }> = {}): PriorAutomationWorkingSet {
  return {
    automations: c.automations.map((a, i) => ({
      id: `row-${i}`,
      airtableEntityId: a.airtableEntityId,
      name: a.name,
      definition: a.definition,
      status: over.status ?? "active",
    })),
  };
}

// ───────────────────────── parseAutomationsField ─────────────────────────

describe("parseAutomationsField", () => {
  it("absent field means no processing at all", () => {
    expect(parseAutomationsField(undefined)).toEqual({ kind: "absent" });
  });

  it("null / missing capturedAt is invalid_capture", () => {
    expect(parseAutomationsField(null)).toMatchObject({ kind: "invalid", reason: "invalid_capture" });
    expect(parseAutomationsField({ raw: envelope([]) })).toMatchObject({
      kind: "invalid",
      reason: "invalid_capture",
    });
    expect(parseAutomationsField({ capturedAt: "not-a-date", raw: envelope([]) })).toMatchObject({
      kind: "invalid",
      reason: "invalid_capture",
    });
  });

  it("malformed envelope is invalid_envelope", () => {
    expect(parseAutomationsField({ capturedAt: "2026-07-24T10:00:00.000Z", raw: {} })).toMatchObject({
      kind: "invalid",
      reason: "invalid_envelope",
    });
    expect(parseAutomationsField({ capturedAt: "2026-07-24T10:00:00.000Z", raw: { automations: "nope" } })).toMatchObject({
      kind: "invalid",
      reason: "invalid_envelope",
    });
  });

  it("valid capture parses and extracts", () => {
    const parsed = parseAutomationsField(capture());
    expect(parsed.kind).toBe("ok");
    if (parsed.kind !== "ok") return;
    expect(parsed.capturedAt.toISOString()).toBe("2026-07-24T10:00:00.000Z");
    expect(parsed.capture.automations).toHaveLength(1);
  });
});

// ───────────────────────── extractAutomationEntities ─────────────────────────

describe("extractAutomationEntities", () => {
  it("keeps unknown keys in the slimmed definition, strips id/name", () => {
    const result = extractAutomationEntities(envelope([automation()]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [a] = result.capture.automations;
    expect(a.airtableEntityId).toBe(WFL_A);
    expect(a.name).toBe("Notify on new order");
    expect(a.definition).toEqual({
      deploymentStatus: "enabled",
      trigger: { type: "recordCreated", tableId: "tblX" },
      nodes: [{ kind: "action", action: "sendEmail" }],
    });
    expect(a.definition).not.toHaveProperty("id");
    expect(a.definition).not.toHaveProperty("name");
  });

  it("drops (and counts) entries without a string id + name", () => {
    const result = extractAutomationEntities(
      envelope([automation(), { id: 42, name: "bad id" }, { name: "no id" }, "not-a-record", null]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.capture.automations).toHaveLength(1);
    expect(result.capture.dropped).toBe(4);
  });

  it("empty envelope is a valid empty capture", () => {
    const result = extractAutomationEntities(envelope([]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.capture.automations).toEqual([]);
    expect(result.capture.dropped).toBe(0);
  });

  it("rejects a non-array automations key", () => {
    expect(extractAutomationEntities({ automations: {} })).toEqual({ ok: false, reason: "invalid_envelope" });
    expect(extractAutomationEntities(null)).toEqual({ ok: false, reason: "invalid_envelope" });
  });
});

// ───────────────────────── diffAutomations ─────────────────────────

const extracted = (automations: unknown[]) => {
  const r = extractAutomationEntities(envelope(automations));
  if (!r.ok) throw new Error("fixture must extract");
  return r.capture;
};

describe("diffAutomations", () => {
  it("first capture inserts everything", () => {
    const next = extracted([automation(), automation({ id: WFL_B, name: "Weekly digest" })]);
    const diff = diffAutomations({ prior: { automations: [] }, next });
    expect(diff.unchanged).toBe(false);
    expect(diff.automations.inserts).toHaveLength(2);
    expect(diff.automations.seen).toHaveLength(0);
    expect(diff.automations.removals).toHaveLength(0);
    expect(diff.updates).toHaveLength(0);
  });

  it("identical re-capture short-circuits via the hash", () => {
    const next = extracted([automation()]);
    const diff = diffAutomations({ prior: priorFrom(next), next });
    expect(diff.unchanged).toBe(true);
    expect(diff.automations.inserts).toHaveLength(0);
    expect(diff.automations.removals).toHaveLength(0);
    expect(diff.updates).toHaveLength(0);
  });

  it("hash is key-order-insensitive (JSONB round-trip canonicalization)", () => {
    const next = extracted([automation()]);
    const prior = priorFrom(next);
    // Re-key the stored definition in a different object-key order.
    prior.automations[0].definition = {
      nodes: [{ action: "sendEmail", kind: "action" }],
      trigger: { tableId: "tblX", type: "recordCreated" },
      deploymentStatus: "enabled",
    };
    expect(diffAutomations({ prior, next }).unchanged).toBe(true);
  });

  it("rename emits a name update and refreshes the row", () => {
    const prior = priorFrom(extracted([automation()]));
    const next = extracted([automation({ name: "Notify on ANY order" })]);
    const diff = diffAutomations({ prior, next });
    expect(diff.unchanged).toBe(false);
    expect(diff.automations.seen).toHaveLength(1);
    expect(diff.updates).toEqual([
      {
        entityType: "automation",
        entityId: WFL_A,
        changeType: "name",
        beforeValue: "Notify on new order",
        afterValue: "Notify on ANY order",
      },
    ]);
  });

  it("definition change (e.g. enabled flip) emits a config update with before/after", () => {
    const prior = priorFrom(extracted([automation()]));
    const next = extracted([automation({ deploymentStatus: "disabled" })]);
    const diff = diffAutomations({ prior, next });
    expect(diff.unchanged).toBe(false);
    expect(diff.updates).toHaveLength(1);
    const [u] = diff.updates;
    expect(u.changeType).toBe("config");
    expect(u.entityId).toBe(WFL_A);
    expect(u.beforeValue).toMatchObject({ deploymentStatus: "enabled" });
    expect(u.afterValue).toMatchObject({ deploymentStatus: "disabled" });
  });

  it("a null prior name never emits a name update", () => {
    const next = extracted([automation()]);
    const prior = priorFrom(next);
    prior.automations[0].name = null;
    const diff = diffAutomations({ prior, next });
    expect(diff.updates.filter((u) => u.changeType === "name")).toHaveLength(0);
  });

  it("absence from a successful capture removes prior active rows", () => {
    const prior = priorFrom(extracted([automation(), automation({ id: WFL_B, name: "Weekly digest" })]));
    const next = extracted([automation()]);
    const diff = diffAutomations({ prior, next });
    expect(diff.automations.removals).toEqual([{ rowId: "row-1", entityId: WFL_B }]);
  });

  it("an already-removed row absent again is not re-removed", () => {
    const prior = priorFrom(extracted([automation({ id: WFL_B, name: "Weekly digest" })]), { status: "removed" });
    const next = extracted([automation()]);
    const diff = diffAutomations({ prior, next });
    expect(diff.automations.removals).toHaveLength(0);
    expect(diff.automations.inserts).toHaveLength(1); // WFL_A is new
  });

  it("a removed row reappearing resurrects as seen, not insert", () => {
    const next = extracted([automation()]);
    const prior = priorFrom(next, { status: "removed" });
    const diff = diffAutomations({ prior, next });
    expect(diff.automations.inserts).toHaveLength(0);
    expect(diff.automations.seen).toEqual([{ rowId: "row-0", entity: next.automations[0] }]);
    // Resurrection is a real change — the hash must not short-circuit it.
    expect(diff.unchanged).toBe(false);
  });
});
