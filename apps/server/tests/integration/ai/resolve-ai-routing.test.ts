/**
 * shared-ai-byok task 3.2 — the AI routing seam.
 *
 * resolveAiRouting is a PURE resolver over two injected deps (entitlement check +
 * active-key lookup), so it needs no DB or workerd binding — it just runs under
 * the server harness like the other pure modules. It returns `pool` for everyone
 * today (the deps aren't wired to real data until tasks 3.3/4), so behavior is
 * identical to current production.
 *
 * The load-bearing security assertion (design D2, review point #2): the routing
 * result carries NO secret material and is safe to log — call sites obtain the
 * plaintext key via the gated credential endpoint (task 3.3), never from here.
 */

import { describe, expect, it } from "vitest";
import { resolveAiRouting } from "../../../src/lib/ai/resolve-ai-routing";

function deps(opts: {
  entitled: boolean;
  key?: { provider: string; modelDefault: string | null } | null;
}) {
  return {
    isByokEntitled: async () => opts.entitled,
    findActiveKey: async () => opts.key ?? null,
  };
}

describe("resolveAiRouting", () => {
  it("returns pool when byo_ai_key is NOT entitled — even with an active key present", async () => {
    const r = await resolveAiRouting(
      "org_1",
      deps({ entitled: false, key: { provider: "anthropic", modelDefault: "claude-opus-4-8" } }),
    );
    expect(r).toEqual({ mode: "pool" });
  });

  it("returns pool when entitled but the org has no active key", async () => {
    const r = await resolveAiRouting("org_1", deps({ entitled: true, key: null }));
    expect(r).toEqual({ mode: "pool" });
  });

  it("returns pool when the active key is for an UNSUPPORTED provider", async () => {
    const r = await resolveAiRouting(
      "org_1",
      deps({ entitled: true, key: { provider: "cohere", modelDefault: null } }),
    );
    expect(r).toEqual({ mode: "pool" });
  });

  it("returns byok when entitled AND an active key exists for a supported provider", async () => {
    const r = await resolveAiRouting(
      "org_1",
      deps({
        entitled: true,
        key: { provider: "anthropic", modelDefault: "claude-opus-4-8" },
      }),
    );
    expect(r).toEqual({
      mode: "byok",
      provider: "anthropic",
      model: "claude-opus-4-8",
      billable: false,
    });
  });

  it("carries a null model through when the key has no model_default", async () => {
    const r = await resolveAiRouting(
      "org_1",
      deps({ entitled: true, key: { provider: "openai", modelDefault: null } }),
    );
    expect(r).toEqual({ mode: "byok", provider: "openai", model: null, billable: false });
  });

  it("SECURITY: the byok result exposes only non-secret fields (safe to log)", async () => {
    const r = await resolveAiRouting(
      "org_1",
      deps({
        entitled: true,
        key: { provider: "anthropic", modelDefault: "claude-opus-4-8" },
      }),
    );
    // exact key set — no key_enc / key / fingerprint / last_four ever leaks here
    expect(Object.keys(r).sort()).toEqual(["billable", "mode", "model", "provider"]);
    const serialized = JSON.stringify(r).toLowerCase();
    for (const forbidden of ["key_enc", "keyenc", "fingerprint", "last_four", "lastfour", "secret"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
