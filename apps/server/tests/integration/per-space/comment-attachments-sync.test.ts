import { describe, it, expect } from "vitest";
import {
  extractCommentAttachments,
  diffCommentAttachments,
  type PriorCommentAttachment,
} from "../../../src/lib/per-space/comment-attachments-sync";

// The extractor walks the SAME comment payloads comments-sync receives — one
// record capture carries raw Airtable comment objects, each with an optional
// `attachments` array.
const capture = (recordId: string, comments: unknown[], complete = true) => ({
  recordId,
  tableId: "tbl1",
  complete,
  comments,
});

const comment = (id: string, attachments?: unknown[]) => ({
  id,
  text: "hi",
  createdTime: "2026-07-30T00:00:00.000Z",
  ...(attachments ? { attachments } : {}),
});

describe("extractCommentAttachments", () => {
  it("pulls attachment entries with comment + record tie-backs", () => {
    const out = extractCommentAttachments([
      capture("rec1", [
        comment("com1", [
          { id: "att1", filename: "a.pdf", url: "https://x/a", type: "application/pdf", size: 12 },
        ]),
      ]),
    ]);
    expect(out.attachments).toEqual([
      {
        commentId: "com1",
        attachmentId: "att1",
        recordId: "rec1",
        tableId: "tbl1",
        filename: "a.pdf",
        url: "https://x/a",
        mimeType: "application/pdf",
        sizeBytes: 12,
      },
    ]);
    expect(out.dropped).toBe(0);
  });

  it("ignores comments with no attachments array", () => {
    const out = extractCommentAttachments([capture("rec1", [comment("com1")])]);
    expect(out.attachments).toEqual([]);
  });

  it("drops malformed attachment entries (missing id/filename/url) but counts them", () => {
    const out = extractCommentAttachments([
      capture("rec1", [
        comment("com1", [
          { id: "att1", filename: "a.pdf", url: "https://x/a" },
          { filename: "no-id.pdf", url: "https://x/b" }, // no id → dropped
          { id: "att3", url: "https://x/c" }, // no filename → dropped
        ]),
      ]),
    ]);
    expect(out.attachments.map((a) => a.attachmentId)).toEqual(["att1"]);
    expect(out.dropped).toBe(2);
  });

  it("width/height/thumbnails are not stored", () => {
    const out = extractCommentAttachments([
      capture("rec1", [
        comment("com1", [
          { id: "att1", filename: "a.jpg", url: "https://x/a", width: 100, height: 50, thumbnails: {} },
        ]),
      ]),
    ]);
    expect(out.attachments[0]).not.toHaveProperty("width");
    expect(out.attachments[0]).not.toHaveProperty("thumbnails");
  });
});

describe("diffCommentAttachments", () => {
  it("new attachment → pending upsert, appears in pending set", () => {
    const extracted = extractCommentAttachments([
      capture("rec1", [comment("com1", [{ id: "att1", filename: "a.pdf", url: "https://x/a" }])]),
    ]);
    const diff = diffCommentAttachments({ extracted, prior: [] });
    expect(diff.upserts).toHaveLength(1);
    expect(diff.upserts[0]).toMatchObject({ commentId: "com1", attachmentId: "att1", filename: "a.pdf" });
    expect(diff.pendingSet).toEqual([
      { commentAttachmentId: "com1:att1", commentId: "com1", recordId: "rec1", url: "https://x/a", filename: "a.pdf" },
    ]);
    expect(diff.deletions).toEqual([]);
  });

  it("already-uploaded attachment re-observed → not regressed, not in pending set", () => {
    const prior: PriorCommentAttachment[] = [
      { commentId: "com1", attachmentId: "att1", recordId: "rec1", uploadStatus: "uploaded", status: "active" },
    ];
    const extracted = extractCommentAttachments([
      capture("rec1", [comment("com1", [{ id: "att1", filename: "a.pdf", url: "https://x/fresh" }])]),
    ]);
    const diff = diffCommentAttachments({ extracted, prior });
    // still upserted (bumps seen stamps + url) but pending set excludes it
    expect(diff.pendingSet).toEqual([]);
    expect(diff.upserts[0]).toMatchObject({ attachmentId: "att1", regressUploadStatus: false });
  });

  it("ready attachment re-observed → stays out of pending set (already staged)", () => {
    const prior: PriorCommentAttachment[] = [
      { commentId: "com1", attachmentId: "att1", recordId: "rec1", uploadStatus: "ready", status: "active" },
    ];
    const extracted = extractCommentAttachments([
      capture("rec1", [comment("com1", [{ id: "att1", filename: "a.pdf", url: "https://x/a" }])]),
    ]);
    const diff = diffCommentAttachments({ extracted, prior });
    expect(diff.pendingSet).toEqual([]);
  });

  it("attachment absent from a complete re-capture of its comment → soft delete", () => {
    const prior: PriorCommentAttachment[] = [
      { commentId: "com1", attachmentId: "attGone", recordId: "rec1", uploadStatus: "uploaded", status: "active" },
    ];
    // com1 re-captured (complete record) but no longer lists attGone
    const extracted = extractCommentAttachments([
      capture("rec1", [comment("com1", [{ id: "att1", filename: "a.pdf", url: "https://x/a" }])]),
    ]);
    const diff = diffCommentAttachments({ extracted, prior });
    expect(diff.deletions).toEqual(["com1:attGone"]);
  });

  it("does NOT delete attachments of comments not present in this capture", () => {
    const prior: PriorCommentAttachment[] = [
      { commentId: "comOther", attachmentId: "attX", recordId: "rec1", uploadStatus: "uploaded", status: "active" },
    ];
    const extracted = extractCommentAttachments([
      capture("rec1", [comment("com1", [{ id: "att1", filename: "a.pdf", url: "https://x/a" }])]),
    ]);
    const diff = diffCommentAttachments({ extracted, prior });
    expect(diff.deletions).toEqual([]);
  });

  it("incomplete record capture never deletes", () => {
    const prior: PriorCommentAttachment[] = [
      { commentId: "com1", attachmentId: "attGone", recordId: "rec1", uploadStatus: "uploaded", status: "active" },
    ];
    const extracted = extractCommentAttachments([
      capture("rec1", [comment("com1", [{ id: "att1", filename: "a.pdf", url: "https://x/a" }])], false),
    ]);
    const diff = diffCommentAttachments({ extracted, prior });
    expect(diff.deletions).toEqual([]);
  });
});
