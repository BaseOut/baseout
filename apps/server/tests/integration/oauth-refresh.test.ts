import { describe, expect, it, vi } from "vitest";
import { runOAuthRefreshTick } from "../../src/lib/oauth-refresh";
import type {
  OAuthRefreshLogEvent,
  OAuthRefreshTickDeps,
} from "../../src/lib/oauth-refresh";
import type { RefreshOutcome } from "../../src/lib/airtable-refresh";
import { encryptToken } from "../../src/lib/crypto";
import type { AppDb } from "../../src/db/worker";

const ENC_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const AIRTABLE_PLATFORM_ID = "platform-airtable-uuid";
const CLIENT_ID = "test-client-id";
const CLIENT_SECRET = "test-client-secret";
const CONN_ID = "conn-11111111-1111-1111-1111-111111111111";
const ORG_ID = "org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FROZEN_NOW = 1_700_000_000_000;

interface ScriptedResponse {
  rows: unknown[];
}

function makeFakeDb(scripted: ScriptedResponse[]): {
  db: AppDb;
  calls: string[];
} {
  const calls: string[] = [];
  let cursor = 0;
  const execute = vi.fn(async (q: unknown) => {
    calls.push(String(q));
    const next = scripted[cursor];
    cursor += 1;
    if (!next) {
      throw new Error(
        `fake db.execute call ${cursor} but only ${scripted.length} scripted`,
      );
    }
    return next.rows;
  });
  return { db: { execute } as unknown as AppDb, calls };
}

function defaultDeps(
  overrides: Partial<OAuthRefreshTickDeps> = {},
): OAuthRefreshTickDeps {
  return {
    db: {} as AppDb,
    encryptionKey: ENC_KEY,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    nowMs: () => FROZEN_NOW,
    ...overrides,
  };
}

const selectedRow = {
  id: CONN_ID,
  organization_id: ORG_ID,
  status: "active",
  refresh_token_enc: "cipher",
  token_expires_at: new Date(FROZEN_NOW + 5 * 60_000),
  scopes: "data.records:read",
  platform_config: {},
};

describe("runOAuthRefreshTick (hardened)", () => {
  it("bails when airtable platform is not seeded", async () => {
    const { db } = makeFakeDb([{ rows: [] }]);
    const logs: OAuthRefreshLogEvent[] = [];
    const result = await runOAuthRefreshTick(
      defaultDeps({
        db,
        log: (e) => logs.push(e),
      }),
    );
    expect(result.considered).toBe(0);
    expect(logs[0]?.outcome).toBe("unexpected_error");
  });

  it("success — persists new tokens and keeps status active", async () => {
    const refreshEnc = await encryptToken("refresh-plain", ENC_KEY);
    const row = { ...selectedRow, refresh_token_enc: refreshEnc };
    const claimedAt = new Date("2026-01-01T00:00:00.000Z");
    const { db } = makeFakeDb([
      { rows: [{ id: AIRTABLE_PLATFORM_ID }] },
      { rows: [row] },
      { rows: [{ id: CONN_ID, status: "active", modified_at: claimedAt }] },
      { rows: [{ id: CONN_ID }] },
    ]);
    const refresh = vi.fn(
      async (): Promise<RefreshOutcome> => ({
        kind: "success",
        accessToken: "new-access",
        refreshToken: "new-refresh",
        expiresAtMs: FROZEN_NOW + 3_600_000,
        scope: "data.records:read",
      }),
    );
    const result = await runOAuthRefreshTick(defaultDeps({ db, refresh }));
    expect(result.claimed).toBe(1);
    expect(result.outcomes.success).toBe(1);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("pending_reauth on invalid_grant — never writes status invalid", async () => {
    const refreshEnc = await encryptToken("refresh-plain", ENC_KEY);
    const row = { ...selectedRow, refresh_token_enc: refreshEnc };
    const claimedAt = new Date("2026-01-01T00:00:00.000Z");
    const { db } = makeFakeDb([
      { rows: [{ id: AIRTABLE_PLATFORM_ID }] },
      { rows: [row] },
      { rows: [{ id: CONN_ID, status: "active", modified_at: claimedAt }] },
      { rows: [] },
    ]);
    const refresh = vi.fn(
      async (): Promise<RefreshOutcome> => ({
        kind: "pending_reauth",
        reason: "invalid_grant: Invalid token.",
      }),
    );
    const result = await runOAuthRefreshTick(defaultDeps({ db, refresh }));
    expect(result.outcomes.pending_reauth).toBe(1);
    expect(result.outcomes).not.toHaveProperty("invalid");
  });

  it("decrypt failure → pending_reauth not invalid", async () => {
    const row = { ...selectedRow, refresh_token_enc: "not-valid-cipher" };
    const claimedAt = new Date("2026-01-01T00:00:00.000Z");
    const { db } = makeFakeDb([
      { rows: [{ id: AIRTABLE_PLATFORM_ID }] },
      { rows: [row] },
      { rows: [{ id: CONN_ID, status: "active", modified_at: claimedAt }] },
      { rows: [] },
    ]);
    const result = await runOAuthRefreshTick(defaultDeps({ db }));
    expect(result.outcomes.decrypt_failed).toBe(1);
    expect(result.outcomes.pending_reauth).toBe(0);
  });

  it("dedupes to one row per organization_id", async () => {
    const refreshEnc = await encryptToken("refresh-plain", ENC_KEY);
    const rowA = { ...selectedRow, id: "conn-a", refresh_token_enc: refreshEnc };
    const rowB = {
      ...selectedRow,
      id: "conn-b",
      organization_id: ORG_ID,
      refresh_token_enc: refreshEnc,
    };
    const claimedAt = new Date("2026-01-01T00:00:00.000Z");
    const refresh = vi.fn(
      async (): Promise<RefreshOutcome> => ({
        kind: "success",
        accessToken: "a",
        refreshToken: "r",
        expiresAtMs: FROZEN_NOW + 3_600_000,
        scope: null,
      }),
    );
    const { db } = makeFakeDb([
      { rows: [{ id: AIRTABLE_PLATFORM_ID }] },
      { rows: [rowA, rowB] },
      { rows: [{ id: "conn-a", status: "active", modified_at: claimedAt }] },
      { rows: [{ id: "conn-a" }] },
    ]);
    const result = await runOAuthRefreshTick(defaultDeps({ db, refresh }));
    expect(result.considered).toBe(1);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("cas miss after success — id-only persist", async () => {
    const refreshEnc = await encryptToken("refresh-plain", ENC_KEY);
    const row = { ...selectedRow, refresh_token_enc: refreshEnc };
    const claimedAt = new Date("2026-01-01T00:00:00.000Z");
    const { db } = makeFakeDb([
      { rows: [{ id: AIRTABLE_PLATFORM_ID }] },
      { rows: [row] },
      { rows: [{ id: CONN_ID, status: "active", modified_at: claimedAt }] },
      { rows: [] },
      { rows: [{ id: CONN_ID }] },
    ]);
    const refresh = vi.fn(
      async (): Promise<RefreshOutcome> => ({
        kind: "success",
        accessToken: "new-access",
        refreshToken: "new-refresh",
        expiresAtMs: FROZEN_NOW + 3_600_000,
        scope: null,
      }),
    );
    const result = await runOAuthRefreshTick(defaultDeps({ db, refresh }));
    expect(result.outcomes.persist_after_cas_miss).toBe(1);
  });

  it("persist failure after rotation — pending_reauth not stale active", async () => {
    const refreshEnc = await encryptToken("refresh-plain", ENC_KEY);
    const row = { ...selectedRow, refresh_token_enc: refreshEnc };
    const claimedAt = new Date("2026-01-01T00:00:00.000Z");
    const persistFailures = Array.from({ length: 8 }, () => ({ rows: [] as unknown[] }));
    const { db } = makeFakeDb([
      { rows: [{ id: AIRTABLE_PLATFORM_ID }] },
      { rows: [row] },
      { rows: [{ id: CONN_ID, status: "active", modified_at: claimedAt }] },
      ...persistFailures,
      { rows: [] },
    ]);
    const refresh = vi.fn(
      async (): Promise<RefreshOutcome> => ({
        kind: "success",
        accessToken: "new-access",
        refreshToken: "new-refresh",
        expiresAtMs: FROZEN_NOW + 3_600_000,
        scope: null,
      }),
    );
    const result = await runOAuthRefreshTick(defaultDeps({ db, refresh }));
    expect(result.outcomes.cas_lost).toBe(1);
    expect(refresh).toHaveBeenCalledOnce();
  });
});
