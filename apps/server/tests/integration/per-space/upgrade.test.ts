// Pure-logic tests for the per-Space upgrade decision (system-per-space-upgrade).

import { describe, expect, it } from "vitest";
import { SPACE_SCHEMA_VERSION } from "@baseout/db-schema/space";
import { needsUpgrade } from "../../../src/lib/provisioning/upgrade";

describe("needsUpgrade", () => {
  it("treats null/undefined (legacy, unrecorded) as behind", () => {
    expect(needsUpgrade(null)).toBe(true);
    expect(needsUpgrade(undefined)).toBe(true);
  });

  it("is false when at the current version", () => {
    expect(needsUpgrade(SPACE_SCHEMA_VERSION)).toBe(false);
  });

  it("is true when behind the current version", () => {
    expect(needsUpgrade(SPACE_SCHEMA_VERSION - 1)).toBe(true);
    expect(needsUpgrade(2)).toBe(true);
  });

  it("is false when at or ahead of the current version", () => {
    expect(needsUpgrade(SPACE_SCHEMA_VERSION + 1)).toBe(false);
  });

  it("honors an explicit target version", () => {
    expect(needsUpgrade(2, 5)).toBe(true);
    expect(needsUpgrade(5, 5)).toBe(false);
    expect(needsUpgrade(4, 5)).toBe(true);
  });
});
