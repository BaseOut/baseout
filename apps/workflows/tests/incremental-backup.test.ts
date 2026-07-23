// Tests for the incremental-backup pure orchestration module + the
// airtable-payloads client (openspec/changes/workflows-instant-webhook).
//
// The task is payloads-API-primary: it pulls webhook payloads from the
// subscription's cursor, applies them in baseTransactionNumber order (schema
// events before record events within each payload), advances the cursor via
// the engine callback after each durably-applied batch, and optionally runs a
// modifiedTime reconciliation catch-all. Everything is dep-injected — fixture
// payload streams + a recording fake per-space DB stand in for Airtable and
// the engine-brokered write transport (server-instant-webhook Phase D).

import { describe, expect, it, vi } from "vitest";
import {
  fetchPayloadsPage,
  parsePayloadsResponse,
  AirtablePayloadsError,
  PayloadsCursorExpiredError,
  type PayloadsPage,
  type WebhookPayload,
} from "../trigger/tasks/_lib/airtable-payloads";
import {
  runIncrementalBackup,
  createEngineCallbacks,
  schemaHashOf,
  type AppliedSchemaState,
  type IncrementalBackupDeps,
  type IncrementalBackupInput,
  type RecordWrite,
  type SchemaWrite,
  type StoredRecordState,
} from "../trigger/tasks/incremental-backup";
import { createAirtableClient } from "../trigger/tasks/_lib/airtable-client";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const INPUT: IncrementalBackupInput = {
  runId: "run-1",
  spaceId: "space-1",
  subscriptionId: "sub-1",
  baseId: "appBase1",
  connectionId: "conn-1",
  cursor: 10,
  reconcile: false,
};

const NOW = new Date("2026-07-20T12:00:00.000Z");

function page(
  payloads: WebhookPayload[],
  cursor: number,
  mightHaveMore = false,
): PayloadsPage {
  return { payloads, cursor, mightHaveMore };
}

/** A payload changing one cell of one record in tbl1. */
function cellChangePayload(args: {
  txn: number;
  tableId?: string;
  recordId?: string;
  fieldId?: string;
  value?: unknown;
  previous?: unknown;
  actionMetadata?: WebhookPayload["actionMetadata"];
}): WebhookPayload {
  const {
    txn,
    tableId = "tbl1",
    recordId = "rec1",
    fieldId = "fld1",
    value = "new",
  } = args;
  return {
    baseTransactionNumber: txn,
    timestamp: "2026-07-20T11:59:00.000Z",
    actionMetadata: args.actionMetadata,
    changedTablesById: {
      [tableId]: {
        changedRecordsById: {
          [recordId]: {
            current: { cellValuesByFieldId: { [fieldId]: value } },
            ...(args.previous !== undefined
              ? { previous: { cellValuesByFieldId: { [fieldId]: args.previous } } }
              : {}),
          },
        },
      },
    },
  };
}

interface DepsHarness {
  deps: IncrementalBackupDeps;
  /** 'schema' | 'records' in apply-call order. */
  order: string[];
  schemaBatches: SchemaWrite[][];
  recordBatches: RecordWrite[][];
  allSchemaWrites: () => SchemaWrite[];
  allRecordWrites: () => RecordWrite[];
  postCursor: ReturnType<typeof vi.fn>;
  postFallback: ReturnType<typeof vi.fn>;
}

function makeDeps(opts: {
  pages?: PayloadsPage[];
  /** tableId → recordId → cells (fieldId → value). */
  stored?: Record<string, Record<string, Record<string, unknown>>>;
  meta?: { tables: { id: string; name: string; primaryFieldId: string; fields: { id: string; name: string; type: string }[] }[] };
  appliedSchema?: AppliedSchemaState;
  tableIds?: string[];
  recordsPages?: (tableId: string, o: Record<string, unknown>) => { records: { id: string; createdTime: string; fields: Record<string, unknown> }[]; offset?: string };
  driftThreshold?: number;
  viewCaptureEnabled?: boolean;
  lastReconciledAt?: string | null;
}): DepsHarness {
  const stored = opts.stored ?? {};
  const pages = [...(opts.pages ?? [page([], INPUT.cursor)])];
  const order: string[] = [];
  const schemaBatches: SchemaWrite[][] = [];
  const recordBatches: RecordWrite[][] = [];
  const postCursor = vi.fn(async () => {});
  const postFallback = vi.fn(async () => {});

  const meta = opts.meta ?? { tables: [] };
  const defaultApplied: AppliedSchemaState = {
    tables: Object.fromEntries(
      meta.tables.map((t) => [
        t.id,
        { fields: Object.fromEntries(t.fields.map((f) => [f.id, { type: f.type }])) },
      ]),
    ),
  };

  const deps: IncrementalBackupDeps = {
    airtable: {
      fetchPayloadsPage: vi.fn(async () => {
        const next = pages.shift();
        if (!next) throw new Error("no more fixture pages");
        return next;
      }),
      getBaseSchema: vi.fn(async () => meta),
      listRecordsPage: vi.fn(async (tableId: string, o: Record<string, unknown>) =>
        opts.recordsPages ? opts.recordsPages(tableId, o) : { records: [] },
      ),
    },
    db: {
      openBaseRun: vi.fn(async () => ({ baseRunId: "base-run-1" })),
      completeBaseRun: vi.fn(async () => {}),
      applySchemaEvents: vi.fn(async (_baseRunId: string, writes: SchemaWrite[]) => {
        order.push("schema");
        schemaBatches.push(writes);
      }),
      applyRecordEvents: vi.fn(async (_baseRunId: string, writes: RecordWrite[]) => {
        order.push("records");
        recordBatches.push(writes);
      }),
      getStoredRecords: vi.fn(
        async (tableId: string, recordIds: string[]) => {
          const out: Record<string, StoredRecordState | undefined> = {};
          for (const id of recordIds) {
            const cells = stored[tableId]?.[id];
            out[id] = cells ? { cells } : undefined;
          }
          return out;
        },
      ),
      insertSchemaVersion: vi.fn(async () => ({ inserted: true })),
      getAppliedSchemaState: vi.fn(async () => opts.appliedSchema ?? defaultApplied),
      regenerateViews: vi.fn(async () => {}),
      listStoredRecordIds: vi.fn(async (tableId: string) =>
        Object.keys(stored[tableId] ?? {}),
      ),
      listTableIds: vi.fn(async () => opts.tableIds ?? Object.keys(stored)),
    },
    engine: { postCursor, postFallback },
    now: () => NOW,
    log: vi.fn(),
    ...(opts.driftThreshold !== undefined ? { driftThreshold: opts.driftThreshold } : {}),
    ...(opts.viewCaptureEnabled !== undefined ? { viewCaptureEnabled: opts.viewCaptureEnabled } : {}),
    ...(opts.lastReconciledAt !== undefined ? { lastReconciledAt: opts.lastReconciledAt } : {}),
  };

  return {
    deps,
    order,
    schemaBatches,
    recordBatches,
    allSchemaWrites: () => schemaBatches.flat(),
    allRecordWrites: () => recordBatches.flat(),
    postCursor,
    postFallback,
  };
}

// ── airtable-payloads client ─────────────────────────────────────────────────

describe("airtable-payloads client", () => {
  it("GETs /v0/bases/:baseId/webhooks/:webhookId/payloads with cursor + limit and bearer auth", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ payloads: [], cursor: 11, mightHaveMore: false }),
          { status: 200 },
        ),
    );
    const result = await fetchPayloadsPage({
      baseId: "appB",
      webhookId: "achWebhook1",
      cursor: 10,
      accessToken: "tok",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result).toEqual({ payloads: [], cursor: 11, mightHaveMore: false });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/v0/bases/appB/webhooks/achWebhook1/payloads");
    expect(url).toContain("cursor=10");
    expect(url).toContain("limit=50");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
  });

  it("parses tolerantly: all change maps optional, unknown payload keys logged not fatal", () => {
    const log = vi.fn();
    const parsed = parsePayloadsResponse(
      {
        payloads: [
          {
            baseTransactionNumber: 3,
            payloadFormat: "v0",
            someFutureKey: { nested: true },
          },
        ],
        cursor: 4,
        mightHaveMore: false,
      },
      log,
    );
    expect(parsed.payloads).toHaveLength(1);
    expect(parsed.payloads[0]!.baseTransactionNumber).toBe(3);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ event: "unknown_payload_key", key: "someFutureKey" }),
    );
  });

  it("keeps error payload variants (error + code) intact", () => {
    const parsed = parsePayloadsResponse({
      payloads: [{ baseTransactionNumber: 5, error: true, code: "INVALID_HOOK" }],
      cursor: 6,
      mightHaveMore: false,
    });
    expect(parsed.payloads[0]!.error).toBe(true);
    expect(parsed.payloads[0]!.code).toBe("INVALID_HOOK");
  });

  it("throws on a malformed body", () => {
    expect(() => parsePayloadsResponse({ nope: true })).toThrowError(/payloads/);
  });

  it("detects cursor expiry and throws PayloadsCursorExpiredError", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              type: "INVALID_REQUEST_UNKNOWN",
              message: "Invalid cursor: the requested payload data has expired",
            },
          }),
          { status: 422 },
        ),
    );
    await expect(
      fetchPayloadsPage({
        baseId: "appB",
        webhookId: "ach1",
        cursor: 1,
        accessToken: "tok",
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(PayloadsCursorExpiredError);
  });

  it("throws AirtablePayloadsError (not expiry) on unrelated non-2xx", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: "boom" }), { status: 500 }),
    );
    const err = await fetchPayloadsPage({
      baseId: "appB",
      webhookId: "ach1",
      cursor: 1,
      accessToken: "tok",
      fetchImpl: fetchMock as unknown as typeof fetch,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AirtablePayloadsError);
    expect(err).not.toBeInstanceOf(PayloadsCursorExpiredError);
    expect((err as AirtablePayloadsError).status).toBe(500);
  });
});

// ── Happy path + cursor advance ──────────────────────────────────────────────

describe("runIncrementalBackup — payload pass", () => {
  it("opens an incremental base run, applies changes, posts the new cursor, completes succeeded", async () => {
    const h = makeDeps({
      pages: [page([cellChangePayload({ txn: 11 })], 12)],
      stored: { tbl1: { rec1: { fld1: "old" } } },
    });
    const result = await runIncrementalBackup(INPUT, h.deps);

    expect(h.deps.db.openBaseRun).toHaveBeenCalledWith(
      expect.objectContaining({ backupRunId: "run-1", baseId: "appBase1", runType: "incremental" }),
    );
    expect(h.postCursor).toHaveBeenCalledTimes(1);
    expect(h.postCursor).toHaveBeenCalledWith(12);
    expect(h.deps.db.completeBaseRun).toHaveBeenCalledWith(
      expect.objectContaining({ baseRunId: "base-run-1", status: "succeeded" }),
    );
    expect(result.status).toBe("succeeded");
    expect(result.updated).toBe(1);
    expect(result.finalCursor).toBe(12);

    const write = h.allRecordWrites().find((w) => w.kind === "updateCell");
    expect(write).toMatchObject({
      tableId: "tbl1",
      recordId: "rec1",
      fieldId: "fld1",
      value: "new",
    });
  });

  it("loops while mightHaveMore, posting the cursor after each durably-applied batch", async () => {
    const h = makeDeps({
      pages: [
        page([cellChangePayload({ txn: 11, recordId: "rec1" })], 12, true),
        page([cellChangePayload({ txn: 12, recordId: "rec2" })], 13, false),
      ],
      stored: { tbl1: { rec1: { fld1: "a" }, rec2: { fld1: "b" } } },
    });
    const result = await runIncrementalBackup(INPUT, h.deps);
    expect(h.deps.airtable.fetchPayloadsPage).toHaveBeenNthCalledWith(1, 10);
    expect(h.deps.airtable.fetchPayloadsPage).toHaveBeenNthCalledWith(2, 12);
    expect(h.postCursor.mock.calls.map((c) => c[0])).toEqual([12, 13]);
    expect(result.finalCursor).toBe(13);
    expect(result.payloadsApplied).toBe(2);
  });

  it("applies payloads in baseTransactionNumber order within a page", async () => {
    const seen: unknown[] = [];
    const h = makeDeps({
      pages: [
        page(
          [
            cellChangePayload({ txn: 13, value: "third" }),
            cellChangePayload({ txn: 11, value: "first" }),
            cellChangePayload({ txn: 12, value: "second" }),
          ],
          14,
        ),
      ],
      stored: { tbl1: { rec1: { fld1: "seed" } } },
    });
    (h.deps.db.applyRecordEvents as ReturnType<typeof vi.fn>).mockImplementation(
      async (_id: string, writes: RecordWrite[]) => {
        for (const w of writes) if (w.kind === "updateCell") seen.push(w.value);
      },
    );
    await runIncrementalBackup(INPUT, h.deps);
    expect(seen).toEqual(["first", "second", "third"]);
  });

  it("is idempotent on retry: replaying already-applied values makes no writes and logs nothing", async () => {
    // Mid-batch retry scenario: the batch applied but the cursor callback never
    // landed, so the retried attempt re-reads from the stored cursor. Our
    // stored rfd already holds the payload's current value → value-equality
    // guard skips both the cell write and the superseded-value log.
    const h = makeDeps({
      pages: [page([cellChangePayload({ txn: 11, value: "new" })], 12)],
      stored: { tbl1: { rec1: { fld1: "new" } } },
    });
    const result = await runIncrementalBackup(INPUT, h.deps);
    expect(h.allRecordWrites()).toEqual([]);
    expect(result.updated).toBe(0);
    // The cursor still advances — the batch is durably applied (as a no-op).
    expect(h.postCursor).toHaveBeenCalledWith(12);
    expect(result.status).toBe("succeeded");
  });
});

// ── Schema events ────────────────────────────────────────────────────────────

describe("runIncrementalBackup — schema events", () => {
  it("applies schema events before record events within a payload (field created + populated in one txn)", async () => {
    const payload: WebhookPayload = {
      baseTransactionNumber: 11,
      changedTablesById: {
        tbl1: {
          createdFieldsById: { fld9: { name: "New field", type: "number" } },
          changedRecordsById: {
            rec1: { current: { cellValuesByFieldId: { fld9: 42 } } },
          },
        },
      },
    };
    const h = makeDeps({
      pages: [page([payload], 12)],
      stored: { tbl1: { rec1: {} } },
      meta: {
        tables: [
          {
            id: "tbl1",
            name: "T1",
            primaryFieldId: "fld1",
            fields: [{ id: "fld9", name: "New field", type: "number" }],
          },
        ],
      },
    });
    await runIncrementalBackup(INPUT, h.deps);
    expect(h.order[0]).toBe("schema");
    expect(h.order.indexOf("schema")).toBeLessThan(h.order.indexOf("records"));
    expect(h.allSchemaWrites()).toContainEqual(
      expect.objectContaining({ kind: "createField", tableId: "tbl1", fieldId: "fld9", type: "number" }),
    );
    expect(h.allRecordWrites()).toContainEqual(
      expect.objectContaining({ kind: "updateCell", fieldId: "fld9", value: 42 }),
    );
  });

  it("maps destroys to confident removed + cascade — never 'unknown'", async () => {
    const payload: WebhookPayload = {
      baseTransactionNumber: 11,
      destroyedTableIds: ["tblGone"],
      changedTablesById: {
        tbl1: {
          destroyedFieldIds: ["fldGone"],
          destroyedRecordIds: ["recGone"],
        },
      },
    };
    const h = makeDeps({
      pages: [page([payload], 12)],
      stored: { tbl1: { recGone: { fld1: "x" } } },
      meta: { tables: [] },
      appliedSchema: { tables: {} },
    });
    const result = await runIncrementalBackup(INPUT, h.deps);
    expect(h.allSchemaWrites()).toContainEqual(
      expect.objectContaining({ kind: "destroyTable", tableId: "tblGone", status: "removed", cascade: true }),
    );
    expect(h.allSchemaWrites()).toContainEqual(
      expect.objectContaining({ kind: "destroyField", tableId: "tbl1", fieldId: "fldGone", status: "removed", cascade: true }),
    );
    expect(h.allRecordWrites()).toContainEqual(
      expect.objectContaining({ kind: "destroyRecord", tableId: "tbl1", recordId: "recGone", status: "deleted" }),
    );
    expect(JSON.stringify(h.allSchemaWrites())).not.toContain("unknown");
    expect(result.deleted).toBe(1);
  });

  it("field description change touches ONLY description (never ai_description/description_override)", async () => {
    const payload: WebhookPayload = {
      baseTransactionNumber: 11,
      changedTablesById: {
        tbl1: {
          changedFieldsById: {
            fld1: {
              current: { description: "after" },
              previous: { description: "before" },
            },
          },
        },
      },
    };
    const h = makeDeps({
      pages: [page([payload], 12)],
      meta: {
        tables: [
          { id: "tbl1", name: "T1", primaryFieldId: "fld1", fields: [{ id: "fld1", name: "F", type: "singleLineText" }] },
        ],
      },
    });
    await runIncrementalBackup(INPUT, h.deps);
    const write = h.allSchemaWrites().find((w) => w.kind === "updateField");
    expect(write).toBeDefined();
    if (write?.kind !== "updateField") throw new Error("unreachable");
    expect(Object.keys(write.set)).toEqual(["description"]);
    expect(write.log).toMatchObject({ changeType: "description" });
  });

  it("marks a field retype breaks_data and logs payload previous/current as before/after", async () => {
    const payload: WebhookPayload = {
      baseTransactionNumber: 11,
      changedTablesById: {
        tbl1: {
          changedFieldsById: {
            fld1: {
              current: { type: "number" },
              previous: { type: "singleLineText" },
            },
          },
        },
      },
    };
    const h = makeDeps({
      pages: [page([payload], 12)],
      meta: {
        tables: [
          { id: "tbl1", name: "T1", primaryFieldId: "fld1", fields: [{ id: "fld1", name: "F", type: "number" }] },
        ],
      },
    });
    await runIncrementalBackup(INPUT, h.deps);
    const write = h.allSchemaWrites().find((w) => w.kind === "updateField");
    if (write?.kind !== "updateField") throw new Error("missing updateField write");
    expect(write.log).toMatchObject({
      changeType: "type",
      breaksData: true,
      beforeValue: { type: "singleLineText" },
      afterValue: { type: "number" },
    });
  });

  it("skips changedViewsById unless Enterprise view capture is enabled", async () => {
    const payload: WebhookPayload = {
      baseTransactionNumber: 11,
      changedTablesById: {
        tbl1: { changedViewsById: { viw1: { current: { name: "V" } } } },
      },
    };
    const off = makeDeps({ pages: [page([payload], 12)], meta: { tables: [] }, appliedSchema: { tables: {} } });
    await runIncrementalBackup(INPUT, off.deps);
    expect(off.allSchemaWrites().filter((w) => w.kind === "updateView")).toEqual([]);

    const on = makeDeps({
      pages: [page([payload], 12)],
      meta: { tables: [] },
      appliedSchema: { tables: {} },
      viewCaptureEnabled: true,
    });
    await runIncrementalBackup(INPUT, on.deps);
    expect(on.allSchemaWrites()).toContainEqual(
      expect.objectContaining({ kind: "updateView", tableId: "tbl1", viewId: "viw1" }),
    );
  });
});

// ── Record semantics ─────────────────────────────────────────────────────────

describe("runIncrementalBackup — record semantics", () => {
  it("logs the superseded value FROM OUR STORED rfd value, not the payload previous, and counts drift", async () => {
    const h = makeDeps({
      pages: [
        page(
          [cellChangePayload({ txn: 11, value: "new", previous: "payload-prev" })],
          12,
        ),
      ],
      stored: { tbl1: { rec1: { fld1: "stored-V" } } },
    });
    const result = await runIncrementalBackup(INPUT, h.deps);
    const write = h.allRecordWrites().find((w) => w.kind === "updateCell");
    if (write?.kind !== "updateCell") throw new Error("missing updateCell write");
    expect(write.log?.oldValue).toBe("stored-V");
    expect(write.log?.oldValue).not.toBe("payload-prev");
    // payload previous ≠ stored → drift counted, pass flips to reconcile.
    expect(result.driftCount).toBe(1);
    expect(result.reconcileRan).toBe(true);
  });

  it("does not count drift when payload previous agrees with our stored value", async () => {
    const h = makeDeps({
      pages: [page([cellChangePayload({ txn: 11, value: "new", previous: "same" })], 12)],
      stored: { tbl1: { rec1: { fld1: "same" } } },
    });
    const result = await runIncrementalBackup(INPUT, h.deps);
    expect(result.driftCount).toBe(0);
    expect(result.reconcileRan).toBe(false);
  });

  it("creates the rfd row without a log when no stored cell exists (first population logs nothing)", async () => {
    const h = makeDeps({
      pages: [page([cellChangePayload({ txn: 11, value: "v1" })], 12)],
      stored: { tbl1: { rec1: {} } }, // record exists, cell never populated
    });
    await runIncrementalBackup(INPUT, h.deps);
    const write = h.allRecordWrites().find((w) => w.kind === "updateCell");
    if (write?.kind !== "updateCell") throw new Error("missing updateCell write");
    expect(write.log).toBeNull();
  });

  it("createdRecordsById inserts the record + sparse cells with no update log", async () => {
    const payload: WebhookPayload = {
      baseTransactionNumber: 11,
      changedTablesById: {
        tbl1: {
          createdRecordsById: {
            recNew: {
              createdTime: "2026-07-20T11:58:00.000Z",
              cellValuesByFieldId: { fld1: "hello" },
            },
          },
        },
      },
    };
    const h = makeDeps({ pages: [page([payload], 12)], stored: { tbl1: {} } });
    const result = await runIncrementalBackup(INPUT, h.deps);
    expect(h.allRecordWrites()).toContainEqual(
      expect.objectContaining({
        kind: "createRecord",
        tableId: "tbl1",
        recordId: "recNew",
        createdTime: "2026-07-20T11:58:00.000Z",
        cells: { fld1: "hello" },
      }),
    );
    expect(h.allRecordWrites().filter((w) => w.kind === "updateCell")).toEqual([]);
    expect(result.created).toBe(1);
  });

  it("threads actionMetadata → action_source + actor onto record AND schema update logs", async () => {
    const actionMetadata = {
      source: "publicApi",
      sourceMetadata: { user: { id: "usr1", email: "u@example.com", name: "U" } },
    };
    const payload: WebhookPayload = {
      baseTransactionNumber: 11,
      actionMetadata,
      changedTablesById: {
        tbl1: {
          changedFieldsById: {
            fld1: { current: { name: "B" }, previous: { name: "A" } },
          },
          changedRecordsById: {
            rec1: { current: { cellValuesByFieldId: { fld1: "n" } } },
          },
        },
      },
    };
    const h = makeDeps({
      pages: [page([payload], 12)],
      stored: { tbl1: { rec1: { fld1: "o" } } },
      meta: {
        tables: [
          { id: "tbl1", name: "T1", primaryFieldId: "fld1", fields: [{ id: "fld1", name: "B", type: "singleLineText" }] },
        ],
      },
    });
    await runIncrementalBackup(INPUT, h.deps);
    const cell = h.allRecordWrites().find((w) => w.kind === "updateCell");
    if (cell?.kind !== "updateCell") throw new Error("missing updateCell");
    expect(cell.log).toMatchObject({ actionSource: "publicApi", actor: "u@example.com" });
    const field = h.allSchemaWrites().find((w) => w.kind === "updateField");
    if (field?.kind !== "updateField") throw new Error("missing updateField");
    expect(field.log).toMatchObject({ actionSource: "publicApi", actor: "u@example.com" });
  });
});

// ── End-of-pass schema snapshot ──────────────────────────────────────────────

describe("runIncrementalBackup — end-of-pass schema snapshot", () => {
  const schemaPayload: WebhookPayload = {
    baseTransactionNumber: 11,
    changedTablesById: {
      tbl1: {
        changedFieldsById: {
          fld1: { current: { type: "number" }, previous: { type: "singleLineText" } },
        },
      },
    },
  };
  const META = {
    tables: [
      { id: "tbl1", name: "T1", primaryFieldId: "fld1", fields: [{ id: "fld1", name: "F", type: "number" }] },
    ],
  };

  it("record-only pass makes ZERO extra Airtable API calls (no meta fetch, no view regen)", async () => {
    const h = makeDeps({
      pages: [page([cellChangePayload({ txn: 11 })], 12)],
      stored: { tbl1: { rec1: { fld1: "old" } } },
    });
    await runIncrementalBackup(INPUT, h.deps);
    expect(h.deps.airtable.getBaseSchema).not.toHaveBeenCalled();
    expect(h.deps.db.regenerateViews).not.toHaveBeenCalled();
    expect(h.deps.db.insertSchemaVersion).not.toHaveBeenCalled();
  });

  it("schema pass fetches meta once, inserts a hash-deduped schema version, regenerates affected views", async () => {
    const h = makeDeps({ pages: [page([schemaPayload], 12)], meta: META });
    const result = await runIncrementalBackup(INPUT, h.deps);
    expect(h.deps.airtable.getBaseSchema).toHaveBeenCalledTimes(1);
    expect(h.deps.db.insertSchemaVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        baseRunId: "base-run-1",
        schemaHash: schemaHashOf(META),
        schemaJson: META,
      }),
    );
    expect(h.deps.db.regenerateViews).toHaveBeenCalledWith(["tbl1"]);
    // applied state matches the meta fetch → no reconcile.
    expect(result.reconcileRan).toBe(false);
  });

  it("verification mismatch (payload-stream miss) flips the pass to reconcile", async () => {
    const h = makeDeps({
      pages: [page([schemaPayload], 12)],
      meta: META,
      // applied state disagrees with the meta fetch: fld1 still text.
      appliedSchema: { tables: { tbl1: { fields: { fld1: { type: "singleLineText" } } } } },
      tableIds: ["tbl1"],
    });
    const result = await runIncrementalBackup(INPUT, h.deps);
    expect(result.reconcileRan).toBe(true);
  });
});

// ── Error payloads + fallback ────────────────────────────────────────────────

describe("runIncrementalBackup — error payloads and gap fallback", () => {
  it.each(["INVALID_HOOK", "INVALID_FILTERS"] as const)(
    "%s error payload → fallback callback + fallback_to_full, cursor not advanced",
    async (code) => {
      const h = makeDeps({
        pages: [page([{ baseTransactionNumber: 11, error: true, code }], 12)],
      });
      const result = await runIncrementalBackup(INPUT, h.deps);
      expect(h.postFallback).toHaveBeenCalledWith(code);
      expect(h.postCursor).not.toHaveBeenCalled();
      expect(result.status).toBe("fallback_to_full");
      expect(h.deps.db.completeBaseRun).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed" }),
      );
    },
  );

  it("INTERNAL_ERROR payload is skipped, the pass continues, and reconcile covers the opaque txn", async () => {
    const h = makeDeps({
      pages: [
        page(
          [
            { baseTransactionNumber: 11, error: true, code: "INTERNAL_ERROR" },
            cellChangePayload({ txn: 12, value: "applied-anyway" }),
          ],
          13,
        ),
      ],
      stored: { tbl1: { rec1: { fld1: "old" } } },
    });
    const result = await runIncrementalBackup(INPUT, h.deps);
    expect(h.postFallback).not.toHaveBeenCalled();
    expect(h.allRecordWrites()).toContainEqual(
      expect.objectContaining({ kind: "updateCell", value: "applied-anyway" }),
    );
    expect(h.postCursor).toHaveBeenCalledWith(13);
    expect(result.status).toBe("succeeded");
    expect(result.reconcileRan).toBe(true);
  });

  it("cursor expiry → fallback with cursor_expired, no partial application", async () => {
    const h = makeDeps({});
    (h.deps.airtable.fetchPayloadsPage as ReturnType<typeof vi.fn>).mockRejectedValue(
      new PayloadsCursorExpiredError("cursor predates retained payloads"),
    );
    const result = await runIncrementalBackup(INPUT, h.deps);
    expect(h.postFallback).toHaveBeenCalledWith("cursor_expired");
    expect(result.status).toBe("fallback_to_full");
    expect(h.deps.db.applySchemaEvents).not.toHaveBeenCalled();
    expect(h.deps.db.applyRecordEvents).not.toHaveBeenCalled();
    expect(h.postCursor).not.toHaveBeenCalled();
  });
});

// ── Reconciliation ───────────────────────────────────────────────────────────

describe("runIncrementalBackup — modifiedTime reconciliation", () => {
  const ANCHOR = "2026-07-13T12:00:00.000Z";

  it("reconcile=true pages LAST_MODIFIED_TIME() since the anchor, applies misses with NULL attribution, sweeps deletions", async () => {
    const h = makeDeps({
      pages: [page([], 10)],
      stored: {
        tbl1: {
          recStale: { fld1: "db-value" }, // source differs → reconciled
          recGone: { fld1: "x" }, // absent from source → sweep-deleted
        },
      },
      tableIds: ["tbl1"],
      lastReconciledAt: ANCHOR,
      recordsPages: (tableId, o) => {
        if (tableId !== "tbl1") return { records: [] };
        if (o.filterByFormula) {
          return {
            records: [
              {
                id: "recStale",
                createdTime: "2026-07-01T00:00:00.000Z",
                fields: { fld1: "source-value" },
              },
            ],
          };
        }
        // fields-free id sweep: recGone is NOT in the source.
        return {
          records: [{ id: "recStale", createdTime: "2026-07-01T00:00:00.000Z", fields: {} }],
        };
      },
    });
    const result = await runIncrementalBackup({ ...INPUT, reconcile: true }, h.deps);

    const filtered = (h.deps.airtable.listRecordsPage as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => (c[1] as Record<string, unknown>).filterByFormula,
    );
    expect(filtered).toBeDefined();
    expect(String((filtered![1] as Record<string, unknown>).filterByFormula)).toContain(
      "LAST_MODIFIED_TIME()",
    );
    expect(String((filtered![1] as Record<string, unknown>).filterByFormula)).toContain(ANCHOR);

    const upsert = h
      .allRecordWrites()
      .find((w) => w.kind === "updateCell" && w.recordId === "recStale");
    if (upsert?.kind !== "updateCell") throw new Error("missing reconciliation upsert");
    expect(upsert.value).toBe("source-value");
    expect(upsert.log).toMatchObject({ oldValue: "db-value", actionSource: null, actor: null });

    expect(h.allRecordWrites()).toContainEqual(
      expect.objectContaining({ kind: "destroyRecord", recordId: "recGone", status: "deleted" }),
    );
    expect(result.reconcileRan).toBe(true);
    expect(result.reconciledRecords).toBe(2); // recStale + swept recGone
  });

  it("reconcile=false with a clean pass runs no reconciliation and no records-API calls", async () => {
    const h = makeDeps({
      pages: [page([cellChangePayload({ txn: 11 })], 12)],
      stored: { tbl1: { rec1: { fld1: "old" } } },
    });
    const result = await runIncrementalBackup(INPUT, h.deps);
    expect(h.deps.airtable.listRecordsPage).not.toHaveBeenCalled();
    expect(result.reconcileRan).toBe(false);
    expect(result.reconciledRecords).toBe(0);
  });

  it("a table created this pass gets a full fill (no modifiedTime filter) regardless of recordsById", async () => {
    const payload: WebhookPayload = {
      baseTransactionNumber: 11,
      createdTablesById: {
        tblNew: {
          metadata: { name: "New table" },
          fieldsById: { fldA: { name: "A", type: "singleLineText" } },
          recordsById: {
            recPartial: { createdTime: "2026-07-20T11:00:00.000Z", cellValuesByFieldId: { fldA: "1" } },
          },
        },
      },
    };
    const h = makeDeps({
      pages: [page([payload], 12)],
      stored: {},
      tableIds: [],
      lastReconciledAt: ANCHOR,
      meta: {
        tables: [
          { id: "tblNew", name: "New table", primaryFieldId: "fldA", fields: [{ id: "fldA", name: "A", type: "singleLineText" }] },
        ],
      },
      recordsPages: () => ({
        records: [
          { id: "recPartial", createdTime: "2026-07-20T11:00:00.000Z", fields: { fldA: "1" } },
          { id: "recMissed", createdTime: "2026-07-20T11:00:01.000Z", fields: { fldA: "2" } },
        ],
      }),
    });
    const result = await runIncrementalBackup(INPUT, h.deps);
    expect(result.reconcileRan).toBe(true);
    const callsForNewTable = (
      h.deps.airtable.listRecordsPage as ReturnType<typeof vi.fn>
    ).mock.calls.filter((c) => c[0] === "tblNew");
    expect(callsForNewTable.length).toBeGreaterThan(0);
    for (const call of callsForNewTable) {
      expect((call[1] as Record<string, unknown>).filterByFormula).toBeUndefined();
    }
    // The record the payload's partial recordsById missed is picked up.
    expect(h.allRecordWrites()).toContainEqual(
      expect.objectContaining({ kind: "createRecord", recordId: "recMissed" }),
    );
    expect(result.reconciledRecords).toBeGreaterThan(0);
  });
});

// ── Engine callbacks (wrapper transport, pure) ───────────────────────────────

describe("createEngineCallbacks", () => {
  const ARGS = {
    engineUrl: "https://engine.example.com/",
    internalToken: "tok",
    subscriptionId: "sub-1",
  };

  it("POSTs the cursor to /api/internal/webhook-subscriptions/:id/cursor with the internal token", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const cb = createEngineCallbacks({ ...ARGS, fetchImpl: fetchMock as unknown as typeof fetch });
    await cb.postCursor(42);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://engine.example.com/api/internal/webhook-subscriptions/sub-1/cursor",
    );
    expect((init.headers as Record<string, string>)["x-internal-token"]).toBe("tok");
    expect(JSON.parse(String(init.body))).toEqual({ cursor: 42 });
  });

  it("treats a 409 cursor response (monotonic guard on replay) as success", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 409 }));
    const cb = createEngineCallbacks({ ...ARGS, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(cb.postCursor(41)).resolves.toBeUndefined();
  });

  it("throws on other cursor-callback failures so the task retries", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 500 }));
    const cb = createEngineCallbacks({ ...ARGS, fetchImpl: fetchMock as unknown as typeof fetch });
    await expect(cb.postCursor(41)).rejects.toThrowError(/cursor/);
  });

  it("POSTs the fallback reason to /api/internal/webhook-subscriptions/:id/fallback", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const cb = createEngineCallbacks({ ...ARGS, fetchImpl: fetchMock as unknown as typeof fetch });
    await cb.postFallback("cursor_expired");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://engine.example.com/api/internal/webhook-subscriptions/sub-1/fallback",
    );
    expect(JSON.parse(String(init.body))).toEqual({ reason: "cursor_expired" });
  });
});

// ── airtable-client extension for reconciliation paging ─────────────────────

describe("airtable-client listRecords reconciliation options", () => {
  it("forwards filterByFormula, returnFieldsByFieldId, and fields[] to the records API", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ records: [] }), { status: 200 }),
    );
    const client = createAirtableClient({
      accessToken: "tok",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await client.listRecords("appB", "tbl1", {
      filterByFormula: 'IS_AFTER(LAST_MODIFIED_TIME(), "2026-07-13T12:00:00.000Z")',
      returnFieldsByFieldId: true,
      fields: ["fldA"],
    });
    const url = new URL(
      String((fetchMock.mock.calls[0] as unknown as [string])[0]),
    );
    expect(url.searchParams.get("filterByFormula")).toContain("LAST_MODIFIED_TIME()");
    expect(url.searchParams.get("returnFieldsByFieldId")).toBe("true");
    expect(url.searchParams.getAll("fields[]")).toEqual(["fldA"]);
  });
});
