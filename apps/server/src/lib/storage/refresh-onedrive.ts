// Microsoft OneDrive OAuth2 token refresh — engine-side helper.
//
// Used by the internal storage-destination endpoint to swap a stored refresh
// token for a fresh access token. Modeled on refresh-box.ts because Microsoft
// ROTATES refresh tokens on every refresh — same persistence requirement as
// Box. The response carries a new `refresh_token` that supersedes the old;
// the caller MUST persist it before the next refresh, otherwise the stored
// (now-stale) refresh token will fail with `invalid_grant` (Microsoft's
// AADSTS50173 / "expired or invalid refresh token").
//
// Public-client + PKCE — NO `client_secret` is sent. The Azure App is
// registered with `allowPublicClient: true`; Microsoft accepts refresh
// requests carrying only `client_id` + `refresh_token` + `scope`.
//
//   POST https://login.microsoftonline.com/common/oauth2/v2.0/token
//   Content-Type: application/x-www-form-urlencoded
//   Body: grant_type=refresh_token
//         &refresh_token=<token>
//         &client_id=<id>
//         &scope=Files.ReadWrite.AppFolder offline_access User.Read
//
// Outcome mapping:
//   200 with access_token + refresh_token → 'success' (with NEW refresh_token)
//   400 + invalid_grant                   → 'pending_reauth' (token expired
//                                            by inactivity, was revoked, or
//                                            was already rotated)
//   401 + invalid_client                  → 'invalid' (manifest reverted to
//                                            non-public-client, or client_id
//                                            mismatch)
//   429 / 5xx / network error             → 'transient' (caller may retry)
//   anything else                         → 'invalid'

export const MICROSOFT_TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";

const DEFAULT_SCOPES = [
  "Files.ReadWrite.AppFolder",
  "offline_access",
  "User.Read",
] as const;

export interface OneDriveRefreshInput {
  refreshToken: string;
  clientId: string;
  /** Optional override for tests / non-default scope. Defaults to DEFAULT_SCOPES. */
  scopes?: readonly string[];
  /** Optional override for tests. Defaults to MICROSOFT_TOKEN_URL. */
  tokenUrl?: string;
  /** Optional override for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /**
   * Optional clock seam. Used to compute expiresAtMs = now() + expires_in*1000.
   * Defaults to Date.now.
   */
  nowMs?: () => number;
}

export type OneDriveRefreshOutcome =
  | {
      kind: "success";
      accessToken: string;
      /**
       * The NEW refresh token. Microsoft rotates on every refresh; this
       * value supersedes the input refreshToken and MUST be persisted by
       * the caller, or the next refresh will fail with `invalid_grant`.
       */
      refreshToken: string;
      expiresAtMs: number;
      scope: string | null;
    }
  | { kind: "pending_reauth"; reason: string }
  | { kind: "transient"; reason: string; retryAfterMs?: number }
  | { kind: "invalid"; reason: string };

interface RawTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

const PENDING_REAUTH_ERROR_CODES = new Set<string>([
  "invalid_grant",
  "unauthorized_client",
  "access_denied",
]);

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  return undefined;
}

export async function refreshOneDriveAccessToken(
  input: OneDriveRefreshInput,
): Promise<OneDriveRefreshOutcome> {
  const fetchFn = input.fetchImpl ?? fetch;
  const nowMs = input.nowMs ?? Date.now;
  const tokenUrl = input.tokenUrl ?? MICROSOFT_TOKEN_URL;
  const scopes = input.scopes ?? DEFAULT_SCOPES;

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", input.refreshToken);
  body.set("client_id", input.clientId);
  body.set("scope", scopes.join(" "));
  // NO client_secret — public-client + PKCE.

  let res: Response;
  try {
    res = await fetchFn(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (err) {
    return {
      kind: "transient",
      reason: `network_error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (res.status === 429 || res.status >= 500) {
    return {
      kind: "transient",
      reason: `http_${res.status}`,
      retryAfterMs: parseRetryAfter(res.headers.get("retry-after")),
    };
  }

  let json: RawTokenResponse;
  try {
    json = (await res.json()) as RawTokenResponse;
  } catch {
    return { kind: "invalid", reason: `http_${res.status}_unparseable_body` };
  }

  if (
    res.ok &&
    typeof json.access_token === "string" &&
    typeof json.refresh_token === "string"
  ) {
    const expiresIn =
      typeof json.expires_in === "number" && Number.isFinite(json.expires_in)
        ? json.expires_in
        : 0;
    return {
      kind: "success",
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAtMs: nowMs() + expiresIn * 1000,
      scope: json.scope ?? null,
    };
  }

  // 200 OK with missing refresh_token is treated as invalid — Microsoft
  // always includes a fresh refresh_token on a successful refresh response
  // when `offline_access` is in scope. Missing one indicates a contract
  // drift or a scope misconfiguration; either way fail loud so the next
  // refresh isn't silently doomed.
  if (res.ok) {
    return {
      kind: "invalid",
      reason: `http_${res.status}_missing_refresh_token`,
    };
  }

  const code = json.error ?? `http_${res.status}`;
  const desc = json.error_description ? `: ${json.error_description}` : "";
  if (PENDING_REAUTH_ERROR_CODES.has(code)) {
    return { kind: "pending_reauth", reason: `${code}${desc}` };
  }
  return { kind: "invalid", reason: `${code}${desc}` };
}
