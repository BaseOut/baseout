import { describe, expect, it, vi } from "vitest";
import { refreshAirtableAccessToken } from "../../src/lib/airtable-refresh";

const NOW = 1_800_000_000_000;

function makeFetchMock(response: Response): typeof fetch {
  return vi.fn(async () => response) as unknown as typeof fetch;
}

function defaultInput(
  overrides: Partial<Parameters<typeof refreshAirtableAccessToken>[0]> = {},
) {
  return {
    refreshToken: "refresh-old",
    clientId: "client-id",
    clientSecret: "client-secret",
    nowMs: () => NOW,
    ...overrides,
  };
}

describe("refreshAirtableAccessToken", () => {
  it("maps 200 with rotated refresh_token to success", async () => {
    const fetchImpl = makeFetchMock(
      new Response(
        JSON.stringify({
          access_token: "access-new",
          refresh_token: "refresh-new",
          expires_in: 3600,
          scope: "data.records:read",
        }),
        { status: 200 },
      ),
    );

    await expect(
      refreshAirtableAccessToken(defaultInput({ fetchImpl })),
    ).resolves.toEqual({
      kind: "success",
      accessToken: "access-new",
      refreshToken: "refresh-new",
      expiresAtMs: NOW + 3600 * 1000,
      scope: "data.records:read",
    });
  });

  it("maps 200 without refresh_token to success preserving submitted grant", async () => {
    const fetchImpl = makeFetchMock(
      new Response(
        JSON.stringify({
          access_token: "access-new",
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    );

    await expect(
      refreshAirtableAccessToken(defaultInput({ fetchImpl })),
    ).resolves.toEqual({
      kind: "success",
      accessToken: "access-new",
      refreshToken: "refresh-old",
      expiresAtMs: NOW + 3600 * 1000,
      scope: null,
    });
  });

  it("maps invalid_grant to pending_reauth", async () => {
    const fetchImpl = makeFetchMock(
      new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "revoked",
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
      expect(result.reason).toContain("revoked");
    }
  });

  it("maps 429 and 5xx to transient", async () => {
    const rateLimited = await refreshAirtableAccessToken(
      defaultInput({
        fetchImpl: makeFetchMock(
          new Response("", { status: 429, headers: { "retry-after": "30" } }),
        ),
      }),
    );
    expect(rateLimited).toEqual({
      kind: "transient",
      reason: "http_429",
      retryAfterMs: 30_000,
    });

    await expect(
      refreshAirtableAccessToken(
        defaultInput({ fetchImpl: makeFetchMock(new Response("", { status: 503 })) }),
      ),
    ).resolves.toEqual({ kind: "transient", reason: "http_503" });
  });
});
