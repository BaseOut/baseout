// API-token helpers shared by apps/api (auth lookup) and apps/web (token CRUD,
// plaintext-once display). See openspec/changes/api-rest-read design D4.
//
// Storage contract: the plaintext token is shown exactly once at creation;
// only `token_hash` (SHA-256 hex of the FULL plaintext, prefix included) and
// `token_prefix` (short display fragment) are persisted in `api_tokens`.
// Web Crypto only — must run identically under workerd and Node.

export const API_TOKEN_LIVE_PREFIX = "bo_live_";
/** Reserved for future sandbox/test-mode tokens; never issued today. */
export const API_TOKEN_TEST_PREFIX = "bo_test_";

/** Display-prefix length: scheme prefix + first 6 secret chars (`bo_live_a1b2c3`). */
const DISPLAY_SECRET_CHARS = 6;

const base64UrlEncode = (bytes: Uint8Array): string => {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** SHA-256 hex of the full plaintext token — the `api_tokens.token_hash` value. */
export async function hashApiToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToHex(new Uint8Array(digest));
}

export interface GeneratedApiToken {
  /** Full plaintext — show once, never persist. */
  token: string;
  /** Display fragment persisted as `api_tokens.token_prefix`. */
  tokenPrefix: string;
  /** SHA-256 hex persisted as `api_tokens.token_hash`. */
  tokenHash: string;
}

/** Mint a `bo_live_` token with 32 bytes of CSPRNG entropy (43-char base64url). */
export async function generateApiToken(): Promise<GeneratedApiToken> {
  const entropy = new Uint8Array(32);
  crypto.getRandomValues(entropy);
  const token = `${API_TOKEN_LIVE_PREFIX}${base64UrlEncode(entropy)}`;
  return {
    token,
    tokenPrefix: token.slice(0, API_TOKEN_LIVE_PREFIX.length + DISPLAY_SECRET_CHARS),
    tokenHash: await hashApiToken(token),
  };
}

/**
 * Extract a Baseout token from an `Authorization` header. Returns null for
 * anything that is not exactly `Bearer <bo_live_…>` (single space, scheme
 * case-insensitive) — callers map null to 401 without a DB lookup.
 */
export function parseBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer (\S+)$/i.exec(header);
  const token = match?.[1];
  if (!token) return null;
  return token.startsWith(API_TOKEN_LIVE_PREFIX) ? token : null;
}
