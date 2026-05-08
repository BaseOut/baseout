// Trigger.dev-task-side helper: POST a CSV to apps/server's
// /api/internal/runs/:runId/upload-csv route, which writes it to R2 via
// the BACKUP_BUCKET binding.
//
// Why this exists:
//   The backup-base task runs in Node (Trigger.dev runner), not workerd.
//   R2 bindings are workerd-only. So the task can't `env.BACKUP_BUCKET.put`
//   directly — it has to round-trip through the Worker. This helper is
//   the round-trip.
//
// Wire format (matches the route handler in
// apps/server/src/pages/api/internal/runs/upload-csv.ts):
//   POST {engineUrl}/api/internal/runs/{runId}/upload-csv
//     headers:
//       x-internal-token: <INTERNAL_TOKEN>
//       content-type: application/json
//     body: { key, contentType, body }
//   200 → { ok: true, key, size }
//   4xx/5xx → { error: '...' }
//
// On a network error (fetch throws): we synthesize { ok: false, status: 0,
// error: 'unreachable' } so the caller can branch on a single shape.

export interface PutCsvViaProxyOptions {
  /** Base URL of apps/server, e.g. https://baseout-server-dev.openside.workers.dev. Trailing slash tolerated. */
  engineUrl: string;
  /** Shared secret matching apps/server's INTERNAL_TOKEN. */
  internalToken: string;
  /** Backup-runs row id — currently used for the URL path; future iterations will validate against masterDb. */
  runId: string;
  /** R2 object key, e.g. "acme/MainSpace/Tasks/2026-05-07T12:00:00Z/Tasks.csv" */
  key: string;
  /** The CSV bytes as a string. Caller has already done newline + quoting. */
  csv: string;
  /** Defaults to "text/csv". Override for e.g. "text/csv; charset=utf-8". */
  contentType?: string;
  /** Test seam — defaults to global fetch in production. */
  fetchImpl?: typeof fetch;
}

export type PutCsvResult =
  | { ok: true; key: string; size: number }
  | { ok: false; status: number; error: string };

function trimTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

export async function putCsvViaProxy(
  opts: PutCsvViaProxyOptions,
): Promise<PutCsvResult> {
  const fetchFn = opts.fetchImpl ?? fetch;
  const url = `${trimTrailingSlash(opts.engineUrl)}/api/internal/runs/${encodeURIComponent(opts.runId)}/upload-csv`;
  const contentType = opts.contentType ?? "text/csv";

  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers: {
        "x-internal-token": opts.internalToken,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        key: opts.key,
        contentType,
        body: opts.csv,
      }),
    });
  } catch {
    return { ok: false, status: 0, error: "unreachable" };
  }

  if (res.ok) {
    const body = (await res.json()) as { key: string; size: number };
    return { ok: true, key: body.key, size: body.size };
  }

  let error = "unknown";
  try {
    const body = (await res.json()) as { error?: string };
    if (typeof body.error === "string") error = body.error;
  } catch {
    // non-JSON body — fall through with 'unknown'
  }
  return { ok: false, status: res.status, error };
}
