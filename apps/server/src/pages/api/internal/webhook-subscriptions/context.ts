// POST /api/internal/webhook-subscriptions/:id/context
//
// Payloads-auth resolution for the incremental-backup Trigger.dev task
// (server-dynamic-mode Phase 4.1, pairing with server-instant-webhook). The
// task payload deliberately carries no Airtable webhook id and no token —
// payloads are logged in Trigger.dev run history, so anything secret or
// re-resolvable is fetched here at run start instead:
//
//   - airtableWebhookId (ach…)  — Airtable's id, NOT our registry row uuid
//   - baseId (app…)             — the webhook's base
//   - accessToken               — decrypted via the ConnectionDO /token gate
//                                 (refresh-if-needed; the single engine-side
//                                 token-access path, lib/connections/token-via-do.ts)
//   - lastReconciledAt          — the reconciliation anchor (ISO | null)
//   - cursor                    — the subscription's current payload_cursor
//
// Token gate is applied by middleware (path begins /api/internal/).
//
// Result-code → HTTP-status mapping:
//   resolved              → 200  { airtableWebhookId, baseId, accessToken,
//                                  lastReconciledAt, cursor, commentsEnabled }
//   unknown subscription  → 404  { error: 'subscription_not_found' }
//   token can't be minted → 409  { error: 'token_unavailable' }
//                                (connection row missing / pending_reauth /
//                                 transient DO failure — caller retries next
//                                 poll tick; a persistent failure parks the
//                                 webhook pending_reauth via the renewal cron)
//   invalid id            → 400  { error: 'invalid_request' }

import { eq } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import {
  airtableWebhookSubscriptions,
  airtableWebhooks,
  connections,
} from "../../../../db/schema";
import { commentBackupEnabled } from "../../../../lib/capabilities/comment-backup";
import { resolveCapabilities } from "../../../../lib/capabilities/resolve";
import { getConnectionTokenViaDO } from "../../../../lib/connections/token-via-do";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function webhookSubscriptionsContextHandler(
  request: Request,
  env: Env,
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

  const { db } = locals.getMasterDb();

  const rows = await db
    .select({
      airtableWebhookId: airtableWebhooks.airtableWebhookId,
      baseId: airtableWebhooks.baseId,
      connectionId: airtableWebhooks.connectionId,
      organizationId: connections.organizationId,
      lastReconciledAt: airtableWebhookSubscriptions.lastReconciledAt,
      payloadCursor: airtableWebhookSubscriptions.payloadCursor,
    })
    .from(airtableWebhookSubscriptions)
    .innerJoin(
      airtableWebhooks,
      eq(airtableWebhooks.id, airtableWebhookSubscriptions.webhookId),
    )
    .innerJoin(connections, eq(connections.id, airtableWebhooks.connectionId))
    .where(eq(airtableWebhookSubscriptions.id, subscriptionId))
    .limit(1);
  const sub = rows[0];
  if (!sub) {
    return jsonResponse({ error: "subscription_not_found" }, 404);
  }

  const accessToken = await getConnectionTokenViaDO(env, db, sub.connectionId);
  if (accessToken == null) {
    return jsonResponse({ error: "token_unavailable" }, 409);
  }

  // Visited-record comment capture flag (workflows-comments task 3.5) — the
  // same tier resolution full runs use (runs/start-deps
  // resolveCommentsEnabled). Failure-isolated: a resolver error must not
  // block payloads processing, so it degrades to false (comments skip this
  // pass and self-heal on the next full run).
  let commentsEnabled = false;
  try {
    const { tier } = await resolveCapabilities(db, sub.organizationId, "airtable");
    commentsEnabled = commentBackupEnabled(tier);
  } catch {
    commentsEnabled = false;
  }

  return jsonResponse(
    {
      airtableWebhookId: sub.airtableWebhookId,
      baseId: sub.baseId,
      accessToken,
      lastReconciledAt: sub.lastReconciledAt?.toISOString() ?? null,
      cursor: sub.payloadCursor,
      commentsEnabled,
    },
    200,
  );
}
