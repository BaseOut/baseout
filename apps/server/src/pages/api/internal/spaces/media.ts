// GET /api/internal/spaces/:spaceId/media                      — filtered list
// GET /api/internal/spaces/:spaceId/media/totals               — count + summed size
// GET /api/internal/spaces/:spaceId/media/:assetId             — detail (all refs)
// GET /api/internal/spaces/:spaceId/media/:assetId/download    — stream / locator
//
// The Media Library read API (server-media-index). Web proxies these over the
// SERVER service binding and adds auth/middleware — the engine owns the
// per-Space IO. Downloads: Baseout-stored assets (storage_kind 'r2_managed')
// stream through the NATIVE read-only R2 binding (BACKUPS_R2 — credential-less,
// zero egress; r2-setup.md §2.4's no-S3-creds rule untouched); destination-
// stored (BYOS) assets return `{kind:'destination', provider, locator}` — the
// engine never proxies bytes it doesn't hold (privacy posture in the API shape,
// design Decision 3).
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import {
  getMediaAsset,
  listMediaAssets,
  mediaTotals,
  withSpaceSchema,
  type MediaFilters,
} from "../../../../lib/per-space/space-db-pg";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLASSES = new Set(["image", "video", "audio", "document", "other"]);
const MAX_LIMIT = 100;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function parseFilters(url: URL): MediaFilters {
  const filters: MediaFilters = {};
  const classes = (url.searchParams.get("class") ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter((c) => CLASSES.has(c));
  if (classes.length) filters.classes = classes;
  const baseId = url.searchParams.get("baseId");
  if (baseId) filters.baseId = baseId;
  const tableId = url.searchParams.get("tableId");
  if (tableId) filters.tableId = tableId;
  const minSize = Number(url.searchParams.get("minSize"));
  if (Number.isFinite(minSize) && url.searchParams.has("minSize")) filters.minSize = minSize;
  const maxSize = Number(url.searchParams.get("maxSize"));
  if (Number.isFinite(maxSize) && url.searchParams.has("maxSize")) filters.maxSize = maxSize;
  const after = new Date(url.searchParams.get("after") ?? "");
  if (!Number.isNaN(after.getTime())) filters.capturedAfter = after;
  const before = new Date(url.searchParams.get("before") ?? "");
  if (!Number.isNaN(before.getTime())) filters.capturedBefore = before;
  const q = url.searchParams.get("q");
  if (q && q.trim()) filters.q = q.trim();
  return filters;
}

/** `subpath` is everything after `/media` — "", "totals", ":assetId", ":assetId/download". */
export async function spacesMediaHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
  subpath: string,
): Promise<Response> {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }
  const pgLocator = space.pgLocator;
  const url = new URL(request.url);

  try {
    // …/media/totals
    if (subpath === "totals") {
      const totals = await withSpaceSchema(masterDb, pgLocator, (tx) =>
        mediaTotals(tx, parseFilters(url)),
      );
      return jsonResponse({ ok: true, ...totals }, 200);
    }

    // …/media (list)
    if (subpath === "") {
      const limitRaw = Number(url.searchParams.get("limit"));
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : 50;
      let cursor: { firstSeenAt: Date; id: string } | undefined;
      const cursorRaw = url.searchParams.get("cursor");
      if (cursorRaw) {
        const [ts, id] = cursorRaw.split("~");
        const at = new Date(ts ?? "");
        if (Number.isNaN(at.getTime()) || !UUID_RE.test(String(id))) {
          return jsonResponse({ error: "invalid_cursor" }, 400);
        }
        cursor = { firstSeenAt: at, id: String(id) };
      }
      const page = await withSpaceSchema(masterDb, pgLocator, (tx) =>
        listMediaAssets(tx, { ...parseFilters(url), cursor, limit }),
      );
      return jsonResponse(
        {
          ok: true,
          items: page.items,
          nextCursor: page.nextCursor
            ? `${page.nextCursor.firstSeenAt.toISOString()}~${page.nextCursor.id}`
            : null,
        },
        200,
      );
    }

    // …/media/:assetId[/download]
    const [assetId, action, ...rest] = subpath.split("/");
    if (!UUID_RE.test(String(assetId)) || rest.length > 0 || (action !== undefined && action !== "download")) {
      return jsonResponse({ error: "not_found" }, 404);
    }
    const asset = await withSpaceSchema(masterDb, pgLocator, (tx) => getMediaAsset(tx, assetId!));
    if (!asset) return jsonResponse({ error: "not_found" }, 404);

    if (action === undefined) return jsonResponse({ ok: true, asset }, 200);

    // download
    if (asset.storageKind === "destination") {
      // Never proxy bytes the engine doesn't hold — web renders "Open in {provider}".
      return jsonResponse(
        { ok: true, kind: "destination", provider: asset.storageProvider, locator: asset.storageRef },
        200,
      );
    }
    if (asset.storageKind !== "r2_managed" || !asset.storageRef) {
      return jsonResponse({ error: "no_stored_object" }, 404);
    }
    if (!env.BACKUPS_R2) return jsonResponse({ error: "r2_binding_unavailable" }, 503);
    const object = await env.BACKUPS_R2.get(asset.storageRef);
    if (!object) return jsonResponse({ error: "object_not_found" }, 404);
    const filename = asset.refs.find((r) => r.filename)?.filename ?? asset.checksum;
    return new Response(object.body, {
      status: 200,
      headers: {
        "content-type": asset.contentType ?? "application/octet-stream",
        ...(object.size ? { "content-length": String(object.size) } : {}),
        "content-disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      },
    });
  } catch (err) {
    return jsonResponse(
      { error: "media_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
