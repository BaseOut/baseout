// Write-path body validation (api-write-foundation task 1.1) + the echo
// operation proving the full write pipeline (task 1.2): PATCH/DELETE routing,
// content-type gate, JSON parse, Zod validation with field issues, and
// OpenAPI requestBody generation.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseValidatedBody } from "../src/lib/body";
import { ApiError } from "../src/lib/errors";
import { buildRouter, type OperationContext } from "../src/lib/registry";
import { buildOpenApiDocument } from "../src/lib/openapi";
import { operations } from "../src/operations";
import { testOperations, echoBodySchema } from "../src/operations/_test";

const schema = z.object({ message: z.string(), count: z.number().int().optional() });

function expectApiError(fn: () => unknown, code: string, param?: string): ApiError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    const e = err as ApiError;
    expect(e.status).toBe(400);
    expect(e.code).toBe(code);
    if (param) expect(e.param).toBe(param);
    return e;
  }
  throw new Error("expected an ApiError to be thrown");
}

describe("parseValidatedBody", () => {
  it("happy path: valid JSON matching the schema → parsed value", () => {
    const body = parseValidatedBody(schema, "application/json", JSON.stringify({ message: "hi", count: 2 }));
    expect(body).toEqual({ message: "hi", count: 2 });
  });

  it("accepts a content-type with charset parameter", () => {
    const body = parseValidatedBody(schema, "application/json; charset=utf-8", JSON.stringify({ message: "hi" }));
    expect(body).toEqual({ message: "hi" });
  });

  it("wrong content-type → 400 unsupported_content_type", () => {
    expectApiError(() => parseValidatedBody(schema, "text/plain", JSON.stringify({ message: "hi" })), "unsupported_content_type");
    expectApiError(() => parseValidatedBody(schema, null, JSON.stringify({ message: "hi" })), "unsupported_content_type");
  });

  it("malformed JSON → 400 invalid_json", () => {
    expectApiError(() => parseValidatedBody(schema, "application/json", "{nope"), "invalid_json");
  });

  it("schema violation → 400 invalid_body with the offending field as param", () => {
    const e = expectApiError(() => parseValidatedBody(schema, "application/json", JSON.stringify({ count: 2 })), "invalid_body", "message");
    expect(e.message).toContain("message");
  });

  it("nested field issue paths are dotted", () => {
    const nested = z.object({ a: z.object({ b: z.string() }) });
    expectApiError(() => parseValidatedBody(nested, "application/json", JSON.stringify({ a: { b: 1 } })), "invalid_body", "a.b");
  });

  it("no bodySchema → lenient parse (legacy POST search behavior)", () => {
    expect(parseValidatedBody(undefined, "application/json", JSON.stringify({ q: "x" }))).toEqual({ q: "x" });
    expect(parseValidatedBody(undefined, "application/json", "{nope")).toEqual({});
    expect(parseValidatedBody(undefined, null, "")).toEqual({});
  });
});

describe("router accepts PATCH and DELETE operations", () => {
  const router = buildRouter([...operations, ...testOperations]);

  it("matches the PATCH echo operation", () => {
    const m = router.match("PATCH", "/v1/_test/echo");
    expect(m).not.toBeNull();
    expect(m!.op.bodySchema).toBe(echoBodySchema);
  });

  it("supports DELETE in the Operation type", () => {
    const del = buildRouter([{ method: "DELETE", path: "/x/{id}", scope: "org:read", summary: "", handler: () => new Response(null, { status: 204 }) }]);
    expect(del.match("DELETE", "/x/1")!.params.id).toBe("1");
  });
});

describe("echo operation — full write path", () => {
  it("returns the validated body as the canonical representation", async () => {
    const op = testOperations[0]!;
    const body = parseValidatedBody(op.bodySchema, "application/json", JSON.stringify({ message: "hello" }));
    const c = { body, requestId: "req_1" } as unknown as OperationContext;
    const res = await op.handler(c);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ echoed: { message: "hello" } });
  });
});

describe("OpenAPI generation for write operations", () => {
  it("emits a JSON requestBody for operations with a bodySchema", () => {
    const doc = buildOpenApiDocument([...operations, ...testOperations]) as any;
    const patch = doc.paths["/v1/_test/echo"].patch;
    expect(patch.requestBody).toBeDefined();
    expect(patch.requestBody.required).toBe(true);
    expect(patch.requestBody.content["application/json"]).toBeDefined();
  });

  it("read operations stay requestBody-free", () => {
    const doc = buildOpenApiDocument(operations) as any;
    expect(doc.paths["/v1/orgs/{orgId}"].get.requestBody).toBeUndefined();
  });
});
