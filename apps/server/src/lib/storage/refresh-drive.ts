// Google Drive OAuth2 token refresh — engine-side helper.
//
// Used by the internal storage-destination endpoint (and any future
// proactive-refresh cron) to swap a stored refresh token for a fresh access
// token. Outcome union mirrors other storage refresh helpers so future
// consolidation under packages/shared is mechanical, with Google-specific
// wire differences:
//
//   POST https://oauth2.googleapis.com/token
//   Content-Type: application/x-www-form-urlencoded
//   Body: grant_type=refresh_token
//         &refresh_token=<token>
//         &client_id=<id>
//         &client_secret=<secret>
//
// Google supports both HTTP Basic auth and body-form auth for the token
// endpoint; the form variant is the canonical web-server flow per
// https://developers.google.com/identity/protocols/oauth2/web-server.
//
// Outcome mapping:
//   200 with access_token        → 'success' (refresh_token absent — Google
//                                  omits it on refresh; we preserve the stored one)
//   400 + invalid_grant          → 'pending_reauth' (user revoked or refresh
//                                  token expired; flip to needs-reconnect)
//   401 + invalid_client         → 'invalid' (client secret rotated; page ops)
//   429 / 5xx / network error    → 'transient' (caller may retry)
//   anything else                → 'invalid'

export const GOOGLE_DRIVE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface DriveRefreshInput {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  /** Optional override for tests. Defaults to GOOGLE_DRIVE_TOKEN_URL. */
  tokenUrl?: string;
  /** Optional override for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /**
   * Optional clock seam. Used to compute expiresAtMs = now() + expires_in*1000.
   * Defaults to Date.now.
   */
  nowMs?: () => number;
}

export type DriveRefreshOutcome =
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

export async function refreshDriveAccessToken(
  input: DriveRefreshInput,
): Promise<DriveRefreshOutcome> {
  const fetchFn = input.fetchImpl ?? fetch;
  const nowMs = input.nowMs ?? Date.now;
  const tokenUrl = input.tokenUrl ?? GOOGLE_DRIVE_TOKEN_URL;

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
