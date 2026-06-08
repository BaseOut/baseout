// Airtable OAuth2 token refresh — engine-side mirror of apps/web's
// refreshAccessToken (src/lib/airtable/oauth.ts). The cron orchestrator
// calls this once per claimed Connection and switches on RefreshOutcome.

export const AIRTABLE_TOKEN_URL = "https://airtable.com/oauth2/v1/token";

export interface AirtableRefreshInput {
  refreshToken: string;
  tokenUrl?: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
}

export type RefreshOutcome =
  | {
      kind: "success";
      accessToken: string;
      refreshToken: string;
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
  "invalid_request_or_grant",
  "unauthorized_client",
  "access_denied",
]);

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const creds = `${clientId}:${clientSecret}`;
  const bytes = new TextEncoder().encode(creds);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return `Basic ${btoa(bin)}`;
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  return undefined;
}

export async function refreshAirtableAccessToken(
  input: AirtableRefreshInput,
): Promise<RefreshOutcome> {
  const fetchFn = input.fetchImpl ?? fetch;
  const nowMs = input.nowMs ?? Date.now;
  const tokenUrl = input.tokenUrl ?? AIRTABLE_TOKEN_URL;

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", input.refreshToken);

  let res: Response;
  try {
    res = await fetchFn(tokenUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: basicAuthHeader(input.clientId, input.clientSecret),
      },
      body: body.toString(),
    });
  } catch (err) {
    return {
      kind: "transient",
      reason: `network_error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Airtable returns 409 when a refresh was recently completed for this grant.
  if (res.status === 409) {
    return {
      kind: "transient",
      reason: "http_409_refresh_conflict",
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
    if (
      typeof json.refresh_token !== "string" ||
      json.refresh_token.length === 0
    ) {
      return { kind: "invalid", reason: "missing_refresh_token" };
    }
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

  const code = json.error ?? `http_${res.status}`;
  const desc = json.error_description ? `: ${json.error_description}` : "";
  if (PENDING_REAUTH_ERROR_CODES.has(code)) {
    return { kind: "pending_reauth", reason: `${code}${desc}` };
  }
  return { kind: "invalid", reason: `${code}${desc}` };
}
