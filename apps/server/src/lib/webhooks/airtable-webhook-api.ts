// Airtable webhook lifecycle RPC wrappers (server-instant-webhook Phase E).
//
// Thin, pure wrappers over Airtable's webhook create/delete/list endpoints,
// mirroring airtable-webhook-renewal.ts (outcome unions, injectable
// fetchImpl, no throws for expected upstream states):
//
//   createAirtableWebhook      POST   /v0/bases/:baseId/webhooks
//   deleteAirtableWebhook      DELETE /v0/bases/:baseId/webhooks/:id
//   fetchAirtableWebhookCursor GET    /v0/bases/:baseId/webhooks
//                              → cursorForNextPayload for one webhook (the
//                                "Airtable's latest cursor" the Phase D
//                                fallback resets a subscription to)
//
// Error mapping:
//   cap error (422/403 + limit language) → cap_reached  (2 webhooks per base
//                                          per OAuth integration)
//   other 4xx (400/422)                  → invalid       (no retry)
//   404                                  → not_found
//   401 / 403                            → unauthorized  (token → reauth)
//   429                                  → rate_limited
//   5xx / network / garbled 2xx body     → transient
//
// The create SPECIFICATION is contractually fixed by the change spec:
// dataTypes tableData/tableFields/tableMetadata; includes cell values "all",
// previous cell values, previous field definitions — payload-driven
// processing + schema-intelligence diffing need full context.
//
// Token acquisition stays with the caller (ConnectionDO /token gate). Like
// the renewal cron's wrappers, these management calls don't ride the
// per-base 5 rps ConnectionDO data gateway — they're rare, one-shot calls.

export const AIRTABLE_API_BASE_URL = "https://api.airtable.com";

export const WEBHOOK_SPECIFICATION = {
  options: {
    filters: {
      dataTypes: ["tableData", "tableFields", "tableMetadata"],
    },
    includes: {
      includeCellValuesInFieldIds: "all",
      includePreviousCellValues: true,
      includePreviousFieldDefinitions: true,
    },
  },
} as const;

export type AirtableWebhookCreateOutcome =
  | {
      kind: "success";
      /** Airtable's webhook id (ach…). */
      airtableWebhookId: string;
      /** Returned ONLY at creation — encrypt + persist immediately. */
      macSecretBase64: string;
      /** null when the response omits/garbles expirationTime. */
      expiresAt: Date | null;
    }
  | { kind: "cap_reached" }
  | { kind: "invalid"; reason: string }
  | { kind: "unauthorized"; reason: string }
  | { kind: "rate_limited"; retryAfterMs?: number }
  | { kind: "transient"; reason: string };

export type AirtableWebhookDeleteOutcome =
  | { kind: "success" }
  | { kind: "not_found" }
  | { kind: "unauthorized"; reason: string }
  | { kind: "rate_limited"; retryAfterMs?: number }
  | { kind: "transient"; reason: string };

export type AirtableWebhookCursorOutcome =
  | { kind: "success"; cursor: number }
  | { kind: "not_found" }
  | { kind: "unauthorized"; reason: string }
  | { kind: "rate_limited"; retryAfterMs?: number }
  | { kind: "transient"; reason: string };

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return seconds * 1000;
}

/** Airtable's per-base / per-integration webhook cap, in any phrasing. */
const CAP_ERROR_RE = /too.?many|limit|maximum|quota/i;

interface AirtableErrorBody {
  error?: { type?: string; message?: string } | string;
}

async function readErrorBody(res: Response): Promise<{ type: string; message: string }> {
  try {
    const json = (await res.json()) as AirtableErrorBody;
    if (typeof json.error === "string") return { type: json.error, message: "" };
    return {
      type: json.error?.type ?? "",
      message: json.error?.message ?? "",
    };
  } catch {
    return { type: "", message: "" };
  }
}

async function safeFetch(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<Response | { kind: "transient"; reason: string }> {
  try {
    return await fetchImpl(url, init);
  } catch (err) {
    return {
      kind: "transient",
      reason: `network_error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Register a webhook with the contractually-fixed full specification. */
export async function createAirtableWebhook(
  baseId: string,
  notificationUrl: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AirtableWebhookCreateOutcome> {
  const res = await safeFetch(
    fetchImpl,
    `${AIRTABLE_API_BASE_URL}/v0/bases/${baseId}/webhooks`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        notificationUrl,
        specification: WEBHOOK_SPECIFICATION,
      }),
    },
  );
  if (!(res instanceof Response)) return res;

  if (!res.ok) {
    if (res.status === 429) {
      await res.body?.cancel?.();
      return {
        kind: "rate_limited",
        retryAfterMs: parseRetryAfter(res.headers.get("retry-after")),
      };
    }
    if (res.status >= 500) {
      await res.body?.cancel?.();
      return { kind: "transient", reason: `http_${res.status}` };
    }
    const { type, message } = await readErrorBody(res);
    // The cap can surface as 422 (INVALID_REQUEST-family with limit language)
    // or 403 depending on the auth flavor — match on the language, not the
    // status alone.
    if (CAP_ERROR_RE.test(type) || CAP_ERROR_RE.test(message)) {
      return { kind: "cap_reached" };
    }
    if (res.status === 401 || res.status === 403) {
      return { kind: "unauthorized", reason: `http_${res.status}` };
    }
    return {
      kind: "invalid",
      reason: `http_${res.status}: ${type || message || "unknown"}`,
    };
  }

  let body: {
    id?: string;
    macSecretBase64?: string;
    expirationTime?: string;
  };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { kind: "transient", reason: "unparseable_create_response" };
  }
  // Without id + secret the webhook is unverifiable AND unmanageable — treat
  // as transient so the caller retries rather than half-persisting.
  if (typeof body.id !== "string" || typeof body.macSecretBase64 !== "string") {
    return { kind: "transient", reason: "create_response_missing_id_or_secret" };
  }

  let expiresAt: Date | null = null;
  if (typeof body.expirationTime === "string") {
    const parsed = new Date(body.expirationTime);
    if (!Number.isNaN(parsed.getTime())) expiresAt = parsed;
  }

  return {
    kind: "success",
    airtableWebhookId: body.id,
    macSecretBase64: body.macSecretBase64,
    expiresAt,
  };
}

function mapDeleteStatus(
  res: Response,
): Exclude<AirtableWebhookDeleteOutcome, { kind: "success" }> | null {
  if (res.ok) return null;
  if (res.status === 404) return { kind: "not_found" };
  if (res.status === 401 || res.status === 403) {
    return { kind: "unauthorized", reason: `http_${res.status}` };
  }
  if (res.status === 429) {
    return {
      kind: "rate_limited",
      retryAfterMs: parseRetryAfter(res.headers.get("retry-after")),
    };
  }
  return { kind: "transient", reason: `http_${res.status}` };
}

/** Delete a webhook (last-unsubscribe teardown + create compensating action). */
export async function deleteAirtableWebhook(
  baseId: string,
  airtableWebhookId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AirtableWebhookDeleteOutcome> {
  const res = await safeFetch(
    fetchImpl,
    `${AIRTABLE_API_BASE_URL}/v0/bases/${baseId}/webhooks/${airtableWebhookId}`,
    {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` },
    },
  );
  if (!(res instanceof Response)) return res;
  const error = mapDeleteStatus(res);
  await res.body?.cancel?.();
  return error ?? { kind: "success" };
}

/**
 * "Airtable's latest cursor" for one webhook — `cursorForNextPayload` from
 * the list-webhooks response. The Phase D fallback resets a subscription's
 * payload_cursor to this after enqueuing the full re-read.
 */
export async function fetchAirtableWebhookCursor(
  baseId: string,
  airtableWebhookId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AirtableWebhookCursorOutcome> {
  const res = await safeFetch(
    fetchImpl,
    `${AIRTABLE_API_BASE_URL}/v0/bases/${baseId}/webhooks`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` },
    },
  );
  if (!(res instanceof Response)) return res;

  if (!res.ok) {
    const mapped = mapDeleteStatus(res);
    await res.body?.cancel?.();
    // mapDeleteStatus never returns null for !res.ok; 404 here means the
    // base itself is gone/inaccessible — same not_found handling applies.
    return mapped ?? { kind: "transient", reason: "unreachable" };
  }

  let body: { webhooks?: Array<{ id?: string; cursorForNextPayload?: number }> };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { kind: "transient", reason: "unparseable_list_response" };
  }
  const match = body.webhooks?.find((w) => w.id === airtableWebhookId);
  if (!match) return { kind: "not_found" };
  if (typeof match.cursorForNextPayload !== "number") {
    return { kind: "transient", reason: "listing_missing_cursor" };
  }
  return { kind: "success", cursor: match.cursorForNextPayload };
}
