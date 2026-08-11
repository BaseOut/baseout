// Unit tests for refreshDropboxAccessToken's response mapper. Mirrors
// refresh-drive.test.ts because Dropbox refresh tokens are stable (no
// rotation; the response omits refresh_token, the caller preserves the
// stored value).

import { describe, expect, it, vi } from "vitest";
import {
  DROPBOX_TOKEN_URL,
  refreshDropboxAccessToken,
} from "../../src/lib/storage/refresh-dropbox";

const FROZEN_NOW = 1_700_000_000_000;

function makeFetchMock(response: Response): typeof fetch {
  return vi.fn(async () => response) as unknown as typeof fetch;
}

function defaultInput(
  overrides: Partial<Parameters<typeof refreshDropboxAccessToken>[0]> = {},
) {
  return {
    refreshToken: "refr-old",
    clientId: "client-id",
    clientSecret: "client-secret",
    nowMs: () => FROZEN_NOW,
    ...overrides,
  };
}

describe("refreshDropboxAccessToken", () => {
  it("success — 200 with access_token returns 'success' + computed expiresAtMs (refresh_token NOT surfaced)", async () => {
    // Dropbox omits refresh_token on refresh because the original is
    // long-lived. The outcome doesn't include a refreshToken field — the
    // engine route preserves the previously stored value.
    const fetchImpl = makeFetchMock(
      new Response(
        JSON.stringify({
          access_token: "sl.u.at-new",
          expires_in: 14400,
          token_type: "bearer",
          scope: "files.content.write files.metadata.write",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await refreshDropboxAccessToken(defaultInput({ fetchImpl }));

    expect(result).toEqual({
      kind: "success",
      accessToken: "sl.u.at-new",
      expiresAtMs: FROZEN_NOW + 14400 * 1000,
      scope: "files.content.write files.metadata.write",
    });
  });

  it("success — defaults missing scope to null and missing expires_in to 0", async () => {
    const fetchImpl = makeFetchMock(
      new Response(JSON.stringify({ access_token: "sl.u.at-new" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await refreshDropboxAccessToken(defaultInput({ fetchImpl }));

    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.scope).toBeNull();
      expect(result.expiresAtMs).toBe(FROZEN_NOW);
    }
  });

  it("sends form-encoded body with grant_type, refresh_token, client_id, client_secret", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: "a", expires_in: 1 }), {
        status: 200,
      }),
    ) as unknown as typeof fetch;

    await refreshDropboxAccessToken(defaultInput({ fetchImpl }));

    const call = (fetchImpl as unknown as { mock: { calls: unknown[] } }).mock
      .calls[0] as [string, RequestInit];
    expect(call[0]).toBe(DROPBOX_TOKEN_URL);
    expect(call[1].method).toBe("POST");
    const headers = new Headers(call[1].headers);
    expect(headers.get("content-type")).toBe(
      "application/x-www-form-urlencoded",
    );
    // Dropbox accepts body-form auth — no Authorization header (parity with Drive).
    expect(headers.get("authorization")).toBeNull();
    const body = new URLSearchParams(call[1].body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("refr-old");
    expect(body.get("client_id")).toBe("client-id");
    expect(body.get("client_secret")).toBe("client-secret");
  });

  it("pending_reauth — 400 invalid_grant (refresh token revoked or app permission revoked)", async () => {
    const fetchImpl = makeFetchMock(
      new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "refresh token revoked",
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await refreshDropboxAccessToken(defaultInput({ fetchImpl }));

    expect(result.kind).toBe("pending_reauth");
    if (result.kind === "pending_reauth") {
      expect(result.reason).toMatch(/invalid_grant/);
    }
  });

  it("invalid — 401 invalid_client means client secret rotation in Dropbox App", async () => {
    const fetchImpl = makeFetchMock(
      new Response(JSON.stringify({ error: "invalid_client" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await refreshDropboxAccessToken(defaultInput({ fetchImpl }));

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

    const result = await refreshDropboxAccessToken(defaultInput({ fetchImpl }));

    expect(result.kind).toBe("transient");
    if (result.kind === "transient") {
      expect(result.reason).toBe("http_503");
      expect(result.retryAfterMs).toBe(5000);
    }
  });

  it("transient — 429 maps to transient", async () => {
    const fetchImpl = makeFetchMock(new Response("", { status: 429 }));
    const result = await refreshDropboxAccessToken(defaultInput({ fetchImpl }));
    expect(result.kind).toBe("transient");
  });

  it("transient — network error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const result = await refreshDropboxAccessToken(defaultInput({ fetchImpl }));

    expect(result.kind).toBe("transient");
    if (result.kind === "transient") {
      expect(result.reason).toMatch(/network_error.*ECONNREFUSED/);
    }
  });

  it("invalid — unparseable body", async () => {
    const fetchImpl = makeFetchMock(
      new Response("not json", { status: 400 }),
    );
    const result = await refreshDropboxAccessToken(defaultInput({ fetchImpl }));
    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.reason).toMatch(/unparseable_body/);
    }
  });
});
