// Dead-connection auto-invalidation (Phase 4 of shared-oauth-refresh-keepalive).
//
// A Connection whose refresh token died sits in 'pending_reauth' (stamped with
// pending_reauth_at). Per PRD §11 Q5 the dead-connection cadence ends by marking
// the connection invalid after ~10 days. This is the state-machine half —
// pending_reauth → invalid after the grace window — WITHOUT the escalating email
// cadence (deferred; the in-app notifications-inbox item already surfaces the
// reconnect prompt throughout). Pure so the grace/cutoff decision is unit-tested;
// the real UPDATE is injected by the production wiring in oauth-refresh-deps.ts.

// §11 Q5 timeline: sends at T0 / T+2d / T+5d / T+10d, then invalidate — i.e.
// invalidate once the connection has been pending_reauth for ~10 days.
export const PENDING_REAUTH_GRACE_MS = 10 * 24 * 60 * 60 * 1000;

export interface ConnectionAutoInvalidateDeps {
  now: () => Date;
  /** Flip active-platform connections stuck pending_reauth past `cutoff` to invalid; returns the count flipped. */
  invalidateStale: (cutoff: Date) => Promise<number>;
  log: (event: Record<string, unknown>) => void;
}

export async function runConnectionAutoInvalidate(
  deps: ConnectionAutoInvalidateDeps,
): Promise<{ invalidated: number }> {
  const cutoff = new Date(deps.now().getTime() - PENDING_REAUTH_GRACE_MS);
  const invalidated = await deps.invalidateStale(cutoff);
  deps.log({
    event: "connection_auto_invalidate",
    invalidated,
    graceDays: PENDING_REAUTH_GRACE_MS / (24 * 60 * 60 * 1000),
  });
  return { invalidated };
}
