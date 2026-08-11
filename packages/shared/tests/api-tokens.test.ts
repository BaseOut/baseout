// @baseout/shared api-token helpers — generation, parsing, and SHA-256 hashing
// (api-rest-read task 1.1). Plaintext is shown once at creation; only the
// SHA-256 hash is stored (api_tokens.token_hash), so hashing must be
// deterministic and constant across runtimes (Web Crypto, workerd + Node).
import { describe, expect, test } from "vitest";

import {
  API_TOKEN_LIVE_PREFIX,
  generateApiToken,
  hashApiToken,
  parseBearerToken,
} from "../src/api-tokens";

describe("generateApiToken", () => {
  test("produces a bo_live_ token with 32 bytes of url-safe entropy and its display prefix", async () => {
    const generated = await generateApiToken();
    expect(generated.token.startsWith(API_TOKEN_LIVE_PREFIX)).toBe(true);
    const secret = generated.token.slice(API_TOKEN_LIVE_PREFIX.length);
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes base64url, unpadded
    // token_prefix is the display fragment web shows in listings.
    expect(generated.tokenPrefix).toBe(generated.token.slice(0, API_TOKEN_LIVE_PREFIX.length + 6));
    // token_hash is the stored lookup key for the full plaintext.
    expect(generated.tokenHash).toBe(await hashApiToken(generated.token));
  });

  test("never produces the same token twice", async () => {
    const a = await generateApiToken();
    const b = await generateApiToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe("hashApiToken", () => {
  test("is deterministic SHA-256 hex of the full plaintext", async () => {
    // Fixed vector: sha256("bo_live_test") — guards against accidental
    // algorithm/encoding drift, which would invalidate every stored token.
    expect(await hashApiToken("bo_live_test")).toBe(
      "f26b257b204f04ab00e1f73151bef88fe89839dc8de7fbbabbb07cbd0b100309",
    );
  });

  test("different tokens hash differently", async () => {
    expect(await hashApiToken("bo_live_a")).not.toBe(await hashApiToken("bo_live_b"));
  });
});

describe("parseBearerToken", () => {
  test("extracts a bo_live_ token from a well-formed Authorization header", () => {
    expect(parseBearerToken("Bearer bo_live_abc123")).toBe("bo_live_abc123");
  });

  test("rejects missing header, wrong scheme, empty value, and non-Baseout tokens", () => {
    expect(parseBearerToken(null)).toBeNull();
    expect(parseBearerToken("")).toBeNull();
    expect(parseBearerToken("Basic dXNlcjpwYXNz")).toBeNull();
    expect(parseBearerToken("Bearer ")).toBeNull();
    expect(parseBearerToken("Bearer sk_live_notours")).toBeNull();
    expect(parseBearerToken("bo_live_missing_scheme")).toBeNull();
  });

  test("accepts exactly one space and is case-insensitive on the scheme only", () => {
    expect(parseBearerToken("bearer bo_live_abc")).toBe("bo_live_abc");
    expect(parseBearerToken("Bearer  bo_live_abc")).toBeNull();
  });
});
