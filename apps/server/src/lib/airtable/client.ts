// MIRROR of apps/workflows/trigger/tasks/_lib/airtable-client.ts (canonical
// writer). Per CLAUDE.md §5.3 — the workflows-side copy is the long-lived
// task body that runs on the Trigger.dev Node runner; this Worker-side copy
// is what apps/server uses for direct calls from the Worker (workspace
// rediscovery + future cron paths).
//
// Both copies use only Web fetch + Web Response, so the body runs unchanged
// in both workerd and Node. Keep them in sync — drift would mean two
// different views of Airtable retry / error behavior across the two
// runtimes. When extending: prefer adding here AND in
// apps/workflows/trigger/tasks/_lib/airtable-client.ts.
//
// Surface (kept minimal — extend only when a caller needs it):
//   listBases()                          → GET /v0/meta/bases
//   getBaseSchema(baseId)                → GET /v0/meta/bases/:baseId/tables
//   listRecords(baseId, tableId, opts)   → GET /v0/:baseId/:tableId?...
//
// Auth: bearer access token (already-decrypted; the caller is the route
// handler, which holds the OAuth token in scope only for the duration of one
// rediscovery call). No refresh logic here — token refresh is owned by
// apps/server's scheduled cron (baseout-server-cron-oauth-refresh).

const AIRTABLE_BASE_URL = "https://api.airtable.com";

export interface AirtableBaseSummary {
  id: string;
  name: string;
  permissionLevel: string;
}

export interface AirtableField {
  id: string;
  name: string;
  type: string;
}

export interface AirtableTable {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: AirtableField[];
}

export interface AirtableSchema {
  tables: AirtableTable[];
}

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export interface AirtableRecordsPage {
  records: AirtableRecord[];
  /** Cursor for the next page. Absent on the final page. */
  offset?: string;
}

export interface ListRecordsOptions {
  /** Cursor returned by a previous page. Omit on the first call. */
  offset?: string;
  /** 1-100; defaults to 100 (Airtable's max). */
  pageSize?: number;
}

export interface AirtableClientOptions {
  /** Decrypted Airtable OAuth access token. */
  accessToken: string;
  /** Test seam — defaults to global fetch in production. */
  fetchImpl?: typeof fetch;
  /** Test seam — defaults to setTimeout-based sleep in production. */
  sleepImpl?: (ms: number) => Promise<void>;
}

/**
 * Thrown by every client method when Airtable returns a non-2xx that we didn't
 * absorb via retry. Carries `status` so callers can branch on 401 (token bad,
 * needs reauth) vs 4xx (validation) vs 429/5xx exhausted (give up, retry next
 * tick).
 */
export class AirtableError extends Error {
  public readonly status: number;
  public readonly bodyText: string;

  constructor(status: number, bodyText: string) {
    super(`Airtable returned ${status}: ${bodyText.slice(0, 200)}`);
    this.name = "AirtableError";
    this.status = status;
    this.bodyText = bodyText;
  }
}

const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 200;
const BACKOFF_GROWTH = 4;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function backoffMsForAttempt(attempt: number): number {
  return BACKOFF_BASE_MS * BACKOFF_GROWTH ** attempt;
}

function isRetriable(status: number): boolean {
  return status === 429 || status >= 500;
}

function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = Number(headerValue);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.round(seconds * 1000);
}

export interface AirtableClient {
  listBases(): Promise<AirtableBaseSummary[]>;
  getBaseSchema(baseId: string): Promise<AirtableSchema>;
  listRecords(
    baseId: string,
    tableIdOrName: string,
    opts?: ListRecordsOptions,
  ): Promise<AirtableRecordsPage>;
}

const DEFAULT_PAGE_SIZE = 100;

export function createAirtableClient(
  opts: AirtableClientOptions,
): AirtableClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleepImpl ?? defaultSleep;
  const headers = {
    authorization: `Bearer ${opts.accessToken}`,
    accept: "application/json",
  };

  async function getJson<T>(url: string): Promise<T> {
    let lastStatus = 0;
    let lastBody = "";
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const res = await fetchImpl(url, { headers });
      if (res.ok) return (await res.json()) as T;

      lastStatus = res.status;
      lastBody = await res.text();

      if (!isRetriable(res.status) || attempt === MAX_ATTEMPTS - 1) break;

      const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));
      const waitMs = retryAfterMs ?? backoffMsForAttempt(attempt);
      await sleep(waitMs);
    }
    throw new AirtableError(lastStatus, lastBody);
  }

  return {
    async listBases() {
      const body = await getJson<{ bases: AirtableBaseSummary[] }>(
        `${AIRTABLE_BASE_URL}/v0/meta/bases`,
      );
      return body.bases;
    },

    async getBaseSchema(baseId) {
      return getJson<AirtableSchema>(
        `${AIRTABLE_BASE_URL}/v0/meta/bases/${encodeURIComponent(baseId)}/tables`,
      );
    },

    async listRecords(baseId, tableIdOrName, listOpts) {
      const pageSize = listOpts?.pageSize ?? DEFAULT_PAGE_SIZE;
      const params = new URLSearchParams();
      params.set("pageSize", String(pageSize));
      if (listOpts?.offset) params.set("offset", listOpts.offset);
      return getJson<AirtableRecordsPage>(
        `${AIRTABLE_BASE_URL}/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(tableIdOrName)}?${params.toString()}`,
      );
    },
  };
}
