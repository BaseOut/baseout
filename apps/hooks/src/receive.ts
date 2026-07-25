// Pure Airtable ping receiver (openspec/changes/hooks) — the entire business
// logic of apps/hooks. Airtable notification pings carry no change data; a
// verified ping means "this base has changes waiting", recorded as a single
// last_ping_at upsert on the airtable_webhooks registry row. No event rows,
// no queue, no forwarding — per-Space polling (server-instant-webhook)
// discovers dirty bases from that column on its own cadence.
//
// Verification order (design "HMAC verification order"):
//   body cap → row lookup → decrypt secret → MAC verify → JSON cross-check
//   → upsert → 200 EMPTY body (Airtable requires 200/204 + empty body;
//   anything else counts as a failed delivery).
//
// Status contract: 410 unknown/inactive row; 401 anything MAC/body-shaped
// (never reveals which check failed); 503 on registry-write failure so
// Airtable's ~13-retry/1-day backoff redelivers.

import { decryptToken, verifyAirtableContentMac } from "@baseout/shared";

/** Reject bodies over 64KB before any crypto/DB work (spec W4). */
export const MAX_BODY_BYTES = 64 * 1024;

export interface WebhookRow {
  id: string;
  airtableWebhookId: string;
  baseId: string;
  macSecretBase64Enc: string;
  status: string;
}

export interface HandlePingDeps {
  fetchWebhookRow: (id: string) => Promise<WebhookRow | null>;
  recordPing: (id: string, at: Date, sourceIp: string | null) => Promise<void>;
  /** Master encryption key (base64 32 bytes) for mac_secret_base64_enc. */
  encryptionKey: string;
  log: (event: string, fields: Record<string, unknown>) => void;
  now: () => Date;
}

export interface HandlePingInput {
  webhookRowId: string;
  rawBody: Uint8Array;
  macHeader: string | null;
  sourceIp: string | null;
  deps: HandlePingDeps;
}

const empty = (status: number): Response => new Response(null, { status });

export async function handlePing(input: HandlePingInput): Promise<Response> {
  const { deps } = input;

  if (input.rawBody.byteLength > MAX_BODY_BYTES) {
    return empty(401);
  }

  const row = await deps.fetchWebhookRow(input.webhookRowId);
  if (!row || row.status === "inactive") {
    return empty(410);
  }

  let secretB64: string;
  try {
    secretB64 = await decryptToken(row.macSecretBase64Enc, deps.encryptionKey);
  } catch {
    // Undecryptable secret (key drift, corrupt row) — indistinguishable from a
    // bad MAC to the caller by design.
    deps.log("webhook_ping_secret_decrypt_failed", { webhookRowId: row.id });
    return empty(401);
  }

  if (!(await verifyAirtableContentMac(input.rawBody, secretB64, input.macHeader))) {
    deps.log("webhook_ping_mac_rejected", { webhookRowId: row.id, sourceIp: input.sourceIp });
    return empty(401);
  }

  // MAC verified — now (and only now) parse and cross-check the body against
  // the row, so a replayed ping for a different webhook can't dirty this one.
  let parsed: { base?: { id?: unknown }; webhook?: { id?: unknown } };
  try {
    parsed = JSON.parse(new TextDecoder().decode(input.rawBody)) as typeof parsed;
  } catch {
    return empty(401);
  }
  if (parsed.webhook?.id !== row.airtableWebhookId || parsed.base?.id !== row.baseId) {
    deps.log("webhook_ping_body_row_mismatch", {
      webhookRowId: row.id,
      bodyWebhookId: parsed.webhook?.id ?? null,
      bodyBaseId: parsed.base?.id ?? null,
    });
    return empty(401);
  }

  try {
    await deps.recordPing(row.id, deps.now(), input.sourceIp);
  } catch (err) {
    deps.log("webhook_ping_record_failed", {
      webhookRowId: row.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return empty(503);
  }

  deps.log("webhook_ping_recorded", {
    webhookRowId: row.id,
    baseId: row.baseId,
    sourceIp: input.sourceIp,
  });
  return empty(200);
}
