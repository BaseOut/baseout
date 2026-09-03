// POST /api/internal/webhook-subscriptions/:id/fallback
//
// Gap-signal callback from the incremental-backup task (server-instant-webhook
// Phase D): the payload stream can't be trusted for this subscription (cursor
// past Airtable's 7-day retention, INVALID_HOOK/INVALID_FILTERS, stream
// error). Recovery is a full re-read:
//
//   1. Enqueue a full backup-base run for the affected base — an ordinary
//      backup_runs row (triggered_by='webhook', kind='full') driven through
//      processRunStart with the fan-out narrowed to this base.
//   2. Stamp the subscription's last_reconciled_at (the full re-read is the
//      new reconciliation anchor).
//   3. Reset payload_cursor to Airtable's latest (`cursorForNextPayload` from
//      the list-webhooks endpoint, token via the ConnectionDO /token gate) so
//      the next incremental resumes past the unreadable backlog. Best-effort:
//      when the cursor can't be fetched (dead token, webhook gone) the run +
//      anchor still land and the response carries cursorReset:false — the
//      next poll retries from the stale cursor and re-signals if still broken.
//
// Token gate is applied by middleware (path begins /api/internal/).
//
// Result-code → HTTP-status mapping:
//   ok                     → 202  { ok, runId, reconciledAt, cursorReset, cursor? }
//   unknown subscription   → 404  { error: 'subscription_not_found' }
//   run-start failure      → runs/start mapping (404/409/422) { error }
//   invalid request/body   → 400  { error: 'invalid_request' }

import { eq } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import {
  airtableWebhookSubscriptions,
  airtableWebhooks,
  backupRuns,
} from "../../../../db/schema";
import {
  processRunStart,
  type ProcessRunStartResult,
} from "../../../../lib/runs/start";
import { buildRunStartDeps } from "../../../../lib/runs/start-deps";
import { getConnectionTokenViaDO } from "../../../../lib/connections/token-via-do";
import { fetchAirtableWebhookCursor } from "../../../../lib/webhooks/airtable-webhook-api";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function statusForStartFailure(
  result: Exclude<ProcessRunStartResult, { ok: true }>,
): number {
  // Mirrors runs/start.ts so callers see one consistent mapping.
  switch (result.error) {
    case "run_not_found":
    case "connection_not_found":
    case "config_not_found":
      return 404;
    case "run_already_started":
    case "invalid_connection":
      return 409;
    case "unsupported_storage_type":
    case "no_bases_selected":
      return 422;
    case "env_mismatch":
      return 403;
  }
}

export async function webhookSubscriptionsFallbackHandler(
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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const reason =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>).reason
      : undefined;
  if (typeof reason !== "string" || reason.length === 0) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const { db } = locals.getMasterDb();

  const rows = await db
    .select({
      subscriptionId: airtableWebhookSubscriptions.id,
      spaceId: airtableWebhookSubscriptions.spaceId,
      baseId: airtableWebhooks.baseId,
      connectionId: airtableWebhooks.connectionId,
      airtableWebhookId: airtableWebhooks.airtableWebhookId,
    })
    .from(airtableWebhookSubscriptions)
    .innerJoin(
      airtableWebhooks,
      eq(airtableWebhooks.id, airtableWebhookSubscriptions.webhookId),
    )
    .where(eq(airtableWebhookSubscriptions.id, subscriptionId))
    .limit(1);
  const sub = rows[0];
  if (!sub) {
    return jsonResponse({ error: "subscription_not_found" }, 404);
  }

  // 1. Full re-read for the affected base. The run rides the standard
  //    processRunStart path (connection/config/storage validation + task
  //    fan-out) with fetchIncludedBases narrowed to this base — the gap is
  //    per-subscription, not per-Space.
  const [runRow] = await db
    .insert(backupRuns)
    .values({
      spaceId: sub.spaceId,
      connectionId: sub.connectionId,
      status: "queued",
      triggeredBy: "webhook",
      kind: "full",
      isTrial: false,
    })
    .returning({ id: backupRuns.id });
  if (!runRow) {
    return jsonResponse({ error: "run_insert_failed" }, 502);
  }

  const deps = buildRunStartDeps(db, env);
  const fetchAllIncluded = deps.fetchIncludedBases;
  deps.fetchIncludedBases = async (configId) =>
    (await fetchAllIncluded(configId)).filter(
      (base) => base.atBaseId === sub.baseId,
    );

  const started = await processRunStart({ runId: runRow.id }, deps);
  if (!started.ok) {
    // Roll back the orphaned queued row — same pattern as the SpaceDO fire.
    await db.delete(backupRuns).where(eq(backupRuns.id, runRow.id));
    return jsonResponse({ error: started.error }, statusForStartFailure(started));
  }

  // 2. The full re-read is the new reconciliation anchor.
  const reconciledAt = new Date();
  await db
    .update(airtableWebhookSubscriptions)
    .set({ lastReconciledAt: reconciledAt, modifiedAt: reconciledAt })
    .where(eq(airtableWebhookSubscriptions.id, subscriptionId));

  // 3. Best-effort cursor reset to Airtable's latest.
  let cursorReset = false;
  let latestCursor: number | undefined;
  const token = await getConnectionTokenViaDO(env, db, sub.connectionId);
  if (token != null) {
    const outcome = await fetchAirtableWebhookCursor(
      sub.baseId,
      sub.airtableWebhookId,
      token,
    );
    if (outcome.kind === "success") {
      await db
        .update(airtableWebhookSubscriptions)
        .set({ payloadCursor: outcome.cursor, modifiedAt: new Date() })
        .where(eq(airtableWebhookSubscriptions.id, subscriptionId));
      cursorReset = true;
      latestCursor = outcome.cursor;
    }
  }

  return jsonResponse(
    {
      ok: true,
      runId: runRow.id,
      reconciledAt: reconciledAt.toISOString(),
      cursorReset,
      ...(latestCursor !== undefined ? { cursor: latestCursor } : {}),
    },
    202,
  );
}
