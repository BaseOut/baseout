// Airtable webhook-renewal RPC wrappers (server-cron-webhook-renewal).
//
// Two thin, pure wrappers over Airtable's webhook maintenance endpoints,
// mirroring the shape of airtable-refresh.ts (outcome unions, injectable
// fetchImpl, no throws for expected upstream states):
//
//   refreshAirtableWebhook             POST /v0/bases/:baseId/webhooks/:id/refresh
//   toggleAirtableWebhookNotifications POST /v0/bases/:baseId/webhooks/:id/enableNotifications
//
// Error mapping (consumed by runWebhookRenewalPass):
//   404        → not_found     (webhook deleted upstream → pending_reauth, no retry)
//   401 / 403  → unauthorized  (token invalid → pending_reauth)
//   429        → rate_limited  (retried next pass)
//   5xx / network → transient  (row unchanged; retried next pass)

export const AIRTABLE_API_BASE_URL = "https://api.airtable.com";

export type WebhookRefreshOutcome =
  | {
      kind: "success";
      // Airtable returns the new expiry as `expirationTime` (ISO). null when
      // the response omits/garbles it — treat as "renewed, expiry unknown".
      expiresAt: Date | null;
    }
  | { kind: "not_found" }
  | { kind: "unauthorized"; reason: string }
  | { kind: "rate_limited"; retryAfterMs?: number }
  | { kind: "transient"; reason: string };

export type WebhookToggleOutcome =
  | { kind: "success" }
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

/** Shared status→outcome mapping for both endpoints; null = 2xx (success). */
function mapErrorStatus(
  res: Response,
): Exclude<WebhookToggleOutcome, { kind: "success" }> | null {
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
  // 5xx and anything unexpected: leave the row alone and retry next pass.
  return { kind: "transient", reason: `http_${res.status}` };
}

async function postWebhookEndpoint(
  baseId: string,
  webhookId: string,
  action: "refresh" | "enableNotifications",
  accessToken: string,
  fetchImpl: typeof fetch,
  body?: string,
): Promise<Response | { kind: "transient"; reason: string }> {
  try {
    return await fetchImpl(
      `${AIRTABLE_API_BASE_URL}/v0/bases/${baseId}/webhooks/${webhookId}/${action}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body } : {}),
      },
    );
  } catch (err) {
    return {
      kind: "transient",
      reason: `network_error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Extend a webhook's 7-day expiry via Airtable's refresh endpoint. */
export async function refreshAirtableWebhook(
  baseId: string,
  webhookId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WebhookRefreshOutcome> {
  const res = await postWebhookEndpoint(baseId, webhookId, "refresh", accessToken, fetchImpl);
  if (!(res instanceof Response)) return res;
  const error = mapErrorStatus(res);
  if (error) {
    await res.body?.cancel?.();
    return error;
  }

  let expiresAt: Date | null = null;
  try {
    const json = (await res.json()) as { expirationTime?: string };
    if (typeof json.expirationTime === "string") {
      const parsed = new Date(json.expirationTime);
      if (!Number.isNaN(parsed.getTime())) expiresAt = parsed;
    }
  } catch {
    // 2xx with an unparseable body: the refresh itself succeeded — surface
    // success with an unknown expiry rather than faking a failure.
  }
  return { kind: "success", expiresAt };
}

/** Enable/disable ping notifications for a webhook (renewal pass re-enables). */
export async function toggleAirtableWebhookNotifications(
  baseId: string,
  webhookId: string,
  enable: boolean,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WebhookToggleOutcome> {
  const res = await postWebhookEndpoint(
    baseId,
    webhookId,
    "enableNotifications",
    accessToken,
    fetchImpl,
    JSON.stringify({ enable }),
  );
  if (!(res instanceof Response)) return res;
  const error = mapErrorStatus(res);
  await res.body?.cancel?.();
  return error ?? { kind: "success" };
}
