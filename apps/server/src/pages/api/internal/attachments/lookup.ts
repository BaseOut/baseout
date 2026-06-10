// POST /api/internal/attachments/lookup   — dedup read
// POST /api/internal/attachments/record   — dedup upsert
//
// Filed by openspec/changes/server-attachments. The workflows attachment
// downloader (Node-only, no master-DB access) hits these to implement
// composite-ID dedup (PRD §2.8):
//   1. lookup: given a batch of composite IDs for a Space, return the ones
//      already persisted + their storage keys, and bump their last_seen_at so
//      retention doesn't prune attachments still in use. Misses are downloaded.
//   2. record: after the downloader streams a miss to the StorageWriter, it
//      upserts the row (idempotent on composite_id; re-records refresh
//      last_seen_at + storage_key).
//
// `storage_key` is destination-agnostic (R2 object key | BYOS relative path |
// local-disk relative path). The token gate is applied by middleware (path
// begins /api/internal/).

import { and, eq, inArray, sql } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import { attachmentDedup } from "../../../../db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface RecordEntry {
  compositeId: string;
  storageKey: string;
  sizeBytes?: number;
  mimeType?: string;
  contentHash?: string;
}

function isRecordEntry(v: unknown): v is RecordEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  if (typeof e.compositeId !== "string" || e.compositeId.length === 0) {
    return false;
  }
  if (typeof e.storageKey !== "string" || e.storageKey.length === 0) {
    return false;
  }
  if (e.sizeBytes !== undefined && typeof e.sizeBytes !== "number") {
    return false;
  }
  if (e.mimeType !== undefined && typeof e.mimeType !== "string") return false;
  if (e.contentHash !== undefined && typeof e.contentHash !== "string") {
    return false;
  }
  return true;
}

export async function attachmentsLookupHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const spaceId = (body as { spaceId?: unknown })?.spaceId;
  const compositeIds = (body as { compositeIds?: unknown })?.compositeIds;
  if (
    typeof spaceId !== "string" ||
    !UUID_RE.test(spaceId) ||
    !Array.isArray(compositeIds) ||
    compositeIds.some((c) => typeof c !== "string")
  ) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  if (compositeIds.length === 0) {
    return jsonResponse({ hits: {} }, 200);
  }

  const { db } = locals.getMasterDb();
  const rows = await db
    .select({
      compositeId: attachmentDedup.compositeId,
      storageKey: attachmentDedup.storageKey,
    })
    .from(attachmentDedup)
    .where(
      and(
        eq(attachmentDedup.spaceId, spaceId),
        inArray(attachmentDedup.compositeId, compositeIds as string[]),
      ),
    );

  const hits: Record<string, string> = {};
  for (const r of rows) hits[r.compositeId] = r.storageKey;

  if (rows.length > 0) {
    // Bump last_seen_at so retention treats these as still-live.
    await db
      .update(attachmentDedup)
      .set({ lastSeenAt: sql`now()` })
      .where(
        and(
          eq(attachmentDedup.spaceId, spaceId),
          inArray(
            attachmentDedup.compositeId,
            rows.map((r) => r.compositeId),
          ),
        ),
      );
  }

  return jsonResponse({ hits }, 200);
}

export async function attachmentsRecordHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const spaceId = (body as { spaceId?: unknown })?.spaceId;
  const entries = (body as { entries?: unknown })?.entries;
  if (
    typeof spaceId !== "string" ||
    !UUID_RE.test(spaceId) ||
    !Array.isArray(entries) ||
    !entries.every(isRecordEntry)
  ) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  if (entries.length === 0) {
    return jsonResponse({ recorded: 0 }, 200);
  }

  const { db } = locals.getMasterDb();
  await db
    .insert(attachmentDedup)
    .values(
      entries.map((e) => ({
        compositeId: e.compositeId,
        spaceId,
        storageKey: e.storageKey,
        sizeBytes: e.sizeBytes ?? null,
        mimeType: e.mimeType ?? null,
        contentHash: e.contentHash ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: attachmentDedup.compositeId,
      set: {
        storageKey: sql`excluded.storage_key`,
        sizeBytes: sql`excluded.size_bytes`,
        mimeType: sql`excluded.mime_type`,
        contentHash: sql`excluded.content_hash`,
        lastSeenAt: sql`now()`,
      },
    });

  return jsonResponse({ recorded: entries.length }, 200);
}
