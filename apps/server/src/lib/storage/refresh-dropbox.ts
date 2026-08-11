// Dropbox OAuth2 token refresh — engine-side helper.
//
// Used by the internal storage-destination endpoint (and any future
// proactive-refresh cron) to swap a stored refresh token for a fresh access
// token. The shape mirrors refresh-drive.ts because Dropbox refresh tokens
// are STABLE — the refresh response carries no new refresh_token, so the
// engine route preserves the existing encrypted value rather than
// re-encrypting it on every refresh.
//
//   POST https://api.dropboxapi.com/oauth2/token
//   Content-Type: application/x-www-form-urlencoded
//   Body: grant_type=refresh_token
//         &refresh_token=<token>
//         &client_id=<key>
//         &client_secret=<secret>
//
// Dropbox accepts body-form auth (parity with Drive / Box) — keeps the
// client_secret out of an Authorization header in worker logs.
//
// Outcome mapping:
//   200 with access_token        → 'success' (refresh_token absent — Dropbox
//                                  omits it on refresh; the caller preserves
//                                  the previously stored value)
//   400 + invalid_grant          → 'pending_reauth' (user revoked, app
//                                  permission revoked, or refresh token
//                                  invalidated)
//   401 + invalid_client         → 'invalid' (client_id/secret rotation)
//   429 / 5xx / network error    → 'transient' (caller may retry)
//   anything else                → 'invalid'

export const DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";

export interface DropboxRefreshInput {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  /** Optional override for tests. Defaults to DROPBOX_TOKEN_URL. */
  tokenUrl?: string;
  /** Optional override for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /**
   * Optional clock seam. Used to compute expiresAtMs = now() + expires_in*1000.
   * Defaults to Date.now.
   */
  nowMs?: () => number;
}

export type DropboxRefreshOutcome =
  | {
      kind: "success";
      accessToken: string;
      expiresAtMs: number;
      scope: string | null;
    }
  | { kind: "pending_reauth"; reason: string }
  | { kind: "transient"; reason: string; retryAfterMs?: number }
  | { kind: "invalid"; reason: string };

interface RawTokenResponse {
  access_token?: string;
  refresh_token?: string | null;
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

export async function refreshDropboxAccessToken(
  input: DropboxRefreshInput,
): Promise<DropboxRefreshOutcome> {
  const fetchFn = input.fetchImpl ?? fetch;
  const nowMs = input.nowMs ?? Date.now;
  const tokenUrl = input.tokenUrl ?? DROPBOX_TOKEN_URL;

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

  if (res.ok && typeof json.access_token === "string") {
    const expiresIn =
      typeof json.expires_in === "number" && Number.isFinite(json.expires_in)
        ? json.expires_in
        : 0;
    return {
      kind: "success",
      accessToken: json.access_token,
      expiresAtMs: nowMs() + expiresIn * 1000,
      scope: json.scope ?? null,
    };
  }

  const code = json.error ?? `http_${res.status}`;
  const desc = json.error_description ? `: ${json.error_description}` : "";
  if (PENDING_REAUTH_ERROR_CODES.has(code)) {
    return { kind: "pending_reauth", reason: `${code}${desc}` };
  }
  return { kind: "invalid", reason: `${code}${desc}` };
}
