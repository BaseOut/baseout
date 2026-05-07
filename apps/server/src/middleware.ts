// Per-request middleware: INTERNAL_TOKEN gate for /api/internal/*.
//
// Per CLAUDE.md §5.2:
//   - /api/health is public (no token)
//   - /api/internal/* requires `x-internal-token` header to equal env.INTERNAL_TOKEN
// Per CLAUDE.md §3.3:
//   - constant-time comparison so a timing oracle can't reveal the token
//
// masterDb construction + teardown lives in src/index.ts so the try/finally
// around the route handler owns the lifecycle (apps/web pattern). This file
// is purely the auth gate.

import type { Env } from "./env";

export interface MiddlewareResult {
  /** If present, short-circuit the request with this response. */
  res?: Response;
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

export function applyMiddleware(request: Request, env: Env): MiddlewareResult {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/internal/")) {
    const presented = request.headers.get("x-internal-token");
    if (!presented || !env.INTERNAL_TOKEN) {
      return { res: unauthorized() };
    }
    if (!constantTimeEqual(presented, env.INTERNAL_TOKEN)) {
      return { res: unauthorized() };
    }
  }
  return {};
}
