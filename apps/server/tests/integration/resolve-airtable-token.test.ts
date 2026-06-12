import { describe, expect, it, vi } from "vitest";
import {
  resolveAirtableToken,
  type AirtableTokenConnection,
  type ResolveAirtableTokenDeps,
} from "../../src/lib/connections/resolve-airtable-token";

const NOW = new Date("2026-06-12T12:00:00.000Z");
const CONNECTION_ID = "conn-airtable-1";
const CLAIM_ID = "claim-1";

function makeConnection(
  overrides: Partial<AirtableTokenConnection> = {},
): AirtableTokenConnection {
  return {
    id: CONNECTION_ID,
    status: "active",
    accessTokenEnc: "access-old-enc",
    refreshTokenEnc: "refresh-old-enc",
    tokenExpiresAt: new Date(NOW.getTime() + 60 * 60_000),
    scopes: "data.records:read schema.bases:read",
    oauthRefreshClaimId: null,
    oauthRefreshClaimedAt: null,
    ...overrides,
  };
}

function makeDeps(
  connection: AirtableTokenConnection,
  overrides: Partial<ResolveAirtableTokenDeps> = {},
): ResolveAirtableTokenDeps {
  return {
    now: () => NOW,
    newClaimId: () => CLAIM_ID,
    fetchConnection: vi.fn(async () => connection),
    decrypt: vi.fn(async (cipher: string) => `plain:${cipher}`),
    encrypt: vi.fn(async (plain: string) => `enc:${plain}`),
    claimRefresh: vi.fn(async () => connection),
    persistRefreshSuccess: vi.fn(async () => true),
    markPendingReauth: vi.fn(async () => undefined),
    clearRefreshClaim: vi.fn(async () => undefined),
    observeConnection: vi.fn(async () => connection),
    refresh: vi.fn(async () => ({
      kind: "success",
      accessToken: "access-new",
      refreshToken: "refresh-new",
      expiresAtMs: NOW.getTime() + 60 * 60_000,
      scope: "data.records:read",
    })),
    log: vi.fn(),
    ...overrides,
  };
}

describe("resolveAirtableToken", () => {
  it("feature flag off preserves decrypt-only behavior", async () => {
    const connection = makeConnection({
      tokenExpiresAt: new Date(NOW.getTime() - 60_000),
    });
    const deps = makeDeps(connection);

    const result = await resolveAirtableToken(
      { connectionId: CONNECTION_ID, refreshEnabled: false },
      deps,
    );

    expect(result).toEqual({
      ok: true,
      accessToken: "plain:access-old-enc",
      refreshed: false,
    });
    expect(deps.refresh).not.toHaveBeenCalled();
    expect(deps.claimRefresh).not.toHaveBeenCalled();
    expect(deps.persistRefreshSuccess).not.toHaveBeenCalled();
  });

  it("fresh active token decrypts without refreshing", async () => {
    const connection = makeConnection({
      tokenExpiresAt: new Date(NOW.getTime() + 30 * 60_000),
    });
    const deps = makeDeps(connection);

    const result = await resolveAirtableToken(
      { connectionId: CONNECTION_ID, refreshEnabled: true },
      deps,
    );

    expect(result).toEqual({
      ok: true,
      accessToken: "plain:access-old-enc",
      refreshed: false,
    });
    expect(deps.refresh).not.toHaveBeenCalled();
    expect(deps.claimRefresh).not.toHaveBeenCalled();
  });

  it("expired token claims, refreshes, persists rotated tokens, and returns new access token", async () => {
    const connection = makeConnection({
      tokenExpiresAt: new Date(NOW.getTime() - 60_000),
    });
    const deps = makeDeps(connection);

    const result = await resolveAirtableToken(
      { connectionId: CONNECTION_ID, refreshEnabled: true },
      deps,
    );

    expect(result).toEqual({
      ok: true,
      accessToken: "access-new",
      refreshed: true,
    });
    expect(deps.claimRefresh).toHaveBeenCalledWith({
      connectionId: CONNECTION_ID,
      claimId: CLAIM_ID,
      staleBefore: new Date(NOW.getTime() - 2 * 60_000),
    });
    expect(deps.refresh).toHaveBeenCalledWith({ refreshToken: "plain:refresh-old-enc" });
    expect(deps.persistRefreshSuccess).toHaveBeenCalledWith({
      connectionId: CONNECTION_ID,
      claimId: CLAIM_ID,
      accessTokenEnc: "enc:access-new",
      refreshTokenEnc: "enc:refresh-new",
      tokenExpiresAt: new Date(NOW.getTime() + 60 * 60_000),
      scopes: "data.records:read",
    });
  });

  it("claim conflict does not call Airtable", async () => {
    const connection = makeConnection({
      tokenExpiresAt: new Date(NOW.getTime() - 60_000),
    });
    const deps = makeDeps(connection, {
      claimRefresh: vi.fn(async () => null),
    });

    const result = await resolveAirtableToken(
      { connectionId: CONNECTION_ID, refreshEnabled: true },
      deps,
    );

    expect(result).toEqual({ ok: false, error: "refresh_claim_unavailable" });
    expect(deps.refresh).not.toHaveBeenCalled();
  });

  it("invalid_grant marks pending_reauth, not invalid", async () => {
    const connection = makeConnection({
      tokenExpiresAt: new Date(NOW.getTime() - 60_000),
    });
    const deps = makeDeps(connection, {
      refresh: vi.fn(async () => ({
        kind: "pending_reauth",
        reason: "invalid_grant: revoked",
      })),
    });

    const result = await resolveAirtableToken(
      { connectionId: CONNECTION_ID, refreshEnabled: true },
      deps,
    );

    expect(result).toEqual({
      ok: false,
      error: "reauth_required",
      reason: "invalid_grant: revoked",
    });
    expect(deps.markPendingReauth).toHaveBeenCalledWith({
      connectionId: CONNECTION_ID,
      claimId: CLAIM_ID,
      reason: "invalid_grant: revoked",
    });
  });

  it("persist miss after Airtable success returns persist_failed and does not refresh again", async () => {
    const connection = makeConnection({
      tokenExpiresAt: new Date(NOW.getTime() - 60_000),
    });
    const observed = makeConnection({ oauthRefreshClaimId: "other-claim" });
    const deps = makeDeps(connection, {
      persistRefreshSuccess: vi.fn(async () => false),
      observeConnection: vi.fn(async () => observed),
    });

    const result = await resolveAirtableToken(
      { connectionId: CONNECTION_ID, refreshEnabled: true },
      deps,
    );

    expect(result).toEqual({ ok: false, error: "persist_failed" });
    expect(deps.refresh).toHaveBeenCalledTimes(1);
    expect(deps.log).toHaveBeenCalledWith({
      event: "airtable_token_refresh_persist_failed",
      connectionId: CONNECTION_ID,
      claimId: CLAIM_ID,
      observedClaimId: "other-claim",
      observedStatus: "active",
    });
  });
});
