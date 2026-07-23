// @baseout/hooks — public Airtable webhook receiver (openspec/changes/hooks).
//
// One route: POST /webhooks/airtable/{webhook_row_id}. Verifies Airtable's
// X-Airtable-Content-MAC against the row's decrypted per-webhook secret and
// stamps last_ping_at ("changes waiting") — the entire write path. Change
// processing lives in server (polling) + workflows (payload application);
// hooks deliberately has NO service bindings so it stays up during engine
// deploys. Business logic is the pure handlePing (./receive) — this file is
// the thin wire: routing, raw-body read, per-request DB, teardown.

import { eq } from "drizzle-orm";
import { airtableWebhooks, createMasterDb, type HooksDb } from "./db";
import { handlePing, type HandlePingDeps } from "./receive";
import type { Env } from "./env";
import type { Sql } from "postgres";

const ROUTE_RE = /^\/webhooks\/airtable\/([0-9a-f-]{36})$/i;

function logEvent(event: string, fields: Record<string, unknown>): void {
  // eslint-disable-next-line no-console -- structured-logger sink (§3.5); hooks has no other output channel
  console.log(JSON.stringify({ event, ...fields }));
}

function buildDeps(db: HooksDb, env: Env): HandlePingDeps {
  return {
    fetchWebhookRow: async (id) => {
      const [row] = await db
        .select({
          id: airtableWebhooks.id,
          airtableWebhookId: airtableWebhooks.airtableWebhookId,
          baseId: airtableWebhooks.baseId,
          macSecretBase64Enc: airtableWebhooks.macSecretBase64Enc,
          status: airtableWebhooks.status,
        })
        .from(airtableWebhooks)
        .where(eq(airtableWebhooks.id, id))
        .limit(1);
      return row ?? null;
    },
    recordPing: async (id, at, sourceIp) => {
      await db
        .update(airtableWebhooks)
        .set({ lastPingAt: at, lastPingSourceIp: sourceIp, modifiedAt: at })
        .where(eq(airtableWebhooks.id, id));
    },
    encryptionKey: env.MASTER_ENCRYPTION_KEY ?? "",
    log: logEvent,
    now: () => new Date(),
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const match = ROUTE_RE.exec(url.pathname);
    if (!match) return new Response(null, { status: 404 });
    if (request.method !== "POST") return new Response(null, { status: 405 });
    if (!env.MASTER_ENCRYPTION_KEY) {
      logEvent("webhook_receiver_misconfigured", { missing: "MASTER_ENCRYPTION_KEY" });
      return new Response(null, { status: 503 });
    }

    let sql: Sql | null = null;
    try {
      const conn = createMasterDb(env);
      sql = conn.sql;
      return await handlePing({
        webhookRowId: match[1]!,
        rawBody: new Uint8Array(await request.arrayBuffer()),
        macHeader: request.headers.get("x-airtable-content-mac"),
        sourceIp: request.headers.get("cf-connecting-ip"),
        deps: buildDeps(conn.db, env),
      });
    } catch (err) {
      logEvent("webhook_receiver_error", {
        err: err instanceof Error ? err.message : String(err),
      });
      return new Response(null, { status: 503 });
    } finally {
      if (sql) ctx.waitUntil(sql.end({ timeout: 5 }).catch(() => {}));
    }
  },
};
