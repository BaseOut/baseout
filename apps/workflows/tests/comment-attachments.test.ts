import { describe, it, expect } from "vitest";
import {
  buildCommentAttachmentKey,
  planCommentAttachmentDownloads,
  downloadCommentAttachments,
  type PendingCommentAttachment,
} from "../trigger/tasks/_lib/comment-attachments";

const pathArgs = { orgSlug: "acme", spaceName: "Space A", baseName: "Base B" };

describe("buildCommentAttachmentKey", () => {
  it("lays out under the base's attachments/comments/<commentId>/ subtree", () => {
    expect(
      buildCommentAttachmentKey({ ...pathArgs, commentId: "com1", filename: "a.pdf" }),
    ).toBe("acme/Space A/Base B/attachments/comments/com1/a.pdf");
  });

  it("sanitizes slashes in name segments", () => {
    expect(
      buildCommentAttachmentKey({ ...pathArgs, commentId: "com1", filename: "x/y.pdf" }),
    ).toBe("acme/Space A/Base B/attachments/comments/com1/x_y.pdf");
  });
});

describe("planCommentAttachmentDownloads", () => {
  const pending = (commentId: string, attachmentId: string, filename: string): PendingCommentAttachment => ({
    commentAttachmentId: `${commentId}:${attachmentId}`,
    commentId,
    recordId: "rec1",
    url: `https://x/${attachmentId}`,
    filename,
  });

  it("builds one work item per pending entry with its storage key", () => {
    const items = planCommentAttachmentDownloads([pending("com1", "att1", "a.pdf")], pathArgs);
    expect(items).toEqual([
      {
        commentAttachmentId: "com1:att1",
        commentId: "com1",
        url: "https://x/att1",
        filename: "a.pdf",
        storageKey: "acme/Space A/Base B/attachments/comments/com1/a.pdf",
      },
    ]);
  });

  it("disambiguates same-filename attachments within one comment", () => {
    const items = planCommentAttachmentDownloads(
      [pending("com1", "att1", "photo.jpg"), pending("com1", "att2", "photo.jpg")],
      pathArgs,
    );
    const keys = items.map((i) => i.storageKey);
    expect(new Set(keys).size).toBe(2); // distinct
    expect(keys.some((k) => k.includes("att1") || k.includes("att2"))).toBe(true);
  });

  it("same filename on DIFFERENT comments does not collide (per-comment folder)", () => {
    const items = planCommentAttachmentDownloads(
      [pending("com1", "att1", "photo.jpg"), pending("com2", "att2", "photo.jpg")],
      pathArgs,
    );
    expect(items[0]!.storageKey).toBe("acme/Space A/Base B/attachments/comments/com1/photo.jpg");
    expect(items[1]!.storageKey).toBe("acme/Space A/Base B/attachments/comments/com2/photo.jpg");
  });
});

describe("downloadCommentAttachments", () => {
  const item = {
    commentAttachmentId: "com1:att1",
    commentId: "com1",
    url: "https://x/att1",
    filename: "a.pdf",
    storageKey: "acme/Space A/Base B/attachments/comments/com1/a.pdf",
  };

  const okFetch = () =>
    Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));

  it("downloads a miss: lookup empty → writeBlob → record(uploaded)", async () => {
    const writes: string[] = [];
    const recorded: unknown[] = [];
    const res = await downloadCommentAttachments([item], {
      spaceId: "s1",
      uploadStatus: "uploaded",
      writer: { writeBlob: async (k: string) => void writes.push(k) } as never,
      commentLookup: async () => ({}),
      commentRecord: async (_s, entries) => void recorded.push(...entries),
      fetchImpl: okFetch as never,
    });
    expect(res).toEqual({ downloaded: 1, skipped: 0, failed: 0 });
    expect(writes).toEqual([item.storageKey]);
    expect(recorded).toEqual([
      {
        commentAttachmentId: "com1:att1",
        storageKey: item.storageKey,
        sizeBytes: 3,
        uploadStatus: "uploaded",
      },
    ]);
  });

  it("skips a lookup hit (already staged) — no download, no record", async () => {
    let fetched = 0;
    const recorded: unknown[] = [];
    const res = await downloadCommentAttachments([item], {
      spaceId: "s1",
      uploadStatus: "uploaded",
      writer: { writeBlob: async () => {} } as never,
      commentLookup: async () => ({ "com1:att1": { storageKey: item.storageKey, uploadStatus: "uploaded" } }),
      commentRecord: async (_s, entries) => void recorded.push(...entries),
      fetchImpl: (() => {
        fetched++;
        return okFetch();
      }) as never,
    });
    expect(res).toEqual({ downloaded: 0, skipped: 1, failed: 0 });
    expect(fetched).toBe(0);
    expect(recorded).toEqual([]);
  });

  it("expired/4xx URL → counted failed, left unrecorded (server recovery re-fetches)", async () => {
    const recorded: unknown[] = [];
    const res = await downloadCommentAttachments([item], {
      spaceId: "s1",
      uploadStatus: "uploaded",
      writer: { writeBlob: async () => {} } as never,
      commentLookup: async () => ({}),
      commentRecord: async (_s, entries) => void recorded.push(...entries),
      fetchImpl: (() => Promise.resolve(new Response("gone", { status: 410 }))) as never,
    });
    expect(res).toEqual({ downloaded: 0, skipped: 0, failed: 1 });
    expect(recorded).toEqual([]);
  });

  it("local_fs stamps uploadStatus 'ready'", async () => {
    const recorded: Array<{ uploadStatus?: string }> = [];
    await downloadCommentAttachments([item], {
      spaceId: "s1",
      uploadStatus: "ready",
      writer: { writeBlob: async () => {} } as never,
      commentLookup: async () => ({}),
      commentRecord: async (_s, entries) => void recorded.push(...(entries as never[])),
      fetchImpl: okFetch as never,
    });
    expect(recorded[0]!.uploadStatus).toBe("ready");
  });

  it("a failed download never throws (best-effort isolation)", async () => {
    const res = await downloadCommentAttachments([item], {
      spaceId: "s1",
      uploadStatus: "uploaded",
      writer: { writeBlob: async () => {} } as never,
      commentLookup: async () => ({}),
      commentRecord: async () => {},
      fetchImpl: (() => Promise.reject(new Error("network"))) as never,
    });
    expect(res).toEqual({ downloaded: 0, skipped: 0, failed: 1 });
  });
});
