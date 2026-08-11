// POST /api/internal/connections/:id/whoami
//
// Read a Connection row from the master DB, decrypt the access token, and
// call Airtable's GET /v0/meta/whoami to confirm the token works. This is
// the foundational proof that the engine can use credentials persisted by
// apps/web's OAuth flow.
//
// Status code matrix (callers should expect):
//   400 invalid_connection_id      — `:id` did not parse as a UUID
//   401 unauthorized                — middleware rejected the request
//   404 connection_not_found        — no row with that id
//   409 connection_status           — row exists but status !== 'active', OR the
//                                      on-demand refresh returned reauth_required
//   500 server_misconfigured        — BASEOUT_ENCRYPTION_KEY missing
//   502 token_unavailable           — ConnectionDO /token gate returned non-200
//                                      (transient refresh failure / decrypt error)
//   502 airtable_token_rejected     — Airtable returned 401
//   502 airtable_upstream           — Airtable returned 4xx/5xx other than 401
//   200 success                     — `{ connectionId, airtable: { id, scopes, email? } }`
//
// The access token is obtained via the ConnectionDO /token gate (single decrypt
// owner + refresh-if-needed), NOT by decrypting access_token_enc here — so an
// idle connection's expired access token is refreshed before we call Airtable
// (Phase 2 of the on-demand keep-alive reshape).
//
// Per CLAUDE.md §3.3: don't leak internal failure details (token bytes,
// Airtable response bodies) to the caller. Status code + opaque code is
// enough for the web side to surface useful copy.

import { eq } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import { connections } from "../../../../db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AIRTABLE_WHOAMI_URL = "https://api.airtable.com/v0/meta/whoami";

interface AirtableWhoami {
  id: string;
  scopes: string[];
  email?: string;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function whoamiHandler(
  _request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  connectionId: string,
): Promise<Response> {
  if (!UUID_RE.test(connectionId)) {
    return json({ error: "invalid_connection_id" }, 400);
  }
  if (!env.BASEOUT_ENCRYPTION_KEY) {
    return json(
      { error: "server_misconfigured", missing: "BASEOUT_ENCRYPTION_KEY" },
      500,
    );
  }

  const rows = await locals
    .getMasterDb()
    .db.select({
      status: connections.status,
      accessTokenEnc: connections.accessTokenEnc,
    })
    .from(connections)
    .where(eq(connections.id, connectionId))
    .limit(1);
  const row = rows[0];
  if (!row) return json({ error: "connection_not_found" }, 404);
  if (row.status !== "active") {
    return json({ error: "connection_status", status: row.status }, 409);
  }

  // Obtain the access token through the ConnectionDO /token gate rather than
  // decrypting here — the DO is the single decrypt owner and refreshes a
  // near/at-expiry token before returning it. Send both connectionId (the
  // on-demand refresh path) and encryptedToken (the legacy decrypt-only path)
  // so this works whether or not on-demand refresh is enabled.
  const stub = env.CONNECTION_DO.get(env.CONNECTION_DO.idFromName(connectionId));
  const tokenRes = await stub.fetch("http://do/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      connectionId,
      encryptedToken: row.accessTokenEnc,
    }),
  });
  if (tokenRes.status === 409) {
    // reauth_required — the refresh token is dead; the connection needs reconnecting.
    return json({ error: "connection_status", status: "pending_reauth" }, 409);
  }
  if (tokenRes.status !== 200) {
    await tokenRes.body?.cancel?.();
    return json({ error: "token_unavailable" }, 502);
  }
  const { accessToken } = (await tokenRes.json()) as { accessToken: string };

  const upstream = await fetch(AIRTABLE_WHOAMI_URL, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });
  if (upstream.status === 401) {
    return json({ error: "airtable_token_rejected" }, 502);
  }
  if (!upstream.ok) {
    return json(
      { error: "airtable_upstream", upstream_status: upstream.status },
      502,
    );
  }
  const airtable = (await upstream.json()) as AirtableWhoami;
  return json({ connectionId, airtable }, 200);
}
