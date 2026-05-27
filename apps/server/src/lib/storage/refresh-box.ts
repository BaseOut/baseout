// Box OAuth2 token refresh — engine-side helper.
//
// Used by the internal storage-destination endpoint (and any future proactive-
// refresh cron) to swap a stored refresh token for a fresh access token. The
// shape mirrors refresh-drive.ts with one load-bearing divergence: Box ROTATES
// refresh tokens on every refresh. The response carries a new `refresh_token`
// that supersedes the old within ~60s. The `success` outcome surfaces it so
// the caller MUST persist it before the next refresh — otherwise the stored
// (now-stale) refresh token will fail with `invalid_grant`.
//
//   POST https://api.box.com/oauth2/token
//   Content-Type: application/x-www-form-urlencoded
//   Body: grant_type=refresh_token
//         &refresh_token=<token>
//         &client_id=<id>
//         &client_secret=<secret>
//
// Box accepts both Basic auth and body-form auth; body-form matches Drive and
// keeps client_secret out of an Authorization header in worker logs.
//
// Outcome mapping:
//   200 with access_token + refresh_token → 'success' (with NEW refresh_token)
//   400 + invalid_grant                   → 'pending_reauth' (token expired
//                                            after 60 idle days, was revoked,
//                                            or was already rotated)
//   401 + invalid_client                  → 'invalid' (client secret rotated)
//   429 / 5xx / network error             → 'transient' (caller may retry)
//   anything else                         → 'invalid'

export const BOX_TOKEN_URL = "https://api.box.com/oauth2/token";

export interface BoxRefreshInput {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  /** Optional override for tests. Defaults to BOX_TOKEN_URL. */
  tokenUrl?: string;
  /** Optional override for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /**
   * Optional clock seam. Used to compute expiresAtMs = now() + expires_in*1000.
   * Defaults to Date.now.
   */
  nowMs?: () => number;
}

export type BoxRefreshOutcome =
  | {
      kind: "success";
      accessToken: string;
      /**
       * The NEW refresh token. Box rotates on every refresh; this value
       * supersedes the input refreshToken and MUST be persisted by the
       * caller, or the next refresh will fail with `invalid_grant`.
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

export async function refreshBoxAccessToken(
  input: BoxRefreshInput,
): Promise<BoxRefreshOutcome> {
  const fetchFn = input.fetchImpl ?? fetch;
  const nowMs = input.nowMs ?? Date.now;
  const tokenUrl = input.tokenUrl ?? BOX_TOKEN_URL;

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", input.refreshToken);
  body.set("client_id", input.clientId);
  body.set("client_secret", input.clientSecret);

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

  // 200 OK with missing refresh_token is treated as invalid — Box always
  // includes a fresh refresh_token on a successful refresh response, so a
  // missing one indicates a contract drift we'd rather see fail loudly.
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
