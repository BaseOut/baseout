// Airtable Metadata + Records API client used by the backup-base Trigger.dev
// task. Read-only — schema discovery and record listing only. No write paths.
//
// Runtime: Node (Trigger.dev runner). The module uses only Web fetch + Web
// Response, so it also runs unchanged inside the workerd vitest pool.
//
// Surface (kept minimal — extend only when a caller needs it):
//   listBases()                          → GET /v0/meta/bases
//   getBaseSchema(baseId)                → GET /v0/meta/bases/:baseId/tables
//   listRecords(baseId, tableId, opts)   → GET /v0/:baseId/:tableId?...
//
// Auth: bearer access token (already-decrypted; the caller is the task, which
// holds the OAuth token in scope only for the duration of one base's backup).
// No refresh logic here — token refresh is a separate change owned by
// apps/server's scheduled cron.
//
// Test seam: `fetchImpl?` injection mirrors the pattern in r2-proxy-write.ts
// and apps/web's backup-engine.ts. Tests pass a vi.fn(); production uses
// global fetch.

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

// Total attempts (initial + retries). 3 means "1 try, 2 retries on 429/5xx."
const MAX_ATTEMPTS = 3;

// Exponential backoff base. attempt 0 → 200ms, attempt 1 → 800ms (4× growth).
// Tuned for Airtable's 5 req/sec/base limit: 200ms is ~1 slot at the cap,
// 800ms is conservative for a second hit.
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

  // Retry-aware GET that returns parsed JSON or throws AirtableError.
  // Retries 429 + 5xx up to MAX_ATTEMPTS total; honors Retry-After when
  // present, falls back to exponential backoff otherwise. Non-retriable
  // 4xx (auth failures, validation, etc.) surface immediately.
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
