// Cadence math (pure, unit-tested) — server-reports task 2.2.
//
// Computes `next_run_at` for clock-based cadences. The two event cadences
// (data_backup / schema_backup) carry no clock — they fire from the backup-
// completion hook, so this returns null for them.
//
// OPEN QUESTION (design §Window & cadence math): the timezone of
// `schedule_time` is unresolved. Until it is decided, times are interpreted as
// UTC — deterministic and DST-free. When a tz policy lands (per-Org tz vs
// fixed UTC), swap the Date.UTC construction here for a tz-aware one; the
// weekly/monthly day-edge logic is unaffected.

import type { ReportCadence } from "./types";

export interface CadenceInput {
  cadence: ReportCadence;
  /** 0–6 (Sun–Sat) for weekly; 1–28 for monthly. */
  scheduleDay?: number | null;
  /** "HH:MM", 24-hour. */
  scheduleTime?: string | null;
  /** Compute the next fire strictly after this instant. */
  from: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseTime(time: string | null | undefined): { h: number; m: number } {
  const match = typeof time === "string" ? /^(\d{2}):(\d{2})$/.exec(time) : null;
  if (!match) {
    throw new Error(`computeNextRunAt: schedule_time must be "HH:MM", got ${String(time)}`);
  }
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) {
    throw new Error(`computeNextRunAt: schedule_time out of range: ${time}`);
  }
  return { h, m };
}

/**
 * The next fire instant for a clock cadence, strictly after `from`, or null for
 * event cadences. Monthly day is constrained to 1–28 (CHECK), so every month
 * has the day and there are no month-length edge cases.
 */
export function computeNextRunAt(input: CadenceInput): Date | null {
  if (input.cadence === "data_backup" || input.cadence === "schema_backup") {
    return null;
  }

  const { h, m } = parseTime(input.scheduleTime);
  const from = input.from;

  if (input.cadence === "weekly") {
    if (input.scheduleDay == null || input.scheduleDay < 0 || input.scheduleDay > 6) {
      throw new Error(
        `computeNextRunAt: weekly schedule_day must be 0–6, got ${String(input.scheduleDay)}`,
      );
    }
    // Today at the target time (UTC), then advance to the target day-of-week.
    let candidate = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), h, m, 0, 0),
    );
    const deltaDays = (input.scheduleDay - candidate.getUTCDay() + 7) % 7;
    candidate = new Date(candidate.getTime() + deltaDays * MS_PER_DAY);
    // Strictly after `from` — if we landed on/before it, jump a full week.
    if (candidate.getTime() <= from.getTime()) {
      candidate = new Date(candidate.getTime() + 7 * MS_PER_DAY);
    }
    return candidate;
  }

  // monthly
  if (input.scheduleDay == null || input.scheduleDay < 1 || input.scheduleDay > 28) {
    throw new Error(
      `computeNextRunAt: monthly schedule_day must be 1–28, got ${String(input.scheduleDay)}`,
    );
  }
  let candidate = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), input.scheduleDay, h, m, 0, 0),
  );
  if (candidate.getTime() <= from.getTime()) {
    // Next month (Date normalizes a month overflow, e.g. Dec → Jan next year).
    candidate = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, input.scheduleDay, h, m, 0, 0),
    );
  }
  return candidate;
}
