// POST /api/internal/runs/:runId/complete
//
// Internal callback the Trigger.dev task wrappers hit after a task returns.
// Wires the per-base completion into the masterDb row owned by Phase 8a's
// runs/start. TWO body shapes (workflows-instant-webhook 4.2, the flagged
// server-instant-webhook D.3 cross-app gap):
//
//   - snapshot (backup-base.task.ts): the original contract —
//     tablesProcessed/recordsProcessed/attachmentsProcessed + four statuses.
//   - incremental (incremental-backup.task.ts, `kind: "incremental"`):
//     created/updated/deleted/reconciledRecords/driftCount/finalCursor +
//     status succeeded|fallback_to_full|failed. Counters map to
//     recordsProcessed = created+updated+deleted+reconciledRecords (tables/
//     attachments 0); `fallback_to_full` finalizes the run as FAILED with a
//     composed errorMessage (`fallback_to_full: <reason>`) — the incremental
//     run yielded; the fallback full run the task already enqueued carries
//     the recovery. On a succeeded completion whose `reconcileRan` is true,
//     the subscription's last_reconciled_at is stamped (that stamp previously
//     had no writer on the success path — only the fallback route stamped it
//     — which forced a FULL reconcile on every dirty poll).
//
// Token gate is applied by middleware (path begins /api/internal/). This
// handler validates URL shape (UUID) + JSON body, then delegates to
// processRunComplete (src/lib/runs/complete.ts).
//
// Idempotency: the atomic UPDATE removes triggerRunId from
// trigger_run_ids if present. A second callback with the same triggerRunId
// matches no rows → null return → 200 noop (the reconcile stamp is skipped
// on noop replays). See complete.ts header for the design rationale
// (Option J — no schema change).
//
// Result-code → HTTP-status mapping:
//   ok / kind=noop|partial|finalized → 200  { ok: true, kind, ... }
//   run_not_found                    → 404
//   invalid request body             → 400  { error: 'invalid_request' }

import { eq, sql } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import {
  airtableWebhookSubscriptions,
  backupRuns,
  backupRunBases,
  backupRunTables,
} from "../../../../db/schema";
import {
  processRunComplete,
  type PerTableDetail,
  type ProcessRunCompleteInput,
  type ProcessRunCompleteResult,
} from "../../../../lib/runs/complete";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_STATUSES = new Set([
  "succeeded",
  "trial_truncated",
  "trial_complete",
  "failed",
]);

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function statusFor(result: ProcessRunCompleteResult): number {
  if (result.ok) return 200;
  switch (result.error) {
    case "run_not_found":
      return 404;
  }
}

function isNonNegativeInt(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    Number.isFinite(value)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function parseTableDetail(item: unknown): PerTableDetail | null {
  if (typeof item !== "object" || item === null) return null;
  const t = item as Record<string, unknown>;
  if (!isNonEmptyString(t.tableId)) return null;
  if (!isNonEmptyString(t.tableName)) return null;
  if (!isNonNegativeInt(t.recordCount)) return null;
  if (!isNonNegativeInt(t.fieldCount)) return null;
  if (!isNonNegativeInt(t.attachmentCount)) return null;
  return {
    tableId: t.tableId,
    tableName: t.tableName,
    recordCount: t.recordCount,
    fieldCount: t.fieldCount,
    attachmentCount: t.attachmentCount,
  };
}

/** Incremental-completion metadata the handler acts on after the run update. */
export interface IncrementalCompletionMeta {
  status: "succeeded" | "fallback_to_full" | "failed";
  /** Present when the wrapper knows its subscription — enables the reconcile stamp. */
  subscriptionId?: string;
  reconcileRan?: boolean;
}

export interface ParsedRunCompleteBody {
  input: ProcessRunCompleteInput;
  /** Present only for `kind: "incremental"` bodies. */
  incremental?: IncrementalCompletionMeta;
}

const INCREMENTAL_STATUSES = new Set(["succeeded", "fallback_to_full", "failed"]);

/** The incremental shape (workflows-instant-webhook 4.2) — kind-discriminated. */
function parseIncrementalBody(r: Record<string, unknown>): ParsedRunCompleteBody | null {
  if (!isNonEmptyString(r.triggerRunId)) return null;
  if (!isNonEmptyString(r.atBaseId)) return null;
  if (typeof r.status !== "string" || !INCREMENTAL_STATUSES.has(r.status)) return null;
  for (const key of ["created", "updated", "deleted", "reconciledRecords", "driftCount", "finalCursor"]) {
    if (!isNonNegativeInt(r[key])) return null;
  }
  if (r.errorMessage !== undefined && typeof r.errorMessage !== "string") return null;
  if (r.fallbackReason !== undefined && typeof r.fallbackReason !== "string") return null;
  if (r.subscriptionId !== undefined && !isNonEmptyString(r.subscriptionId)) return null;
  if (r.reconcileRan !== undefined && typeof r.reconcileRan !== "boolean") return null;

  const status = r.status as IncrementalCompletionMeta["status"];
  // fallback_to_full: the incremental run yielded to the full re-read the
  // task already enqueued via /webhook-subscriptions/:id/fallback — finalize
  // this row as failed with a composed, greppable message (an explicit
  // errorMessage wins).
  const errorMessage =
    typeof r.errorMessage === "string"
      ? r.errorMessage
      : status === "fallback_to_full"
        ? `fallback_to_full: ${typeof r.fallbackReason === "string" ? r.fallbackReason : "unknown"}`
        : undefined;

  return {
    input: {
      runId: "", // overwritten by caller from URL
      triggerRunId: r.triggerRunId as string,
      atBaseId: r.atBaseId as string,
      status: status === "succeeded" ? "succeeded" : "failed",
      tablesProcessed: 0,
      recordsProcessed:
        (r.created as number) +
        (r.updated as number) +
        (r.deleted as number) +
        (r.reconciledRecords as number),
      attachmentsProcessed: 0,
      ...(errorMessage !== undefined ? { errorMessage } : {}),
    },
    incremental: {
      status,
      ...(isNonEmptyString(r.subscriptionId) ? { subscriptionId: r.subscriptionId } : {}),
      ...(typeof r.reconcileRan === "boolean" ? { reconcileRan: r.reconcileRan } : {}),
    },
  };
}

/** Exported for unit tests (runs-complete-route.test.ts) — handler-internal otherwise. */
export function parseRunCompleteBody(raw: unknown): ParsedRunCompleteBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.kind === "incremental") return parseIncrementalBody(r);
  const input = parseSnapshotBody(r);
  return input ? { input } : null;
}

function parseSnapshotBody(r: Record<string, unknown>): ProcessRunCompleteInput | null {
  if (!isNonEmptyString(r.triggerRunId)) return null;
  if (!isNonEmptyString(r.atBaseId)) return null;
  if (typeof r.status !== "string" || !ALLOWED_STATUSES.has(r.status)) {
    return null;
  }
  if (!isNonNegativeInt(r.tablesProcessed)) return null;
  if (!isNonNegativeInt(r.recordsProcessed)) return null;
  if (!isNonNegativeInt(r.attachmentsProcessed)) return null;
  if (r.errorMessage !== undefined && typeof r.errorMessage !== "string") {
    return null;
  }

  // Optional per-table snapshot fields (server-run-detail, additive).
  // baseName must be a non-empty string when present.
  if (r.baseName !== undefined && !isNonEmptyString(r.baseName)) return null;

  // tables must be an array of valid PerTableDetail objects when present.
  let tables: PerTableDetail[] | undefined;
  if (r.tables !== undefined) {
    if (!Array.isArray(r.tables)) return null;
    const parsed: PerTableDetail[] = [];
    for (const item of r.tables) {
      const detail = parseTableDetail(item);
      if (!detail) return null;
      parsed.push(detail);
    }
    tables = parsed;
  }

  return {
    runId: "", // overwritten by caller from URL
    triggerRunId: r.triggerRunId,
    atBaseId: r.atBaseId,
    status: r.status as ProcessRunCompleteInput["status"],
    tablesProcessed: r.tablesProcessed,
    recordsProcessed: r.recordsProcessed,
    attachmentsProcessed: r.attachmentsProcessed,
    ...(typeof r.errorMessage === "string"
      ? { errorMessage: r.errorMessage }
      : {}),
    ...(isNonEmptyString(r.baseName) ? { baseName: r.baseName } : {}),
    ...(tables !== undefined ? { tables } : {}),
  };
}

export async function runsCompleteHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  runId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(runId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const parsed = parseRunCompleteBody(raw);
  if (!parsed) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const input: ProcessRunCompleteInput = { ...parsed.input, runId };

  // Production wiring uses the per-request masterDb; tests cover the routing
  // layer (this file) and the pure function (complete.ts) separately —
  // see runs-complete.test.ts and runs-complete-route.test.ts.
  const { db } = locals.getMasterDb();

  const result = await processRunComplete(input, {
    fetchRunById: async (id) => {
      const rows = await db
        .select({ id: backupRuns.id })
        .from(backupRuns)
        .where(eq(backupRuns.id, id))
        .limit(1);
      return rows[0] ?? null;
    },
    applyPerBaseCompletion: async (perBase) => {
      // Atomic per-base completion. Removes triggerRunId from trigger_run_ids
      // (jsonb minus operator), increments counters, stickily sets
      // error_message via COALESCE(existing, new). Returns the post-update
      // remaining count + hasFailure flag, or null if WHERE didn't match
      // (idempotent replay).
      //
      // Counters: COALESCE handles the schema's nullable integer columns —
      // Phase 8a writes nulls on row creation; we treat null as 0 for the
      // increment.
      const failureMessage = perBase.failureMessage;
      const rows = await db.execute(sql`
        UPDATE baseout.backup_runs
        SET
          trigger_run_ids = COALESCE(trigger_run_ids, '[]'::jsonb) - ${perBase.triggerRunId},
          record_count = COALESCE(record_count, 0) + ${perBase.recordsProcessed},
          table_count = COALESCE(table_count, 0) + ${perBase.tablesProcessed},
          attachment_count = COALESCE(attachment_count, 0) + ${perBase.attachmentsProcessed},
          error_message = COALESCE(error_message, ${failureMessage}::text),
          modified_at = NOW()
        WHERE id = ${perBase.runId}
          AND trigger_run_ids ? ${perBase.triggerRunId}
        RETURNING
          jsonb_array_length(trigger_run_ids) AS remaining_count,
          (error_message IS NOT NULL) AS has_failure
      `);

      const row = (rows as unknown as Array<{
        remaining_count: number;
        has_failure: boolean;
      }>)[0];
      if (!row) return null;
      return {
        remainingCount: Number(row.remaining_count),
        hasFailure: Boolean(row.has_failure),
      };
    },
    finalizeRun: async (final) => {
      await db
        .update(backupRuns)
        .set({
          status: final.finalStatus,
          completedAt: final.completedAt,
          modifiedAt: final.completedAt,
        })
        .where(eq(backupRuns.id, final.runId));
    },
    // Per-table snapshot deps (server-run-detail, additive). Only wired when
    // the caller included tables[] in the body; processRunComplete skips these
    // when input.tables is undefined, so legacy completions are unaffected.
    insertRunBaseSnapshot: async (snap) => {
      const rows = await db
        .insert(backupRunBases)
        .values({
          runId: snap.runId,
          atBaseId: snap.atBaseId,
          baseName: snap.baseName,
          status: snap.status,
          tablesCount: snap.tablesCount,
          recordsCount: snap.recordsCount,
          attachmentsCount: snap.attachmentsCount,
          completedAt: snap.completedAt,
          errorMessage: snap.errorMessage ?? undefined,
        })
        .returning({ id: backupRunBases.id });
      const row = rows[0];
      if (!row) throw new Error("insertRunBaseSnapshot: no row returned");
      return { id: row.id };
    },
    insertRunTableSnapshots: async (snap) => {
      if (snap.tables.length === 0) return;
      await db.insert(backupRunTables).values(
        snap.tables.map((t) => ({
          runBaseId: snap.runBaseId,
          tableId: t.tableId,
          tableName: t.tableName,
          recordCount: t.recordCount,
          fieldCount: t.fieldCount,
          attachmentCount: t.attachmentCount,
        })),
      );
    },
  });

  if (result.ok) {
    // Success-path reconcile stamp (workflows-instant-webhook 4.2): a
    // succeeded incremental completion whose reconcile pass ran resets the
    // 7-day reconcile cadence — previously only the FALLBACK route stamped
    // this, so a healthy stream re-ran a full reconcile on every dirty poll.
    // Skipped on noop (idempotent replay). Best-effort: a stamp failure must
    // not turn a recorded completion into a wire error.
    if (
      result.kind !== "noop" &&
      parsed.incremental?.status === "succeeded" &&
      parsed.incremental.reconcileRan === true &&
      parsed.incremental.subscriptionId
    ) {
      try {
        await db
          .update(airtableWebhookSubscriptions)
          .set({ lastReconciledAt: new Date(), modifiedAt: new Date() })
          .where(eq(airtableWebhookSubscriptions.id, parsed.incremental.subscriptionId));
      } catch {
        // ignored — the next reconcile-cadence check simply fires again.
      }
    }
    if (result.kind === "noop") {
      return jsonResponse({ ok: true, kind: "noop" }, statusFor(result));
    }
    if (result.kind === "partial") {
      return jsonResponse(
        { ok: true, kind: "partial", remainingCount: result.remainingCount },
        statusFor(result),
      );
    }
    return jsonResponse(
      { ok: true, kind: "finalized", finalStatus: result.finalStatus },
      statusFor(result),
    );
  }
  return jsonResponse({ error: result.error }, statusFor(result));
}
