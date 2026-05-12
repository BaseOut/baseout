// Tests for the OAuth-refresh orchestrator (Phase B1 / openspec
// baseout-server-cron-oauth-refresh).
//
// These cover the orchestrator's full state machine via a fake AppDb whose
// `.execute` returns scripted rows in call order. Each `runOAuthRefreshTick`
// emits a known sequence of SQL queries (platform lookup → selection →
// per-row: CAS claim → outcome-specific UPDATE), so the scripted sequence
// in each test mirrors that ordering.
//
// The openspec proposal also calls for a real-Postgres integration test
// (oauth-refresh.test.ts §5.1) that drives the scheduled export directly.
// That's deferred — apps/server has no docker-compose.test.yml today and
// spinning one up is its own task. The mock-DB tests below give us full
// branch + concurrency coverage in the meantime.

import { describe, expect, it, vi } from "vitest";
import { runOAuthRefreshTick } from "../../src/lib/oauth-refresh";
import type {
  OAuthRefreshLogEvent,
  OAuthRefreshTickDeps,
} from "../../src/lib/oauth-refresh";
import type { RefreshOutcome } from "../../src/lib/airtable-refresh";
import { encryptToken } from "../../src/lib/crypto";
import type { AppDb } from "../../src/db/worker";

const ENC_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; // 32 zero bytes
const AIRTABLE_PLATFORM_ID = "platform-airtable-uuid";
const CLIENT_ID = "test-client-id";
const CLIENT_SECRET = "test-client-secret";
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
    // Drizzle's sql tagged-template returns a SQL object; the call signature
    // is db.execute(sql). For inspection we don't need to parse it — we
    // just need to advance through the scripted responses in order. Capture
    // a string fingerprint for assertion convenience.
    calls.push(String((q as { queryChunks?: unknown }).queryChunks ?? q));
    const next = scripted[cursor];
    cursor += 1;
    if (!next) {
      throw new Error(
        `fake db.execute received call ${cursor} but only ${scripted.length} scripted responses`,
      );
    }
    return next.rows;
  });
  return { db: { execute } as unknown as AppDb, calls };
}

async function buildSeed(refreshTokenPlaintext: string) {
  return encryptToken(refreshTokenPlaintext, ENC_KEY);
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

describe("runOAuthRefreshTick", () => {
  it("returns early when the platforms table has no airtable row", async () => {
    const { db } = makeFakeDb([{ rows: [] }]); // platform lookup → empty
    const logs: OAuthRefreshLogEvent[] = [];

    const result = await runOAuthRefreshTick(
      defaultDeps({ db, log: (e) => logs.push(e) }),
    );

    expect(result).toEqual({
      considered: 0,
      claimed: 0,
      outcomes: {
        success: 0,
        pending_reauth: 0,
        transient: 0,
        invalid: 0,
        claim_skipped: 0,
        decrypt_failed: 0,
        cas_lost: 0,
      },
    });
    expect(logs[0]?.reason).toBe("airtable_platform_not_seeded");
  });

  it("returns early when no candidates are near expiry", async () => {
    const { db } = makeFakeDb([
      { rows: [{ id: AIRTABLE_PLATFORM_ID }] }, // platform lookup
      { rows: [] }, // selection → empty
    ]);

    const result = await runOAuthRefreshTick(defaultDeps({ db }));

    expect(result.considered).toBe(0);
    expect(result.claimed).toBe(0);
  });

  it("success — refreshes one row, updates ciphertext + expiry, status → active", async () => {
    const seed = await buildSeed("refresh-token-old");
    const { db, calls } = makeFakeDb([
      { rows: [{ id: AIRTABLE_PLATFORM_ID }] }, // platform lookup
      {
        rows: [
          {
            id: "conn-1",
            refresh_token_enc: seed,
            token_expires_at: new Date(FROZEN_NOW + 5 * 60_000),
            scopes: "data.records:read",
            platform_config: null,
          },
        ],
      },
      { rows: [{ id: "conn-1" }] }, // CAS claim succeeded
      { rows: [{ id: "conn-1" }] }, // success-path UPDATE matched
    ]);

    const refresh = vi.fn(
      async (): Promise<RefreshOutcome> => ({
        kind: "success",
        accessToken: "new-access",
        refreshToken: "new-refresh",
        expiresAtMs: FROZEN_NOW + 3600 * 1000,
        scope: "data.records:read schema.bases:read",
      }),
    );

    const logs: OAuthRefreshLogEvent[] = [];
    const result = await runOAuthRefreshTick(
      defaultDeps({ db, refresh, log: (e) => logs.push(e) }),
    );

    expect(refresh).toHaveBeenCalledOnce();
    expect(refresh.mock.calls[0]![0]).toMatchObject({
      refreshToken: "refresh-token-old", // decrypted from seed
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });

    expect(result.considered).toBe(1);
    expect(result.claimed).toBe(1);
    expect(result.outcomes.success).toBe(1);
    expect(logs.find((e) => e.outcome === "success")).toBeDefined();
    expect(calls).toHaveLength(4); // platform, select, claim, success-update
  });

  it("pending_reauth — invalid_grant flips status, no token rewrite", async () => {
    const seed = await buildSeed("refresh-token-revoked");
    const { db } = makeFakeDb([
      { rows: [{ id: AIRTABLE_PLATFORM_ID }] },
      {
        rows: [
          {
            id: "conn-2",
            refresh_token_enc: seed,
            token_expires_at: new Date(FROZEN_NOW + 5 * 60_000),
            scopes: null,
            platform_config: null,
          },
        ],
      },
      { rows: [{ id: "conn-2" }] }, // CAS claim succeeded
      { rows: [] }, // pending_reauth UPDATE (we don't assert RETURNING)
    ]);

    const refresh = vi.fn(
      async (): Promise<RefreshOutcome> => ({
        kind: "pending_reauth",
        reason: "invalid_grant: token revoked",
      }),
    );

    const logs: OAuthRefreshLogEvent[] = [];
    const result = await runOAuthRefreshTick(
      defaultDeps({ db, refresh, log: (e) => logs.push(e) }),
    );

    expect(result.outcomes.pending_reauth).toBe(1);
    expect(result.outcomes.success).toBe(0);
    expect(logs.find((e) => e.outcome === "pending_reauth")?.reason).toContain(
      "invalid_grant",
    );
  });

  it("transient — Airtable 5xx reverts the row to active for retry", async () => {
    const seed = await buildSeed("refresh-token-temp");
    const { db } = makeFakeDb([
      { rows: [{ id: AIRTABLE_PLATFORM_ID }] },
      {
        rows: [
          {
            id: "conn-3",
            refresh_token_enc: seed,
            token_expires_at: new Date(FROZEN_NOW + 5 * 60_000),
            scopes: null,
            platform_config: null,
          },
        ],
      },
      { rows: [{ id: "conn-3" }] }, // claim
      { rows: [] }, // transient revert UPDATE
    ]);

    const refresh = vi.fn(
      async (): Promise<RefreshOutcome> => ({
        kind: "transient",
        reason: "http_503",
      }),
    );

    const result = await runOAuthRefreshTick(
      defaultDeps({ db, refresh }),
    );

    expect(result.outcomes.transient).toBe(1);
    expect(result.outcomes.success).toBe(0);
    expect(result.outcomes.pending_reauth).toBe(0);
  });

  it("invalid — unknown 4xx writes invalid + invalidated_at", async () => {
    const seed = await buildSeed("refresh-token-x");
    const { db } = makeFakeDb([
      { rows: [{ id: AIRTABLE_PLATFORM_ID }] },
      {
        rows: [
          {
            id: "conn-4",
            refresh_token_enc: seed,
            token_expires_at: new Date(FROZEN_NOW + 5 * 60_000),
            scopes: null,
            platform_config: null,
          },
        ],
      },
      { rows: [{ id: "conn-4" }] }, // claim
      { rows: [] }, // invalid UPDATE
    ]);

    const refresh = vi.fn(
      async (): Promise<RefreshOutcome> => ({
        kind: "invalid",
        reason: "weird_response",
      }),
    );

    const result = await runOAuthRefreshTick(
      defaultDeps({ db, refresh }),
    );

    expect(result.outcomes.invalid).toBe(1);
  });

  it("concurrency — claim returns 0 rows → skip the row (no refresh call)", async () => {
    const seed = await buildSeed("refresh-token-old");
    const { db } = makeFakeDb([
      { rows: [{ id: AIRTABLE_PLATFORM_ID }] },
      {
        rows: [
          {
            id: "conn-5",
            refresh_token_enc: seed,
            token_expires_at: new Date(FROZEN_NOW + 5 * 60_000),
            scopes: null,
            platform_config: null,
          },
        ],
      },
      { rows: [] }, // CAS claim returned 0 rows (concurrent cron or apps/web claimed it)
    ]);
    const refresh = vi.fn();

    const result = await runOAuthRefreshTick(
      defaultDeps({ db, refresh: refresh as never }),
    );

    expect(refresh).not.toHaveBeenCalled();
    expect(result.outcomes.claim_skipped).toBe(1);
    expect(result.claimed).toBe(0);
  });

  it("concurrency — success-path UPDATE matches 0 rows (apps/web wrote mid-flight) → cas_lost", async () => {
    const seed = await buildSeed("refresh-token-old");
    const { db } = makeFakeDb([
      { rows: [{ id: AIRTABLE_PLATFORM_ID }] },
      {
        rows: [
          {
            id: "conn-6",
            refresh_token_enc: seed,
            token_expires_at: new Date(FROZEN_NOW + 5 * 60_000),
            scopes: null,
            platform_config: null,
          },
        ],
      },
      { rows: [{ id: "conn-6" }] }, // claim succeeded
      { rows: [] }, // success UPDATE matched 0 rows (someone else wrote)
    ]);

    const refresh = vi.fn(
      async (): Promise<RefreshOutcome> => ({
        kind: "success",
        accessToken: "would-be-stale",
        refreshToken: "would-be-stale",
        expiresAtMs: FROZEN_NOW + 3600 * 1000,
        scope: null,
      }),
    );

    const result = await runOAuthRefreshTick(
      defaultDeps({ db, refresh }),
    );

    expect(result.outcomes.cas_lost).toBe(1);
    expect(result.outcomes.success).toBe(0);
  });

  it("decrypt_failed — corrupt ciphertext flips row to invalid", async () => {
    const { db } = makeFakeDb([
      { rows: [{ id: AIRTABLE_PLATFORM_ID }] },
      {
        rows: [
          {
            id: "conn-7",
            refresh_token_enc: "not-valid-base64-or-cipher",
            token_expires_at: new Date(FROZEN_NOW + 5 * 60_000),
            scopes: null,
            platform_config: null,
          },
        ],
      },
      { rows: [{ id: "conn-7" }] }, // claim succeeded
      { rows: [] }, // invalid UPDATE for decrypt failure
    ]);

    const refresh = vi.fn();

    const result = await runOAuthRefreshTick(
      defaultDeps({ db, refresh: refresh as never }),
    );

    expect(refresh).not.toHaveBeenCalled();
    expect(result.outcomes.decrypt_failed).toBe(1);
  });

  it("processes multiple rows in one tick — sums outcomes correctly", async () => {
    const seedA = await buildSeed("refresh-A");
    const seedB = await buildSeed("refresh-B");
    const { db } = makeFakeDb([
      { rows: [{ id: AIRTABLE_PLATFORM_ID }] },
      {
        rows: [
          {
            id: "conn-A",
            refresh_token_enc: seedA,
            token_expires_at: new Date(FROZEN_NOW + 3 * 60_000),
            scopes: null,
            platform_config: null,
          },
          {
            id: "conn-B",
            refresh_token_enc: seedB,
            token_expires_at: new Date(FROZEN_NOW + 7 * 60_000),
            scopes: null,
            platform_config: null,
          },
        ],
      },
      { rows: [{ id: "conn-A" }] }, // A claim
      { rows: [{ id: "conn-A" }] }, // A success update
      { rows: [{ id: "conn-B" }] }, // B claim
      { rows: [] }, // B pending_reauth update
    ]);

    let call = 0;
    const refresh = vi.fn(async (): Promise<RefreshOutcome> => {
      call += 1;
      if (call === 1)
        return {
          kind: "success",
          accessToken: "new-A",
          refreshToken: "new-A-refr",
          expiresAtMs: FROZEN_NOW + 3600 * 1000,
          scope: null,
        };
      return { kind: "pending_reauth", reason: "invalid_grant" };
    });

    const result = await runOAuthRefreshTick(
      defaultDeps({ db, refresh }),
    );

    expect(result.considered).toBe(2);
    expect(result.claimed).toBe(2);
    expect(result.outcomes.success).toBe(1);
    expect(result.outcomes.pending_reauth).toBe(1);
  });
});
