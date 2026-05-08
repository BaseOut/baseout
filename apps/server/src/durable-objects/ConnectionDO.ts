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

const LOCK_TTL_MS = 60_000;
const TOKEN_CACHE_TTL_MS = 5 * 60_000;

interface TokenCacheEntry {
  accessToken: string;
  expiresAt: number;
}

export class ConnectionDO {
  private locked = false;
  private decryptImpl: typeof decryptToken = decryptToken;
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

  private async getToken(request: Request): Promise<Response> {
    let body: { encryptedToken?: unknown };
    try {
      body = (await request.json()) as { encryptedToken?: unknown };
    } catch {
      return new Response(JSON.stringify({ error: "invalid_body" }), {
        status: 400,
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
