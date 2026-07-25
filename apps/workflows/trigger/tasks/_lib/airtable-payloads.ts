// Airtable "list webhook payloads" client used by the incremental-backup task
// (openspec/changes/workflows-instant-webhook task 1.2).
//
//   GET /v0/bases/:baseId/webhooks/:webhookId/payloads?cursor=N&limit=50
//
// One page per call (≤50 payloads); the caller loops while `mightHaveMore`.
// Parsing is tolerant per Airtable's contract: every change map is optional,
// no field may be assumed present, and unknown payload keys are logged (via
// the injected structured-log callback), never fatal. Error-payload variants
// (`error: true` + code INVALID_HOOK | INVALID_FILTERS | INTERNAL_ERROR) pass
// through for the orchestrator to map onto recovery paths.
//
// Cursor expiry: Airtable purges payloads after 7 days. When the stored cursor
// predates retained payloads the endpoint rejects the request; we detect that
// and throw PayloadsCursorExpiredError so the task falls back to a full
// re-read (reason `cursor_expired`). Detection is heuristic — a 4xx whose
// error body mentions the cursor being invalid/expired — pending verification
// against the live API (Airtable does not document a stable machine code for
// this case).
//
// Runtime: Node (Trigger.dev runner); Web fetch only. `fetchImpl?` is the
// test seam, mirroring _lib/airtable-client.ts.

const AIRTABLE_BASE_URL = "https://api.airtable.com";

/** Max payloads per list call (Airtable's documented page cap). */
export const PAYLOADS_PAGE_LIMIT = 50;

export type LogFn = (event: Record<string, unknown>) => void;

export interface PayloadUser {
  id?: string;
  email?: string;
  name?: string;
}

export interface PayloadActionMetadata {
  /** Originating action kind: client | publicApi | formSubmission | automation | sync | … */
  source?: string;
  sourceMetadata?: { user?: PayloadUser };
}

export interface PayloadCellValues {
  cellValuesByFieldId?: Record<string, unknown>;
}

export interface PayloadChangedRecord {
  current?: PayloadCellValues;
  /** Present only when the webhook spec sets includePreviousCellValues. Used
   *  for drift detection ONLY — never written (per-space spec). */
  previous?: PayloadCellValues;
  unchanged?: PayloadCellValues;
}

export interface PayloadCreatedRecord {
  createdTime?: string;
  cellValuesByFieldId?: Record<string, unknown>;
}

export interface PayloadFieldSchema {
  name?: string;
  type?: string;
  description?: string | null;
}

export interface PayloadChangedField {
  current?: PayloadFieldSchema;
  previous?: PayloadFieldSchema;
}

export interface PayloadChangedMetadata {
  current?: { name?: string; description?: string | null };
  previous?: { name?: string; description?: string | null };
}

export interface PayloadTableChanges {
  changedRecordsById?: Record<string, PayloadChangedRecord>;
  createdRecordsById?: Record<string, PayloadCreatedRecord>;
  destroyedRecordIds?: string[];
  changedFieldsById?: Record<string, PayloadChangedField>;
  createdFieldsById?: Record<string, PayloadFieldSchema>;
  destroyedFieldIds?: string[];
  changedMetadata?: PayloadChangedMetadata;
  /** Applied only when the Space's Enterprise view capture is enabled. */
  changedViewsById?: Record<string, unknown>;
}

export interface PayloadCreatedTable {
  metadata?: { name?: string; description?: string | null };
  fieldsById?: Record<string, PayloadFieldSchema>;
  /** May be PARTIAL for large pasted-in tables — the orchestrator forces a
   *  reconciliation fill for tables created this pass. */
  recordsById?: Record<string, PayloadCreatedRecord>;
}

export type PayloadErrorCode = "INVALID_HOOK" | "INVALID_FILTERS" | "INTERNAL_ERROR";

export interface WebhookPayload {
  baseTransactionNumber: number;
  timestamp?: string;
  actionMetadata?: PayloadActionMetadata;
  payloadFormat?: string;
  changedTablesById?: Record<string, PayloadTableChanges>;
  createdTablesById?: Record<string, PayloadCreatedTable>;
  destroyedTableIds?: string[];
  /** Error-payload variant: the transaction could not be serialized. */
  error?: boolean;
  code?: PayloadErrorCode | string;
}

export interface PayloadsPage {
  payloads: WebhookPayload[];
  /** The next cursor — pass on the following call; POST to the engine after
   *  the batch durably applies. */
  cursor: number;
  mightHaveMore: boolean;
}

/** Non-2xx from the payloads endpoint that is NOT a cursor expiry. */
export class AirtablePayloadsError extends Error {
  public readonly status: number;
  public readonly bodyText: string;

  constructor(status: number, bodyText: string) {
    super(`Airtable payloads returned ${status}: ${bodyText.slice(0, 200)}`);
    this.name = "AirtablePayloadsError";
    this.status = status;
    this.bodyText = bodyText;
  }
}

/** The stored cursor predates Airtable's 7-day payload retention — the task
 *  must abort without partial application and fall back to a full re-read. */
export class PayloadsCursorExpiredError extends Error {
  constructor(message = "webhook payload cursor predates retained payloads") {
    super(message);
    this.name = "PayloadsCursorExpiredError";
  }
}

// Keys we understand on a payload object. Anything else is logged, not fatal.
const KNOWN_PAYLOAD_KEYS = new Set([
  "baseTransactionNumber",
  "timestamp",
  "actionMetadata",
  "payloadFormat",
  "changedTablesById",
  "createdTablesById",
  "destroyedTableIds",
  "error",
  "code",
]);

/**
 * Validate + shape the payloads-endpoint 200 body at the IO boundary. Tolerant
 * per Airtable's contract: optional maps stay optional; unknown keys on each
 * payload are logged through the structured-log callback and passed over. A
 * structurally malformed body (missing payloads[] / cursor) throws so the run
 * fails visibly rather than silently applying nothing.
 */
export function parsePayloadsResponse(body: unknown, log?: LogFn): PayloadsPage {
  const candidate = body as {
    payloads?: unknown;
    cursor?: unknown;
    mightHaveMore?: unknown;
  } | null;
  if (!candidate || !Array.isArray(candidate.payloads) || typeof candidate.cursor !== "number") {
    throw new Error("webhook payloads response is malformed: missing payloads[] or cursor");
  }

  const payloads: WebhookPayload[] = [];
  for (const raw of candidate.payloads) {
    if (!raw || typeof raw !== "object") {
      log?.({ event: "unparseable_payload_skipped" });
      continue;
    }
    const obj = raw as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (!KNOWN_PAYLOAD_KEYS.has(key)) {
        log?.({ event: "unknown_payload_key", key });
      }
    }
    payloads.push({
      baseTransactionNumber:
        typeof obj.baseTransactionNumber === "number" ? obj.baseTransactionNumber : 0,
      ...(typeof obj.timestamp === "string" ? { timestamp: obj.timestamp } : {}),
      ...(obj.actionMetadata && typeof obj.actionMetadata === "object"
        ? { actionMetadata: obj.actionMetadata as PayloadActionMetadata }
        : {}),
      ...(typeof obj.payloadFormat === "string" ? { payloadFormat: obj.payloadFormat } : {}),
      ...(obj.changedTablesById && typeof obj.changedTablesById === "object"
        ? { changedTablesById: obj.changedTablesById as Record<string, PayloadTableChanges> }
        : {}),
      ...(obj.createdTablesById && typeof obj.createdTablesById === "object"
        ? { createdTablesById: obj.createdTablesById as Record<string, PayloadCreatedTable> }
        : {}),
      ...(Array.isArray(obj.destroyedTableIds)
        ? { destroyedTableIds: obj.destroyedTableIds.filter((t): t is string => typeof t === "string") }
        : {}),
      ...(obj.error === true ? { error: true } : {}),
      ...(typeof obj.code === "string" ? { code: obj.code } : {}),
    });
  }

  return {
    payloads,
    cursor: candidate.cursor,
    mightHaveMore: candidate.mightHaveMore === true,
  };
}

// Heuristic cursor-expiry match on the error body text (see module header).
function looksLikeCursorExpiry(status: number, bodyText: string): boolean {
  if (status < 400 || status >= 500) return false;
  return /cursor/i.test(bodyText) && /expired?|too\s?old|invalid|no longer/i.test(bodyText);
}

export interface FetchPayloadsPageArgs {
  baseId: string;
  /** Airtable's webhook id (ach…) — NOT our registry row id. */
  webhookId: string;
  cursor: number;
  accessToken: string;
  fetchImpl?: typeof fetch;
  log?: LogFn;
}

/**
 * Fetch one page of webhook payloads. Throws PayloadsCursorExpiredError when
 * the cursor predates retained payloads, AirtablePayloadsError on any other
 * non-2xx. Rate-limit retry/backoff is owned by the per-Connection gateway
 * the production call path routes through; this function performs one request.
 */
export async function fetchPayloadsPage(args: FetchPayloadsPageArgs): Promise<PayloadsPage> {
  const fetchFn = args.fetchImpl ?? fetch;
  const params = new URLSearchParams();
  params.set("cursor", String(args.cursor));
  params.set("limit", String(PAYLOADS_PAGE_LIMIT));
  const url = `${AIRTABLE_BASE_URL}/v0/bases/${encodeURIComponent(args.baseId)}/webhooks/${encodeURIComponent(args.webhookId)}/payloads?${params.toString()}`;

  const res = await fetchFn(url, {
    headers: {
      authorization: `Bearer ${args.accessToken}`,
      accept: "application/json",
    },
  });
  if (!res.ok) {
    const bodyText = await res.text();
    if (looksLikeCursorExpiry(res.status, bodyText)) {
      throw new PayloadsCursorExpiredError();
    }
    throw new AirtablePayloadsError(res.status, bodyText);
  }
  return parsePayloadsResponse(await res.json(), args.log);
}
