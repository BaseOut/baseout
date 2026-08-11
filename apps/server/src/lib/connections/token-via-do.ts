// Valid Airtable access token for a Connection via the ConnectionDO /token
// gate (refresh-if-needed) — the single production token-access path for
// engine-side background/lifecycle work. Extracted from
// lib/cron/webhook-renewal-deps.ts when the Phase E webhook lifecycle routes
// (server-instant-webhook) became the second consumer; no crypto is
// reimplemented here — the DO owns decrypt/refresh/persist.
//
// connectionId drives the on-demand refresh path; encryptedToken rides along
// as the legacy decrypt-only fallback used when on-demand refresh is
// disabled. Returns null when the token can't be produced (row missing,
// pending_reauth, transient DO failure) — callers decide whether that's
// transient or a reauth state.

import { eq } from "drizzle-orm";
import { connections } from "../../db/schema";
import type { createMasterDb } from "../../db/worker";
import type { Env } from "../../env";

type MasterDb = ReturnType<typeof createMasterDb>["db"];

export async function getConnectionTokenViaDO(
  env: Env,
  db: MasterDb,
  connectionId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ accessTokenEnc: connections.accessTokenEnc })
    .from(connections)
    .where(eq(connections.id, connectionId))
    .limit(1);
  if (!row) return null;

  const stub = env.CONNECTION_DO.get(env.CONNECTION_DO.idFromName(connectionId));
  const res = await stub.fetch("http://do/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      connectionId,
      encryptedToken: row.accessTokenEnc,
    }),
  });
  if (res.status !== 200) {
    await res.body?.cancel?.();
    return null;
  }
  const { accessToken } = (await res.json()) as { accessToken: string };
  return accessToken;
}
