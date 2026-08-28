// Schema-agreement contract (api-write-foundation design D4): every MCP tool's
// hand-written argProps must agree with its backing operation's declared Zod
// shapes — path params (always string), querySchema keys (non-body args), and
// bodySchema keys (body args). Missing, extra, or type-mismatched properties
// fail here, so tool-schema drift is a red test instead of a silent lie.
// (Descriptions stay hand-written — that's the point of testing over generating.)
import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { operations } from "../src/operations";
import { opForTool, pathParamNames } from "../src/mcp/catalog";
import { MCP_TOOLS } from "../src/mcp/tools";

const INJECTED = new Set(["orgId", "platform", "spaceId"]);

/** Unwrap optional/default/nullable/effects wrappers to the core Zod type. */
function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let s = schema;
  for (;;) {
    const def = (s as { _def: { typeName: string; innerType?: z.ZodTypeAny; schema?: z.ZodTypeAny } })._def;
    if (def.typeName === "ZodOptional" || def.typeName === "ZodDefault" || def.typeName === "ZodNullable") s = def.innerType!;
    else if (def.typeName === "ZodEffects") s = def.schema!;
    else return s;
  }
}

function isOptional(schema: z.ZodTypeAny): boolean {
  return schema.isOptional();
}

/** Zod core type → the JSON Schema `type` keyword a tool arg must declare. */
function jsonTypeOf(schema: z.ZodTypeAny): string {
  const name = (unwrap(schema) as { _def: { typeName: string } })._def.typeName;
  switch (name) {
    case "ZodString":
    case "ZodEnum":
      return "string";
    case "ZodNumber":
      return "number"; // "integer" also accepted for int-constrained numbers
    case "ZodBoolean":
      return "boolean";
    case "ZodArray":
      return "array";
    case "ZodObject":
      return "object";
    default:
      throw new Error(`No JSON type mapping for ${name} — extend the agreement test`);
  }
}

function typeMatches(zodSchema: z.ZodTypeAny, declared: unknown): boolean {
  const prop = declared as { type?: string };
  const want = jsonTypeOf(zodSchema);
  if (want === "number") return prop.type === "number" || prop.type === "integer";
  return prop.type === want;
}

function shapeOf(schema: z.ZodTypeAny | undefined): Record<string, z.ZodTypeAny> {
  if (!schema) return {};
  const core = unwrap(schema) as z.ZodObject<z.ZodRawShape>;
  return core.shape as Record<string, z.ZodTypeAny>;
}

describe("tool argProps ⇄ operation Zod shapes (D4)", () => {
  for (const tool of MCP_TOOLS) {
    test(tool.name, () => {
      const op = opForTool(operations, tool)!;
      expect(op, `${tool.name} has no backing operation`).toBeDefined();

      // Expected args: non-injected path params + query/body schema keys.
      const expected = new Map<string, { type: "path" } | { type: "schema"; zod: z.ZodTypeAny }>();
      for (const p of pathParamNames(op.path)) {
        if (!INJECTED.has(p)) expected.set(p, { type: "path" });
      }
      const bodyShape = shapeOf(op.bodySchema);
      const queryShape = shapeOf(op.querySchema);
      if (tool.bodyArgs === "all") {
        expect(op.bodySchema, `${tool.name} is a body tool but its operation declares no bodySchema`).toBeDefined();
        for (const [k, v] of Object.entries(bodyShape)) expected.set(k, { type: "schema", zod: v });
      } else {
        for (const [k, v] of Object.entries(queryShape)) expected.set(k, { type: "schema", zod: v });
        for (const k of tool.bodyArgs ?? []) {
          expect(bodyShape[k], `${tool.name} declares body arg '${k}' the operation's bodySchema lacks`).toBeDefined();
          expected.set(k, { type: "schema", zod: bodyShape[k]! });
        }
      }

      const declaredKeys = Object.keys(tool.argProps).sort();
      expect(declaredKeys, `${tool.name} argProps drift from the operation's declared shapes`).toEqual([...expected.keys()].sort());

      for (const [name, exp] of expected) {
        const prop = tool.argProps[name] as { type?: string };
        if (exp.type === "path") {
          expect(prop.type, `${tool.name}.${name} (path param) must be string`).toBe("string");
        } else {
          expect(typeMatches(exp.zod, prop), `${tool.name}.${name}: declared '${prop.type}' mismatches the Zod shape`).toBe(true);
          // Requiredness agreement: a non-optional schema key must be a required tool arg.
          if (!isOptional(exp.zod)) {
            expect(tool.required ?? [], `${tool.name}.${name} is required by the Zod shape but not by the tool`).toContain(name);
          }
        }
      }
    });
  }
});
