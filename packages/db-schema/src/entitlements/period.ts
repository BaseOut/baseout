/**
 * Monthly-anniversary period resolver — pure, no I/O
 * (shared-entitlements design D6, metering phase).
 *
 * Flow meters (AI credits, API/MCP/SQL calls, manual backups, restores) reset
 * on a monthly cycle keyed to the SUBSCRIPTION START DATE — regardless of the
 * Stripe billing interval. This matters for annual subscriptions: their Stripe
 * period is a year, but allowances are per month, so anchoring to the Stripe
 * period would hand an annual customer 12× their monthly allowance once a year.
 *
 * Stock meters (records, file GB, DB size) don't reset — they carry over — but
 * `usage_rollups` still buckets their current level by this period so history
 * is retained per closed cycle for trends. So every rollup write, flow or
 * stock, needs the current [start, end) this function returns.
 *
 * All arithmetic is UTC so the boundary is deterministic regardless of the
 * server's timezone. The anniversary preserves the anchor's day-of-month AND
 * time-of-day; a day that doesn't exist in a shorter month clamps to that
 * month's last day (Jan-31 anchor → Feb-28/29), then rolls back to the true day
 * the following month.
 */

/** Days in the given UTC year/month (month is 0-indexed; day 0 of next month). */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/**
 * The anniversary instant for a given calendar (year, monthIndex), carrying the
 * anchor's day + time. `monthIndex` may be out of range (negative or > 11);
 * Date.UTC normalizes it across year boundaries.
 */
function anniversaryFor(year: number, monthIndex: number, anchor: Date): Date {
  const normalized = new Date(Date.UTC(year, monthIndex, 1))
  const y = normalized.getUTCFullYear()
  const m = normalized.getUTCMonth()
  const day = Math.min(anchor.getUTCDate(), daysInMonth(y, m))
  return new Date(
    Date.UTC(
      y,
      m,
      day,
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds(),
    ),
  )
}

export interface BillingPeriod {
  /** Inclusive cycle start (the current monthly anniversary). */
  start: Date
  /** Exclusive cycle end (the next monthly anniversary). */
  end: Date
}

/**
 * Return the monthly-anniversary cycle `[start, end)` containing `now`, keyed to
 * `anchor`'s day-of-month. Guarantees `start <= now < end`.
 */
export function currentMonthlyPeriod(anchor: Date, now: Date): BillingPeriod {
  // The anniversary within `now`'s own month; step back one month if it hasn't
  // arrived yet. One step always suffices — the prior anniversary lands in the
  // previous month, which is necessarily <= now.
  let start = anniversaryFor(now.getUTCFullYear(), now.getUTCMonth(), anchor)
  if (start.getTime() > now.getTime()) {
    start = anniversaryFor(now.getUTCFullYear(), now.getUTCMonth() - 1, anchor)
  }
  const end = anniversaryFor(start.getUTCFullYear(), start.getUTCMonth() + 1, anchor)
  return { start, end }
}
