// Pure-module tests for the workspace auto-enroll decision
// (server-mcp-workspaces): enrollment filtering, the standing new-workspaces
// flag (unknown→known only; existing rows never modified), legacy-flag
// precedence, ordering, and cap behavior (add-until-cap, skip the rest).

import { describe, it, expect } from "vitest";
import { decideAutoEnroll, type WorkspaceListingEntry } from "../../src/lib/workspaces/auto-enroll";

const ws = (id: string, bases: { atBaseId: string; name: string }[], name?: string): WorkspaceListingEntry => ({
  workspaceId: id,
  workspaceName: name ?? `Workspace ${id}`,
  bases,
});

const base = (id: string, name: string) => ({ atBaseId: id, name });

const defaults = {
  autoEnrollNewWorkspaces: false,
  legacyAutoAddFutureBases: false,
  configuredBaseIds: new Set<string>(),
  cap: null as number | null,
  currentIncludedCount: 0,
};

describe("decideAutoEnroll — enrollment rows govern", () => {
  it("adds unconfigured bases of enrolled workspaces with the auto-add flag on", () => {
    const d = decideAutoEnroll({
      ...defaults,
      enrolled: [{ workspaceId: "wsA", autoEnrollFutureBases: true }],
      listing: [ws("wsA", [base("app1", "Zeta"), base("app2", "Alpha")])],
      configuredBaseIds: new Set(["app1"]),
    });
    expect(d.toAdd).toEqual([
      { workspaceId: "wsA", workspaceName: "Workspace wsA", atBaseId: "app2", name: "Alpha" },
    ]);
    expect(d.workspacesToEnroll).toEqual([]);
    expect(d.skipped).toEqual([]);
  });

  it("an enrolled workspace with the flag OFF contributes nothing (opt-out stands)", () => {
    const d = decideAutoEnroll({
      ...defaults,
      enrolled: [{ workspaceId: "wsA", autoEnrollFutureBases: false }],
      listing: [ws("wsA", [base("app1", "New base")])],
    });
    expect(d.toAdd).toEqual([]);
  });

  it("un-enrolled workspaces are ignored when the standing flag is off", () => {
    const d = decideAutoEnroll({
      ...defaults,
      enrolled: [{ workspaceId: "wsA", autoEnrollFutureBases: true }],
      listing: [ws("wsA", []), ws("wsNew", [base("app9", "Other")])],
    });
    expect(d.toAdd).toEqual([]);
    expect(d.workspacesToEnroll).toEqual([]);
  });
});

describe("decideAutoEnroll — standing new-workspaces flag", () => {
  it("auto-enrolls workspaces without a row and adds their bases; existing rows untouched", () => {
    const d = decideAutoEnroll({
      ...defaults,
      autoEnrollNewWorkspaces: true,
      enrolled: [{ workspaceId: "wsOptOut", autoEnrollFutureBases: false }],
      listing: [
        ws("wsOptOut", [base("appX", "Excluded by opt-out")]),
        ws("wsNew", [base("appN", "Brand new")], "Fresh Team"),
      ],
    });
    expect(d.workspacesToEnroll).toEqual([{ workspaceId: "wsNew", workspaceName: "Fresh Team" }]);
    expect(d.toAdd).toEqual([
      { workspaceId: "wsNew", workspaceName: "Fresh Team", atBaseId: "appN", name: "Brand new" },
    ]);
  });

  it("the standing flag does NOT apply under legacy precedence (no rows)", () => {
    const d = decideAutoEnroll({
      ...defaults,
      autoEnrollNewWorkspaces: true,
      enrolled: [],
      listing: [ws("wsA", [base("app1", "B")])],
    });
    // No rows + legacy flag off → nothing (rows are the unit of truth only once they exist).
    expect(d.toAdd).toEqual([]);
    expect(d.workspacesToEnroll).toEqual([]);
  });
});

describe("decideAutoEnroll — legacy precedence (no rows)", () => {
  it("legacy flag on = all workspaces including future, NO rows materialized", () => {
    const d = decideAutoEnroll({
      ...defaults,
      legacyAutoAddFutureBases: true,
      enrolled: [],
      listing: [ws("wsA", [base("app1", "A")]), ws("wsB", [base("app2", "B")])],
    });
    expect(d.toAdd.map((c) => c.atBaseId)).toEqual(["app1", "app2"]);
    expect(d.workspacesToEnroll).toEqual([]); // lazy migration — first UI save materializes
  });

  it("legacy flag is IGNORED once any row exists", () => {
    const d = decideAutoEnroll({
      ...defaults,
      legacyAutoAddFutureBases: true,
      enrolled: [{ workspaceId: "wsA", autoEnrollFutureBases: false }],
      listing: [ws("wsA", [base("app1", "A")]), ws("wsB", [base("app2", "B")])],
    });
    expect(d.toAdd).toEqual([]); // wsA opted out; wsB unknown + standing flag off
  });
});

describe("decideAutoEnroll — ordering + cap", () => {
  const listing = [
    ws("wsB", [base("app3", "Charlie"), base("app2", "Bravo")], "Second"),
    ws("wsA", [base("app1", "Alpha")], "First"),
  ];
  const enrolled = [
    { workspaceId: "wsA", autoEnrollFutureBases: true },
    { workspaceId: "wsB", autoEnrollFutureBases: true },
  ];

  it("orders by workspace listing order then base name", () => {
    const d = decideAutoEnroll({ ...defaults, enrolled, listing });
    expect(d.toAdd.map((c) => c.atBaseId)).toEqual(["app2", "app3", "app1"]);
  });

  it("stops at the cap and reports the rest as skipped (never partial-silent)", () => {
    const d = decideAutoEnroll({
      ...defaults,
      enrolled,
      listing,
      cap: 5,
      currentIncludedCount: 4, // one slot left
    });
    expect(d.toAdd.map((c) => c.atBaseId)).toEqual(["app2"]);
    expect(d.skipped.map((c) => c.atBaseId)).toEqual(["app3", "app1"]);
  });

  it("cap already reached: everything skipped; null cap = unlimited", () => {
    const capped = decideAutoEnroll({ ...defaults, enrolled, listing, cap: 3, currentIncludedCount: 3 });
    expect(capped.toAdd).toEqual([]);
    expect(capped.skipped).toHaveLength(3);

    const unlimited = decideAutoEnroll({ ...defaults, enrolled, listing, cap: null, currentIncludedCount: 999 });
    expect(unlimited.toAdd).toHaveLength(3);
  });

  it("already-configured bases (included OR excluded) are never re-added and never consume cap", () => {
    const d = decideAutoEnroll({
      ...defaults,
      enrolled,
      listing,
      configuredBaseIds: new Set(["app2", "app3"]),
      cap: 5,
      currentIncludedCount: 4,
    });
    expect(d.toAdd.map((c) => c.atBaseId)).toEqual(["app1"]);
    expect(d.skipped).toEqual([]);
  });
});
