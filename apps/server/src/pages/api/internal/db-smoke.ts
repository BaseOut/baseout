// PoC route — confirms the per-request masterDb factory connects end-to-end.
// Runs `SELECT 1` and reports `{ db: 'ok' }` on success. Token-gated by the
// `/api/internal/` prefix in middleware. Safe to keep around long-term as a
// liveness probe for the master DB binding wiring; it does not read any rows.

import { sql } from "drizzle-orm";
import type { AppLocals, Env } from "../../../env";

export async function dbSmokeHandler(
  _request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
): Promise<Response> {
  const { db } = locals.getMasterDb();
  try {
    await db.execute(sql`select 1`);
    return new Response(JSON.stringify({ db: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ db: "error", error: message }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
