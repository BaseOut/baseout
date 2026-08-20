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

import { and, eq, inArray, sql, sum } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import {
  airtableWebhookSubscriptions,
  backupRuns,
  backupRunBases,
  backupRunTables,
  spaceDatabases,
  spaces,
  subscriptions,
  usageNotificationState,
  usageRollups,
} from "../../../../db/schema";
import {
  processRunComplete,
  type PerTableDetail,
  type ProcessRunCompleteInput,
  type ProcessRunCompleteResult,
} from "../../../../lib/runs/complete";
import { ingestRunUsage, type UsageIngestDeps } from "../../../../lib/runs/usage-ingest";
import { ingestSpaceDbSize, type DbSizeIngestDeps } from "../../../../lib/runs/db-size";
import { fireEventReports } from "../../../../lib/reports/after-backup";
import { resolveEntitlements } from "../../../../lib/entitlements/resolve";
import {
  evaluateUsageForOrg,
  type UsageEnforcementDeps,
} from "../../../../lib/entitlements/usage-enforcement";
import { createSkeletonNotifier } from "../../../../lib/entitlements/notify";
import { currentMonthlyPeriod, type UsageState } from "@baseout/db-schema";

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
  // File-storage meter (shared-entitlements 3.1). Optional + additive — an
  // older workflows build omits it. Reject a malformed value rather than
  // silently coercing.
  if (r.fileBytesProcessed !== undefined && !isNonNegativeInt(r.fileBytesProcessed)) {
    return null;
  }
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
    ...(isNonNegativeInt(r.fileBytesProcessed)
      ? { fileBytesProcessed: r.fileBytesProcessed }
      : {}),
    ...(typeof r.errorMessage === "string"
      ? { errorMessage: r.errorMessage }
      : {}),
    ...(isNonEmptyString(r.baseName) ? { baseName: r.baseName } : {}),
    ...(tables !== undefined ? { tables } : {}),
  };
}

/** The per-request masterDb Drizzle instance, typed off App.Locals. */
type MasterDb = ReturnType<AppLocals["getMasterDb"]>["db"];

// ── Shared usage-rollup wiring (shared-entitlements 3.1 + 3.2) ───────────────
// resolveOrgAnchor + the rollup upsert are used by BOTH the per-base record/
// file ingest (3.1, `add`) and the DB-size level write (3.2, `set`).

/** Resolve a Space's Organization + monthly-anniversary anchor (D6). */
async function resolveOrgAnchor(
  db: MasterDb,
  spaceId: string,
): Promise<{ organizationId: string; anchor: Date } | null> {
  const rows = await db
    .select({
      organizationId: spaces.organizationId,
      anchor: subscriptions.createdAt,
    })
    .from(spaces)
    .leftJoin(
      subscriptions,
      and(
        eq(subscriptions.organizationId, spaces.organizationId),
        inArray(subscriptions.status, ["active", "trialing"]),
      ),
    )
    .where(eq(spaces.id, spaceId))
    .limit(1);
  const row = rows[0];
  // No org, or no active/trialing subscription to anchor the monthly cycle →
  // can't attribute a period. Skip; the reconciliation sweep re-derives later.
  if (!row || !row.anchor) return null;
  return { organizationId: row.organizationId, anchor: row.anchor };
}

/**
 * Atomically write one Space-scoped rollup for a meter+period. `add` increments
 * (`used = used + value`) for the per-base best-effort counters; `set` replaces
 * (`used = value`) for an absolute measurement like DB size. Date params MUST
 * be ISO strings — a bare Date serializes as toString() text PG rejects (the
 * deployed-500 trap in reference_postgresjs_date_precision). Conflict target
 * mirrors the 0035 unique-index expression exactly.
 */
async function upsertRollup(
  db: MasterDb,
  row: {
    organizationId: string;
    spaceId: string;
    featureSlug: string;
    meterKind: string;
    periodStart: Date;
    periodEnd: Date;
    value: number;
  },
  mode: "add" | "set",
): Promise<void> {
  const nextUsed =
    mode === "add"
      ? sql`baseout.usage_rollups.used + ${row.value}`
      : sql`${row.value}`;
  await db.execute(sql`
    INSERT INTO baseout.usage_rollups
      (organization_id, feature_slug, space_id, period_start, period_end, used, meter_kind)
    VALUES (
      ${row.organizationId}, ${row.featureSlug}, ${row.spaceId},
      ${row.periodStart.toISOString()}::timestamptz,
      ${row.periodEnd.toISOString()}::timestamptz,
      ${row.value}, ${row.meterKind}
    )
    ON CONFLICT (organization_id, feature_slug, (COALESCE(space_id, '')), period_start)
    DO UPDATE SET used = ${nextUsed}, modified_at = NOW()
  `);
}

/** Per-base record + file-byte ingestion deps (shared-entitlements 3.1). */
function usageIngestDeps(db: MasterDb): UsageIngestDeps {
  return {
    resolveOrgAnchor: (spaceId) => resolveOrgAnchor(db, spaceId),
    upsertRollupDelta: (row) =>
      upsertRollup(db, { ...row, value: row.delta }, "add"),
  };
}

/** SUM of relation sizes in a per-Space PG schema — the managed_pg DB-size
 *  measure (schema-per-Space topology; see db-size.ts). schemaName is a bound
 *  param, so injection-safe regardless of its provenance. */
async function measurePgSchemaBytes(
  db: MasterDb,
  schemaName: string,
): Promise<number | null> {
  const rows = await db.execute(sql`
    SELECT COALESCE(SUM(pg_total_relation_size(c.oid)), 0)::bigint AS bytes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ${schemaName} AND c.relkind IN ('r', 'm')
  `);
  const raw = (rows as unknown as Array<{ bytes: string | number }>)[0]?.bytes;
  const bytes = Number(raw ?? 0);
  return Number.isFinite(bytes) ? bytes : null;
}

/** D1 database `file_size` via the Cloudflare REST API (shared-entitlements
 *  3.2). Returns null when the account/token isn't provisioned or on any API
 *  error — DB-size metering is best-effort. */
async function measureD1Bytes(
  env: Env,
  databaseId: string,
): Promise<number | null> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_D1_API_TOKEN;
  if (!accountId || !token) return null;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: { file_size?: number } };
    const size = body.result?.file_size;
    return typeof size === "number" && Number.isFinite(size) ? size : null;
  } catch {
    return null;
  }
}

/** DB-size measurement + level-write deps (shared-entitlements 3.2). */
function dbSizeIngestDeps(db: MasterDb, env: Env): DbSizeIngestDeps {
  return {
    getSpaceDb: async (spaceId) => {
      const rows = await db
        .select({
          backend: spaceDatabases.backend,
          status: spaceDatabases.status,
          pgLocator: spaceDatabases.pgLocator,
          d1DatabaseId: spaceDatabases.d1DatabaseId,
        })
        .from(spaceDatabases)
        .where(eq(spaceDatabases.spaceId, spaceId))
        .limit(1);
      return rows[0] ?? null;
    },
    measurers: {
      measurePgSchemaBytes: (schemaName) => measurePgSchemaBytes(db, schemaName),
      measureD1Bytes: (databaseId) => measureD1Bytes(env, databaseId),
    },
    resolveOrgAnchor: (spaceId) => resolveOrgAnchor(db, spaceId),
    upsertRollupLevel: (row) =>
      upsertRollup(db, { ...row, value: row.used }, "set"),
  };
}

// ── Usage-enforcement wiring (shared-entitlements 4.2, design D7) ─────────────
// The stock/level meters a snapshot completion can move: 3.1 increments the two
// per-base meters; 3.2 sets database_size_gb once on finalization. We evaluate
// the same superset every time — evaluateUsage skips any slug with no rollup row
// (not returned by readUsage) and any non-limit feature, so a stale/absent meter
// is a silent no-op, never a false alarm.
const STOCK_METER_SLUGS = [
  "records_under_management",
  "file_storage_gb",
  "database_size_gb",
];

/**
 * Drizzle-backed deps for `evaluateUsageForOrg` (the pure warn-90 / enforce-100
 * state machine, unit-tested). Resolves the org's effective entitlements, reads
 * the org-summed current-period usage + persisted notification state for the
 * affected meters, upserts only the states that moved, and fires the skeleton
 * notifier on transitions only. `ENTITLEMENT_ENFORCEMENT` gates warn-only vs
 * enforcing (default off). Date params in the raw writeStates upsert are ISO
 * strings — a bare Date serializes as toString() text PG rejects (the deployed
 * -500 trap in reference_postgresjs_date_precision); the query-builder reads
 * bind Date params directly, which is safe.
 */
function usageEnforcementDeps(db: MasterDb, env: Env): UsageEnforcementDeps {
  return {
    resolveEntitlements: (orgId) =>
      resolveEntitlements(db, orgId).then((r) => r?.entitlements ?? null),
    readUsage: async (orgId, featureSlugs, period) => {
      if (featureSlugs.length === 0) return [];
      // Org total per meter = SUM of the per-Space rollups for this period.
      const rows = await db
        .select({
          featureSlug: usageRollups.featureSlug,
          used: sum(usageRollups.used),
        })
        .from(usageRollups)
        .where(
          and(
            eq(usageRollups.organizationId, orgId),
            inArray(usageRollups.featureSlug, featureSlugs),
            eq(usageRollups.periodStart, period.start),
          ),
        )
        .groupBy(usageRollups.featureSlug);
      return rows.map((r) => ({
        featureSlug: r.featureSlug,
        used: Number(r.used ?? 0),
      }));
    },
    readStates: async (orgId, featureSlugs, periodStart) => {
      if (featureSlugs.length === 0) return [];
      const rows = await db
        .select({
          featureSlug: usageNotificationState.featureSlug,
          state: usageNotificationState.state,
        })
        .from(usageNotificationState)
        .where(
          and(
            eq(usageNotificationState.organizationId, orgId),
            inArray(usageNotificationState.featureSlug, featureSlugs),
            eq(usageNotificationState.periodStart, periodStart),
          ),
        );
      return rows.map((r) => ({
        featureSlug: r.featureSlug,
        state: r.state as UsageState,
      }));
    },
    writeStates: async (orgId, periodStart, changed, at) => {
      // One upsert per moved feature — `changed` is at most STOCK_METER_SLUGS.
      // ON CONFLICT targets the named unique constraint the web migration owns.
      for (const c of changed) {
        await db.execute(sql`
          INSERT INTO baseout.usage_notification_state
            (organization_id, feature_slug, state, period_start, last_transition_at)
          VALUES (
            ${orgId}, ${c.featureSlug}, ${c.next},
            ${periodStart.toISOString()}::timestamptz,
            ${at.toISOString()}::timestamptz
          )
          ON CONFLICT ON CONSTRAINT usage_notification_state_org_feature_period_unique
          DO UPDATE SET
            state = ${c.next},
            last_transition_at = ${at.toISOString()}::timestamptz,
            modified_at = NOW()
        `);
      }
    },
    notifier: createSkeletonNotifier(),
    enforcementEnabled: env.ENTITLEMENT_ENFORCEMENT === "1",
  };
}

export async function runsCompleteHandler(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
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

    // Usage metering (shared-entitlements 3.1 + 3.2). Snapshot completions only
    // (incremental deltas are the sweep's job), and never on a noop idempotent
    // replay (which would double-count). Everything here is best-effort — a
    // metering failure must not turn a recorded completion into a wire error;
    // the reconciliation sweep (task 3.5) is the authority that heals drift.
    if (result.kind !== "noop" && !parsed.incremental) {
      let spaceId: string | undefined;
      let backupKind: string | undefined;
      try {
        const runRows = await db
          .select({ spaceId: backupRuns.spaceId, kind: backupRuns.kind })
          .from(backupRuns)
          .where(eq(backupRuns.id, runId))
          .limit(1);
        spaceId = runRows[0]?.spaceId;
        backupKind = runRows[0]?.kind;
      } catch {
        // ignore — nothing to attribute against.
      }
      if (spaceId) {
        // 3.1: this base's records + file bytes → Space stock rollups (increment).
        try {
          await ingestRunUsage(
            {
              spaceId,
              recordsProcessed: input.recordsProcessed,
              fileBytesProcessed: input.fileBytesProcessed ?? 0,
              now: new Date(),
            },
            usageIngestDeps(db),
          );
        } catch {
          // best-effort; the sweep re-derives exact levels.
        }
        // 3.2: measure the Space's DB size ONCE, at run finalization (the last
        // base has reported and the row flipped terminal) → set the level.
        if (result.kind === "finalized") {
          try {
            await ingestSpaceDbSize(
              { spaceId, now: new Date() },
              dbSizeIngestDeps(db, env),
            );
          } catch {
            // best-effort; the sweep re-derives exact levels.
          }
          // server-reports task 4.2: fire event-cadence reports for this
          // finalized backup (data_backup after full, schema_backup after
          // schema). Best-effort + deferred via waitUntil so a slow assembly
          // never delays the completion response; the one-running guard
          // debounces. A hook failure must not turn a completion into an error.
          if (backupKind) {
            const kindForReport = backupKind;
            ctx.waitUntil(
              fireEventReports(env, db, { spaceId, backupKind: kindForReport }).then(
                () => undefined,
                () => undefined,
              ),
            );
          }
        }
        // 4.2: now that this base's meters have landed, evaluate warn-90 /
        // enforce-100 for the org's affected stock meters and dispatch skeleton
        // notifications on transitions only. Behind ENTITLEMENT_ENFORCEMENT
        // (default off → warn-only). Best-effort — a metering/notification
        // failure must never turn a recorded completion into a wire error; the
        // reconciliation sweep (task 3.5) re-evaluates. Runs per non-noop
        // snapshot completion (D7: evaluation runs wherever usage changes land).
        try {
          const anchor = await resolveOrgAnchor(db, spaceId);
          if (anchor) {
            const { start, end } = currentMonthlyPeriod(anchor.anchor, new Date());
            await evaluateUsageForOrg(
              {
                organizationId: anchor.organizationId,
                featureSlugs: STOCK_METER_SLUGS,
                period: { start, end },
                now: new Date(),
              },
              usageEnforcementDeps(db, env),
            );
          }
        } catch {
          // best-effort; the sweep re-evaluates exact levels + states.
        }
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
