// Pure-function tests for computeNextFire (Phase B of
// baseout-backup-schedule-and-cancel).
//
// `computeNextFire(frequency, now: Date): number` returns the unix-ms
// timestamp the SpaceDO should call `state.storage.setAlarm()` with.
// MVP is UTC-only — time-zone-aware fires are explicitly out of scope
// (proposal.md Out of Scope). 'instant' is also out of scope: the
// instant-webhook path is a separate change.

import { describe, expect, it } from "vitest";
import { computeNextFire } from "../../../src/lib/scheduling/next-fire";

function utc(iso: string): Date {
  return new Date(iso);
}

function expectedMs(iso: string): number {
  return new Date(iso).getTime();
}

describe("computeNextFire — monthly", () => {
  it("mid-month → next 1st 00:00 UTC", () => {
    expect(computeNextFire("monthly", utc("2026-05-12T14:23:00.000Z"))).toBe(
      expectedMs("2026-06-01T00:00:00.000Z"),
    );
  });

  it("late month → next month's 1st", () => {
    expect(computeNextFire("monthly", utc("2026-05-31T23:59:59.999Z"))).toBe(
      expectedMs("2026-06-01T00:00:00.000Z"),
    );
  });

  it("on the 1st AFTER 00:00 → next month's 1st (no fire at exactly now)", () => {
    // If now > the boundary, we've already missed this month — the next
    // fire is the following month.
    expect(computeNextFire("monthly", utc("2026-05-01T00:00:00.001Z"))).toBe(
      expectedMs("2026-06-01T00:00:00.000Z"),
    );
  });

  it("on the 1st AT 00:00 → still next month (boundary is exclusive)", () => {
    // Per design.md: "If now() happens to BE the next-fire boundary
    // exactly, return the boundary AFTER that". The alarm has already
    // missed its own boundary by definition.
    expect(computeNextFire("monthly", utc("2026-05-01T00:00:00.000Z"))).toBe(
      expectedMs("2026-06-01T00:00:00.000Z"),
    );
  });

  it("wraps the year at December → January 1", () => {
    expect(computeNextFire("monthly", utc("2026-12-15T14:00:00.000Z"))).toBe(
      expectedMs("2027-01-01T00:00:00.000Z"),
    );
  });
});

describe("computeNextFire — weekly (next Monday 00:00 UTC)", () => {
  it("on a Wednesday → next Monday", () => {
    // 2026-05-13 is a Wednesday.
    expect(computeNextFire("weekly", utc("2026-05-13T14:00:00.000Z"))).toBe(
      expectedMs("2026-05-18T00:00:00.000Z"),
    );
  });

  it("on a Sunday → tomorrow (Monday)", () => {
    // 2026-05-17 is a Sunday.
    expect(computeNextFire("weekly", utc("2026-05-17T23:59:00.000Z"))).toBe(
      expectedMs("2026-05-18T00:00:00.000Z"),
    );
  });

  it("on a Monday AFTER 00:00 → next Monday (week later)", () => {
    // 2026-05-18 is a Monday.
    expect(computeNextFire("weekly", utc("2026-05-18T00:00:00.001Z"))).toBe(
      expectedMs("2026-05-25T00:00:00.000Z"),
    );
  });

  it("on a Monday AT 00:00 → next Monday (boundary is exclusive)", () => {
    expect(computeNextFire("weekly", utc("2026-05-18T00:00:00.000Z"))).toBe(
      expectedMs("2026-05-25T00:00:00.000Z"),
    );
  });
});

describe("computeNextFire — daily (next day 00:00 UTC)", () => {
  it("mid-day → tomorrow", () => {
    expect(computeNextFire("daily", utc("2026-05-12T14:23:00.000Z"))).toBe(
      expectedMs("2026-05-13T00:00:00.000Z"),
    );
  });

  it("just before midnight → tomorrow", () => {
    expect(computeNextFire("daily", utc("2026-05-12T23:59:59.999Z"))).toBe(
      expectedMs("2026-05-13T00:00:00.000Z"),
    );
  });

  it("at 00:00 sharp → tomorrow (boundary is exclusive)", () => {
    expect(computeNextFire("daily", utc("2026-05-12T00:00:00.000Z"))).toBe(
      expectedMs("2026-05-13T00:00:00.000Z"),
    );
  });

  it("month rollover: last day → first of next month", () => {
    expect(computeNextFire("daily", utc("2026-05-31T14:00:00.000Z"))).toBe(
      expectedMs("2026-06-01T00:00:00.000Z"),
    );
  });

  it("year rollover: Dec 31 → Jan 1", () => {
    expect(computeNextFire("daily", utc("2026-12-31T14:00:00.000Z"))).toBe(
      expectedMs("2027-01-01T00:00:00.000Z"),
    );
  });
});

describe("computeNextFire — instant (out of scope)", () => {
  it("throws on instant — the instant-webhook path is a separate change", () => {
    expect(() =>
      computeNextFire("instant", utc("2026-05-12T14:23:00.000Z")),
    ).toThrow(/instant/i);
  });
});

describe("computeNextFire — invalid frequency", () => {
  it("throws on an unknown frequency", () => {
    expect(() =>
      computeNextFire("hourly" as never, utc("2026-05-12T14:23:00.000Z")),
    ).toThrow();
  });
});
