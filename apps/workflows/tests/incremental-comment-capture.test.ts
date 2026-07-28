// Incremental comment capture (workflows-comments task 3.5).
//
// Incremental runs re-capture comments ONLY for records the pass actually
// visited (applied create/update writes from payloads or reconciliation) —
// the incremental signal from the design's fallback (b). There is no
// count-delta plan step: webhook payloads carry no commentCount, and the
// visited set is already bounded by what changed. Destroyed records are never
// fetched. Best-effort: the outcome never affects the run status.

import { describe, expect, it, vi } from "vitest";
import {
  runIncrementalBackup,
  type IncrementalBackupDeps,
  type IncrementalBackupInput,
} from "../trigger/tasks/incremental-backup";
import type {
  PayloadsPage,
  WebhookPayload,
} from "../trigger/tasks/_lib/airtable-payloads";
import type {
  CommentRecordCaptureWire,
  FetchRecordCommentsResult,
} from "../trigger/tasks/_lib/record-comments";

const INPUT: IncrementalBackupInput = {
  runId: "run-1",
  spaceId: "space-1",
  subscriptionId: "sub-1",
  baseId: "appBase1",
  connectionId: "conn-1",
  cursor: 10,
  reconcile: false,
};

function page(
  payloads: WebhookPayload[],
  cursor: number,
  mightHaveMore = false,
): PayloadsPage {
  return { payloads, cursor, mightHaveMore };
}

function cellChangePayload(args: {
  txn: number;
  tableId?: string;
  recordId?: string;
  value?: unknown;
}): WebhookPayload {
  const { txn, tableId = "tbl1", recordId = "rec1", value = "new" } = args;
  return {
    baseTransactionNumber: txn,
    timestamp: "2026-07-20T11:59:00.000Z",
    changedTablesById: {
      [tableId]: {
        changedRecordsById: {
          [recordId]: {
            current: { cellValuesByFieldId: { fld1: value } },
          },
        },
      },
    },
  };
}

function destroyPayload(args: {
  txn: number;
  tableId?: string;
  recordId: string;
}): WebhookPayload {
  return {
    baseTransactionNumber: args.txn,
    timestamp: "2026-07-20T11:59:30.000Z",
    changedTablesById: {
      [args.tableId ?? "tbl1"]: { destroyedRecordIds: [args.recordId] },
    },
  };
}

type FetchRecordCommentsDep = NonNullable<IncrementalBackupDeps["fetchRecordComments"]>;
type SyncCommentsDep = NonNullable<IncrementalBackupDeps["syncComments"]>;

interface CommentFakes {
  fetchRecordComments: ReturnType<typeof vi.fn<FetchRecordCommentsDep>>;
  syncComments: ReturnType<typeof vi.fn<SyncCommentsDep>>;
  syncedRecords: () => CommentRecordCaptureWire[];
}

function makeCommentFakes(opts?: {
  commentsByRecord?: Record<string, unknown[]>;
  failOn?: string;
}): CommentFakes {
  const batches: CommentRecordCaptureWire[][] = [];
  const fetchRecordComments = vi.fn(
    async (ref: { tableId: string; recordId: string }): Promise<FetchRecordCommentsResult> => {
      if (opts?.failOn === ref.recordId) return { ok: false, reason: "transport" };
      return { ok: true, comments: opts?.commentsByRecord?.[ref.recordId] ?? [] };
    },
  );
  const syncComments = vi.fn(
    async (args: { baseId: string; records: CommentRecordCaptureWire[] }) => {
      batches.push(args.records);
    },
  );
  return {
    fetchRecordComments,
    syncComments,
    syncedRecords: () => batches.flat(),
  };
}

/** Minimal deps: empty stored state, no schema, injectable pages + comment fakes. */
function makeDeps(opts: {
  pages: PayloadsPage[];
  stored?: Record<string, Record<string, Record<string, unknown>>>;
  commentsEnabled?: boolean;
  comments?: CommentFakes;
  recordsPages?: (
    tableId: string,
    o: Record<string, unknown>,
  ) => { records: { id: string; createdTime: string; fields: Record<string, unknown> }[]; offset?: string };
  tableIds?: string[];
}): IncrementalBackupDeps {
  const stored = opts.stored ?? {};
  const pages = [...opts.pages];
  return {
    airtable: {
      fetchPayloadsPage: async () => {
        const next = pages.shift();
        if (!next) throw new Error("no more fixture pages");
        return next;
      },
      getBaseSchema: async () => ({ tables: [] }),
      listRecordsPage: async (tableId, o) =>
        opts.recordsPages
          ? opts.recordsPages(tableId, o as Record<string, unknown>)
          : { records: [] },
    },
    db: {
      openBaseRun: async () => ({ baseRunId: "base-run-1" }),
      completeBaseRun: async () => {},
      applySchemaEvents: async () => {},
      applyRecordEvents: async () => {},
      getStoredRecords: async (tableId, recordIds) => {
        const out: Record<string, { cells: Record<string, unknown> } | undefined> = {};
        for (const id of recordIds) {
          const cells = stored[tableId]?.[id];
          out[id] = cells ? { cells } : undefined;
        }
        return out;
      },
      insertSchemaVersion: async () => ({ inserted: true }),
      getAppliedSchemaState: async () => ({ tables: {} }),
      regenerateViews: async () => {},
      listStoredRecordIds: async (tableId) => Object.keys(stored[tableId] ?? {}),
      listTableIds: async () => opts.tableIds ?? Object.keys(stored),
    },
    engine: { postCursor: async () => {}, postFallback: async () => {} },
    log: () => {},
    ...(opts.commentsEnabled !== undefined ? { commentsEnabled: opts.commentsEnabled } : {}),
    ...(opts.comments
      ? {
          fetchRecordComments: opts.comments.fetchRecordComments,
          syncComments: opts.comments.syncComments,
        }
      : {}),
  };
}

describe("incremental comment capture (task 3.5)", () => {
  it("captures comments for exactly the payload-visited records", async () => {
    const fakes = makeCommentFakes({
      commentsByRecord: { rec1: [{ id: "com1" }], rec2: [] },
    });
    const deps = makeDeps({
      pages: [
        page(
          [
            cellChangePayload({ txn: 1, recordId: "rec1" }),
            cellChangePayload({ txn: 2, recordId: "rec2", tableId: "tbl2" }),
          ],
          11,
        ),
      ],
      commentsEnabled: true,
      comments: fakes,
    });

    const result = await runIncrementalBackup(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(fakes.fetchRecordComments.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining([
        { tableId: "tbl1", recordId: "rec1" },
        { tableId: "tbl2", recordId: "rec2" },
      ]),
    );
    expect(fakes.fetchRecordComments).toHaveBeenCalledTimes(2);
    const synced = fakes.syncedRecords();
    expect(synced).toHaveLength(2);
    for (const rec of synced) expect(rec.complete).toBe(true);
    expect(synced.find((r) => r.recordId === "rec1")?.comments).toEqual([{ id: "com1" }]);
    expect(result.comments).toEqual({ status: "captured", records: 2, comments: 1 });
    // Batch body carries the base id for the engine route.
    expect(fakes.syncComments.mock.calls[0]?.[0]?.baseId).toBe("appBase1");
  });

  it("never fetches comments for destroyed records", async () => {
    const fakes = makeCommentFakes();
    const deps = makeDeps({
      pages: [
        page(
          [
            cellChangePayload({ txn: 1, recordId: "recKept" }),
            destroyPayload({ txn: 2, recordId: "recGone" }),
          ],
          11,
        ),
      ],
      stored: { tbl1: { recGone: { fld1: "x" } } },
      commentsEnabled: true,
      comments: fakes,
    });

    const result = await runIncrementalBackup(INPUT, deps);

    expect(result.status).toBe("succeeded");
    const fetched = fakes.fetchRecordComments.mock.calls.map((c) => c[0].recordId);
    expect(fetched).toEqual(["recKept"]);
  });

  it("a record created then destroyed in the same pass is not visited", async () => {
    const fakes = makeCommentFakes();
    const deps = makeDeps({
      pages: [
        page(
          [
            cellChangePayload({ txn: 1, recordId: "recFlash" }),
            destroyPayload({ txn: 2, recordId: "recFlash" }),
          ],
          11,
        ),
      ],
      commentsEnabled: true,
      comments: fakes,
    });

    const result = await runIncrementalBackup(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(fakes.fetchRecordComments).not.toHaveBeenCalled();
    expect(result.comments).toBeUndefined();
  });

  it("includes reconciliation-visited records", async () => {
    const fakes = makeCommentFakes();
    const deps = makeDeps({
      pages: [page([], 11)],
      stored: { tbl1: { recOld: { fld1: "stale" } } },
      recordsPages: (_tableId, o) =>
        Array.isArray((o as { fields?: unknown }).fields)
          ? { records: [{ id: "recOld", createdTime: "2026-01-01T00:00:00.000Z", fields: {} }] }
          : {
              records: [
                {
                  id: "recOld",
                  createdTime: "2026-01-01T00:00:00.000Z",
                  fields: { fld1: "fresh" },
                },
              ],
            },
      commentsEnabled: true,
      comments: fakes,
    });

    const result = await runIncrementalBackup({ ...INPUT, reconcile: true }, deps);

    expect(result.status).toBe("succeeded");
    expect(result.reconcileRan).toBe(true);
    expect(fakes.fetchRecordComments.mock.calls.map((c) => c[0])).toEqual([
      { tableId: "tbl1", recordId: "recOld" },
    ]);
  });

  it("does nothing when commentsEnabled is absent (zero behavior change)", async () => {
    const fakes = makeCommentFakes();
    const deps = makeDeps({
      pages: [page([cellChangePayload({ txn: 1 })], 11)],
      comments: fakes,
    });

    const result = await runIncrementalBackup(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(fakes.fetchRecordComments).not.toHaveBeenCalled();
    expect(fakes.syncComments).not.toHaveBeenCalled();
    expect(result.comments).toBeUndefined();
  });

  it("fetch failure yields a partial outcome and never fails the run", async () => {
    const fakes = makeCommentFakes({
      commentsByRecord: { recA: [{ id: "c1" }] },
      failOn: "recB",
    });
    const deps = makeDeps({
      pages: [
        page(
          [
            cellChangePayload({ txn: 1, recordId: "recA" }),
            cellChangePayload({ txn: 2, recordId: "recB" }),
          ],
          11,
        ),
      ],
      commentsEnabled: true,
      comments: fakes,
    });

    const result = await runIncrementalBackup(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(result.comments).toMatchObject({ status: "partial", reason: "transport" });
  });

  it("emits no comments outcome when nothing was visited", async () => {
    const fakes = makeCommentFakes();
    const deps = makeDeps({
      pages: [page([], 11)],
      commentsEnabled: true,
      comments: fakes,
    });

    const result = await runIncrementalBackup(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(fakes.syncComments).not.toHaveBeenCalled();
    expect(result.comments).toBeUndefined();
  });
});
