// POST /api/internal/spaces/:spaceId/comments-plan
//
// Count-delta refresh planning (server-comments design Decision 5, founder
// direction 2026-07-25): before any comment fetch, the workflows task submits
// the per-record commentCounts observed on its record-listing pass; the engine
// compares each against the stored active-comment count (grouped over
// bo_at_comments — no stored count column) and returns `refresh` (counts
// differ — fetch these) + `zeroCandidates` (stored-active records absent from
// the observed set — resolvable with an empty `complete` capture, no fetch).
// Unchanged counts are skipped entirely: the documented same-count blind spot
// (delete+add pairs, comment edits) is a founder-approved trade-off. If this
// call fails, workflows falls back to refreshing every observed record — the
// optimization degrades to correctness, never the reverse.
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { planCommentRefresh } from "../../../../lib/per-space/comments-sync";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import {
  readActiveCommentCounts,
  withSpaceSchema,
} from "../../../../lib/per-space/space-db-pg";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesCommentsPlanHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const body = raw as { baseId?: unknown; records?: unknown };
  if (typeof body.baseId !== "string" || !Array.isArray(body.records)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const observed: { recordId: string; commentCount: number }[] = [];
  for (const entry of body.records) {
    if (
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as Record<string, unknown>).recordId === "string" &&
      typeof (entry as Record<string, unknown>).commentCount === "number"
    ) {
      observed.push({
        recordId: (entry as { recordId: string }).recordId,
        commentCount: (entry as { commentCount: number }).commentCount,
      });
    }
  }

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    const storedActiveCounts = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      readActiveCommentCounts(tx, body.baseId as string),
    );
    const plan = planCommentRefresh({ observed, storedActiveCounts });
    return jsonResponse({ ok: true, refresh: plan.refresh, zeroCandidates: plan.zeroCandidates }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "plan_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
