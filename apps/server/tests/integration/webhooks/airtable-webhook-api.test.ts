// Airtable webhook lifecycle RPC wrappers (server-instant-webhook Phase E).
//
// createAirtableWebhook / deleteAirtableWebhook / fetchAirtableWebhookCursor —
// thin outcome-union wrappers over Airtable's webhook endpoints, mirroring
// airtable-webhook-renewal.ts (injectable fetchImpl, no throws for expected
// upstream states). Pins the request shapes (full specification per the spec),
// the cap-error mapping, and the shared error mapping.

import { describe, expect, it, vi } from "vitest";
import {
  AIRTABLE_API_BASE_URL,
  createAirtableWebhook,
  deleteAirtableWebhook,
  fetchAirtableWebhookCursor,
} from "../../../src/lib/webhooks/airtable-webhook-api";

const BASE_ID = "appAAAAAAAAAAAAAA";
const WEBHOOK_ID = "achAAAAAAAAAAAAAA";
const TOKEN = "oaat-test-token";
const NOTIFICATION_URL =
  "https://hooks.baseout.com/webhooks/airtable/11111111-1111-1111-1111-111111111111";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createAirtableWebhook", () => {
  it("POSTs the full specification and maps the create response", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        id: WEBHOOK_ID,
        macSecretBase64: "c2VjcmV0",
        expirationTime: "2030-01-22T14:23:00.000Z",
        cursorForNextPayload: 1,
      }),
    );

    const outcome = await createAirtableWebhook(
      BASE_ID,
      NOTIFICATION_URL,
      TOKEN,
      fetchImpl as unknown as typeof fetch,
    );

    expect(outcome).toEqual({
      kind: "success",
      airtableWebhookId: WEBHOOK_ID,
      macSecretBase64: "c2VjcmV0",
      expiresAt: new Date("2030-01-22T14:23:00.000Z"),
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${AIRTABLE_API_BASE_URL}/v0/bases/${BASE_ID}/webhooks`);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Bearer ${TOKEN}`,
    );
    const body = JSON.parse(init.body as string) as {
      notificationUrl: string;
      specification: {
        options: {
          filters: { dataTypes: string[] };
          includes: Record<string, unknown>;
        };
      };
    };
    expect(body.notificationUrl).toBe(NOTIFICATION_URL);
    expect(body.specification.options.filters.dataTypes).toEqual([
      "tableData",
      "tableFields",
      "tableMetadata",
    ]);
    expect(body.specification.options.includes).toEqual({
      includeCellValuesInFieldIds: "all",
      includePreviousCellValues: true,
      includePreviousFieldDefinitions: true,
    });
  });

  it("maps the per-base webhook cap error to cap_reached", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          error: {
            type: "TOO_MANY_WEBHOOKS_IN_BASE_FOR_INTEGRATION",
            message:
              "Cannot create webhook: the OAuth integration already has the maximum number of webhooks in this base",
          },
        },
        422,
      ),
    );
    const outcome = await createAirtableWebhook(
      BASE_ID,
      NOTIFICATION_URL,
      TOKEN,
      fetchImpl as unknown as typeof fetch,
    );
    expect(outcome).toEqual({ kind: "cap_reached" });
  });

  it("maps a plain 422 without cap language to invalid", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { error: { type: "INVALID_REQUEST_UNKNOWN", message: "bad specification" } },
        422,
      ),
    );
    const outcome = await createAirtableWebhook(
      BASE_ID,
      NOTIFICATION_URL,
      TOKEN,
      fetchImpl as unknown as typeof fetch,
    );
    expect(outcome).toMatchObject({ kind: "invalid" });
  });

  it("maps 401/403 to unauthorized, 429 to rate_limited, 5xx/network to transient", async () => {
    for (const [status, kind] of [
      [401, "unauthorized"],
      [403, "unauthorized"],
      [429, "rate_limited"],
      [500, "transient"],
    ] as const) {
      const fetchImpl = vi.fn(async () => jsonResponse({}, status));
      const outcome = await createAirtableWebhook(
        BASE_ID,
        NOTIFICATION_URL,
        TOKEN,
        fetchImpl as unknown as typeof fetch,
      );
      expect(outcome.kind).toBe(kind);
    }

    const failing = vi.fn(async () => {
      throw new Error("socket hang up");
    });
    const outcome = await createAirtableWebhook(
      BASE_ID,
      NOTIFICATION_URL,
      TOKEN,
      failing as unknown as typeof fetch,
    );
    expect(outcome.kind).toBe("transient");
  });

  it("treats a 2xx with a garbled body (no id/secret) as transient — never half-persist", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ unexpected: true }));
    const outcome = await createAirtableWebhook(
      BASE_ID,
      NOTIFICATION_URL,
      TOKEN,
      fetchImpl as unknown as typeof fetch,
    );
    expect(outcome.kind).toBe("transient");
  });
});

describe("deleteAirtableWebhook", () => {
  it("DELETEs the webhook and maps success", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const outcome = await deleteAirtableWebhook(
      BASE_ID,
      WEBHOOK_ID,
      TOKEN,
      fetchImpl as unknown as typeof fetch,
    );
    expect(outcome).toEqual({ kind: "success" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      `${AIRTABLE_API_BASE_URL}/v0/bases/${BASE_ID}/webhooks/${WEBHOOK_ID}`,
    );
    expect(init.method).toBe("DELETE");
  });

  it("maps 404 to not_found (already gone upstream — treat as done)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 404));
    const outcome = await deleteAirtableWebhook(
      BASE_ID,
      WEBHOOK_ID,
      TOKEN,
      fetchImpl as unknown as typeof fetch,
    );
    expect(outcome).toEqual({ kind: "not_found" });
  });
});

describe("fetchAirtableWebhookCursor", () => {
  it("lists webhooks and returns cursorForNextPayload for the matching id", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        webhooks: [
          { id: "achOTHER", cursorForNextPayload: 3 },
          { id: WEBHOOK_ID, cursorForNextPayload: 17 },
        ],
      }),
    );
    const outcome = await fetchAirtableWebhookCursor(
      BASE_ID,
      WEBHOOK_ID,
      TOKEN,
      fetchImpl as unknown as typeof fetch,
    );
    expect(outcome).toEqual({ kind: "success", cursor: 17 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${AIRTABLE_API_BASE_URL}/v0/bases/${BASE_ID}/webhooks`);
    expect(init.method ?? "GET").toBe("GET");
  });

  it("maps a missing webhook id in the listing to not_found", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ webhooks: [{ id: "achOTHER", cursorForNextPayload: 3 }] }),
    );
    const outcome = await fetchAirtableWebhookCursor(
      BASE_ID,
      WEBHOOK_ID,
      TOKEN,
      fetchImpl as unknown as typeof fetch,
    );
    expect(outcome).toEqual({ kind: "not_found" });
  });
});
