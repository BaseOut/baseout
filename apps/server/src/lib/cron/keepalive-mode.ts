// Refresh-model selector for the shadow-first migration from the access-token
// sweep to the refresh-idle keep-alive (shared-oauth-refresh-keepalive).
//
// Pure so the mode-gating decisions are unit-tested without env/DB/DO. The
// wiring in oauth-refresh-deps.ts reads env.AIRTABLE_KEEPALIVE_MODE through
// resolveKeepaliveMode and branches with the predicates below.

export type KeepaliveMode = "sweep" | "shadow" | "keepalive";

/** Default when unset/unrecognized: 'sweep' (current behavior, safe rollback). */
export function resolveKeepaliveMode(raw: string | undefined): KeepaliveMode {
  if (raw === "shadow") return "shadow";
  if (raw === "keepalive") return "keepalive";
  return "sweep";
}

/**
 * Does the 15-minute access-token sweep still refresh? Yes in 'sweep' and
 * 'shadow' (shadow keeps the safety net on while the keep-alive selection is
 * observed); no in 'keepalive' (the daily job owns refresh — the sweep would
 * double-refresh).
 */
export function sweepRefreshesInMode(mode: KeepaliveMode): boolean {
  return mode !== "keepalive";
}

/** Does the daily keep-alive job actually refresh (write)? Only in 'keepalive'. */
export function keepaliveRefreshesInMode(mode: KeepaliveMode): boolean {
  return mode === "keepalive";
}

/**
 * Does the daily keep-alive job run its SELECTION for log-only observation?
 * Only in 'shadow' (in 'keepalive' it refreshes; in 'sweep' it's inert).
 */
export function keepaliveShadowsInMode(mode: KeepaliveMode): boolean {
  return mode === "shadow";
}
