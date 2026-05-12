// Unit tests for refreshAirtableAccessToken's response mapper. Live in
// tests/integration/ because apps/server has no tests/unit/ dir (everything
// runs through the @cloudflare/vitest-pool-workers pool — see Phase 5 of
// the openspec baseout-server-cron-oauth-refresh plan).
//
// The RPC itself does no I/O beyond the injected fetch, so these tests
// are effectively pure: each one builds a Response, feeds it via fetchImpl,
// and asserts the resulting discriminated RefreshOutcome.

import { describe, expect, it, vi } from "vitest";
import {
  AIRTABLE_TOKEN_URL,
  refreshAirtableAccessToken,
} from "../../src/lib/airtable-refresh";

const FROZEN_NOW = 1_700_000_000_000;

function makeFetchMock(response: Response): typeof fetch {
  return vi.fn(async () => response) as unknown as typeof fetch;
}

function defaultInput(overrides: Partial<Parameters<typeof refreshAirtableAccessToken>[0]> = {}) {
  return {
    refreshToken: "refr-old",
    clientId: "client-id",
    clientSecret: "client-secret",
    nowMs: () => FROZEN_NOW,
    ...overrides,
  };
}

describe("refreshAirtableAccessToken", () => {
  it("success — returns 'success' with new tokens + computed expiresAtMs", async () => {
    const fetchImpl = makeFetchMock(
      new Response(
        JSON.stringify({
          access_token: "acc-new",
          refresh_token: "refr-new",
          expires_in: 3600,
          scope: "data.records:read schema.bases:read",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await refreshAirtableAccessToken(
      defaultInput({ fetchImpl }),
    );

    expect(result).toEqual({
      kind: "success",
      accessToken: "acc-new",
      refreshToken: "refr-new",
      expiresAtMs: FROZEN_NOW + 3600 * 1000,
      scope: "data.records:read schema.bases:read",
    });
  });

  it("success — defaults missing scope to null", async () => {
    const fetchImpl = makeFetchMock(
      new Response(
        JSON.stringify({
          access_token: "acc-new",
          refresh_token: "refr-new",
          expires_in: 3600,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await refreshAirtableAccessToken(
      defaultInput({ fetchImpl }),
    );

    expect(result.kind).toBe("success");
    if (result.kind === "success") expect(result.scope).toBeNull();
  });

  it("invalid — 200 with missing refresh_token must NOT overwrite stored value", async () => {
    // Airtable always rotates on a successful refresh. A missing refresh_token
    // is a malformed response, not a green light to wipe the DB column.
    const fetchImpl = makeFetchMock(
      new Response(
        JSON.stringify({
          access_token: "acc-new",
          // no refresh_token
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    );

    const result = await refreshAirtableAccessToken(
      defaultInput({ fetchImpl }),
    );

    expect(result).toEqual({ kind: "invalid", reason: "missing_refresh_token" });
  });

  it("pending_reauth — 400 invalid_grant means user revoked / removed integration", async () => {
    const fetchImpl = makeFetchMock(
      new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "Refresh token expired or revoked",
        }),
        { status: 400 },
      ),
    );

    const result = await refreshAirtableAccessToken(
      defaultInput({ fetchImpl }),
    );

    expect(result.kind).toBe("pending_reauth");
    if (result.kind === "pending_reauth") {
      expect(result.reason).toContain("invalid_grant");
      expect(result.reason).toContain("Refresh token expired or revoked");
    }
  });

  it("pending_reauth — 400 unauthorized_client also surfaces as pending_reauth", async () => {
    const fetchImpl = makeFetchMock(
      new Response(JSON.stringify({ error: "unauthorized_client" }), {
        status: 400,
      }),
    );

    const result = await refreshAirtableAccessToken(
      defaultInput({ fetchImpl }),
    );

    expect(result.kind).toBe("pending_reauth");
  });

  it("transient — 503 with no Retry-After", async () => {
    const fetchImpl = makeFetchMock(new Response("", { status: 503 }));

    const result = await refreshAirtableAccessToken(
      defaultInput({ fetchImpl }),
    );

    expect(result).toEqual({ kind: "transient", reason: "http_503" });
  });

  it("transient — 429 with Retry-After in seconds", async () => {
    const fetchImpl = makeFetchMock(
      new Response("", { status: 429, headers: { "retry-after": "30" } }),
    );

    const result = await refreshAirtableAccessToken(
      defaultInput({ fetchImpl }),
    );

    expect(result).toEqual({
      kind: "transient",
      reason: "http_429",
      retryAfterMs: 30_000,
    });
  });

  it("transient — network error caught and reported", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;

    const result = await refreshAirtableAccessToken(
      defaultInput({ fetchImpl }),
    );

    expect(result.kind).toBe("transient");
    if (result.kind === "transient") {
      expect(result.reason).toContain("network_error");
      expect(result.reason).toContain("ECONNRESET");
    }
  });

  it("invalid — 400 with an unknown error code goes to 'invalid'", async () => {
    const fetchImpl = makeFetchMock(
      new Response(
        JSON.stringify({
          error: "some_new_error_code_we_dont_know",
          error_description: "huh",
        }),
        { status: 400 },
      ),
    );

    const result = await refreshAirtableAccessToken(
      defaultInput({ fetchImpl }),
    );

    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.reason).toContain("some_new_error_code_we_dont_know");
    }
  });

  it("invalid — 200 with unparseable body", async () => {
    const fetchImpl = makeFetchMock(
      new Response("not-json", { status: 200 }),
    );

    const result = await refreshAirtableAccessToken(
      defaultInput({ fetchImpl }),
    );

    expect(result).toEqual({
      kind: "invalid",
      reason: "http_200_unparseable_body",
    });
  });

  it("sends the right URL, method, headers, and form body", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
          url:
            typeof url === "string"
              ? url
              : url instanceof URL
                ? url.href
                : url.url,
          init: init ?? {},
        });
        return new Response(
          JSON.stringify({
            access_token: "a",
            refresh_token: "r",
            expires_in: 3600,
          }),
          { status: 200 },
        );
      },
    ) as unknown as typeof fetch;

    await refreshAirtableAccessToken(
      defaultInput({
        fetchImpl,
        refreshToken: "refr-needs-rotation",
        clientId: "id1",
        clientSecret: "sec1",
      }),
    );

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe(AIRTABLE_TOKEN_URL);
    expect(call.init.method).toBe("POST");
    const headers = call.init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    // base64("id1:sec1") === "aWQxOnNlYzE="
    expect(headers["authorization"]).toBe("Basic aWQxOnNlYzE=");
    const params = new URLSearchParams(call.init.body as string);
    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("refresh_token")).toBe("refr-needs-rotation");
  });
});
