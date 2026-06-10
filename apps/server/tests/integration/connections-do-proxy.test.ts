// Worker → DO HTTP proxy for the Trigger.dev backup-base task.
//
// The task runs in Node, where DurableObject bindings don't resolve. So the
// engine exposes thin HTTP routes that forward into ConnectionDO via the
// in-workerd binding:
//   POST /api/internal/connections/:connectionId/lock
//   POST /api/internal/connections/:connectionId/unlock
//   POST /api/internal/connections/:connectionId/token
//
// `connectionId` is the master-DB connections.id (UUID). idFromName(...) hashes
// it to a stable DO id, so the same Connection always lands in the same DO.
//
// These tests exercise the routing wire, not DO internals — the DO is
// covered by connection-do-lock.test.ts + connection-do-token-cache.test.ts.

import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { encryptToken } from "../../src/lib/crypto";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const TEST_ENC_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

function url(connectionId: string, action: "lock" | "unlock" | "token"): string {
  return `http://test/api/internal/connections/${connectionId}/${action}`;
}

async function post(
  connectionId: string,
  action: "lock" | "unlock" | "token",
  body?: unknown,
): Promise<Response> {
  return SELF.fetch(url(connectionId, action), {
    method: "POST",
    headers: {
      "x-internal-token": TEST_TOKEN,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("POST /api/internal/connections/:connectionId/lock + /unlock", () => {
  it("acquires the lock when free, then 409 when already held", async () => {
    const conn = `conn-${crypto.randomUUID()}`;

    const first = await post(conn, "lock");
    expect(first.status).toBe(200);
    expect(((await first.json()) as { acquired: boolean }).acquired).toBe(true);

    const second = await post(conn, "lock");
    expect(second.status).toBe(409);
    expect(((await second.json()) as { acquired: boolean }).acquired).toBe(
      false,
    );
  });

  it("/unlock releases and allows re-acquisition", async () => {
    const conn = `conn-${crypto.randomUUID()}`;
    expect((await post(conn, "lock")).status).toBe(200);
    expect((await post(conn, "unlock")).status).toBe(200);
    expect((await post(conn, "lock")).status).toBe(200);
  });

  it("scopes locks per connectionId (different IDs don't collide)", async () => {
    const a = `conn-A-${crypto.randomUUID()}`;
    const b = `conn-B-${crypto.randomUUID()}`;
    expect((await post(a, "lock")).status).toBe(200);
    expect((await post(b, "lock")).status).toBe(200);
  });
});

describe("POST /api/internal/connections/:connectionId/token", () => {
  it("forwards encryptedToken through and returns the plaintext accessToken", async () => {
    const conn = `conn-${crypto.randomUUID()}`;
    const plaintext = "patAirtableXYZ";
    const encryptedToken = await encryptToken(plaintext, TEST_ENC_KEY);

    const res = await post(conn, "token", { encryptedToken });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accessToken: string };
    expect(body.accessToken).toBe(plaintext);
  });

  it("returns 400 for missing/empty encryptedToken (DO contract surfaces through)", async () => {
    const conn = `conn-${crypto.randomUUID()}`;
    const missing = await post(conn, "token", {});
    expect(missing.status).toBe(400);
    const empty = await post(conn, "token", { encryptedToken: "" });
    expect(empty.status).toBe(400);
  });
});

describe("middleware gate (defense-in-depth on proxy routes)", () => {
  it("rejects without x-internal-token", async () => {
    const conn = `conn-${crypto.randomUUID()}`;
    const res = await SELF.fetch(url(conn, "lock"), { method: "POST" });
    expect(res.status).toBe(401);
  });
});

// Anchor `env` import so the test runner doesn't tree-shake it; some test
// harness behaviors only kick in once `env` has been referenced from a test.
void env;
