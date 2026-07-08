// Pure-logic tests for assembleChangelog (server-schema-changelog). No DB — the
// assembler takes already-fetched modification + removal rows and produces the
// sorted, limited feed. Placed under tests/integration/** so the server test
// runner picks it up, though it touches no bindings.

import { describe, expect, it } from "vitest";
import {
  assembleChangelog,
  type ChangelogModificationRow,
  type ChangelogRemovalRow,
} from "../../../src/lib/per-space/schema-changelog";

const mod = (over: Partial<ChangelogModificationRow>): ChangelogModificationRow => ({
  id: "u1",
  runId: "run1",
  entityType: "field",
  entityId: "fldA",
  baseId: "appX",
  tableId: "tblA",
  changeType: "name",
  changeTypeName: "Name",
  beforeValue: "Old",
  afterValue: "New",
  breaksData: false,
  at: "2026-06-01T00:00:00.000Z",
  ...over,
});

const removal = (over: Partial<ChangelogRemovalRow>): ChangelogRemovalRow => ({
  runId: "run2",
  entityType: "table",
  entityId: "tblGone",
  baseId: "appX",
  tableId: "tblGone",
  name: "Archive",
  at: "2026-06-02T00:00:00.000Z",
  ...over,
});

describe("assembleChangelog", () => {
  it("returns an empty feed for no rows", () => {
    expect(assembleChangelog([], []).entries).toEqual([]);
  });

  it("maps a modification row, carrying before/after + breaksData", () => {
    const { entries } = assembleChangelog(
      [mod({ changeType: "type", breaksData: true, beforeValue: "text", afterValue: "number" })],
      [],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "modified",
      entityType: "field",
      changeType: "type",
      before: "text",
      after: "number",
      breaksData: true,
    });
  });

  it("maps a removal row with its name and null before/after", () => {
    const { entries } = assembleChangelog([], [removal({})]);
    expect(entries[0]).toMatchObject({
      kind: "removed",
      entityType: "table",
      entityName: "Archive",
      before: null,
      after: null,
      breaksData: false,
    });
  });

  it("merges modifications + removals sorted by date descending, nulls last", () => {
    const { entries } = assembleChangelog(
      [
        mod({ id: "old", at: "2026-05-01T00:00:00.000Z" }),
        mod({ id: "newest", at: "2026-06-10T00:00:00.000Z" }),
        mod({ id: "nodate", at: null }),
      ],
      [removal({ at: "2026-06-05T00:00:00.000Z" })],
    );
    expect(entries.map((e) => e.at)).toEqual([
      "2026-06-10T00:00:00.000Z",
      "2026-06-05T00:00:00.000Z",
      "2026-05-01T00:00:00.000Z",
      null,
    ]);
  });

  it("applies the limit after sorting (keeps the most recent)", () => {
    const { entries } = assembleChangelog(
      [
        mod({ id: "a", at: "2026-06-01T00:00:00.000Z" }),
        mod({ id: "b", at: "2026-06-03T00:00:00.000Z" }),
        mod({ id: "c", at: "2026-06-02T00:00:00.000Z" }),
      ],
      [],
      { limit: 2 },
    );
    expect(entries.map((e) => e.at)).toEqual([
      "2026-06-03T00:00:00.000Z",
      "2026-06-02T00:00:00.000Z",
    ]);
  });
});
