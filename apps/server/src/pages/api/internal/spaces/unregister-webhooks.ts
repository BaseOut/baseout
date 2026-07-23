// POST /api/internal/spaces/:spaceId/unregister-webhooks
//
// Webhook lifecycle disable (server-instant-webhook Phase E) — called when a
// Space moves off frequency='instant', removes bases, or downgrades tier
// (route call wiring is web-instant-webhook). Deletes the Space's
// subscription rows; when a webhook's LAST subscription goes, the Airtable
// webhook is deleted and the registry row set status='inactive' (retained for
// audit; the hooks receiver 410s its pings). The Space's DO webhook-poll
// alarm is disarmed best-effort — alarm() also drops the poll lane on its own
// once the config is no longer instant.
//
// Token gate is applied by middleware (path begins /api/internal/).
//
// Result-code → HTTP-status mapping:
//   ok              → 200  { ok, removedSubscriptions, deactivatedWebhooks }
//   invalid request → 400  { error: 'invalid_request' }

import { eq, sql } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import {
  airtableWebhookSubscriptions,
  airtableWebhooks,
} from "../../../../db/schema";
import { getConnectionTokenViaDO } from "../../../../lib/connections/token-via-do";
import { deleteAirtableWebhook } from "../../../../lib/webhooks/airtable-webhook-api";
import { unregisterWebhooksForSpace } from "../../../../lib/webhooks/lifecycle";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesUnregisterWebhooksHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(spaceId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const { db } = locals.getMasterDb();

  const result = await unregisterWebhooksForSpace(
    { spaceId },
    {
      listSpaceSubscriptions: async (sid) => {
        return db
          .select({
            subscriptionId: airtableWebhookSubscriptions.id,
            webhookId: airtableWebhooks.id,
            baseId: airtableWebhooks.baseId,
            airtableWebhookId: airtableWebhooks.airtableWebhookId,
            connectionId: airtableWebhooks.connectionId,
          })
          .from(airtableWebhookSubscriptions)
          .innerJoin(
            airtableWebhooks,
            eq(airtableWebhooks.id, airtableWebhookSubscriptions.webhookId),
          )
          .where(eq(airtableWebhookSubscriptions.spaceId, sid));
      },
      deleteSubscription: async (subscriptionId) => {
        await db
          .delete(airtableWebhookSubscriptions)
          .where(eq(airtableWebhookSubscriptions.id, subscriptionId));
      },
      countSubscriptions: async (webhookId) => {
        const rows = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(airtableWebhookSubscriptions)
          .where(eq(airtableWebhookSubscriptions.webhookId, webhookId));
        return Number(rows[0]?.count ?? 0);
      },
      getConnectionToken: (connectionId) =>
        getConnectionTokenViaDO(env, db, connectionId),
      deleteWebhook: (baseId, airtableWebhookId, token) =>
        deleteAirtableWebhook(baseId, airtableWebhookId, token),
      markWebhookInactive: async (webhookRowId) => {
        await db
          .update(airtableWebhooks)
          .set({ status: "inactive", modifiedAt: new Date() })
          .where(eq(airtableWebhooks.id, webhookRowId));
      },
      log: (event) => {
        // eslint-disable-next-line no-console -- lifecycle failure observability (orphaned Airtable webhooks on dead tokens); structured, matches the cron log contract
        console.log(JSON.stringify(event));
      },
    },
  );

  // Disarm the Space's poll alarm. Best-effort: alarm() drops the poll lane
  // itself once the config is no longer instant.
  try {
    const doId = env.SPACE_DO.idFromName(spaceId);
    const doRes = await env.SPACE_DO.get(doId).fetch(
      "http://do/set-webhook-polling",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      },
    );
    await doRes.body?.cancel?.();
  } catch {
    // Self-healing via the alarm's own config check.
  }

  return jsonResponse(
    {
      ok: true,
      removedSubscriptions: result.removedSubscriptions,
      deactivatedWebhooks: result.deactivatedWebhooks,
    },
    200,
  );
}
