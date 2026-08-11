// Slow-query telemetry for the /data browse routes (server-data-browse design
// §Route-level: "slow-query logging on the record routes from day one — this is
// the first surface where customers hit their own data at scale"). Emits a
// single structured JSON line only when a route's DB work crosses the
// threshold, so the noise floor stays at zero on healthy queries.

const SLOW_QUERY_MS = 500

/** Returns a monotonic start marker; pair with `logIfSlow`. */
export function startTimer(): number {
  return performance.now()
}

export function logIfSlow(route: string, startedAt: number, fields: Record<string, unknown>): void {
  const durationMs = Math.round(performance.now() - startedAt)
  if (durationMs < SLOW_QUERY_MS) return
  // Structured slow-query telemetry (not debug output) — see file header.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ event: 'data_slow_query', route, durationMs, ...fields }))
}
