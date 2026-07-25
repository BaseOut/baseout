import { describe, expect, it } from "vitest";
import { buildRouter, type Operation } from "../src/lib/registry";
import { operations } from "../src/operations";
import { buildOpenApiDocument } from "../src/lib/openapi";
import { rateDecision } from "../src/lib/ratelimit";

const noop: Operation["handler"] = () => new Response(null);

describe("router", () => {
  const router = buildRouter(operations);

  it("matches a nested path and extracts params", () => {
    const m = router.match("GET", "/v1/orgs/org_1/spaces/space_2/backups/runs/run_3");
    expect(m).not.toBeNull();
    expect(m!.params).toMatchObject({ orgId: "org_1", spaceId: "space_2", runId: "run_3" });
  });

  it("distinguishes the platforms listing from the {platform}/schema subtree", () => {
    const platforms = router.match("GET", "/v1/orgs/o/spaces/s/platforms");
    expect(platforms!.op.path).toBe("/v1/orgs/{orgId}/spaces/{spaceId}/platforms");
    const schema = router.match("GET", "/v1/orgs/o/spaces/s/at/schema/bases");
    expect(schema!.op.path).toBe("/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/bases");
    expect(schema!.params.platform).toBe("at");
  });

  it("no method match but path exists → pathExists true (405 path)", () => {
    expect(router.match("DELETE", "/v1/orgs/o/spaces/s/backups/runs")).toBeNull();
    expect(router.pathExists("/v1/orgs/o/spaces/s/backups/runs")).toBe(true);
  });

  it("unknown path → no match and pathExists false (404 path)", () => {
    expect(router.match("GET", "/v1/orgs/o/nope")).toBeNull();
    expect(router.pathExists("/v1/orgs/o/nope")).toBe(false);
  });

  it("supports GET and POST on the same schema/search template", () => {
    expect(buildRouter([
      { method: "GET", path: "/x/{a}", scope: "org:read", summary: "", handler: noop },
      { method: "POST", path: "/x/{a}", scope: "org:read", summary: "", handler: noop },
    ]).match("POST", "/x/1")!.op.method).toBe("POST");
  });
});

describe("OpenAPI generation from the registry", () => {
  it("emits every registry path under bearer security + the Error schema", () => {
    const doc = buildOpenApiDocument(operations) as any;
    for (const op of operations) {
      expect(doc.paths[op.path], op.path).toBeDefined();
      expect(doc.paths[op.path][op.method.toLowerCase()].security).toEqual([{ bearerAuth: [op.scope] }]);
    }
    expect(doc.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
    expect(doc.components.schemas.Error).toBeDefined();
  });
});

describe("rateDecision (shadow vs enforce)", () => {
  it("under limit → no block, headers reflect remaining", () => {
    const d = rateDecision(true, false);
    expect(d.block).toBe(false);
    expect(d.headers["x-ratelimit-remaining"]).not.toBe("0");
  });
  it("over limit + shadow → no block but remaining 0", () => {
    const d = rateDecision(false, false);
    expect(d.block).toBe(false);
    expect(d.headers["x-ratelimit-remaining"]).toBe("0");
  });
  it("over limit + enforce → block with Retry-After", () => {
    const d = rateDecision(false, true);
    expect(d.block).toBe(true);
    expect(d.headers["retry-after"]).toBeDefined();
  });
});
