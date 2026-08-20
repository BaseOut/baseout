import { describe, expect, it } from "vitest";
import { computeNextRunAt } from "../../../src/lib/reports/cadence";

const d = (iso: string) => new Date(iso);

describe("computeNextRunAt — event cadences have no clock", () => {
  it("returns null for data_backup", () => {
    expect(
      computeNextRunAt({ cadence: "data_backup", from: d("2026-04-01T00:00:00Z") }),
    ).toBeNull();
  });
  it("returns null for schema_backup", () => {
    expect(
      computeNextRunAt({ cadence: "schema_backup", from: d("2026-04-01T00:00:00Z") }),
    ).toBeNull();
  });
});

describe("computeNextRunAt — weekly", () => {
  // 2026-04-01 is a Wednesday (getUTCDay() === 3).
  it("fires later this week when the target day is still ahead", () => {
    // Wed 08:00 → next Friday (day 5) 09:00.
    const next = computeNextRunAt({
      cadence: "weekly",
      scheduleDay: 5,
      scheduleTime: "09:00",
      from: d("2026-04-01T08:00:00Z"),
    });
    expect(next).toEqual(d("2026-04-03T09:00:00Z"));
  });

  it("jumps a full week when today is the target day but the time has passed", () => {
    // Wed 10:00, target Wed (day 3) 09:00 → next Wed.
    const next = computeNextRunAt({
      cadence: "weekly",
      scheduleDay: 3,
      scheduleTime: "09:00",
      from: d("2026-04-01T10:00:00Z"),
    });
    expect(next).toEqual(d("2026-04-08T09:00:00Z"));
  });

  it("fires today when the target day is today and the time is still ahead", () => {
    const next = computeNextRunAt({
      cadence: "weekly",
      scheduleDay: 3,
      scheduleTime: "23:30",
      from: d("2026-04-01T10:00:00Z"),
    });
    expect(next).toEqual(d("2026-04-01T23:30:00Z"));
  });

  it("wraps to next week when the target day is earlier in the week", () => {
    // Wed → target Monday (day 1) is behind, so next Monday.
    const next = computeNextRunAt({
      cadence: "weekly",
      scheduleDay: 1,
      scheduleTime: "06:00",
      from: d("2026-04-01T10:00:00Z"),
    });
    expect(next).toEqual(d("2026-04-06T06:00:00Z"));
  });

  it("throws on out-of-range day", () => {
    expect(() =>
      computeNextRunAt({ cadence: "weekly", scheduleDay: 7, scheduleTime: "09:00", from: d("2026-04-01T00:00:00Z") }),
    ).toThrow(/schedule_day/);
  });
});

describe("computeNextRunAt — monthly", () => {
  it("fires this month when the day is still ahead", () => {
    const next = computeNextRunAt({
      cadence: "monthly",
      scheduleDay: 15,
      scheduleTime: "09:00",
      from: d("2026-04-01T00:00:00Z"),
    });
    expect(next).toEqual(d("2026-04-15T09:00:00Z"));
  });

  it("rolls to next month when the day has passed", () => {
    const next = computeNextRunAt({
      cadence: "monthly",
      scheduleDay: 1,
      scheduleTime: "09:00",
      from: d("2026-04-10T00:00:00Z"),
    });
    expect(next).toEqual(d("2026-05-01T09:00:00Z"));
  });

  it("rolls across the year boundary (Dec → Jan)", () => {
    const next = computeNextRunAt({
      cadence: "monthly",
      scheduleDay: 5,
      scheduleTime: "12:00",
      from: d("2026-12-10T00:00:00Z"),
    });
    expect(next).toEqual(d("2027-01-05T12:00:00Z"));
  });

  it("throws on an invalid time", () => {
    expect(() =>
      computeNextRunAt({ cadence: "monthly", scheduleDay: 5, scheduleTime: "9:00", from: d("2026-04-01T00:00:00Z") }),
    ).toThrow(/HH:MM/);
  });
});
