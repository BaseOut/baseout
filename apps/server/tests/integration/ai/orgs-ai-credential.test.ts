/**
 * shared-ai-byok task 3.3 — the SERVER_INTERNAL_TOKEN-gated AI credential endpoint.
 *
 * The workflows chat task (task 4.1) runs on the Node runner and can't decrypt
 * `ai_provider_keys.key_enc` itself (the master key never leaves the Worker), so
 * it fetches the org's routing decision + (for byok) the DECRYPTED plaintext key
 * over this endpoint at run start.
 *
 * The pure `resolveAiCredential` takes injected deps (the token check + the
 * adapter resolver) so both the auth gate and the pool/byok mapping unit-test
 * with no DB and no real crypto.
 *
 * SECURITY: the plaintext apiKey appears ONLY in the byok response body (the
 * trusted service boundary). A bad/missing token is rejected BEFORE any resolve
 * or decrypt; the key is never logged — both asserted below.
 */

import { describe, expect, it, vi } from "vitest";
import { resolveAiCredential } from "../../../src/pages/api/internal/orgs/ai-credential";
import type { ByokAdapterConfig } from "../../../src/lib/ai/byok-credential";

const BYOK: ByokAdapterConfig = {
  provider: "anthropic",
  model: "claude-x",
  apiKey: "sk-secret-should-never-log",
};

describe("resolveAiCredential (task 3.3 credential endpoint)", () => {
  it("rejects a missing token with 401 and never resolves/decrypts", async () => {
    const resolveAdapter = vi.fn(async () => BYOK);
    const out = await resolveAiCredential(null, "org_1", {
      verifyToken: () => false,
      resolveAdapter,
    });
    expect(out.status).toBe(401);
    expect(out.body).toEqual({ error: "unauthorized" });
    expect(resolveAdapter).not.toHaveBeenCalled();
  });

  it("rejects an invalid token with 401 and never resolves/decrypts", async () => {
    const resolveAdapter = vi.fn(async () => BYOK);
    const out = await resolveAiCredential("wrong-token", "org_1", {
      verifyToken: (t) => t === "right-token",
      resolveAdapter,
    });
    expect(out.status).toBe(401);
    expect(resolveAdapter).not.toHaveBeenCalled();
  });

  it("returns { mode: 'pool' } for a non-byok org", async () => {
    const out = await resolveAiCredential("right-token", "org_1", {
      verifyToken: (t) => t === "right-token",
      resolveAdapter: async () => null,
    });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ mode: "pool" });
  });

  it("returns { mode:'byok', provider, model, apiKey } for a byok org", async () => {
    const out = await resolveAiCredential("right-token", "org_1", {
      verifyToken: (t) => t === "right-token",
      resolveAdapter: async () => BYOK,
    });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      mode: "byok",
      provider: "anthropic",
      model: "claude-x",
      apiKey: "sk-secret-should-never-log",
    });
  });

  it("passes the orgId through to the adapter resolver", async () => {
    const resolveAdapter = vi.fn(async () => null);
    await resolveAiCredential("right-token", "org_abc", {
      verifyToken: () => true,
      resolveAdapter,
    });
    expect(resolveAdapter).toHaveBeenCalledWith("org_abc");
  });

  it("never logs the plaintext apiKey", async () => {
    const methods = ["log", "info", "warn", "error", "debug", "trace"] as const;
    const spies = methods.map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    try {
      const out = await resolveAiCredential("right-token", "org_1", {
        verifyToken: () => true,
        resolveAdapter: async () => BYOK,
      });
      // Sanity: the key IS in the response body (the trusted boundary)…
      expect(JSON.stringify(out.body)).toContain("sk-secret-should-never-log");
      // …but NEVER in any log call.
      for (const spy of spies) {
        for (const call of spy.mock.calls) {
          expect(JSON.stringify(call)).not.toContain("sk-secret-should-never-log");
        }
      }
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });
});
