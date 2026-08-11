// POST /api/internal/webhook-subscriptions/:id/cursor
//
// Cursor-advance callback the incremental-backup Trigger.dev task hits after
// each durably-applied payload batch (server-instant-webhook Phase D). The
// cursor is the subscription's durable progress marker — the watermark
// (last_polled_at) only answers "have I looked?", never "did it apply?".
//
// Monotonic guard: the UPDATE is CAS-shaped (WHERE payload_cursor <= :cursor)
// so a stale retried attempt can never rewind progress. An equal cursor is an
// idempotent replay → 200. A decrease → 409 { error: 'cursor_regression' }
// with the stored cursor, so the task can resync.
//
// Token gate is applied by middleware (path begins /api/internal/).
//
// Result-code → HTTP-status mapping:
//   advanced / equal replay → 200  { ok: true, cursor }
//   decrease                → 409  { error: 'cursor_regression', cursor }
//   unknown subscription    → 404  { error: 'subscription_not_found' }
//   invalid request/body    → 400  { error: 'invalid_request' }

import { and, eq, lte } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import { airtableWebhookSubscriptions } from "../../../../db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Airtable payload cursors are positive integer transaction numbers. */
function parseCursor(raw: unknown): number | null {
  if (typeof raw !== "object" || raw === null) return null;
  const cursor = (raw as Record<string, unknown>).cursor;
  if (
    typeof cursor !== "number" ||
    !Number.isInteger(cursor) ||
    !Number.isFinite(cursor) ||
    cursor < 1
  ) {
    return null;
  }
  return cursor;
}

export async function webhookSubscriptionsCursorHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  subscriptionId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(subscriptionId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const cursor = parseCursor(raw);
  if (cursor == null) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const { db } = locals.getMasterDb();

  // Atomic monotonic advance: only rows at-or-below the posted cursor match,
  // so concurrent/stale writers can't rewind each other.
  const advanced = await db
    .update(airtableWebhookSubscriptions)
    .set({ payloadCursor: cursor, modifiedAt: new Date() })
    .where(
      and(
        eq(airtableWebhookSubscriptions.id, subscriptionId),
        lte(airtableWebhookSubscriptions.payloadCursor, cursor),
      ),
    )
    .returning({ id: airtableWebhookSubscriptions.id });

  if (advanced.length > 0) {
    return jsonResponse({ ok: true, cursor }, 200);
  }

  // No match: either the row doesn't exist (404) or the stored cursor is
  // already ahead (409 — stale retry).
  const rows = await db
    .select({ payloadCursor: airtableWebhookSubscriptions.payloadCursor })
    .from(airtableWebhookSubscriptions)
    .where(eq(airtableWebhookSubscriptions.id, subscriptionId))
    .limit(1);
  const existing = rows[0];
  if (!existing) {
    return jsonResponse({ error: "subscription_not_found" }, 404);
  }
  return jsonResponse(
    { error: "cursor_regression", cursor: existing.payloadCursor },
    409,
  );
}
