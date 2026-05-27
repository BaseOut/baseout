// Unit tests for refreshBoxAccessToken's response mapper. Lives in
// tests/integration/ following the refresh-drive.test.ts placement
// convention. Pure: each test feeds a Response via fetchImpl and asserts
// the resulting BoxRefreshOutcome.
//
// The load-bearing assertion across this file: Box rotates refresh tokens on
// every refresh. The `success` outcome MUST surface the new `refresh_token`
// so the caller persists it. Without that, the next refresh fails with
// `invalid_grant` and the user is forced to reconnect.

import { describe, expect, it, vi } from "vitest";
import {
  BOX_TOKEN_URL,
  refreshBoxAccessToken,
} from "../../src/lib/storage/refresh-box";

const FROZEN_NOW = 1_700_000_000_000;

function makeFetchMock(response: Response): typeof fetch {
  return vi.fn(async () => response) as unknown as typeof fetch;
}

function defaultInput(
  overrides: Partial<Parameters<typeof refreshBoxAccessToken>[0]> = {},
) {
  return {
    refreshToken: "refr-old",
    clientId: "client-id",
    clientSecret: "client-secret",
    nowMs: () => FROZEN_NOW,
    ...overrides,
  };
}

describe("refreshBoxAccessToken", () => {
  it("success — 200 returns 'success' with NEW rotated refresh_token + expiresAtMs", async () => {
    const fetchImpl = makeFetchMock(
      new Response(
        JSON.stringify({
          access_token: "acc-new",
          refresh_token: "refr-NEW-rotated",
          expires_in: 3600,
          token_type: "bearer",
          scope: "root_readwrite",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await refreshBoxAccessToken(defaultInput({ fetchImpl }));

    expect(result).toEqual({
      kind: "success",
      accessToken: "acc-new",
      refreshToken: "refr-NEW-rotated",
      expiresAtMs: FROZEN_NOW + 3600 * 1000,
      scope: "root_readwrite",
    });
  });

  it("invalid — 200 OK missing refresh_token violates Box's contract (treated as invalid)", async () => {
    // Box always returns a fresh refresh_token on a successful refresh.
    // A missing one indicates a contract drift; better to fail loudly than
    // silently leave the stored refresh token stale-but-valid (it would
    // expire in 60s).
    const fetchImpl = makeFetchMock(
      new Response(
        JSON.stringify({ access_token: "acc-new", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await refreshBoxAccessToken(defaultInput({ fetchImpl }));

    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.reason).toMatch(/missing_refresh_token/);
    }
  });

  it("sends form-encoded body with grant_type, refresh_token, client_id, client_secret", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          access_token: "a",
          refresh_token: "r-new",
          expires_in: 1,
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    await refreshBoxAccessToken(defaultInput({ fetchImpl }));

    const call = (fetchImpl as unknown as { mock: { calls: unknown[] } }).mock
      .calls[0] as [string, RequestInit];
    expect(call[0]).toBe(BOX_TOKEN_URL);
    expect(call[1].method).toBe("POST");
    const headers = new Headers(call[1].headers);
    expect(headers.get("content-type")).toBe(
      "application/x-www-form-urlencoded",
    );
    // Box accepts body-form auth — no Authorization header (parity with Drive).
    expect(headers.get("authorization")).toBeNull();
    const body = new URLSearchParams(call[1].body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("refr-old");
    expect(body.get("client_id")).toBe("client-id");
    expect(body.get("client_secret")).toBe("client-secret");
  });

  it("pending_reauth — 400 invalid_grant (60-day expiry / revoked / already-rotated)", async () => {
    const fetchImpl = makeFetchMock(
      new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "Refresh token has expired",
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await refreshBoxAccessToken(defaultInput({ fetchImpl }));

    expect(result.kind).toBe("pending_reauth");
    if (result.kind === "pending_reauth") {
      expect(result.reason).toMatch(/invalid_grant/);
    }
  });

  it("invalid — 401 invalid_client means client secret rotation in Box App", async () => {
    const fetchImpl = makeFetchMock(
      new Response(JSON.stringify({ error: "invalid_client" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await refreshBoxAccessToken(defaultInput({ fetchImpl }));

    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.reason).toMatch(/invalid_client/);
    }
  });

  it("transient — 5xx with retry-after surfaces retryAfterMs", async () => {
    const fetchImpl = makeFetchMock(
      new Response("", {
        status: 503,
        headers: { "retry-after": "5" },
      }),
    );

    const result = await refreshBoxAccessToken(defaultInput({ fetchImpl }));

    expect(result.kind).toBe("transient");
    if (result.kind === "transient") {
      expect(result.reason).toBe("http_503");
      expect(result.retryAfterMs).toBe(5000);
    }
  });

  it("transient — 429 maps to transient", async () => {
    const fetchImpl = makeFetchMock(new Response("", { status: 429 }));
    const result = await refreshBoxAccessToken(defaultInput({ fetchImpl }));
    expect(result.kind).toBe("transient");
  });

  it("transient — network error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const result = await refreshBoxAccessToken(defaultInput({ fetchImpl }));

    expect(result.kind).toBe("transient");
    if (result.kind === "transient") {
      expect(result.reason).toMatch(/network_error.*ECONNREFUSED/);
    }
  });

  it("invalid — unparseable body", async () => {
    const fetchImpl = makeFetchMock(
      new Response("not json", { status: 400 }),
    );
    const result = await refreshBoxAccessToken(defaultInput({ fetchImpl }));
    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.reason).toMatch(/unparseable_body/);
    }
  });
});
