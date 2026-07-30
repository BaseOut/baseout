// Tests for the REST comment capture step in runBackupBase
// (workflows-comments tasks 3.1–3.4). Mirrors the harness in
// backup-base-interface-capture.test.ts.
//
// The spec's hard rules exercised here:
//   - commentsEnabled runs request commentCount metadata on the EXISTING
//     listing pass (no second pass) and fetch comments ONLY for the records
//     the comments-plan marks `refresh`,
//   - zeroCandidates observed at count 0 resolve as empty `complete: true`
//     captures with NO fetch,
//   - plan failure degrades to fetching ALL observed commented records,
//   - comment capture is sequenced AFTER records for the base,
//   - NO comment failure mode may change the run's outcome or the captured
//     record data; partial fan-out reports `partial` and only records whose
//     pagination finished were delivered `complete`,
//   - commentsEnabled false/absent → zero plan/fetch/sync requests and no
//     commentCount metadata on the listing.

import { describe, expect, it, vi, type Mock } from "vitest";
import {
  runBackupBase,
  type BackupBaseDeps,
  type CommentRecordCaptureWire,
} from "../trigger/tasks/backup-base";
import type { FetchRecordCommentsResult } from "../trigger/tasks/_lib/record-comments";
import type {
  AirtableSchema,
  AirtableRecordsPage,
  ListRecordsOptions,
} from "../trigger/tasks/_lib/airtable-client";

const ENGINE = "https://engine.example.com";
const TOKEN = "internal-token";

function makeFetchMock(): typeof fetch {
  return vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/lock")) return new Response("{}", { status: 200 });
    if (url.endsWith("/unlock")) return new Response("{}", { status: 200 });
    if (url.endsWith("/token")) {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(JSON.stringify({ accessToken: `pt-${body.encryptedToken}` }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "unexpected_url" }), { status: 500 });
  }) as unknown as typeof fetch;
}

const SCHEMA: AirtableSchema = {
  tables: [
    {
      id: "tbl1",
      name: "Tasks",
      primaryFieldId: "f1",
      fields: [{ id: "f1", name: "Name", type: "singleLineText" }],
      views: [],
    },
  ],
};

// rec1 + rec2 carry comments; rec3 was observed at count 0 (zero-inclusive
// commentCount pinned by the spike).
const RECORDS: AirtableRecordsPage = {
  records: [
    { id: "rec1", createdTime: "2026-01-01T00:00:00Z", commentCount: 2, fields: { Name: "A" } },
    { id: "rec2", createdTime: "2026-01-02T00:00:00Z", commentCount: 1, fields: { Name: "B" } },
    { id: "rec3", createdTime: "2026-01-03T00:00:00Z", commentCount: 0, fields: { Name: "C" } },
  ],
};

function makeClient(page: AirtableRecordsPage = RECORDS) {
  const listOpts: (ListRecordsOptions | undefined)[] = [];
  return {
    listBases: vi.fn(),
    getBaseSchema: vi.fn(async () => SCHEMA),
    listRecords: vi.fn(async (_b: string, _t: string, opts?: ListRecordsOptions) => {
      listOpts.push(opts);
      return page;
    }),
    listOpts,
  };
}

const COMMENTS: Record<string, unknown[]> = {
  rec1: [{ id: "comA", text: "one" }, { id: "comB", text: "two" }],
  rec2: [{ id: "comC", text: "three" }],
};

const okFetchComments = () =>
  vi.fn(async (a: { recordId: string }): Promise<FetchRecordCommentsResult> => ({
    ok: true,
    comments: COMMENTS[a.recordId] ?? [],
  }));

const INPUT = {
  runId: "11111111-1111-4111-8111-111111111111",
  connectionId: "conn-1",
  atBaseId: "appXYZ",
  isTrial: false,
  encryptedToken: "cipher",
  orgSlug: "acme",
  spaceName: "MySpace",
  baseName: "ProjectsDB",
  runStartedAt: new Date("2026-05-02T12:00:00Z"),
  storageType: "local_fs",
  spaceId: "space-1",
  commentsEnabled: true,
};

type PlanMock = Mock<NonNullable<BackupBaseDeps["planComments"]>>;
type SyncCommentsMock = Mock<NonNullable<BackupBaseDeps["syncComments"]>>;

const plan = (refresh: string[], zeroCandidates: string[] = []): PlanMock =>
  vi.fn(async () => ({ refresh, zeroCandidates })) as PlanMock;

const baseDeps = (
  over: Partial<BackupBaseDeps>,
): BackupBaseDeps & { syncComments: SyncCommentsMock } => ({
  engineUrl: ENGINE,
  internalToken: TOKEN,
  fetchImpl: makeFetchMock(),
  airtableClient: makeClient(),
  writeCsv: vi.fn(async () => ({})),
  syncComments: vi.fn(async () => {}) as SyncCommentsMock,
  fetchRecordComments: okFetchComments(),
  ...over,
} as BackupBaseDeps & { syncComments: SyncCommentsMock });

describe("runBackupBase — comment capture", () => {
  it("happy path: listing collects counts, plan gates the fan-out, batch delivers complete records", async () => {
    const planComments = plan(["rec1", "rec2"]);
    const client = makeClient();
    const deps = baseDeps({ airtableClient: client, planComments });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(result.recordsProcessed).toBe(3);
    // Metadata requested on the EXISTING listing pass — no second pass.
    expect(client.listRecords).toHaveBeenCalledTimes(1);
    expect(client.listOpts[0]?.recordMetadata).toEqual(["commentCount"]);
    // Only observed-commented records go to the plan (zero-count ones don't).
    expect(planComments).toHaveBeenCalledWith({
      baseId: "appXYZ",
      records: [
        { recordId: "rec1", commentCount: 2 },
        { recordId: "rec2", commentCount: 1 },
      ],
    });
    expect(deps.fetchRecordComments).toHaveBeenCalledTimes(2);
    expect(deps.syncComments).toHaveBeenCalledTimes(1);
    expect(deps.syncComments.mock.calls[0]![0]).toEqual({
      baseId: "appXYZ",
      records: [
        { recordId: "rec1", tableId: "tbl1", complete: true, comments: COMMENTS.rec1 },
        { recordId: "rec2", tableId: "tbl1", complete: true, comments: COMMENTS.rec2 },
      ],
    });
    expect(result.comments).toEqual({
      status: "captured",
      records: 2,
      comments: 3,
      skippedByPlan: 0,
    });
  });

  it("comment capture is sequenced AFTER record capture for the base", async () => {
    const events: string[] = [];
    const planComments = vi.fn(async () => {
      events.push("plan");
      return { refresh: [], zeroCandidates: [] };
    }) as PlanMock;
    const writeCsv = vi.fn(async () => {
      events.push("csv");
      return {};
    });
    await runBackupBase(INPUT, baseDeps({ planComments, writeCsv }));
    expect(events).toEqual(["csv", "plan"]);
  });

  it("unchanged counts (plan refresh empty) → ZERO comment fetches, everything skipped by plan", async () => {
    const deps = baseDeps({ planComments: plan([]) });
    const result = await runBackupBase(INPUT, deps);

    expect(deps.fetchRecordComments).not.toHaveBeenCalled();
    expect(deps.syncComments).not.toHaveBeenCalled();
    expect(result.comments).toEqual({
      status: "captured",
      records: 0,
      comments: 0,
      skippedByPlan: 2,
    });
  });

  it("zero-drop: zeroCandidate observed at count 0 resolves as an empty complete capture, NO fetch", async () => {
    // rec3 was observed with commentCount 0; recGone was NOT listed this run.
    const deps = baseDeps({ planComments: plan([], ["rec3", "recGone"]) });
    const result = await runBackupBase(INPUT, deps);

    expect(deps.fetchRecordComments).not.toHaveBeenCalled();
    expect(deps.syncComments).toHaveBeenCalledTimes(1);
    // Only the OBSERVED zero-candidate is confirmed; unvisited ones are left alone.
    expect(deps.syncComments.mock.calls[0]![0]).toEqual({
      baseId: "appXYZ",
      records: [{ recordId: "rec3", tableId: "tbl1", complete: true, comments: [] }],
    });
    expect(result.comments).toEqual({
      status: "captured",
      records: 1,
      comments: 0,
      skippedByPlan: 2,
    });
  });

  it("plan-call failure falls back to fetching ALL observed commented records", async () => {
    const planComments = vi.fn(async () => {
      throw new Error("engine 500");
    }) as PlanMock;
    const deps = baseDeps({ planComments });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(deps.fetchRecordComments).toHaveBeenCalledTimes(2);
    expect(deps.syncComments).toHaveBeenCalledTimes(1);
    expect(result.comments).toEqual({
      status: "captured",
      records: 2,
      comments: 3,
      skippedByPlan: 0,
    });
  });

  it("plan reporting space-db-not-ready (null) skips the capture with zero fetch/sync calls", async () => {
    const planComments = vi.fn(async () => null) as PlanMock;
    const deps = baseDeps({ planComments });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(deps.fetchRecordComments).not.toHaveBeenCalled();
    expect(deps.syncComments).not.toHaveBeenCalled();
    expect(result.comments).toEqual({ status: "skipped", reason: "space_db_not_ready" });
  });

  it("mid-fan-out fetch failure → partial; only finished records were delivered complete", async () => {
    const fetchRecordComments = vi.fn(
      async (a: { recordId: string }): Promise<FetchRecordCommentsResult> =>
        a.recordId === "rec1"
          ? { ok: true, comments: COMMENTS.rec1! }
          : { ok: false, reason: "http_429" },
    );
    const deps = baseDeps({ planComments: plan(["rec1", "rec2"]), fetchRecordComments });
    const result = await runBackupBase(INPUT, deps);

    // Run outcome + record capture untouched.
    expect(result.status).toBe("succeeded");
    expect(result.recordsProcessed).toBe(3);
    // rec1 finished pagination → flushed complete; rec2 never delivered.
    expect(deps.syncComments).toHaveBeenCalledTimes(1);
    const delivered = deps.syncComments.mock.calls[0]![0] as {
      records: CommentRecordCaptureWire[];
    };
    expect(delivered.records).toEqual([
      { recordId: "rec1", tableId: "tbl1", complete: true, comments: COMMENTS.rec1 },
    ]);
    expect(result.comments).toEqual({
      status: "partial",
      reason: "http_429",
      records: 1,
      comments: 2,
      skippedByPlan: 0,
    });
  });

  it("comments-sync failure → partial; run outcome and record data untouched", async () => {
    const syncComments = vi.fn(async () => {
      throw new Error("comments-sync 500");
    }) as SyncCommentsMock;
    const deps = baseDeps({ planComments: plan(["rec1", "rec2"]), syncComments });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(result.recordsProcessed).toBe(3);
    expect(result.comments).toEqual({
      status: "partial",
      reason: "sync_failed",
      records: 0,
      comments: 0,
      skippedByPlan: 0,
    });
  });

  it("a throwing injected comment fetcher still cannot fail the run", async () => {
    const fetchRecordComments = vi.fn(async (): Promise<FetchRecordCommentsResult> => {
      throw new Error("kaboom");
    });
    const deps = baseDeps({ planComments: plan(["rec1", "rec2"]), fetchRecordComments });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(result.comments).toEqual({
      status: "partial",
      reason: "transport",
      records: 0,
      comments: 0,
      skippedByPlan: 0,
    });
  });

  it("commentsEnabled false → zero comment/plan requests and NO commentCount metadata on the listing", async () => {
    const planComments = plan(["rec1"]);
    const client = makeClient();
    const deps = baseDeps({ airtableClient: client, planComments });
    const result = await runBackupBase({ ...INPUT, commentsEnabled: false }, deps);

    expect(client.listOpts[0]?.recordMetadata).toBeUndefined();
    expect(planComments).not.toHaveBeenCalled();
    expect(deps.fetchRecordComments).not.toHaveBeenCalled();
    expect(deps.syncComments).not.toHaveBeenCalled();
    expect(result.comments).toBeUndefined();
  });

  it("flag absent entirely (older engine payload) → zero comment requests", async () => {
    const { commentsEnabled: _drop, ...withoutFlag } = INPUT;
    const deps = baseDeps({ planComments: plan(["rec1"]) });
    const result = await runBackupBase(withoutFlag, deps);

    expect(deps.fetchRecordComments).not.toHaveBeenCalled();
    expect(result.comments).toBeUndefined();
  });

  it("no syncComments wired → capture has nowhere to land, zero comment requests", async () => {
    const planComments = plan(["rec1"]);
    const client = makeClient();
    const deps = baseDeps({ airtableClient: client, planComments, syncComments: undefined });
    const result = await runBackupBase(INPUT, deps);

    expect(client.listOpts[0]?.recordMetadata).toBeUndefined();
    expect(planComments).not.toHaveBeenCalled();
    expect(result.comments).toBeUndefined();
  });

  it("schema-only runs make zero comment requests (no listing pass to observe counts)", async () => {
    const planComments = plan(["rec1"]);
    const deps = baseDeps({
      planComments,
      syncSchema: vi.fn(async () => ({ recordsEnabled: false, baseRunId: "br-1" })),
    });
    const result = await runBackupBase({ ...INPUT, kind: "schema" as const }, deps);

    expect(result.status).toBe("succeeded");
    expect(planComments).not.toHaveBeenCalled();
    expect(deps.fetchRecordComments).not.toHaveBeenCalled();
    expect(result.comments).toBeUndefined();
  });

  // ── comment attachments (workflows-comment-attachments) ──
  it("downloads the pending comment-attachment set the sync response returns", async () => {
    const planComments = plan(["rec1"]);
    // comments-sync returns a pending attachment; lookup misses; fetch OK.
    const syncComments = vi.fn(async () => ({
      commentAttachments: {
        pending: [
          { commentAttachmentId: "com1:att1", commentId: "com1", recordId: "rec1", url: "https://cdn/att1", filename: "a.pdf" },
        ],
      },
    })) as SyncCommentsMock;
    const commentAttachmentLookup = vi.fn(async () => ({}));
    const commentAttachmentRecord = vi.fn<
      NonNullable<BackupBaseDeps["commentAttachmentRecord"]>
    >(async () => {});
    // fetch mock that serves the CDN bytes, delegating everything else.
    const base = makeFetchMock();
    const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith("https://cdn/")) return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      return base(input, init);
    }) as unknown as typeof fetch;
    const deps = baseDeps({
      planComments,
      syncComments,
      commentAttachmentLookup,
      commentAttachmentRecord,
      fetchImpl,
    });
    const result = await runBackupBase(INPUT, deps);

    expect(result.status).toBe("succeeded");
    expect(commentAttachmentLookup).toHaveBeenCalledWith("space-1", ["com1:att1"]);
    // recorded with a storage key + local_fs → 'ready'
    expect(commentAttachmentRecord).toHaveBeenCalledTimes(1);
    const [, entries] = commentAttachmentRecord.mock.calls[0]!;
    expect(entries[0]).toMatchObject({
      commentAttachmentId: "com1:att1",
      uploadStatus: "ready",
      storageKey: "acme/MySpace/ProjectsDB/attachments/comments/com1/a.pdf",
    });
    expect(result.commentAttachments).toEqual({ downloaded: 1, skipped: 0, failed: 0 });
  });

  it("a lookup hit skips the download (already staged)", async () => {
    const planComments = plan(["rec1"]);
    const syncComments = vi.fn(async () => ({
      commentAttachments: {
        pending: [
          { commentAttachmentId: "com1:att1", commentId: "com1", recordId: "rec1", url: "https://cdn/att1", filename: "a.pdf" },
        ],
      },
    })) as SyncCommentsMock;
    const commentAttachmentRecord = vi.fn(async () => {});
    const deps = baseDeps({
      planComments,
      syncComments,
      commentAttachmentLookup: vi.fn(async () => ({
        "com1:att1": { storageKey: "existing/key", uploadStatus: "uploaded" },
      })),
      commentAttachmentRecord,
    });
    const result = await runBackupBase(INPUT, deps);

    expect(commentAttachmentRecord).not.toHaveBeenCalled();
    expect(result.commentAttachments).toEqual({ downloaded: 0, skipped: 1, failed: 0 });
  });

  it("no comment-attachment deps wired → no tally, comment capture unaffected", async () => {
    const planComments = plan(["rec1"]);
    const syncComments = vi.fn(async () => ({
      commentAttachments: { pending: [{ commentAttachmentId: "com1:att1", commentId: "com1", recordId: "rec1", url: "https://cdn/att1", filename: "a.pdf" }] },
    })) as SyncCommentsMock;
    const deps = baseDeps({ planComments, syncComments });
    const result = await runBackupBase(INPUT, deps);

    expect(result.commentAttachments).toBeUndefined();
    expect(result.comments).toMatchObject({ status: "captured" });
  });

  // ── base collaborators (workflows-base-collaborators) ──
  it("collaborator courier: fetches base metadata and POSTs it verbatim once", async () => {
    const planComments = plan(["rec1"]);
    const metadata = { workspaceId: "wsp1", individualCollaborators: { baseCollaborators: [] } };
    const fetchBaseMetadata = vi.fn(async () => ({ ok: true as const, metadata }));
    const syncCollaborators = vi.fn(async () => {});
    const deps = baseDeps({ planComments, fetchBaseMetadata, syncCollaborators });
    const result = await runBackupBase(INPUT, deps);

    expect(fetchBaseMetadata).toHaveBeenCalledWith({ baseId: "appXYZ", accessToken: expect.any(String) });
    expect(syncCollaborators).toHaveBeenCalledTimes(1);
    expect(syncCollaborators).toHaveBeenCalledWith({ baseId: "appXYZ", metadata });
    expect(result.collaborators).toEqual({ status: "captured" });
    expect(result.status).toBe("succeeded");
  });

  it("collaborator fetch failure → skipped(reason), NOTHING posted, run + comments unaffected", async () => {
    const planComments = plan(["rec1"]);
    const fetchBaseMetadata = vi.fn(async () => ({ ok: false as const, reason: "http_403" }));
    const syncCollaborators = vi.fn(async () => {});
    const deps = baseDeps({ planComments, fetchBaseMetadata, syncCollaborators });
    const result = await runBackupBase(INPUT, deps);

    expect(syncCollaborators).not.toHaveBeenCalled();
    expect(result.collaborators).toEqual({ status: "skipped", reason: "http_403" });
    expect(result.status).toBe("succeeded");
    expect(result.comments).toMatchObject({ status: "captured" });
  });

  it("no syncCollaborators wired → no collaborator capture, no metadata fetch", async () => {
    const planComments = plan(["rec1"]);
    const fetchBaseMetadata = vi.fn(async () => ({ ok: true as const, metadata: {} }));
    const deps = baseDeps({ planComments, fetchBaseMetadata });
    const result = await runBackupBase(INPUT, deps);

    expect(fetchBaseMetadata).not.toHaveBeenCalled();
    expect(result.collaborators).toBeUndefined();
  });
});
