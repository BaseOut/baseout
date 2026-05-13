// Frequency → next-fire timestamp computation (Phase B of
// baseout-backup-schedule-and-cancel).
//
// Pure function — no side effects. Caller injects `now: Date`.
// Returns the unix-ms timestamp the SpaceDO should pass to
// `state.storage.setAlarm()`.
//
// Boundary rule: if `now` is at or past the would-be boundary, return
// the boundary AFTER that. The alarm has already missed its own
// boundary by definition, so "fire at exactly now" is never the answer.
//
// MVP is UTC-only. Time-zone-aware fires are out of scope (proposal.md
// Out of Scope §); when added, this is the spot to plug in the org's
// preferred TZ. The `instant` frequency throws — the instant-webhook
// path is a separate change.

export type ScheduledFrequency = "monthly" | "weekly" | "daily" | "instant";

/**
 * Compute the unix-ms timestamp of the next scheduled fire.
 *
 *   monthly → next 1st of month, 00:00:00 UTC
 *   weekly  → next Monday, 00:00:00 UTC
 *   daily   → next day, 00:00:00 UTC
 *   instant → throws (out of scope this change)
 *
 * @param frequency  one of the four supported scheduling cadences
 * @param now        the moment from which "next" is computed
 * @returns          unix-ms suitable for state.storage.setAlarm()
 * @throws TypeError on 'instant' or unknown frequency
 */
export function computeNextFire(
  frequency: ScheduledFrequency,
  now: Date,
): number {
  switch (frequency) {
    case "monthly":
      return nextFirstOfMonth(now);
    case "weekly":
      return nextMonday(now);
    case "daily":
      return nextMidnight(now);
    case "instant":
      throw new TypeError(
        "computeNextFire: 'instant' is not a scheduled frequency — the " +
          "instant-webhook path is owned by a separate change",
      );
    default: {
      const exhaustive: never = frequency;
      throw new TypeError(
        `computeNextFire: unknown frequency ${JSON.stringify(exhaustive)}`,
      );
    }
  }
}

function nextFirstOfMonth(now: Date): number {
  // Date.UTC(year, monthIndex, ...) — monthIndex is 0-based AND naturally
  // wraps (Date.UTC(2026, 12, 1) === Date.UTC(2027, 0, 1)), so the
  // year-rollover case (December → January) needs no special handling.
  const candidate = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return candidate <= now.getTime()
    ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1)
    : candidate;
}

function nextMonday(now: Date): number {
  // Day-of-week: 0=Sunday … 6=Saturday in UTC. Monday is 1.
  const day = now.getUTCDay();
  // Days until next Monday, treating "today is Monday at exactly 00:00"
  // as already past (boundary exclusive) — so when day === 1 we add 7.
  let daysAhead = (1 - day + 7) % 7;
  if (daysAhead === 0) daysAhead = 7;
  const candidate = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysAhead,
  );
  // If now is Monday but BEFORE 00:00 it can't happen — UTC days don't
  // have a "before midnight" within the same date. The exclusive rule is
  // already enforced by daysAhead=7 above.
  return candidate;
}

function nextMidnight(now: Date): number {
  // Always tomorrow's 00:00 — even if now is at exactly 00:00 today, the
  // boundary is exclusive.
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
}
