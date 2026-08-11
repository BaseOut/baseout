import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, paginate, parseCursor, parseLimit } from "../src/lib/pagination";
import { ApiError } from "../src/lib/errors";

describe("cursor codec", () => {
  it("round-trips + is url-safe + opaque", () => {
    const c = encodeCursor(["2026-07-01T00:00:00.000Z", "run_1"]);
    expect(c).not.toMatch(/[/+=]/);
    expect(decodeCursor(c)).toEqual(["2026-07-01T00:00:00.000Z", "run_1"]);
  });
  it("decodes malformed → null", () => {
    expect(decodeCursor("!!!")).toBeNull();
    expect(decodeCursor(null)).toBeNull();
  });
});

describe("parseLimit", () => {
  it("defaults to 50, clamps errors to 400 invalid_limit", () => {
    expect(parseLimit(null)).toBe(50);
    expect(parseLimit("100")).toBe(100);
    expect(parseLimit("1")).toBe(1);
    for (const bad of ["0", "101", "5000", "abc", "-3", "1.5"]) {
      expect(() => parseLimit(bad), bad).toThrow(ApiError);
    }
  });
});

describe("parseCursor", () => {
  it("distinguishes no-cursor (null) from malformed (400 invalid_cursor)", () => {
    expect(parseCursor(null)).toBeNull();
    expect(parseCursor(encodeCursor(["x"]))).toEqual(["x"]);
    let thrown: unknown;
    try {
      parseCursor("!!!not-a-cursor");
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).code).toBe("invalid_cursor");
  });
});

describe("paginate", () => {
  const keyOf = (r: { id: string }) => [r.id];
  it("no next page when rows ≤ limit", () => {
    const r = paginate([{ id: "a" }, { id: "b" }], 5, keyOf);
    expect(r.data).toHaveLength(2);
    expect(r.pagination.nextCursor).toBeNull();
  });
  it("slices to limit and emits nextCursor from the last kept row", () => {
    const r = paginate([{ id: "a" }, { id: "b" }, { id: "c" }], 2, keyOf);
    expect(r.data.map((x) => x.id)).toEqual(["a", "b"]);
    expect(decodeCursor(r.pagination.nextCursor)).toEqual(["b"]);
  });
});
