/**
 * shared-ai-byok task 4.2 — in-process credential decrypt + adapter resolution.
 *
 * `resolveByokCredential`: the DB read is faked (drizzle chain) and decrypt is
 * injected, so both branches (no active key → null; active key → decrypt) run
 * without a DB or the real crypto. `resolveByokAdapter`: routing + credential
 * deps are injected, so the pool/byok composition is unit-tested with no DB.
 *
 * SECURITY: the plaintext key is only ever surfaced as the returned
 * `ByokAdapterConfig.apiKey` (an in-process value handed to callByokModel) —
 * asserted below; it is never logged or serialized by these functions.
 */

import { describe, expect, it, vi } from "vitest";
import type { AppDb } from "../../../src/db/worker";
import {
  resolveByokAdapter,
  resolveByokCredential,
} from "../../../src/lib/ai/byok-credential";
import type { ResolveAiRoutingDeps } from "../../../src/lib/ai/resolve-ai-routing";

/** Minimal drizzle-chain fake: every builder method returns itself; limit resolves rows. */
function fakeDb(rows: Array<{ keyEnc: string }>): AppDb {
  const chain: Record<string, unknown> = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
  };
  return chain as unknown as AppDb;
}

describe("resolveByokCredential", () => {
  it("returns null when no active key exists (decrypt never called)", async () => {
    const decrypt = vi.fn(async () => "should-not-happen");
    const out = await resolveByokCredential(fakeDb([]), "enc-key", "org_1", "anthropic", decrypt);
    expect(out).toBeNull();
    expect(decrypt).not.toHaveBeenCalled();
  });

  it("decrypts the active key's ciphertext with the master key and returns plaintext", async () => {
    const decrypt = vi.fn(async (ct: string) => `PLAIN(${ct})`);
    const out = await resolveByokCredential(
      fakeDb([{ keyEnc: "CIPHERTEXT" }]),
      "enc-key",
      "org_1",
      "anthropic",
      decrypt,
    );
    expect(out).toBe("PLAIN(CIPHERTEXT)");
    expect(decrypt).toHaveBeenCalledWith("CIPHERTEXT", "enc-key");
  });
});

const dummyDb = {} as unknown as AppDb;

function routing(entitled: boolean, key: { provider: string; modelDefault: string | null } | null): ResolveAiRoutingDeps {
  return {
    isByokEntitled: async () => entitled,
    findActiveKey: async () => key,
  };
}

describe("resolveByokAdapter", () => {
  it("returns null (pool) when the org is not byo_ai_key-entitled", async () => {
    const out = await resolveByokAdapter(dummyDb, "enc", "org_1", {
      routing: routing(false, { provider: "anthropic", modelDefault: "claude-x" }),
      resolveCredential: async () => "sk",
    });
    expect(out).toBeNull();
  });

  it("returns null (pool) when entitled but there is no active key", async () => {
    const out = await resolveByokAdapter(dummyDb, "enc", "org_1", {
      routing: routing(true, null),
      resolveCredential: async () => "sk",
    });
    expect(out).toBeNull();
  });

  it("returns null (pool) for a non-callable provider (cloudflare)", async () => {
    const out = await resolveByokAdapter(dummyDb, "enc", "org_1", {
      routing: routing(true, { provider: "cloudflare", modelDefault: null }),
      resolveCredential: async () => "sk",
    });
    expect(out).toBeNull();
  });

  it("returns null (pool) when the key cannot be decrypted", async () => {
    const out = await resolveByokAdapter(dummyDb, "enc", "org_1", {
      routing: routing(true, { provider: "anthropic", modelDefault: "claude-x" }),
      resolveCredential: async () => null,
    });
    expect(out).toBeNull();
  });

  it("returns the byok config (provider, model, plaintext key) for a supported active key", async () => {
    const out = await resolveByokAdapter(dummyDb, "enc", "org_1", {
      routing: routing(true, { provider: "anthropic", modelDefault: "claude-x" }),
      resolveCredential: async (provider) => `key-for-${provider}`,
    });
    expect(out).toEqual({ provider: "anthropic", model: "claude-x", apiKey: "key-for-anthropic" });
  });
});
