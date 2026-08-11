// POST /api/internal/spaces/:spaceId/register-webhooks
//
// Webhook lifecycle enable (server-instant-webhook Phase E). apps/web's
// backup-config PATCH calls this when a Space transitions to
// frequency='instant' (route call wiring is web-instant-webhook). For each
// included base the org-level (organization, base) webhook is found-or-created
// per lib/webhooks/lifecycle.ts, and the Space gets a subscription row. On
// success the Space's DO webhook-poll alarm is armed (best-effort — alarm()
// also self-arms on any tick while the config says instant).
//
// Token gate is applied by middleware (path begins /api/internal/).
//
// Result-code → HTTP-status mapping:
//   ok                            → 200  { ok, results, pollingArmed }
//   space/config not found        → 404  { error }
//   no_bases_selected             → 422  { error }
//   no_active_connection          → 409  { error }
//   token_unavailable             → 409  { error, baseId }
//   airtable_webhook_cap_reached  → 409  { error, baseId }
//   airtable_error / registry_insert_failed → 502  { error, baseId }
//   invalid request               → 400  { error: 'invalid_request' }

import { and, eq } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import {
  airtableWebhookSubscriptions,
  airtableWebhooks,
  atBases,
  backupConfigurationBases,
  backupConfigurations,
  connections,
  platforms,
  spaces,
} from "../../../../db/schema";
import { encryptToken } from "../../../../lib/crypto";
import { getConnectionTokenViaDO } from "../../../../lib/connections/token-via-do";
import {
  createAirtableWebhook,
  deleteAirtableWebhook,
} from "../../../../lib/webhooks/airtable-webhook-api";
import {
  registerWebhooksForSpace,
  type RegisterWebhooksResult,
} from "../../../../lib/webhooks/lifecycle";
import { desc } from "drizzle-orm";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function statusForFailure(
  result: Exclude<RegisterWebhooksResult, { ok: true }>,
): number {
  switch (result.error) {
    case "space_not_found":
    case "config_not_found":
      return 404;
    case "no_bases_selected":
      return 422;
    case "no_active_connection":
    case "token_unavailable":
    case "airtable_webhook_cap_reached":
      return 409;
    case "airtable_error":
    case "registry_insert_failed":
      return 502;
  }
}

export async function spacesRegisterWebhooksHandler(
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

  const result = await registerWebhooksForSpace(
    { spaceId },
    {
      fetchSpace: async (id) => {
        const rows = await db
          .select({ id: spaces.id, organizationId: spaces.organizationId })
          .from(spaces)
          .where(eq(spaces.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      fetchConfigId: async (id) => {
        const rows = await db
          .select({ id: backupConfigurations.id })
          .from(backupConfigurations)
          .where(eq(backupConfigurations.spaceId, id))
          .limit(1);
        return rows[0]?.id ?? null;
      },
      fetchIncludedBases: async (configId) => {
        // backup_configuration_bases.at_base_id FKs at_bases.id (UUID), not
        // the Airtable identifier — same join as buildRunStartDeps.
        return db
          .select({ atBaseId: atBases.atBaseId })
          .from(backupConfigurationBases)
          .innerJoin(atBases, eq(atBases.id, backupConfigurationBases.atBaseId))
          .where(
            and(
              eq(backupConfigurationBases.backupConfigurationId, configId),
              eq(backupConfigurationBases.isIncluded, true),
            ),
          );
      },
      fetchActiveConnection: async (organizationId) => {
        const rows = await db
          .select({ id: connections.id })
          .from(connections)
          .innerJoin(platforms, eq(platforms.id, connections.platformId))
          .where(
            and(
              eq(connections.organizationId, organizationId),
              eq(platforms.slug, "airtable"),
              eq(connections.status, "active"),
            ),
          )
          .orderBy(desc(connections.createdAt))
          .limit(1);
        return rows[0] ?? null;
      },
      findWebhook: async (organizationId, baseId) => {
        const rows = await db
          .select({
            id: airtableWebhooks.id,
            status: airtableWebhooks.status,
            airtableWebhookId: airtableWebhooks.airtableWebhookId,
            connectionId: airtableWebhooks.connectionId,
          })
          .from(airtableWebhooks)
          .where(
            and(
              eq(airtableWebhooks.organizationId, organizationId),
              eq(airtableWebhooks.baseId, baseId),
            ),
          )
          .limit(1);
        return rows[0] ?? null;
      },
      deleteWebhookRow: async (webhookRowId) => {
        await db
          .delete(airtableWebhooks)
          .where(eq(airtableWebhooks.id, webhookRowId));
      },
      getConnectionToken: (connectionId) =>
        getConnectionTokenViaDO(env, db, connectionId),
      createWebhook: (baseId, notificationUrl, token) =>
        createAirtableWebhook(baseId, notificationUrl, token),
      deleteWebhook: (baseId, airtableWebhookId, token) =>
        deleteAirtableWebhook(baseId, airtableWebhookId, token),
      encryptSecret: (plaintext) =>
        encryptToken(plaintext, env.BASEOUT_ENCRYPTION_KEY),
      insertWebhookRow: async (row) => {
        await db.insert(airtableWebhooks).values({
          id: row.id,
          organizationId: row.organizationId,
          connectionId: row.connectionId,
          baseId: row.baseId,
          airtableWebhookId: row.airtableWebhookId,
          macSecretBase64Enc: row.macSecretBase64Enc,
          status: "active",
          expiresAt: row.expiresAt,
        });
      },
      insertSubscription: async (webhookId, sid) => {
        // Idempotent re-enable: UNIQUE (webhook_id, space_id).
        await db
          .insert(airtableWebhookSubscriptions)
          .values({ webhookId, spaceId: sid })
          .onConflictDoNothing();
      },
      generateWebhookId: () => crypto.randomUUID(),
      log: (event) => {
        // eslint-disable-next-line no-console -- lifecycle failure observability (compensating deletes, Airtable create errors); structured, matches the cron log contract
        console.log(JSON.stringify(event));
      },
    },
  );

  if (!result.ok) {
    return jsonResponse(
      { error: result.error, ...(result.baseId ? { baseId: result.baseId } : {}) },
      statusForFailure(result),
    );
  }

  // Arm the Space's webhook-poll alarm. Best-effort: registrations above are
  // durable + idempotent, and SpaceDO.alarm() self-arms on any tick while the
  // config says instant — a failed arm here only delays the first poll.
  let pollingArmed = false;
  try {
    const doId = env.SPACE_DO.idFromName(spaceId);
    const doRes = await env.SPACE_DO.get(doId).fetch(
      "http://do/set-webhook-polling",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      },
    );
    pollingArmed = doRes.ok;
    await doRes.body?.cancel?.();
  } catch {
    pollingArmed = false;
  }

  return jsonResponse({ ok: true, results: result.results, pollingArmed }, 200);
}
