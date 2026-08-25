import { describe, expect, it } from "vitest";
import {
  parseD1Locator,
  serializeD1Locator,
} from "../../../src/lib/provisioning/d1-locator";

const ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const NAME = "baseout-dev-space-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("D1 locator", () => {
  it("round-trips id + name", () => {
    const raw = serializeD1Locator({
      d1DatabaseId: ID,
      d1DatabaseName: NAME,
    });
    expect(parseD1Locator(raw)).toEqual({
      d1DatabaseId: ID,
      d1DatabaseName: NAME,
    });
  });

  it("rejects a non-UUID id", () => {
    expect(() =>
      serializeD1Locator({ d1DatabaseId: "not-a-uuid", d1DatabaseName: NAME }),
    ).toThrow(/UUID/);
  });

  it("rejects empty name", () => {
    expect(() =>
      serializeD1Locator({ d1DatabaseId: ID, d1DatabaseName: "  " }),
    ).toThrow(/empty/);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseD1Locator("not-json")).toThrow(/JSON/);
  });

  it("rejects a missing field", () => {
    expect(() => parseD1Locator(JSON.stringify({ d1DatabaseId: ID }))).toThrow(
      /d1DatabaseName/,
    );
  });
});
