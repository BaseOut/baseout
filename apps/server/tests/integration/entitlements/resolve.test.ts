import { describe, expect, it } from "vitest";
import { getBool, getLimit } from "@baseout/db-schema";
import type { AppDb } from "../../../src/db/worker";
import { resolveEntitlements } from "../../../src/lib/entitlements/resolve";

function makeFakeDb(resultSets: unknown[][]): AppDb {
  let i = 0;
  const chain: Record<string, unknown> = {};
  const passthrough = () => chain;
  chain.from = passthrough;
  chain.innerJoin = passthrough;
  chain.where = passthrough;
  chain.limit = passthrough;
  chain.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
    Promise.resolve(resultSets[i++] ?? []).then(onF, onR);
  return { select: () => chain } as unknown as AppDb;
}

describe("resolveEntitlements (server query wrapper)", () => {
  it("upgrades an org owned by an openside admin to enterprise entitlements", async () => {
    const db = makeFakeDb([
      [{ email: "staff@openside.com" }],
      [{ planId: "plan_enterprise", planSlug: "enterprise" }],
      [
        { slug: "spaces", valueType: "limit", enumValues: null, meterable: true, meterKind: "creation", valueBool: null, valueNumeric: null, valueEnum: null },
        { slug: "byo_ai_key", valueType: "boolean", enumValues: null, meterable: false, meterKind: null, valueBool: true, valueNumeric: null, valueEnum: null },
      ],
    ]);

    const res = await resolveEntitlements(db, "org_internal");

    expect(res).not.toBeNull();
    expect(res!.planSlug).toBe("enterprise");
    expect(getLimit(res!.entitlements, "spaces")).toBeNull();
    expect(getBool(res!.entitlements, "byo_ai_key")).toBe(true);
  });

  it("does not upgrade a customer org just because an openside member was invited", async () => {
    const db = makeFakeDb([
      [],
      [{ planId: "plan_core", planSlug: "core" }],
      [
        { slug: "spaces", valueType: "limit", enumValues: null, meterable: true, meterKind: "creation", valueBool: null, valueNumeric: "10", valueEnum: null },
        { slug: "byo_ai_key", valueType: "boolean", enumValues: null, meterable: false, meterKind: null, valueBool: false, valueNumeric: null, valueEnum: null },
      ],
      [],
      [],
    ]);

    const res = await resolveEntitlements(db, "org_customer");

    expect(res).not.toBeNull();
    expect(res!.planSlug).toBe("core");
    expect(getLimit(res!.entitlements, "spaces")).toBe(10);
    expect(getBool(res!.entitlements, "byo_ai_key")).toBe(false);
  });
}
);
