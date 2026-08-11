// Tier gate for interface backup (server-mcp-interface-pages). Pure — placed
// under tests/integration/** so the server test runner picks it up.

import { describe, expect, it } from "vitest";
import { interfaceBackupEnabled } from "../../src/lib/capabilities/interface-backup";
import type { Tier } from "../../src/lib/capabilities/tier-capabilities";

describe("interfaceBackupEnabled", () => {
  it.each<[Tier, boolean]>([
    ["starter", false],
    ["launch", false],
    ["growth", true],
    ["pro", true],
    ["business", true],
    ["enterprise", true],
  ])("%s → %s", (tier, expected) => {
    expect(interfaceBackupEnabled(tier)).toBe(expected);
  });

  it("no active subscription (null tier) → false", () => {
    expect(interfaceBackupEnabled(null)).toBe(false);
  });
});
