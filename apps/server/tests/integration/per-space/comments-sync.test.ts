// Pure-module tests for the comments capture (server-comments): batch
// extraction leniency, the per-record diff (update-in-place + soft deletion
// scoped to `complete` captures), and the count-delta refresh plan (design
// Decision 5 — unchanged counts skipped, the documented same-count blind spot).

import { describe, it, expect } from "vitest";
import {
  diffCommentBatch,
  extractCommentBatch,
  planCommentRefresh,
  type PriorComment,
} from "../../../src/lib/per-space/comments-sync";

const rawComment = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  author: { id: "usrX", email: "a@ex.com", name: "A" },
  text: `text of ${id}`,
  createdTime: "2026-07-01T10:00:00.000Z",
  lastUpdatedTime: null,
  ...over,
});

const priorFor = (over: Partial<PriorComment> & { commentId: string }): PriorComment => ({
  recordId: "recA",
  text: `text of ${over.commentId}`,
  airtableLastUpdatedAt: null,
  status: "active",
  ...over,
});

describe("extractCommentBatch", () => {
  it("extracts records + comments; malformed entries dropped and counted, never fatal", () => {
    const batch = extractCommentBatch([
      {
        recordId: "recA",
        tableId: "tblA",
        complete: true,
        comments: [rawComment("comA"), { noId: true }, "junk"],
      },
      { recordId: 7, tableId: "tblA", comments: [] }, // bad recordId — dropped
      { recordId: "recB", tableId: "tblA" }, // comments not an array — dropped
    ]);
    expect(batch.records).toHaveLength(1);
    expect(batch.records[0]).toMatchObject({
      recordId: "recA",
      tableId: "tblA",
      complete: true,
    });
    expect(batch.records[0]!.comments).toHaveLength(1);
    expect(batch.records[0]!.comments[0]).toMatchObject({
      commentId: "comA",
      text: "text of comA",
      airtableCreatedAt: new Date("2026-07-01T10:00:00.000Z"),
      airtableLastUpdatedAt: null,
    });
    expect(batch.dropped).toBe(4);
  });

  it("complete defaults false; raw is the verbatim comment object", () => {
    const raw = rawComment("comA", { reactions: [{ emoji: "👍" }] });
    const batch = extractCommentBatch([{ recordId: "recA", tableId: "tblA", comments: [raw] }]);
    expect(batch.records[0]!.complete).toBe(false);
    expect(batch.records[0]!.comments[0]!.raw).toBe(raw);
  });
});

describe("diffCommentBatch", () => {
  const batchOf = (records: unknown[]) => extractCommentBatch(records);

  it("first capture: all upserts count as added, no deletions", () => {
    const d = diffCommentBatch({
      batch: batchOf([
        { recordId: "recA", tableId: "tblA", complete: true, comments: [rawComment("comA"), rawComment("comB")] },
      ]),
      prior: [],
    });
    expect(d.upserts).toHaveLength(2);
    expect(d.added).toBe(2);
    expect(d.updated).toBe(0);
    expect(d.deletions).toEqual([]);
  });

  it("edit (text or lastUpdated delta) counts as updated", () => {
    const d = diffCommentBatch({
      batch: batchOf([
        {
          recordId: "recA",
          tableId: "tblA",
          complete: true,
          comments: [rawComment("comA", { text: "EDITED", lastUpdatedTime: "2026-07-27T09:00:00.000Z" })],
        },
      ]),
      prior: [priorFor({ commentId: "comA" })],
    });
    expect(d.added).toBe(0);
    expect(d.updated).toBe(1);
    expect(d.deletions).toEqual([]);
  });

  it("identical re-capture is neither added nor updated (stamps only)", () => {
    const d = diffCommentBatch({
      batch: batchOf([
        { recordId: "recA", tableId: "tblA", complete: true, comments: [rawComment("comA")] },
      ]),
      prior: [priorFor({ commentId: "comA" })],
    });
    expect(d.added).toBe(0);
    expect(d.updated).toBe(0);
    expect(d.upserts).toHaveLength(1); // still upserted — last_seen stamps advance
  });

  it("absent id on a complete capture is deleted; incomplete captures never delete", () => {
    const prior = [priorFor({ commentId: "comA" }), priorFor({ commentId: "comB" })];
    const complete = diffCommentBatch({
      batch: batchOf([
        { recordId: "recA", tableId: "tblA", complete: true, comments: [rawComment("comA")] },
      ]),
      prior,
    });
    expect(complete.deletions).toEqual(["comB"]);

    const incomplete = diffCommentBatch({
      batch: batchOf([{ recordId: "recA", tableId: "tblA", comments: [rawComment("comA")] }]),
      prior,
    });
    expect(incomplete.deletions).toEqual([]);
  });

  it("deletion scope is per record — another record's rows are untouched", () => {
    const d = diffCommentBatch({
      batch: batchOf([
        { recordId: "recA", tableId: "tblA", complete: true, comments: [] }, // zeroCandidate confirmation
      ]),
      prior: [
        priorFor({ commentId: "comA" }),
        priorFor({ commentId: "comZ", recordId: "recZ" }), // unvisited record
      ],
    });
    expect(d.deletions).toEqual(["comA"]);
  });

  it("a deleted row re-captured resurrects (counts as updated, upserted)", () => {
    const d = diffCommentBatch({
      batch: batchOf([
        { recordId: "recA", tableId: "tblA", complete: true, comments: [rawComment("comA")] },
      ]),
      prior: [priorFor({ commentId: "comA", status: "deleted" })],
    });
    expect(d.updated).toBe(1);
    expect(d.deletions).toEqual([]);
  });

  it("already-deleted rows are not re-deleted", () => {
    const d = diffCommentBatch({
      batch: batchOf([{ recordId: "recA", tableId: "tblA", complete: true, comments: [] }]),
      prior: [priorFor({ commentId: "comA", status: "deleted" })],
    });
    expect(d.deletions).toEqual([]);
  });
});

describe("planCommentRefresh", () => {
  it("unchanged count is skipped (the documented same-count blind spot)", () => {
    const plan = planCommentRefresh({
      observed: [{ recordId: "recA", commentCount: 3 }],
      storedActiveCounts: new Map([["recA", 3]]),
    });
    expect(plan.refresh).toEqual([]);
    expect(plan.zeroCandidates).toEqual([]);
  });

  it("changed count triggers refresh (both directions; unseen records default stored 0)", () => {
    const plan = planCommentRefresh({
      observed: [
        { recordId: "recB", commentCount: 4 }, // stored 3 — up
        { recordId: "recC", commentCount: 1 }, // stored 2 — down
        { recordId: "recNew", commentCount: 2 }, // never stored
      ],
      storedActiveCounts: new Map([
        ["recB", 3],
        ["recC", 2],
      ]),
    });
    expect(plan.refresh).toEqual(["recB", "recC", "recNew"]);
  });

  it("stored-active records absent from the observed set are zeroCandidates", () => {
    const plan = planCommentRefresh({
      observed: [{ recordId: "recA", commentCount: 3 }],
      storedActiveCounts: new Map([
        ["recA", 3],
        ["recGone", 2],
        ["recAlso", 1],
      ]),
    });
    expect(plan.refresh).toEqual([]);
    expect(plan.zeroCandidates).toEqual(["recAlso", "recGone"]);
  });

  it("zero stored counts never become zeroCandidates", () => {
    const plan = planCommentRefresh({
      observed: [],
      storedActiveCounts: new Map([["recEmpty", 0]]),
    });
    expect(plan.zeroCandidates).toEqual([]);
  });
});
