// POST /api/internal/spaces/:spaceId/schema-sync
//
// The workflows backup writer POSTs the captured Airtable schema for ONE base;
// the engine diffs it against the per-Space DB's current working set and writes
// bo_at_schema_versions (hash-deduped) + bo_at_{bases,tables,fields,views}
// lifecycle + bo_at_schema_updates. Returns recordsEnabled so the writer knows
// whether to follow up with /records-sync. Runs regardless of records_enabled —
// the per-Space DB always holds schema.
//
// Optional `interfacePages` field (server-mcp-interface-pages): the raw MCP
// list_pages_for_base capture + capturedAt. When present, interface entities
// are extracted, diffed against the prior MCP-sourced working set, and
// persisted in the SAME transaction/run association as the schema diff. An
// absent field means no interface processing whatsoever (old workflows,
// skipped captures — never "all interfaces deleted"). Extraction/validation
// failures are reported per-section on the response and never fail the sync.
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { createMasterDb } from "../../../../db/worker";
import { diffSchema, type CapturedBase } from "../../../../lib/per-space/schema-diff";
import {
  diffInterfaces,
  parseInterfacePagesField,
} from "../../../../lib/per-space/interfaces-sync";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import {
  applyInterfaceDiff,
  applySchemaDiff,
  ensureBaseRun,
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

  const { db: masterDb, sql } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

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
      const result = diffSchema({ captured, prior, runId: baseRunId, confident });
      await applySchemaDiff(tx, { baseId: captured.baseId, baseRunId, result, schemaJson: captured });

      // Interface entities ride the same transaction + run association as the
      // schema diff (design Decision 4). The pure diff is guarded so an
      // interface-side computation failure reports per-section instead of
      // failing the schema sync; DB write failures abort the whole tx, same
      // as the schema writes above.
      if (interfaceCapture) {
        let interfaceDiff: ReturnType<typeof diffInterfaces> | null = null;
        try {
          const priorInterfaces = await readInterfaceWorkingSet(tx, captured.baseId);
          interfaceDiff = diffInterfaces({ prior: priorInterfaces, next: interfaceCapture.entities });
        } catch {
          interfaceSync = { ok: false, reason: "diff_failed" };
        }
        if (interfaceDiff) {
          await applyInterfaceDiff(tx, {
            baseId: captured.baseId,
            baseRunId,
            capturedAt: interfaceCapture.capturedAt,
            diff: interfaceDiff,
          });
          interfaceSync = {
            ok: true,
            added: interfaceDiff.inserts.length,
            removed: interfaceDiff.removals.length,
            updates: interfaceDiff.updates.length,
            unchanged: interfaceDiff.unchanged,
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
        schemaChanged: result.schemaChanged,
        lifecycle: result.lifecycle.length,
        updates: result.schemaUpdates.length,
        // Present only when the request carried `interfacePages` — lets the
        // workflows task report the interface section in run progress.
        ...(interfaceSync !== undefined ? { interfaceSync } : {}),
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
