// Tests the INTERNAL_TOKEN gate on /api/internal/*. The four branches are
// driven through SELF.fetch() against /api/internal/ping (the simplest gated
// route) since middleware runs before any handler.
//
// Branches covered:
//   1. Missing x-internal-token        → 401
//   2. Wrong token, same length        → 401 (constant-time compare path)
//   3. Wrong token, different length   → 401 (length-mismatch early return)
//   4. Correct token                   → 200 pass-through to handler
//
// CLAUDE.md §3.3 mandates constant-time comparison; we don't time-assert here
// (timing oracles are noisy in workerd) but exercising both length branches
// keeps coverage of the early-return path honest.

import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

// Pinned test value — vitest.config.ts asserts this via miniflare.bindings,
// which overrides any `.dev.vars` the developer has locally.
const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";

describe("middleware: INTERNAL_TOKEN gate on /api/internal/*", () => {
  it("rejects requests with no x-internal-token header (401)", async () => {
    const res = await SELF.fetch("http://test/api/internal/ping");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unauthorized");
  });

  it("rejects requests with a wrong-but-same-length token (401)", async () => {
    const wrong = "x".repeat(TEST_TOKEN.length);
    expect(wrong.length).toBe(TEST_TOKEN.length); // sanity: exercises the
    // constant-time XOR loop, not the length-mismatch early return.

    const res = await SELF.fetch("http://test/api/internal/ping", {
      headers: { "x-internal-token": wrong },
    });
    expect(res.status).toBe(401);
  });

  it("rejects requests with a wrong-and-shorter token (401)", async () => {
    // Different code path: length-mismatch early return inside constantTimeEqual.
    const res = await SELF.fetch("http://test/api/internal/ping", {
      headers: { "x-internal-token": "too-short" },
    });
    expect(res.status).toBe(401);
  });

  it("admits requests with the correct token (200)", async () => {
    const res = await SELF.fetch("http://test/api/internal/ping", {
      headers: { "x-internal-token": TEST_TOKEN },
    });
    expect(res.status).toBe(200);
  });
});
