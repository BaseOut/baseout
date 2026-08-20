import { describe, expect, it } from "vitest";
import { validateRecipients, nextRunAtFor } from "../../../src/lib/reports/store";

describe("validateRecipients", () => {
  it("accepts null/empty as an empty list", () => {
    expect(validateRecipients(null)).toEqual({ ok: true, recipients: [] });
    expect(validateRecipients([])).toEqual({ ok: true, recipients: [] });
  });

  it("normalizes, lowercases, and dedupes by email", () => {
    const res = validateRecipients([
      { kind: "member", email: "A@Example.com", name: " Autumn " },
      { kind: "external", email: "a@example.com" },
      { kind: "external", email: "b@example.com" },
    ]);
    expect(res.ok).toBe(true);
    expect(res.recipients).toEqual([
      { kind: "member", email: "a@example.com", name: "Autumn" },
      { kind: "external", email: "b@example.com" },
    ]);
  });

  it("rejects a bad email", () => {
    const res = validateRecipients([{ kind: "member", email: "not-an-email" }]);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/invalid recipient email/);
  });

  it("rejects a bad kind", () => {
    const res = validateRecipients([{ kind: "admin", email: "a@example.com" }]);
    expect(res.ok).toBe(false);
  });

  it("rejects more than 25 recipients", () => {
    const many = Array.from({ length: 26 }, (_, i) => ({
      kind: "external" as const,
      email: `user${i}@example.com`,
    }));
    expect(validateRecipients(many).ok).toBe(false);
  });
});

describe("nextRunAtFor", () => {
  const now = new Date("2026-04-01T00:00:00Z"); // Wednesday

  it("returns null for a manual (null cadence) report", () => {
    expect(nextRunAtFor(null, null, null, true, now)).toBeNull();
  });

  it("returns null for a disabled schedule", () => {
    expect(nextRunAtFor("weekly", 5, "09:00", false, now)).toBeNull();
  });

  it("returns null for event cadences", () => {
    expect(nextRunAtFor("data_backup", null, null, true, now)).toBeNull();
    expect(nextRunAtFor("schema_backup", null, null, true, now)).toBeNull();
  });

  it("computes the next weekly fire", () => {
    expect(nextRunAtFor("weekly", 5, "09:00", true, now)).toEqual(
      new Date("2026-04-03T09:00:00Z"),
    );
  });
});
