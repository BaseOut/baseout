// Production wiring for the hourly webhook-renewal cron
// (server-cron-webhook-renewal), following the oauth-refresh-deps.ts pattern:
// scheduled() has no request-scoped locals, so the master DB client is created
// and torn down per firing (CLAUDE.md §5.1).
//
// Token access reuses the ConnectionDO /token gate (refresh-if-needed) exactly
// like rediscovery's run-deps — connectionId drives the on-demand refresh
// path; encryptedToken is the legacy decrypt-only fallback when on-demand
// refresh is disabled. No crypto is reimplemented here.

import { and, eq, isNotNull, lte } from "drizzle-orm";
import { createMasterDb } from "../../db/worker";
import { airtableWebhooks, connections, organizations } from "../../db/schema";
import { getConnectionTokenViaDO } from "../connections/token-via-do";
import {
  refreshAirtableWebhook,
  toggleAirtableWebhookNotifications,
} from "../airtable-webhook-renewal";
import {
  runWebhookRenewalPass,
  type WebhookRenewalPassResult,
} from "./webhook-renewal";
import type { Env } from "../../env";
import { workerOrgScope } from "../runtime-env";

// Refresh webhooks whose 7-day expiry lands within this window. Hourly cadence
// against a 24h lookahead gives ~24 attempts before an expiry can lapse.
const RENEWAL_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;

const WEBHOOK_ROW_COLUMNS = {
  id: airtableWebhooks.id,
  connectionId: airtableWebhooks.connectionId,
  baseId: airtableWebhooks.baseId,
  airtableWebhookId: airtableWebhooks.airtableWebhookId,
};

function logEvent(event: Record<string, unknown>): void {
  // eslint-disable-next-line no-console -- per-firing summary is the cron observability contract (matches oauth-refresh-deps.ts); a silently rotting webhook registry is the failure mode this cron exists to kill
  console.log(JSON.stringify(event));
}

// Token access lives in lib/connections/token-via-do.ts (extracted when the
// Phase E lifecycle routes became the second consumer).

export async function runScheduledWebhookRenewal(
  env: Env,
): Promise<WebhookRenewalPassResult> {
  const { db, sql: pg } = createMasterDb(env);
  try {
    return await runWebhookRenewalPass({
      listExpiring: () =>
        db
          .select(WEBHOOK_ROW_COLUMNS)
          .from(airtableWebhooks)
          .innerJoin(connections, eq(connections.id, airtableWebhooks.connectionId))
          .innerJoin(organizations, eq(organizations.id, connections.organizationId))
          .where(
            and(
              eq(airtableWebhooks.status, "active"),
              isNotNull(airtableWebhooks.expiresAt),
              lte(
                airtableWebhooks.expiresAt,
                new Date(Date.now() + RENEWAL_LOOKAHEAD_MS),
              ),
              eq(organizations.runtimeEnv, workerOrgScope(env)),
            ),
          ),
      listNotificationsDisabled: () =>
        db
          .select(WEBHOOK_ROW_COLUMNS)
          .from(airtableWebhooks)
          .innerJoin(connections, eq(connections.id, airtableWebhooks.connectionId))
          .innerJoin(organizations, eq(organizations.id, connections.organizationId))
          .where(
            and(
              eq(airtableWebhooks.status, "notifications_disabled"),
              eq(organizations.runtimeEnv, workerOrgScope(env)),
            ),
          ),
      getConnectionToken: (connectionId) =>
        getConnectionTokenViaDO(env, db, connectionId),
      refresh: (baseId, webhookId, token) =>
        refreshAirtableWebhook(baseId, webhookId, token),
      toggle: (baseId, webhookId, enable, token) =>
        toggleAirtableWebhookNotifications(baseId, webhookId, enable, token),
      persistRenewal: async (webhookId, expiresAt, renewedAt) => {
        await db
          .update(airtableWebhooks)
          .set({
            // null expiry from Airtable = "renewed, expiry unknown": keep the
            // stored expires_at rather than nulling a row out of the sweep.
            ...(expiresAt != null ? { expiresAt } : {}),
            lastRenewedAt: renewedAt,
            modifiedAt: new Date(),
          })
          .where(eq(airtableWebhooks.id, webhookId));
      },
      persistStatus: async (webhookId, status) => {
        await db
          .update(airtableWebhooks)
          .set({ status, modifiedAt: new Date() })
          .where(eq(airtableWebhooks.id, webhookId));
      },
      log: logEvent,
      now: () => new Date(),
    });
  } finally {
    await pg.end({ timeout: 5 }).catch(() => {});
  }
}
