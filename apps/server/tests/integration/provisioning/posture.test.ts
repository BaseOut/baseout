import { describe, it, expect } from "vitest";
import {
  residencyPosture,
  validateProvisionRequest,
  schemaNameForSpace,
} from "../../../src/lib/provisioning/posture";

describe("residencyPosture", () => {
  it("byodb is sovereign; d1 and managed_pg are managed", () => {
    expect(residencyPosture("byodb")).toBe("sovereign");
    expect(residencyPosture("d1")).toBe("managed");
    expect(residencyPosture("managed_pg")).toBe("managed");
  });
});

describe("validateProvisionRequest", () => {
  it("accepts known backends", () => {
    expect(validateProvisionRequest({ backend: "managed_pg", recordsEnabled: false }))
      .toEqual({ ok: true });
    expect(validateProvisionRequest({ backend: "d1", recordsEnabled: true }))
      .toEqual({ ok: true });
    expect(validateProvisionRequest({ backend: "byodb", recordsEnabled: true }))
      .toEqual({ ok: true });
  });

  it("rejects an unknown backend", () => {
    expect(validateProvisionRequest({ backend: "sqlite3", recordsEnabled: true }))
      .toEqual({ ok: false, code: "invalid_backend" });
  });

  it("rejects sovereign (byodb) without a dynamic DB", () => {
    expect(validateProvisionRequest({ backend: "byodb", recordsEnabled: false }))
      .toEqual({ ok: false, code: "sovereign_requires_records" });
  });
});

describe("schemaNameForSpace", () => {
  it("derives a safe [a-z0-9_] identifier from a UUID", () => {
    const name = schemaNameForSpace("a1e8cfcd-4853-4614-a32b-a970381639ed");
    expect(name).toBe("bo_space_a1e8cfcd_4853_4614_a32b_a970381639ed");
    expect(name).toMatch(/^[a-z0-9_]+$/);
  });

  it("throws on a non-UUID (injection guard — the value reaches DDL)", () => {
    expect(() => schemaNameForSpace('x"; drop schema baseout; --')).toThrow();
    expect(() => schemaNameForSpace("not-a-uuid")).toThrow();
  });
});
