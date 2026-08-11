// Airtable batch-create helper for the restore-base Trigger.dev task.
//
// Filed by openspec/changes/workflows-restore (section 3.2).
// Write-side mirror of airtable-client.ts (which is read-only).
//
// Surface:
//   createRecords(baseId, tableId, accessToken, records, fetchImpl?, opts?)
//     → { created: AirtableRecord[]; errors: AirtableError[] }
//
// Airtable's batch-create endpoint is POST /v0/:baseId/:tableId with a JSON
// body of { records: [{fields: {...}}], typecast: true }. Maximum 10 per batch.
// Multiple batches are issued serially (Airtable's 5 req/sec/base limit makes
// parallel batching unsafe and there's no per-base concurrency guarantee).
//
// Retry policy: mirrors airtable-client.ts exactly:
//   - 429 and 5xx → retried up to MAX_ATTEMPTS total with exponential backoff.
//   - Honors Retry-After header when present.
//   - Non-retriable 4xx (401, 422, etc.) → AirtableCreateError thrown immediately.
//
// The `errors` array in the return value is reserved for future per-record
// error support (the Airtable upsert API returns per-record errors; create
// does not). For now it is always empty on success, and the function throws
// on any top-level HTTP error. Callers that want to accumulate partial results
// across multiple createRecords() calls should catch AirtableCreateError per
// batch and push to their own error list.

const AIRTABLE_BASE_URL = "https://api.airtable.com";
const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 200;
const BACKOFF_GROWTH = 4;

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export interface AirtableCreateInput {
  fields: Record<string, unknown>;
}

/**
 * Thrown when Airtable returns a non-2xx that survived all retries, or a
 * non-retriable 4xx on the first attempt. Carries `status` so callers can
 * branch (422 = field-validation, 401 = token bad, 429-exhausted = give up).
 */
export class AirtableCreateError extends Error {
  public readonly status: number;
  public readonly bodyText: string;

  constructor(status: number, bodyText: string) {
    super(`Airtable create returned ${status}: ${bodyText.slice(0, 200)}`);
    this.name = "AirtableCreateError";
    this.status = status;
    this.bodyText = bodyText;
  }
}

export interface CreateRecordsResult {
  created: AirtableRecord[];
  errors: AirtableCreateError[];
}

export interface CreateRecordsOptions {
  /** Test seam — defaults to setTimeout-based sleep. */
  sleepImpl?: (ms: number) => Promise<void>;
}

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

/**
 * POST a single batch (≤10 records) to Airtable with retry on 429/5xx.
 * Throws AirtableCreateError on exhausted retries or non-retriable 4xx.
 */
async function postBatch(
  url: string,
  headers: Record<string, string>,
  records: AirtableCreateInput[],
  fetchImpl: typeof fetch,
  sleep: (ms: number) => Promise<void>,
): Promise<AirtableRecord[]> {
  const body = JSON.stringify({ records, typecast: true });
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetchImpl(url, { method: "POST", headers, body });
    if (res.ok) {
      const json = (await res.json()) as { records: AirtableRecord[] };
      return json.records;
    }

    lastStatus = res.status;
    lastBody = await res.text();

    if (!isRetriable(res.status) || attempt === MAX_ATTEMPTS - 1) break;

    const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));
    const waitMs = retryAfterMs ?? backoffMsForAttempt(attempt);
    await sleep(waitMs);
  }

  throw new AirtableCreateError(lastStatus, lastBody);
}

/**
 * Create records in an Airtable table, batching at most 10 at a time.
 *
 * @param baseId       Airtable base ID (e.g. "appXxx").
 * @param tableId      Airtable table ID or name.
 * @param accessToken  Decrypted OAuth access token.
 * @param records      Array of { fields } objects to create.
 * @param fetchImpl    Test seam; defaults to global fetch.
 * @param opts         Optional overrides (sleepImpl for tests).
 */
export async function createRecords(
  baseId: string,
  tableId: string,
  accessToken: string,
  records: AirtableCreateInput[],
  fetchImpl: typeof fetch = fetch,
  opts: CreateRecordsOptions = {},
): Promise<CreateRecordsResult> {
  if (records.length === 0) {
    return { created: [], errors: [] };
  }

  const sleep = opts.sleepImpl ?? defaultSleep;
  const url = `${AIRTABLE_BASE_URL}/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(tableId)}`;
  const headers: Record<string, string> = {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
    accept: "application/json",
  };

  const allCreated: AirtableRecord[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchCreated = await postBatch(url, headers, batch, fetchImpl, sleep);
    allCreated.push(...batchCreated);
  }

  return { created: allCreated, errors: [] };
}
