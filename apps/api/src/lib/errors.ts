// Error contract (rest-read-api "Error contract and request IDs"):
//   { "error": { "type", "code", "message", "param?", "requestId" } }
// type ∈ invalid_request | unauthorized | forbidden | not_found | rate_limited |
// internal. Every response (success + error) carries X-Request-Id === requestId.
// Internal failures never leak stack traces or upstream detail.

export type ApiErrorType =
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "internal";

const STATUS_BY_TYPE: Record<ApiErrorType, number> = {
  invalid_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  rate_limited: 429,
  internal: 500,
};

/** A structured, client-safe API error. `param` is set only for validation errors. */
export class ApiError extends Error {
  readonly type: ApiErrorType;
  readonly code: string;
  readonly param?: string;
  readonly status: number;
  /** extra response headers (e.g. Retry-After on 429). */
  readonly headers?: Record<string, string>;

  constructor(type: ApiErrorType, code: string, message: string, opts?: { param?: string; status?: number; headers?: Record<string, string> }) {
    super(message);
    this.name = "ApiError";
    this.type = type;
    this.code = code;
    this.param = opts?.param;
    this.status = opts?.status ?? STATUS_BY_TYPE[type];
    this.headers = opts?.headers;
  }
}

// Common constructors (tenant-safe: 404s never confirm other tenants' ids).
export const notFound = (code: string, message: string) => new ApiError("not_found", code, message);
export const unauthorized = () => new ApiError("unauthorized", "unauthorized", "Missing, invalid, or expired token.");
export const insufficientScope = (scope: string) =>
  new ApiError("forbidden", "insufficient_scope", `This token lacks the required scope: ${scope}.`);
export const invalidRequest = (code: string, message: string, param?: string) =>
  new ApiError("invalid_request", code, message, { param });
export const upstreamUnavailable = () =>
  new ApiError("internal", "upstream_unavailable", "The schema service is temporarily unavailable.", { status: 502 });
export const internalError = () => new ApiError("internal", "internal", "An unexpected error occurred.");

/** Serialize an error to the wire envelope + status + headers (X-Request-Id added by the caller). */
export function errorResponse(err: unknown, requestId: string, extraHeaders: Record<string, string> = {}): Response {
  const e = err instanceof ApiError ? err : internalError();
  const body = {
    error: {
      type: e.type,
      code: e.code,
      message: e.message,
      ...(e.param ? { param: e.param } : {}),
      requestId,
    },
  };
  return new Response(JSON.stringify(body), {
    status: e.status,
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
      ...extraHeaders,
      ...(e.headers ?? {}),
    },
  });
}
