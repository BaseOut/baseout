// Single operation registry (design D8): each endpoint is declared exactly once
// — method, path template, required scope, Zod query/body/response schemas,
// handler. The router, the OpenAPI 3 generator (scripts/generate-openapi.ts), and
// the MCP tool catalog (api-mcp change) all derive from this array, so REST/docs/
// MCP drift is structurally impossible rather than CI-caught.

import type { z } from "zod";
import type { Sql } from "postgres";
import type { ApiDb } from "../db/client";
import type { Env } from "../env";
import type { Scope, TokenGrant } from "./auth";

export interface OperationContext {
  db: ApiDb;
  sql: Sql;
  env: Env;
  ctx: ExecutionContext;
  grant: TokenGrant;
  /** Path params extracted from the matched template ({orgId}, {spaceId}, …). */
  params: Record<string, string>;
  query: URLSearchParams;
  /** Parsed JSON body for POST ops (already schema-checked when bodySchema is set); undefined for GET. */
  body: unknown;
  requestId: string;
  /** Request headers (e.g. If-None-Match for ETag/304). */
  headers: Headers;
  /** Wall-clock captured once at request start (deterministic within a request). */
  now: Date;
}

export interface Operation {
  method: "GET" | "POST";
  /** Template with `{param}` segments, e.g. `/v1/orgs/{orgId}/spaces`. */
  path: string;
  scope: Scope;
  summary: string;
  querySchema?: z.ZodTypeAny;
  bodySchema?: z.ZodTypeAny;
  responseSchema?: z.ZodTypeAny;
  handler: (c: OperationContext) => Promise<Response> | Response;
}

interface CompiledOp {
  op: Operation;
  regex: RegExp;
  paramNames: string[];
}

function compile(op: Operation): CompiledOp {
  const paramNames: string[] = [];
  const pattern = op.path.replace(/\{(\w+)\}/g, (_m, name: string) => {
    paramNames.push(name);
    return "([^/]+)";
  });
  return { op, regex: new RegExp(`^${pattern}$`), paramNames };
}

export interface MatchedRoute {
  op: Operation;
  params: Record<string, string>;
}

export interface Router {
  /** Exact method+path match. */
  match(method: string, pathname: string): MatchedRoute | null;
  /** Any operation matches this path (any method) — for 404-vs-405 disambiguation. */
  pathExists(pathname: string): boolean;
  operations: Operation[];
}

export function buildRouter(ops: Operation[]): Router {
  const compiled = ops.map(compile);
  return {
    match(method, pathname) {
      for (const c of compiled) {
        if (c.op.method !== method) continue;
        const m = c.regex.exec(pathname);
        if (!m) continue;
        const params: Record<string, string> = {};
        c.paramNames.forEach((n, i) => {
          params[n] = decodeURIComponent(m[i + 1]!);
        });
        return { op: c.op, params };
      }
      return null;
    },
    pathExists(pathname) {
      return compiled.some((c) => c.regex.test(pathname));
    },
    operations: ops,
  };
}
