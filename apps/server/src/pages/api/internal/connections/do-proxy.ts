// Worker → ConnectionDO HTTP proxy for the Trigger.dev backup-base task.
//
// The task runs in Node, where DurableObject bindings don't resolve. So
// these thin POST routes accept the task's HTTP request and forward into
// the DO via the in-workerd binding:
//   POST /api/internal/connections/:connectionId/lock    → DO POST /lock
//   POST /api/internal/connections/:connectionId/unlock  → DO POST /unlock
//   POST /api/internal/connections/:connectionId/token   → DO POST /token
//
// `connectionId` is the master-DB connections.id (UUID); idFromName(...)
// hashes it to a stable DO id so the same Connection always lands in the
// same DO — that's where the lock + token cache live.
//
// Body forwarding: /token expects `{ encryptedToken }` and the proxy passes
// the request body through verbatim. /lock and /unlock take no body.

import type { Env } from "../../../../env";

export type ConnectionDOProxyAction = "lock" | "unlock" | "token";

export async function connectionDOProxyHandler(
  request: Request,
  env: Env,
  connectionId: string,
  action: ConnectionDOProxyAction,
): Promise<Response> {
  const id = env.CONNECTION_DO.idFromName(connectionId);
  const stub = env.CONNECTION_DO.get(id);

  if (action === "token") {
    const body = await request.text();
    return stub.fetch("http://do/token", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
    });
  }
  return stub.fetch(`http://do/${action}`, { method: "POST" });
}
