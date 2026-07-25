// POST /api/internal/spaces/:spaceId/schema-sync
//
// The workflows backup writer POSTs the captured Airtable schema for ONE base;
// the engine diffs it against the per-Space DB's current working set and writes
// bo_at_schema_versions (hash-deduped) + bo_at_{bases,tables,fields,views}
// lifecycle + bo_at_schema_updates. Returns recordsEnabled so the writer knows
// whether to follow up with /records-sync. Runs regardless of records_enabled —
// the per-Space DB always holds schema.
//
// bo_at_views capture is gated to Airtable-Enterprise connections
// (system-per-space-db §8.2, view-capture.ts): non-Enterprise captures have
// views stripped up front and the diff skips the views block, while the
// base's still-active view rows are swept to `unknown` in the same
// transaction. VIEW_CAPTURE_OVERRIDE="1" (dev Worker only) opens the gate for
// every connection (server-view-capture-override). After the sync,
// the per-table query matviews are regenerated best-effort when records are
// enabled (§4.2, query-views-io.ts).
//
// Optional `interfacePages` field (server-mcp-interface-pages): the raw MCP
// list_pages_for_base capture + capturedAt. When present, interface entities
// are extracted, diffed against the prior MCP-sourced working set, and
// persisted in the SAME transaction/run association as the schema diff. An
// absent field means no interface processing whatsoever (old workflows,
// skipped captures — never "all interfaces deleted"). Extraction/validation
// failures are reported per-section on the response and never fail the sync.
//
// Optional `automations` field (server-mcp-automations): the raw MCP
// list_automations capture + capturedAt, with the same contract — extracted,
// diffed against the prior submitted_via='mcp' rows of the EXISTING
// bo_at_automations table, persisted in the same transaction; absent field =
// no automation processing (never "all automations deleted").
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { createMasterDb } from "../../../../db/worker";
import { diffSchema, type CapturedBase } from "../../../../lib/per-space/schema-diff";
import {
  diffInterfaces,
  parseInterfacePagesField,
} from "../../../../lib/per-space/interfaces-sync";
import {
  diffAutomations,
  parseAutomationsField,
} from "../../../../lib/per-space/automations-sync";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import {
  applyAutomationDiff,
  applyInterfaceDiff,
  applySchemaDiff,
  ensureBaseRun,
  markViewsUnknownForBase,
  readAutomationWorkingSet,
  readInterfaceWorkingSet,
  readSchemaWorkingSet,
  withSpaceSchema,
} from "../../../../lib/per-space/space-db-pg";
import {
  loadDescribeBaseData,
  runDescribeBase,
  saveDescriptionUpdates,
  workersAiGenerate,
} from "../../../../lib/per-space/describe-schema-io";
import { runEngineHealthScore, workersAiScoreMetric } from "../../../../lib/per-space/health-score-run";
import { inferAndWriteSyncedViews } from "../../../../lib/per-space/relationships-io";
import { regenerateQueryViews } from "../../../../lib/per-space/query-views-io";
import {
  resolveViewCaptureForRun,
  resolveViewCaptureSetting,
  shouldSweepUnknownViews,
  stripCapturedViews,
} from "../../../../lib/per-space/view-capture";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesSchemaSyncHandler(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const body = raw as {
    backupRunId?: unknown;
    captured?: unknown;
    confident?: unknown;
    interfacePages?: unknown;
    automations?: unknown;
  };
  if (!UUID_RE.test(String(body.backupRunId))) return jsonResponse({ error: "invalid_request" }, 400);
  const captured = body.captured as CapturedBase | undefined;
  if (!captured || typeof captured.baseId !== "string" || !Array.isArray(captured.tables)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const backupRunId = String(body.backupRunId);
  const confident = body.confident !== false; // default true (full schema capture)

  // Optional interface-pages capture — validated + extracted (pure) up front
  // so a malformed capture is reported without touching the transaction.
  // `undefined` summary = field absent = no interface processing at all.
  let interfaceSync:
    | { ok: true; added: number; removed: number; updates: number; unchanged: boolean }
    | { ok: false; reason: string }
    | undefined;
  const parsedCapture = parseInterfacePagesField(body.interfacePages);
  const interfaceCapture = parsedCapture.kind === "ok" ? parsedCapture : null;
  if (parsedCapture.kind === "invalid") {
    interfaceSync = { ok: false, reason: parsedCapture.reason };
  }

  // Optional automations capture — same parse-up-front contract
  // (server-mcp-automations). `undefined` summary = field absent = no
  // automation processing at all.
  let automationSync:
    | { ok: true; added: number; removed: number; updates: number; unchanged: boolean }
    | { ok: false; reason: string }
    | undefined;
  const parsedAutomations = parseAutomationsField(body.automations);
  const automationCapture = parsedAutomations.kind === "ok" ? parsedAutomations : null;
  if (parsedAutomations.kind === "invalid") {
    automationSync = { ok: false, reason: parsedAutomations.reason };
  }

  const { db: masterDb, sql } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  // Enterprise view-capture gate (system-per-space-db §8.2): non-Enterprise
  // connections get views stripped BEFORE hashing/diffing/storing — neither
  // bo_at_views, the schema hash, nor the schema_versions JSON carries view
  // metadata. includeViews=false keeps the diff from confidently "removing"
  // prior view rows captured before the gate existed; instead a closed gate
  // sweeps still-active rows to `unknown` inside the sync transaction below.
  // VIEW_CAPTURE_OVERRIDE="1" (dev Worker only, server-view-capture-override)
  // opens the gate for every connection without the DB resolution.
  const viewCapture = await resolveViewCaptureSetting(env.VIEW_CAPTURE_OVERRIDE, () =>
    resolveViewCaptureForRun(masterDb, backupRunId),
  );
  const capturedGated = viewCapture ? captured : stripCapturedViews(captured);

  // Best-effort: bring an older Space to the current per-Space schema before the
  // write + inference below (system-per-space-upgrade). Must not fail the sync.
  try {
    await ensureSpaceSchemaCurrent(masterDb, sql, {
      spaceId,
      pgLocator: space.pgLocator,
      schemaVersion: space.schemaVersion,
    });
  } catch {
    // ignored — re-attempted on the next sync.
  }

  try {
    const { baseRunId, result } = await withSpaceSchema(masterDb, space.pgLocator, async (tx) => {
      const baseRunId = await ensureBaseRun(tx, backupRunId, captured.baseId);
      const prior = await readSchemaWorkingSet(tx, captured.baseId);
      const result = diffSchema({
        captured: capturedGated,
        prior,
        runId: baseRunId,
        confident,
        includeViews: Boolean(viewCapture),
      });
      await applySchemaDiff(tx, { baseId: captured.baseId, baseRunId, result, schemaJson: capturedGated });

      // Closed gate ⇒ this sync could not observe views: flip the base's
      // still-active bo_at_views rows to `unknown` in the same transaction
      // (server-view-capture-override). Idempotent; reappearance on a later
      // gate-open sync is handled by the normal insert/seen upsert.
      if (shouldSweepUnknownViews(viewCapture)) {
        await markViewsUnknownForBase(tx, captured.baseId);
      }

      // Interface entities ride the same transaction + run association as the
      // schema diff (design Decision 4). The pure diff is guarded so an
      // interface-side computation failure reports per-section instead of
      // failing the schema sync; DB write failures abort the whole tx, same
      // as the schema writes above.
      if (interfaceCapture) {
        let interfaceDiff: ReturnType<typeof diffInterfaces> | null = null;
        try {
          const priorInterfaces = await readInterfaceWorkingSet(tx, captured.baseId);
          interfaceDiff = diffInterfaces({ prior: priorInterfaces, next: interfaceCapture.capture });
        } catch {
          interfaceSync = { ok: false, reason: "diff_failed" };
        }
        if (interfaceDiff) {
          await applyInterfaceDiff(tx, {
            baseId: captured.baseId,
            baseRunId,
            diff: interfaceDiff,
          });
          const d = interfaceDiff;
          interfaceSync = {
            ok: true,
            added:
              d.interfaces.inserts.length + d.pages.inserts.length + d.forms.inserts.length,
            removed:
              d.interfaces.removals.length + d.pages.removals.length + d.forms.removals.length,
            updates: d.updates.length,
            unchanged: d.unchanged,
          };
        }
      }

      // Automation entities — same transaction/run association, same guarded
      // pure-diff pattern as interfaces above (server-mcp-automations).
      if (automationCapture) {
        let automationDiff: ReturnType<typeof diffAutomations> | null = null;
        try {
          const priorAutomations = await readAutomationWorkingSet(tx, captured.baseId);
          automationDiff = diffAutomations({ prior: priorAutomations, next: automationCapture.capture });
        } catch {
          automationSync = { ok: false, reason: "diff_failed" };
        }
        if (automationDiff) {
          await applyAutomationDiff(tx, {
            baseId: captured.baseId,
            baseRunId,
            capturedAt: automationCapture.capturedAt,
            diff: automationDiff,
          });
          automationSync = {
            ok: true,
            added: automationDiff.automations.inserts.length,
            removed: automationDiff.automations.removals.length,
            updates: automationDiff.updates.length,
            unchanged: automationDiff.unchanged,
          };
        }
      }

      return { baseRunId, result };
    });

    // Best-effort synced-view inference off the freshly-written schema
    // (server-relationships). Advisory + idempotent: a failure here must NOT
    // fail the schema sync, so it runs in its own tx and swallows errors. An
    // explicit re-infer is also available via /relationships/sync.
    try {
      await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
        inferAndWriteSyncedViews(tx, { baseId: captured.baseId, runId: baseRunId }),
      );
    } catch {
      // ignored — the next schema capture re-runs inference.
    }

    // Best-effort per-table query-view regeneration (system-per-space-db
    // §4.2): renames/retypes/removals change view names + safe-casts, so the
    // full set is rebuilt off the freshly-written schema. Same own-tx +
    // swallow pattern as the inference above — records-sync repopulates each
    // table's view again after its records land, and the next sync retries.
    if (space.recordsEnabled) {
      try {
        await withSpaceSchema(masterDb, space.pgLocator, (tx) => regenerateQueryViews(tx, {}));
      } catch {
        // ignored — records-sync / the next schema sync regenerates.
      }
    }

    // Best-effort AI descriptions for undescribed entities of this base
    // (server-schema-descriptions). Runs AFTER the response via waitUntil with
    // a FRESH DB client — the request-scoped client is torn down at response
    // time, and the model calls must not delay the sync ack or hold a pooled
    // connection (load and save are separate short transactions around the
    // generation). Skipped when the AI binding is absent or disabled.
    const generate = workersAiGenerate(env);
    const scoreMetric = workersAiScoreMetric(env);
    if (generate || scoreMetric) {
      const pgLocator = space.pgLocator;
      ctx.waitUntil(
        (async () => {
          const fresh = createMasterDb(env);
          try {
            if (generate) {
              await runDescribeBase({
                baseId: captured.baseId,
                load: () => withSpaceSchema(fresh.db, pgLocator, (tx) => loadDescribeBaseData(tx, captured.baseId)),
                save: (updates) => withSpaceSchema(fresh.db, pgLocator, (tx) => saveDescriptionUpdates(tx, updates)),
                generate,
              });
            }
            // Health scores after every schema capture (the Health tab's
            // "runs after a schema backup completes" contract) — only when the
            // schema actually changed or the base has never been scored is
            // decided inside resolveScoreInputs' enabled-metrics gate; scoring
            // an unchanged base refreshes staleness cheaply at POC scale.
            if (scoreMetric && result.schemaChanged) {
              await runEngineHealthScore({
                masterDb: fresh.db,
                pgLocator,
                spaceId,
                baseId: captured.baseId,
                runId: baseRunId,
                scoreMetric,
              });
            }
          } catch (err) {
            // Advisory — the next sync retries. Logged because a silent failure
            // here means "descriptions/health never appear" with zero signal.
            // eslint-disable-next-line no-console -- background-task failure would otherwise be invisible
            console.error("post-sync AI task failed:", err instanceof Error ? err.message : String(err));
          } finally {
            await fresh.sql.end({ timeout: 5 }).catch(() => {});
          }
        })(),
      );
    }

    return jsonResponse(
      {
        ok: true,
        baseRunId,
        recordsEnabled: space.recordsEnabled,
        // §8.2 — false = the Airtable connection is not Enterprise-scoped and
        // view metadata was stripped from this capture (still-active view rows
        // swept to `unknown`). "override" = VIEW_CAPTURE_OVERRIDE opened the
        // gate (server-view-capture-override), true = Enterprise-scoped.
        viewCapture,
        schemaChanged: result.schemaChanged,
        lifecycle: result.lifecycle.length,
        updates: result.schemaUpdates.length,
        // Present only when the request carried `interfacePages` — lets the
        // workflows task report the interface section in run progress.
        ...(interfaceSync !== undefined ? { interfaceSync } : {}),
        // Same contract for the optional `automations` field.
        ...(automationSync !== undefined ? { automationSync } : {}),
      },
      200,
    );
  } catch (err) {
    return jsonResponse(
      { error: "sync_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
