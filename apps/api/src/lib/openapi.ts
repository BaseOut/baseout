// OpenAPI 3 generation from the operation registry (design D8, rest-read-api
// "Single operation registry and OpenAPI publication"). The document is DERIVED
// from `operations`, so a new endpoint appears automatically with no separate
// doc edit. Path + method + summary + security + path params + the shared error
// responses are emitted here; per-endpoint request/response JSON Schemas are an
// additive enrichment (v1 keeps them generic to avoid a zod-to-json-schema dep).
// The publish pipeline to docs.baseout.com is the deploy-side follow-up (5.1).

import type { Operation } from "./registry";

const ERROR_REF = { $ref: "#/components/schemas/Error" };
const ERROR_RESPONSES = {
  "400": { description: "Invalid request", content: { "application/json": { schema: ERROR_REF } } },
  "401": { description: "Unauthorized", content: { "application/json": { schema: ERROR_REF } } },
  "403": { description: "Forbidden", content: { "application/json": { schema: ERROR_REF } } },
  "404": { description: "Not found", content: { "application/json": { schema: ERROR_REF } } },
  "429": { description: "Rate limited", content: { "application/json": { schema: ERROR_REF } } },
  "500": { description: "Internal error", content: { "application/json": { schema: ERROR_REF } } },
};

function pathParams(path: string) {
  return [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1],
    in: "path" as const,
    required: true,
    schema: { type: "string" as const },
  }));
}

export function buildOpenApiDocument(operations: Operation[], version = "1.0.0"): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of operations) {
    const entry = (paths[op.path] ??= {});
    entry[op.method.toLowerCase()] = {
      summary: op.summary,
      security: [{ bearerAuth: [op.scope] }],
      parameters: pathParams(op.path),
      responses: {
        "200": { description: "OK" },
        "304": { description: "Not Modified (matching ETag)" },
        ...ERROR_RESPONSES,
      },
    };
  }

  return {
    openapi: "3.0.3",
    info: { title: "Baseout API", version, description: "Public read-only REST API for Baseout." },
    servers: [{ url: "https://api.baseout.com" }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "Baseout API token (bo_live_…)." },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              required: ["type", "code", "message", "requestId"],
              properties: {
                type: { type: "string", enum: ["invalid_request", "unauthorized", "forbidden", "not_found", "rate_limited", "internal"] },
                code: { type: "string" },
                message: { type: "string" },
                param: { type: "string" },
                requestId: { type: "string" },
              },
            },
          },
        },
      },
    },
    paths,
  };
}
