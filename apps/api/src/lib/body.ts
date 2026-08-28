// Request-body validation for write operations (api-write-foundation D1).
// Pure: content-type gate → JSON parse → Zod validation, each failure mapped
// to the standard 400 envelope. Operations WITHOUT a bodySchema keep the
// legacy lenient parse (POST schema/search validates server-side) so read
// behavior is unchanged.

import type { z } from "zod";
import { ApiError, invalidRequest } from "./errors";

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const mime = contentType.split(";")[0]!.trim().toLowerCase();
  return mime === "application/json" || mime.endsWith("+json");
}

/**
 * Parse + validate a raw request body against an operation's bodySchema.
 * - schema set, non-JSON content-type → 400 unsupported_content_type
 * - schema set, malformed JSON → 400 invalid_json
 * - schema set, Zod failure → 400 invalid_body (param = first issue path, message lists field issues)
 * - no schema → lenient parse ({} on anything unparseable) — legacy behavior.
 */
export function parseValidatedBody(schema: z.ZodTypeAny | undefined, contentType: string | null, rawBody: string): unknown {
  if (!schema) {
    if (!isJsonContentType(contentType)) return {};
    try {
      return JSON.parse(rawBody);
    } catch {
      return {};
    }
  }

  if (!isJsonContentType(contentType)) {
    throw invalidRequest("unsupported_content_type", "Request body must be application/json.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw invalidRequest("invalid_json", "Request body is not valid JSON.");
  }
  return validateBodyValue(schema, parsed);
}

/** Validate an already-parsed body value (shared by the REST router and the MCP dispatch). */
export function validateBodyValue(schema: z.ZodTypeAny, value: unknown): unknown {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".") || "(body)"}: ${i.message}`);
    const firstPath = result.error.issues[0]?.path.join(".") || undefined;
    throw new ApiError("invalid_request", "invalid_body", `Invalid request body — ${issues.join("; ")}`, { param: firstPath });
  }
  return result.data;
}
