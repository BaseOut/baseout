// ConnectionDO — per-Airtable-Connection rate-limit gateway + lock holder
// + token cache.
//
// The Trigger.dev backup-base task acquires a lock here before reading from
// Airtable, so two backup runs across two Spaces sharing one Connection
// serialize at the DO and don't blow Airtable's per-account quota. The DO
// is also the canonical decrypt site for the per-Connection OAuth access
// token: it caches plaintext keyed by ciphertext bytes so repeat reads
// during a backup run skip the AES round-trip.
//
// Lock semantics (Phase 6 of the Backups MVP plan):
// - In-memory `locked` flag. DOs serialize input by default; a fetch handler
//   runs to completion before the next starts. blockConcurrencyWhile wraps
//   the check-and-set + alarm-schedule so the DO yields to no other fetch
//   (or alarm) mid-critical-section, even when storage I/O awaits.
// - Alarm-driven 60s safety net: if a lock-holder crashes without /unlock,
//   the alarm clears the flag so the next caller can proceed.
//
// Token cache:
// - Map<encryptedToken, { accessToken, expiresAt }>. TTL bounds staleness
//   if the access token is rotated upstream.
// - Decrypt is injected via setDecryptImplForTests for the call-count assertion
//   in connection-do-token-cache.test.ts; production uses lib/crypto.

import { decryptToken } from "../lib/crypto";
import type { Env } from "../env";
import { createMasterDb } from "../db/worker";
import { connections } from "../db/schema";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import {
  resolveAirtableToken,
  type ResolveAirtableTokenResult,
} from "../lib/connections/resolve-airtable-token";
import { refreshAirtableAccessToken } from "../lib/airtable-refresh";
import { encryptToken } from "../lib/crypto";

const LOCK_TTL_MS = 60_000;
const TOKEN_CACHE_TTL_MS = 5 * 60_000;

interface TokenCacheEntry {
  accessToken: string;
  expiresAt: number;
}

type ResolveAirtableTokenForDO = (input: {
  connectionId: string;
}) => Promise<ResolveAirtableTokenResult>;

export class ConnectionDO {
  private locked = false;
  private decryptImpl: typeof decryptToken = decryptToken;
  private resolveAirtableTokenImpl: ResolveAirtableTokenForDO | null = null;
  private onDemandRefreshEnabledForTests: boolean | null = null;
  private tokenCache = new Map<string, TokenCacheEntry>();

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST") {
      if (url.pathname === "/lock") return this.tryLock();
      if (url.pathname === "/unlock") return this.unlockNow();
      if (url.pathname === "/token") return this.getToken(request);
    }

    // PoC smoke shape preserved for /api/internal/__do-smoke binding probe.
    return new Response(
      JSON.stringify({ do: "ConnectionDO", id: this.state.id.toString() }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  async alarm(): Promise<void> {
    this.locked = false;
  }

  // Test-only seam — production never calls this. Reached via runInDurableObject
  // from cloudflare:test (the binding API only exposes .fetch).
  setDecryptImplForTests(fn: typeof decryptToken): void {
    this.decryptImpl = fn;
  }

  setResolveAirtableTokenImplForTests(fn: ResolveAirtableTokenForDO): void {
    this.resolveAirtableTokenImpl = fn;
  }

  setOnDemandRefreshEnabledForTests(enabled: boolean): void {
    this.onDemandRefreshEnabledForTests = enabled;
  }

  private async resolveAirtableTokenFromDb(input: {
    connectionId: string;
  }): Promise<ResolveAirtableTokenResult> {
    const clientId = this.env.AIRTABLE_OAUTH_CLIENT_ID;
    const clientSecret = this.env.AIRTABLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return {
        ok: false,
        error: "refresh_invalid",
        reason: "missing_airtable_oauth_config",
      };
    }

    const master = createMasterDb(this.env);
    try {
      return await resolveAirtableToken(
        { connectionId: input.connectionId, refreshEnabled: true },
        {
          now: () => new Date(),
          newClaimId: () => crypto.randomUUID(),
          fetchConnection: async (connectionId) => {
            const rows = await master.db
              .select()
              .from(connections)
              .where(eq(connections.id, connectionId))
              .limit(1);
            return rows[0] ?? null;
          },
          decrypt: (ciphertext) =>
            this.decryptImpl(ciphertext, this.env.BASEOUT_ENCRYPTION_KEY),
          encrypt: (plaintext) =>
            encryptToken(plaintext, this.env.BASEOUT_ENCRYPTION_KEY),
          claimRefresh: async ({ connectionId, claimId, staleBefore }) => {
            const claimedAt = new Date();
            const rows = await master.db
              .update(connections)
              .set({
                oauthRefreshClaimId: claimId,
                oauthRefreshClaimedAt: claimedAt,
                oauthRefreshLastError: null,
                modifiedAt: claimedAt,
              })
              .where(
                and(
                  eq(connections.id, connectionId),
                  eq(connections.status, "active"),
                  or(
                    isNull(connections.oauthRefreshClaimId),
                    lt(connections.oauthRefreshClaimedAt, staleBefore),
                  ),
                ),
              )
              .returning();
            return rows[0] ?? null;
          },
          persistRefreshSuccess: async ({
            connectionId,
            claimId,
            accessTokenEnc,
            refreshTokenEnc,
            tokenExpiresAt,
            scopes,
          }) => {
            const rows = await master.db
              .update(connections)
              .set({
                accessTokenEnc,
                refreshTokenEnc,
                tokenExpiresAt,
                scopes,
                oauthRefreshClaimId: null,
                oauthRefreshClaimedAt: null,
                oauthRefreshLastError: null,
                modifiedAt: new Date(),
              })
              .where(
                and(
                  eq(connections.id, connectionId),
                  eq(connections.oauthRefreshClaimId, claimId),
                ),
              )
              .returning({ id: connections.id });
            return rows.length === 1;
          },
          markPendingReauth: async ({ connectionId, claimId, reason }) => {
            await master.db
              .update(connections)
              .set({
                status: "pending_reauth",
                oauthRefreshClaimId: null,
                oauthRefreshClaimedAt: null,
                oauthRefreshLastError: reason,
                modifiedAt: new Date(),
              })
              .where(
                and(
                  eq(connections.id, connectionId),
                  eq(connections.oauthRefreshClaimId, claimId),
                ),
              );
          },
          clearRefreshClaim: async ({ connectionId, claimId, error }) => {
            await master.db
              .update(connections)
              .set({
                oauthRefreshClaimId: null,
                oauthRefreshClaimedAt: null,
                oauthRefreshLastError: error,
                modifiedAt: new Date(),
              })
              .where(
                and(
                  eq(connections.id, connectionId),
                  eq(connections.oauthRefreshClaimId, claimId),
                ),
              );
          },
          observeConnection: async (connectionId) => {
            const rows = await master.db
              .select()
              .from(connections)
              .where(eq(connections.id, connectionId))
              .limit(1);
            return rows[0] ?? null;
          },
          refresh: ({ refreshToken }) =>
            refreshAirtableAccessToken({
              refreshToken,
              clientId,
              clientSecret,
            }),
          log: (event) => {
            // eslint-disable-next-line no-console -- structured operator log
            console.log(JSON.stringify(event));
          },
        },
      );
    } finally {
      await master.sql.end({ timeout: 5 });
    }
  }

  private async tryLock(): Promise<Response> {
    return this.state.blockConcurrencyWhile(async () => {
      if (this.locked) {
        return new Response(JSON.stringify({ acquired: false }), {
          status: 409,
          headers: { "content-type": "application/json" },
        });
      }
      this.locked = true;
      await this.state.storage.setAlarm(Date.now() + LOCK_TTL_MS);
      return new Response(JSON.stringify({ acquired: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
  }

  private async unlockNow(): Promise<Response> {
    return this.state.blockConcurrencyWhile(async () => {
      this.locked = false;
      await this.state.storage.deleteAlarm();
      return new Response(JSON.stringify({ released: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
  }

  private isOnDemandRefreshEnabled(): boolean {
    if (this.onDemandRefreshEnabledForTests !== null) {
      return this.onDemandRefreshEnabledForTests;
    }
    return this.env.AIRTABLE_ON_DEMAND_REFRESH_ENABLED === "1";
  }

  private async getToken(request: Request): Promise<Response> {
    let body: { encryptedToken?: unknown; connectionId?: unknown };
    try {
      body = (await request.json()) as {
        encryptedToken?: unknown;
        connectionId?: unknown;
      };
    } catch {
      return new Response(JSON.stringify({ error: "invalid_body" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    if (this.isOnDemandRefreshEnabled()) {
      const connectionId = body.connectionId;
      if (typeof connectionId !== "string" || connectionId.length === 0) {
        return new Response(JSON.stringify({ error: "missing_connection_id" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      const resolver =
        this.resolveAirtableTokenImpl ??
        ((resolverInput) => this.resolveAirtableTokenFromDb(resolverInput));
      if (!resolver) {
        return new Response(JSON.stringify({ error: "resolver_unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      }
      const result = await resolver({ connectionId });
      if (result.ok) {
        return new Response(JSON.stringify({ accessToken: result.accessToken }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.error === "reauth_required" ? 409 : 503,
        headers: { "content-type": "application/json" },
      });
    }

    const enc = body.encryptedToken;
    if (typeof enc !== "string" || enc.length === 0) {
      return new Response(JSON.stringify({ error: "missing_encrypted_token" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const cached = this.tokenCache.get(enc);
    if (cached && cached.expiresAt > Date.now()) {
      return new Response(JSON.stringify({ accessToken: cached.accessToken }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const accessToken = await this.decryptImpl(
      enc,
      this.env.BASEOUT_ENCRYPTION_KEY,
    );
    this.tokenCache.set(enc, {
      accessToken,
      expiresAt: Date.now() + TOKEN_CACHE_TTL_MS,
    });
    return new Response(JSON.stringify({ accessToken }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
}
