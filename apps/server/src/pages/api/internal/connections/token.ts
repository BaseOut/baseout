// POST /api/internal/connections/:connectionId/token
//
// Lazy-decrypt + refresh for the Trigger.dev backup-base task. Replaces the
// prior DO-only decrypt path: the task's `encryptedToken` payload field is
// ignored — DB is source of truth at fetch time (same pattern as
// GET /api/internal/spaces/:spaceId/storage-destination).
//
// Query params:
//   ?refresh=1 — force Airtable refresh before returning access token.
//
// Result-code mapping:
//   200 { accessToken, expiresAt }
//   400 invalid_connection_id | method_not_allowed
//   404 connection_not_found
//   409 connection_status | pending_reauth
//   500 server_misconfigured | decrypt_failed | encrypt_failed
//   502 refresh_transient | refresh_invalid

import type { AppLocals, Env } from "../../../../env";
import {
  resolveAirtableConnectionToken,
  type ResolveAirtableTokenResult,
} from "../../../../lib/connections/resolve-airtable-token";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function statusFor(result: Extract<ResolveAirtableTokenResult, { ok: false }>): number {
  switch (result.error) {
    case "connection_not_found":
      return 404;
    case "connection_status":
    case "pending_reauth":
      return 409;
    case "decrypt_failed":
    case "encrypt_failed":
    case "missing_refresh_token":
      return 500;
    case "refresh_transient":
    case "refresh_invalid":
      return 502;
  }
}

export async function connectionTokenHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  connectionId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(connectionId)) {
    return jsonResponse({ error: "invalid_connection_id" }, 400);
  }
  if (
    !env.BASEOUT_ENCRYPTION_KEY ||
    !env.AIRTABLE_OAUTH_CLIENT_ID ||
    !env.AIRTABLE_OAUTH_CLIENT_SECRET
  ) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  const { db } = locals.getMasterDb();
  let result: ResolveAirtableTokenResult;
  try {
    result = await resolveAirtableConnectionToken(db, {
      connectionId,
      forceRefresh,
      encryptionKey: env.BASEOUT_ENCRYPTION_KEY,
      clientId: env.AIRTABLE_OAUTH_CLIENT_ID,
      clientSecret: env.AIRTABLE_OAUTH_CLIENT_SECRET,
    });
  } catch {
    return jsonResponse({ error: "unexpected_error" }, 502);
  }

  if (result.ok) {
    return jsonResponse(
      { accessToken: result.accessToken, expiresAt: result.expiresAt },
      200,
    );
  }

  const body: Record<string, string> = { error: result.error };
  if (result.reason) body.reason = result.reason;
  return jsonResponse(body, statusFor(result));
}
