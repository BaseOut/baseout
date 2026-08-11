// Response helpers: bare-object single resources, `{ data, pagination }` list
// envelope, and X-Request-Id on every response (rest-read-api conventions). Extra
// headers (ETag, X-RateLimit-*) are merged in by the caller/middleware.

export function json(
  body: unknown,
  requestId: string,
  opts: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: opts.status ?? 200,
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
      ...(opts.headers ?? {}),
    },
  });
}

/** 304 for a matching If-None-Match (schema ETag). No body per HTTP. */
export function notModified(requestId: string, etag: string): Response {
  return new Response(null, {
    status: 304,
    headers: { "x-request-id": requestId, etag },
  });
}
