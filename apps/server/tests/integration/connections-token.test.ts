import { describe, expect, it, vi } from "vitest";
import type { AppDb } from "../../src/db/worker";
import { connections } from "../../src/db/schema";
import {
  AIRTABLE_TOKEN_REFRESH_LEEWAY_MS,
  resolveAirtableConnectionToken,
} from "../../src/lib/connections/resolve-airtable-token";
import type { RefreshOutcome } from "../../src/lib/airtable-refresh";
import { encryptToken } from "../../src/lib/crypto";

const ENC_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const CLIENT_ID = "test-client-id";
const CLIENT_SECRET = "test-client-secret";
const CONN_ID = "conn-11111111-1111-1111-1111-111111111111";
const FROZEN = new Date("2026-06-01T12:00:00.000Z");
const FROZEN_MS = FROZEN.getTime();

function makeDb(row: typeof connections.$inferSelect | null): AppDb {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => (row ? [row] : [])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
  } as unknown as AppDb;
}

function baseRow(
  overrides: Partial<typeof connections.$inferSelect> = {},
): typeof connections.$inferSelect {
  return {
    id: CONN_ID,
    organizationId: "org-1",
    platformId: "platform-1",
    status: "active",
    accessTokenEnc: "access-cipher",
    refreshTokenEnc: "refresh-cipher",
    tokenExpiresAt: new Date(FROZEN_MS + 60 * 60_000),
    scopes: "data.records:read",
    platformConfig: {},
    invalidatedAt: null,
    modifiedAt: FROZEN,
    createdAt: FROZEN,
    ...overrides,
  };
}

describe("resolveAirtableConnectionToken", () => {
  it("returns decrypted access token when not near expiry", async () => {
    const accessEnc = await encryptToken("access-plain", ENC_KEY);
    const db = makeDb(baseRow({ accessTokenEnc: accessEnc }));
    const result = await resolveAirtableConnectionToken(db, {
      connectionId: CONN_ID,
      forceRefresh: false,
      encryptionKey: ENC_KEY,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      now: () => FROZEN,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.accessToken).toBe("access-plain");
  });

  it("refreshes when token expires within leeway window", async () => {
    const refreshEnc = await encryptToken("refresh-plain", ENC_KEY);
    const db = makeDb(
      baseRow({
        refreshTokenEnc: refreshEnc,
        tokenExpiresAt: new Date(
          FROZEN_MS + AIRTABLE_TOKEN_REFRESH_LEEWAY_MS - 60_000,
        ),
      }),
    );
    const refresh = vi.fn(
      async (): Promise<RefreshOutcome> => ({
        kind: "success",
        accessToken: "new-access",
        refreshToken: "new-refresh",
        expiresAtMs: FROZEN_MS + 3_600_000,
        scope: "data.records:read",
      }),
    );
    const result = await resolveAirtableConnectionToken(db, {
      connectionId: CONN_ID,
      forceRefresh: false,
      encryptionKey: ENC_KEY,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      now: () => FROZEN,
      refresh,
    });
    expect(refresh).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.accessToken).toBe("new-access");
    expect(db.update).toHaveBeenCalled();
  });

  it("forceRefresh bypasses expiry check", async () => {
    const refreshEnc = await encryptToken("refresh-plain", ENC_KEY);
    const db = makeDb(
      baseRow({
        refreshTokenEnc: refreshEnc,
        tokenExpiresAt: new Date(FROZEN_MS + 60 * 60_000),
      }),
    );
    const refresh = vi.fn(
      async (): Promise<RefreshOutcome> => ({
        kind: "success",
        accessToken: "forced-access",
        refreshToken: "forced-refresh",
        expiresAtMs: FROZEN_MS + 3_600_000,
        scope: null,
      }),
    );
    const result = await resolveAirtableConnectionToken(db, {
      connectionId: CONN_ID,
      forceRefresh: true,
      encryptionKey: ENC_KEY,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      now: () => FROZEN,
      refresh,
    });
    expect(refresh).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.accessToken).toBe("forced-access");
  });

  it("maps invalid_grant to pending_reauth and updates status", async () => {
    const refreshEnc = await encryptToken("refresh-plain", ENC_KEY);
    const db = makeDb(
      baseRow({
        refreshTokenEnc: refreshEnc,
        tokenExpiresAt: new Date(FROZEN_MS - 60_000),
      }),
    );
    const refresh = vi.fn(
      async (): Promise<RefreshOutcome> => ({
        kind: "pending_reauth",
        reason: "invalid_grant: Invalid token.",
      }),
    );
    const result = await resolveAirtableConnectionToken(db, {
      connectionId: CONN_ID,
      forceRefresh: false,
      encryptionKey: ENC_KEY,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      now: () => FROZEN,
      refresh,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("pending_reauth");
    expect(db.update).toHaveBeenCalled();
  });

  it("returns connection_not_found when row is missing", async () => {
    const db = makeDb(null);
    const result = await resolveAirtableConnectionToken(db, {
      connectionId: CONN_ID,
      forceRefresh: false,
      encryptionKey: ENC_KEY,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      now: () => FROZEN,
    });
    expect(result).toEqual({ ok: false, error: "connection_not_found" });
  });
});
