// ConnectionDO /token cache — Phase 6.3 of the Backups MVP plan.
//
// The Trigger.dev backup-base task hands the DO an AES-GCM-encrypted Airtable
// access token and gets back the plaintext. The DO is the canonical decrypt
// site for a given Connection across multiple task runs, so we cache the
// plaintext keyed by ciphertext bytes and skip the AES round-trip on the next
// call. TTL keeps stale tokens from lingering past a refresh.
//
// Spy-injection uses `runInDurableObject` from cloudflare:test to reach the
// instance directly (the standard binding API only forwards via .fetch).

import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import type { ConnectionDO } from "../../src/durable-objects/ConnectionDO";

interface Bindings {
  CONNECTION_DO: DurableObjectNamespace<ConnectionDO>;
}

function getStub(name: string): DurableObjectStub<ConnectionDO> {
  const ns = (env as unknown as Bindings).CONNECTION_DO;
  return ns.get(ns.idFromName(name));
}

async function postToken(
  stub: DurableObjectStub<ConnectionDO>,
  encryptedToken: unknown,
): Promise<Response> {
  return stub.fetch("http://do/token", {
    method: "POST",
    body: JSON.stringify({ encryptedToken }),
  });
}

describe("ConnectionDO /token", () => {
  it("decrypts once across multiple requests with the same encryptedToken", async () => {
    const stub = getStub(`cache-hit-${crypto.randomUUID()}`);
    const decryptSpy = vi.fn(
      async (cipher: string, _key: string) => `plain-${cipher}`,
    );

    await runInDurableObject(stub, async (instance) => {
      instance.setDecryptImplForTests(decryptSpy);
    });

    const r1 = await postToken(stub, "cipher-A");
    const r2 = await postToken(stub, "cipher-A");
    const r3 = await postToken(stub, "cipher-A");

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(200);
    expect(((await r1.json()) as { accessToken: string }).accessToken).toBe(
      "plain-cipher-A",
    );
    expect(((await r2.json()) as { accessToken: string }).accessToken).toBe(
      "plain-cipher-A",
    );
    expect(((await r3.json()) as { accessToken: string }).accessToken).toBe(
      "plain-cipher-A",
    );
    expect(decryptSpy).toHaveBeenCalledTimes(1);
  });

  it("decrypts independently for distinct encryptedTokens", async () => {
    const stub = getStub(`cache-miss-${crypto.randomUUID()}`);
    const decryptSpy = vi.fn(
      async (cipher: string, _key: string) => `plain-${cipher}`,
    );

    await runInDurableObject(stub, async (instance) => {
      instance.setDecryptImplForTests(decryptSpy);
    });

    await postToken(stub, "cipher-X");
    await postToken(stub, "cipher-Y");
    await postToken(stub, "cipher-X");

    // X then Y then X: X should hit cache on third call → 2 distinct decrypts.
    expect(decryptSpy).toHaveBeenCalledTimes(2);
    expect(decryptSpy).toHaveBeenNthCalledWith(1, "cipher-X", expect.any(String));
    expect(decryptSpy).toHaveBeenNthCalledWith(2, "cipher-Y", expect.any(String));
  });

  it("returns 400 when encryptedToken is missing or empty", async () => {
    const stub = getStub(`bad-${crypto.randomUUID()}`);

    const missing = await stub.fetch("http://do/token", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(missing.status).toBe(400);

    const empty = await postToken(stub, "");
    expect(empty.status).toBe(400);
  });

  it("can route /token through the on-demand resolver instead of decrypting the snapshot", async () => {
    const stub = getStub(`resolver-${crypto.randomUUID()}`);
    const decryptSpy = vi.fn(
      async (cipher: string, _key: string) => `plain-${cipher}`,
    );
    const resolverSpy = vi.fn(async () => ({
      ok: true as const,
      accessToken: "fresh-from-db",
      refreshed: true,
    }));

    await runInDurableObject(stub, async (instance) => {
      instance.setDecryptImplForTests(decryptSpy);
      instance.setResolveAirtableTokenImplForTests(resolverSpy);
      instance.setOnDemandRefreshEnabledForTests(true);
    });

    const res = await stub.fetch("http://do/token", {
      method: "POST",
      body: JSON.stringify({
        connectionId: "conn-1",
        encryptedToken: "stale-cipher",
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accessToken: "fresh-from-db" });
    expect(resolverSpy).toHaveBeenCalledWith({ connectionId: "conn-1" });
    expect(decryptSpy).not.toHaveBeenCalled();
  });
});
