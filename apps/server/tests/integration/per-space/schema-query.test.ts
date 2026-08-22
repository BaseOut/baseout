// Pure-logic tests for the internal schema read/search helpers
// (server-rest-read-support). The drizzle execution lives in space-db-pg.ts and
// is exercised by the deployed smoke; the cursor codec, LIKE-pattern building,
// and defensive config re-validation are pure and unit-tested here.

import { describe, expect, it } from "vitest";
import {
  decodeCursor,
  encodeCursor,
  escapeLike,
  likePattern,
  normalizeSearchConfig,
  paginateChangelog,
  pickLatestSchemaHashByBase,
  type PaginableEntry,
} from "../../../src/lib/per-space/schema-query";

describe("cursor codec", () => {
  it("round-trips a keyset cursor", () => {
    const c = encodeCursor(["Podcast", "field", "fldA"]);
    expect(decodeCursor(c)).toEqual(["Podcast", "field", "fldA"]);
  });

  it("is opaque (base64url, no raw values) and url-safe", () => {
    const c = encodeCursor(["a/b+c", "base", "appX"]);
    expect(c).not.toContain("/");
    expect(c).not.toContain("+");
    expect(c).not.toContain("=");
    expect(decodeCursor(c)).toEqual(["a/b+c", "base", "appX"]);
  });

  it("returns null for a malformed cursor instead of throwing", () => {
    expect(decodeCursor("!!!not base64!!!")).toBeNull();
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor(Buffer.from("not json").toString("base64url"))).toBeNull();
  });

  it("preserves null sort values (e.g. null description tie-break)", () => {
    const c = encodeCursor([null, "field", "fldA"]);
    expect(decodeCursor(c)).toEqual([null, "field", "fldA"]);
  });
});

describe("escapeLike", () => {
  it("escapes % and _ so they match literally", () => {
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
  });

  it("escapes the escape character itself first", () => {
    expect(escapeLike("a\\b")).toBe("a\\\\b");
    // combined: backslash then percent
    expect(escapeLike("\\%")).toBe("\\\\\\%");
  });
});

describe("likePattern", () => {
  it("wraps with % for contains, appends for prefix, none for exact — input escaped", () => {
    expect(likePattern("email", "contains")).toBe("%email%");
    expect(likePattern("email", "prefix")).toBe("email%");
    expect(likePattern("email", "exact")).toBe("email");
    expect(likePattern("a%b", "contains")).toBe("%a\\%b%"); // literal % preserved, wildcards are ours
  });
});

describe("normalizeSearchConfig", () => {
  it("applies defaults for a bare query", () => {
    const r = normalizeSearchConfig({ query: "email" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.query).toBe("email");
    expect(r.config.types).toEqual(["base", "table", "field", "view"]);
    expect(r.config.match.mode).toBe("contains");
    expect(r.config.match.in).toEqual(["name", "description"]);
    expect(r.config.limit).toBeGreaterThan(0);
  });

  it("accepts the full owner-facing shape", () => {
    const r = normalizeSearchConfig({
      query: "Archived",
      types: ["field"],
      match: { mode: "exact", in: ["options"] },
      filters: { baseIds: ["appX"], fieldTypes: ["singleSelect"], isPrimary: true, changedAfter: "2026-06-01T00:00:00.000Z" },
      limit: 25,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.types).toEqual(["field"]);
    expect(r.config.match).toEqual({ mode: "exact", in: ["options"] });
    expect(r.config.filters.fieldTypes).toEqual(["singleSelect"]);
    expect(r.config.filters.isPrimary).toBe(true);
  });

  it("rejects an unknown top-level property naming the offending param", () => {
    const r = normalizeSearchConfig({ query: "x", bogus: 1 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.param).toBe("bogus");
  });

  it("rejects a bad enum value (type / match.mode)", () => {
    expect(normalizeSearchConfig({ query: "x", types: ["nope"] }).ok).toBe(false);
    expect(normalizeSearchConfig({ query: "x", match: { mode: "fuzzy" } }).ok).toBe(false);
  });

  it("requires a non-empty query string", () => {
    expect(normalizeSearchConfig({}).ok).toBe(false);
    expect(normalizeSearchConfig({ query: "" }).ok).toBe(false);
    expect(normalizeSearchConfig({ query: 5 }).ok).toBe(false);
  });

  it("clamps limit into range", () => {
    const hi = normalizeSearchConfig({ query: "x", limit: 100000 });
    const lo = normalizeSearchConfig({ query: "x", limit: -3 });
    expect(hi.ok && hi.config.limit).toBeLessThanOrEqual(200);
    expect(lo.ok && lo.config.limit).toBeGreaterThanOrEqual(1);
  });
});

describe("paginateChangelog", () => {
  const e = (over: Partial<PaginableEntry>): PaginableEntry => ({
    at: "2026-07-01T00:00:00.000Z",
    entityType: "field",
    entityId: "fldA",
    changeType: "name",
    breaksData: false,
    kind: "modified",
    ...over,
  });
  // newest-first (as assembleChangelog returns them)
  const feed: PaginableEntry[] = [
    e({ at: "2026-07-05T00:00:00.000Z", entityId: "f5", breaksData: true, changeType: "type" }),
    e({ at: "2026-07-04T00:00:00.000Z", entityId: "f4", entityType: "table", changeType: "name" }),
    e({ at: "2026-07-03T00:00:00.000Z", entityId: "f3", kind: "removed", changeType: null }),
    e({ at: "2026-07-02T00:00:00.000Z", entityId: "f2", breaksData: true, changeType: "type" }),
    e({ at: "2026-07-01T00:00:00.000Z", entityId: "f1" }),
  ];

  it("filters breaksData + from window (newest-first preserved)", () => {
    const r = paginateChangelog(feed, { breaksData: true, from: "2026-07-03T00:00:00.000Z", limit: 50 });
    expect(r.entries.map((x) => x.entityId)).toEqual(["f5"]); // f2 breaks data but is before the window
  });

  it("filters by entityType and changeType", () => {
    expect(paginateChangelog(feed, { entityType: "table", limit: 50 }).entries.map((x) => x.entityId)).toEqual(["f4"]);
    expect(paginateChangelog(feed, { changeType: "type", limit: 50 }).entries.map((x) => x.entityId)).toEqual(["f5", "f2"]);
  });

  it("keyset-paginates with a stable cursor across pages (no gaps/dupes)", () => {
    const p1 = paginateChangelog(feed, { limit: 2 });
    expect(p1.entries.map((x) => x.entityId)).toEqual(["f5", "f4"]);
    expect(p1.nextCursor).toBeTruthy();
    const p2 = paginateChangelog(feed, { limit: 2, cursor: p1.nextCursor! });
    expect(p2.entries.map((x) => x.entityId)).toEqual(["f3", "f2"]);
    const p3 = paginateChangelog(feed, { limit: 2, cursor: p2.nextCursor! });
    expect(p3.entries.map((x) => x.entityId)).toEqual(["f1"]);
    expect(p3.nextCursor).toBeNull();
  });
});

describe("pickLatestSchemaHashByBase", () => {
  it("keeps the newest startedAt hash per base in one pass", () => {
    const older = new Date("2026-01-01T00:00:00Z");
    const newer = new Date("2026-08-01T00:00:00Z");
    expect(
      pickLatestSchemaHashByBase([
        { baseId: "appA", hash: "old", startedAt: older },
        { baseId: "appB", hash: "b", startedAt: older },
        { baseId: "appA", hash: "new", startedAt: newer },
      ]),
    ).toEqual({ appA: "new", appB: "b" });
  });

  it("treats a missing startedAt as oldest", () => {
    expect(
      pickLatestSchemaHashByBase([
        { baseId: "appA", hash: "no-ts", startedAt: null },
        { baseId: "appA", hash: "dated", startedAt: new Date("2026-01-01T00:00:00Z") },
      ]),
    ).toEqual({ appA: "dated" });
  });
});
