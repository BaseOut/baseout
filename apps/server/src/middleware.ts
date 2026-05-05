// Per-request middleware: INTERNAL_TOKEN gate for /api/internal/* + masterDb attachment.
//
// Per CLAUDE.md §5.2:
//   - /api/health is public (no token)
//   - /api/internal/* requires `x-internal-token` header to equal env.INTERNAL_TOKEN
// Per CLAUDE.md §3.3:
//   - constant-time comparison so a timing oracle can't reveal the token

import type { AppLocals, Env } from "./env";
import { createMasterDb } from "./db/worker";

export interface MiddlewareResult {
  /** If present, short-circuit the request with this response. */
  res?: Response;
  /** Per-request locals to thread into handlers. */
  locals: AppLocals;
}

/**
 * Constant-time string equality. Returns false immediately on length mismatch
 * (length itself is not secret), then XORs every byte to avoid early exit.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

export function applyMiddleware(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): MiddlewareResult {
  const locals: AppLocals = {
    masterDb: createMasterDb(env, ctx),
  };

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/internal/")) {
    const presented = request.headers.get("x-internal-token");
    if (!presented || !env.INTERNAL_TOKEN) {
      return { res: unauthorized(), locals };
    }
    if (!constantTimeEqual(presented, env.INTERNAL_TOKEN)) {
      return { res: unauthorized(), locals };
    }
  }

  return { locals };
}
