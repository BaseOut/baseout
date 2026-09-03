// PoC route — confirms the Worker → R2 binding WRITE path works in the
// deployed env (bucket exists + binding accepts .put, not just .get).
// Token-gated by /api/internal/* in middleware, same as __trigger-smoke.
// Context: wrangler.jsonc describes BACKUPS_R2 as "read-only by discipline";
// R2 bindings are always read/write capable — this probe settles whether the
// deployed bucket accepts writes (Sep-2 sync follow-up). Writes one tiny
// object under __smoke/, reads it back, deletes it, reports each step.

import type { AppLocals, Env } from "../../../env";

export async function r2SmokeHandler(
  _request: Request,
  env: Env,
  _ctx: ExecutionContext,
  _locals: AppLocals,
): Promise<Response> {
  const key = `__smoke/r2-smoke-${Date.now()}.txt`;
  const body = `r2-smoke ${new Date().toISOString()}`;
  const result: Record<string, unknown> = { key };
  try {
    if (!env.BACKUPS_R2) {
      return json({ error: "r2_binding_unavailable" }, 503);
    }
    await env.BACKUPS_R2.put(key, body);
    result.put = "ok";
    const obj = await env.BACKUPS_R2.get(key);
    result.get = obj ? ((await obj.text()) === body ? "ok" : "mismatch") : "missing";
    await env.BACKUPS_R2.delete(key);
    result.delete = "ok";
    return json(result, 200);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    return json(result, 500);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
