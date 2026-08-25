import { describe, expect, it } from "vitest";
import { resolveSpaceD1Name } from "../../../src/lib/provisioning/d1-name";

const SPACE_UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("resolveSpaceD1Name", () => {
  it("produces the canonical name for each env with a UUID space id", () => {
    expect(resolveSpaceD1Name("dev", SPACE_UUID)).toBe(
      `baseout-dev-space-${SPACE_UUID}`,
    );
    expect(resolveSpaceD1Name("staging", SPACE_UUID)).toBe(
      `baseout-staging-space-${SPACE_UUID}`,
    );
    expect(resolveSpaceD1Name("prod", SPACE_UUID)).toBe(
      `baseout-prod-space-${SPACE_UUID}`,
    );
  });

  it("keeps the total length within D1's 64-char limit for a 36-char UUID", () => {
    for (const env of ["dev", "staging", "prod"]) {
      const name = resolveSpaceD1Name(env, SPACE_UUID);
      expect(name.length).toBeLessThanOrEqual(64);
    }
  });

  it("emits only D1-legal characters", () => {
    const name = resolveSpaceD1Name("prod", SPACE_UUID);
    expect(name).toMatch(/^[a-zA-Z0-9-_]{1,64}$/);
  });

  it("throws on an empty or whitespace env", () => {
    expect(() => resolveSpaceD1Name("", SPACE_UUID)).toThrow();
    expect(() => resolveSpaceD1Name("   ", SPACE_UUID)).toThrow();
  });

  it("throws on an empty or whitespace spaceId", () => {
    expect(() => resolveSpaceD1Name("prod", "")).toThrow();
    expect(() => resolveSpaceD1Name("prod", "   ")).toThrow();
  });

  it("throws on uppercase characters in either input", () => {
    expect(() => resolveSpaceD1Name("Prod", SPACE_UUID)).toThrow();
    expect(() =>
      resolveSpaceD1Name("prod", SPACE_UUID.toUpperCase()),
    ).toThrow();
  });

  it("throws on invalid characters in either input", () => {
    expect(() => resolveSpaceD1Name("pr.od", SPACE_UUID)).toThrow();
    expect(() => resolveSpaceD1Name("prod", "space id")).toThrow();
  });
});
