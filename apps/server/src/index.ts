// @baseout/server — backup/restore engine. Cloudflare Worker entry point.
// Headless API only: /api/health (public) + /api/internal/* (INTERNAL_TOKEN-gated).
// Per CLAUDE.md §5.2.

import type { AppLocals, Env } from "./env";
import { createMasterDb } from "./db/worker";
import { applyMiddleware } from "./middleware";
import { healthHandler } from "./pages/api/health";
import { internalPingHandler } from "./pages/api/internal/ping";
import { dbSmokeHandler } from "./pages/api/internal/db-smoke";
import { triggerSmokeHandler } from "./pages/api/internal/trigger-smoke";
import { whoamiHandler } from "./pages/api/internal/connections/whoami";
import {
  connectionDOProxyHandler,
  type ConnectionDOProxyAction,
} from "./pages/api/internal/connections/do-proxy";
import { runsStartHandler } from "./pages/api/internal/runs/start";
import { restoresStartHandler } from "./pages/api/internal/restores/start";
import { restoresProgressHandler } from "./pages/api/internal/restores/progress";
import { restoresCompleteHandler } from "./pages/api/internal/restores/complete";
import { runsCompleteHandler } from "./pages/api/internal/runs/complete";
import { runsProgressHandler } from "./pages/api/internal/runs/progress";
import { runsCancelHandler } from "./pages/api/internal/runs/cancel";
import { restoresCancelHandler } from "./pages/api/internal/restores/cancel";
import { runsDeleteHandler } from "./pages/api/internal/runs/delete";
import { runsDeleteCompleteHandler } from "./pages/api/internal/runs/delete-complete";
import { runsDetailHandler } from "./pages/api/internal/runs/detail";
import { spacesSetFrequencyHandler } from "./pages/api/internal/spaces/set-frequency";
import { spacesProvisionDatabaseHandler } from "./pages/api/internal/spaces/provision-database";
import { spacesSchemaSyncHandler } from "./pages/api/internal/spaces/schema-sync";
import { spacesRecordsSyncHandler } from "./pages/api/internal/spaces/records-sync";
import { spacesRescanBasesHandler } from "./pages/api/internal/spaces/rescan-bases";
import { spacesStorageDestinationHandler } from "./pages/api/internal/spaces/storage-destination";
import { spacesDocumentsHandler } from "./pages/api/internal/spaces/documents";
import { spacesDocumentHandler } from "./pages/api/internal/spaces/document";
import { spacesDocsByEntityHandler } from "./pages/api/internal/spaces/docs-by-entity";
import { spacesSchemaReadHandler } from "./pages/api/internal/spaces/schema-read";
import {
  attachmentsLookupHandler,
  attachmentsRecordHandler,
} from "./pages/api/internal/attachments/lookup";

const CONNECTIONS_WHOAMI_RE =
  /^\/api\/internal\/connections\/([^/]+)\/whoami$/;
const CONNECTIONS_DO_PROXY_RE =
  /^\/api\/internal\/connections\/([^/]+)\/(lock|unlock|token)$/;
const RUNS_START_RE = /^\/api\/internal\/runs\/([^/]+)\/start$/;
const RESTORES_START_RE = /^\/api\/internal\/restores\/([^/]+)\/start$/;
const RESTORES_PROGRESS_RE = /^\/api\/internal\/restores\/([^/]+)\/progress$/;
const RESTORES_COMPLETE_RE = /^\/api\/internal\/restores\/([^/]+)\/complete$/;
const RESTORES_CANCEL_RE = /^\/api\/internal\/restores\/([^/]+)\/cancel$/;
const RUNS_COMPLETE_RE = /^\/api\/internal\/runs\/([^/]+)\/complete$/;
const RUNS_PROGRESS_RE = /^\/api\/internal\/runs\/([^/]+)\/progress$/;
const RUNS_CANCEL_RE = /^\/api\/internal\/runs\/([^/]+)\/cancel$/;
const RUNS_DELETE_RE = /^\/api\/internal\/runs\/([^/]+)\/delete$/;
const RUNS_DELETE_COMPLETE_RE =
  /^\/api\/internal\/runs\/([^/]+)\/delete-complete$/;
const RUNS_DETAIL_RE = /^\/api\/internal\/runs\/([^/]+)\/detail$/;
const SPACES_SET_FREQUENCY_RE =
  /^\/api\/internal\/spaces\/([^/]+)\/set-frequency$/;
const SPACES_PROVISION_DATABASE_RE =
  /^\/api\/internal\/spaces\/([^/]+)\/provision-database$/;
const SPACES_SCHEMA_SYNC_RE =
  /^\/api\/internal\/spaces\/([^/]+)\/schema-sync$/;
const SPACES_RECORDS_SYNC_RE =
  /^\/api\/internal\/spaces\/([^/]+)\/records-sync$/;
const SPACES_RESCAN_BASES_RE =
  /^\/api\/internal\/spaces\/([^/]+)\/rescan-bases$/;
const SPACES_STORAGE_DESTINATION_RE =
  /^\/api\/internal\/spaces\/([^/]+)\/storage-destination$/;
// Schema Docs broker (openspec/changes/shared-schema-docs §2).
const SPACES_DOCUMENTS_RE =
  /^\/api\/internal\/spaces\/([^/]+)\/documents$/;
const SPACES_DOCUMENT_RE =
  /^\/api\/internal\/spaces\/([^/]+)\/documents\/([^/]+)$/;
const SPACES_DOCS_BY_ENTITY_RE =
  /^\/api\/internal\/spaces\/([^/]+)\/docs-by-entity$/;
const SPACES_SCHEMA_READ_RE =
  /^\/api\/internal\/spaces\/([^/]+)\/schema$/;

// Re-export Durable Object classes so workerd can resolve their bindings.
// Required even when Astro adapter wraps the entry — see CLAUDE.md §5.1.
export { ConnectionDO } from "./durable-objects/ConnectionDO";
export { SpaceDO } from "./durable-objects/SpaceDO";

function notFound(): Response {
  return new Response(JSON.stringify({ error: "not_found" }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const mw = applyMiddleware(request, env);
    if (mw.res) return mw.res;

    // Per CLAUDE.md §5.1: per-request masterDb. Built lazily on first access
    // so handlers that don't need the DB (health, ping) don't pay for it
    // and don't crash when DATABASE_URL/HYPERDRIVE is misconfigured.
    // Wrapped in an object so closure reassignment survives TS narrowing.
    const slot: { value: ReturnType<typeof createMasterDb> | null } = {
      value: null,
    };
    const locals: AppLocals = {
      getMasterDb() {
        if (!slot.value) slot.value = createMasterDb(env);
        return slot.value;
      },
    };

    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/health") {
        return await healthHandler(request, env, ctx, locals);
      }
      if (url.pathname === "/api/internal/ping") {
        return await internalPingHandler(request, env, ctx, locals);
      }
      if (url.pathname === "/api/internal/__db-smoke") {
        return await dbSmokeHandler(request, env, ctx, locals);
      }
      if (url.pathname === "/api/internal/__trigger-smoke") {
        return await triggerSmokeHandler(request, env, ctx, locals);
      }

      // PoC-only DO smoke test: forwards to ConnectionDO by stable name.
      // Token-gated via the /api/internal/ prefix in middleware.
      if (url.pathname === "/api/internal/__do-smoke") {
        const id = env.CONNECTION_DO.idFromName("smoke-test");
        return await env.CONNECTION_DO.get(id).fetch(request);
      }

      if (request.method === "POST") {
        const m = CONNECTIONS_WHOAMI_RE.exec(url.pathname);
        if (m) {
          return await whoamiHandler(request, env, ctx, locals, m[1]!);
        }
        const proxy = CONNECTIONS_DO_PROXY_RE.exec(url.pathname);
        if (proxy) {
          return await connectionDOProxyHandler(
            request,
            env,
            proxy[1]!,
            proxy[2]! as ConnectionDOProxyAction,
          );
        }
      }

      // Run-start handles its own method check so non-POST returns 405
      // (rather than 404) — gives the caller a clearer wire-error if it
      // somehow fires the wrong verb.
      const start = RUNS_START_RE.exec(url.pathname);
      if (start) {
        return await runsStartHandler(request, env, ctx, locals, start[1]!);
      }

      // Restore-start (server-restore Phase B.4): same method-check-inside-
      // handler pattern as run-start.
      const restoreStart = RESTORES_START_RE.exec(url.pathname);
      if (restoreStart) {
        return await restoresStartHandler(
          request,
          env,
          ctx,
          locals,
          restoreStart[1]!,
        );
      }

      // Restore-progress (server-restore Phase C.2): per-table advisory counter
      // bump from the restore-base task.
      const restoreProgress = RESTORES_PROGRESS_RE.exec(url.pathname);
      if (restoreProgress) {
        return await restoresProgressHandler(
          request,
          env,
          ctx,
          locals,
          restoreProgress[1]!,
        );
      }

      // Restore-complete (server-restore Phase C.4): per-base completion +
      // terminal-transition when all trigger_run_ids have reported in.
      const restoreComplete = RESTORES_COMPLETE_RE.exec(url.pathname);
      if (restoreComplete) {
        return await restoresCompleteHandler(
          request,
          env,
          ctx,
          locals,
          restoreComplete[1]!,
        );
      }

      // Restore-cancel (server-restore Phase D.2): mirrors run-cancel; uses
      // cancelled_at instead of completed_at.
      const restoreCancel = RESTORES_CANCEL_RE.exec(url.pathname);
      if (restoreCancel) {
        return await restoresCancelHandler(
          request,
          env,
          ctx,
          locals,
          restoreCancel[1]!,
        );
      }

      // Run-complete: same method-check-inside-handler pattern.
      const complete = RUNS_COMPLETE_RE.exec(url.pathname);
      if (complete) {
        return await runsCompleteHandler(
          request,
          env,
          ctx,
          locals,
          complete[1]!,
        );
      }

      // Run-progress (Phase 10d): same method-check-inside-handler pattern.
      const progress = RUNS_PROGRESS_RE.exec(url.pathname);
      if (progress) {
        return await runsProgressHandler(
          request,
          env,
          ctx,
          locals,
          progress[1]!,
        );
      }

      // Run-cancel: same method-check-inside-handler pattern. Handles 405
      // for non-POST + 400 for non-UUID runId before touching the DB.
      const cancel = RUNS_CANCEL_RE.exec(url.pathname);
      if (cancel) {
        return await runsCancelHandler(
          request,
          env,
          ctx,
          locals,
          cancel[1]!,
        );
      }

      // Run-delete-complete BEFORE run-delete: both regexes start with
      // /runs/<uuid>/, and `RUNS_DELETE_RE` would otherwise greedy-match
      // "<uuid>/delete-complete" with the trailing "-complete" sliced off
      // — well, no, $ anchors prevent that, but it costs nothing to check
      // the longer route first.
      const deleteComplete = RUNS_DELETE_COMPLETE_RE.exec(url.pathname);
      if (deleteComplete) {
        return await runsDeleteCompleteHandler(
          request,
          env,
          ctx,
          locals,
          deleteComplete[1]!,
        );
      }

      // Run-detail (server-run-detail): per-base/per-table snapshot read.
      // Returns { bases: [...] } assembled from backup_run_bases +
      // backup_run_tables for the given runId. GET-only; method-check inside
      // the handler returns 405 for non-GET.
      const detail = RUNS_DETAIL_RE.exec(url.pathname);
      if (detail) {
        return await runsDetailHandler(request, env, ctx, locals, detail[1]!);
      }

      // Run-delete: openspec/changes/shared-backup-run-delete. CAS-flips
      // the row to 'deleting' and enqueues delete-run-files; the task's
      // /delete-complete callback hard-DELETEs the row.
      const del = RUNS_DELETE_RE.exec(url.pathname);
      if (del) {
        return await runsDeleteHandler(
          request,
          env,
          ctx,
          locals,
          del[1]!,
        );
      }

      // Spaces set-frequency proxy (Phase B of
      // baseout-backup-schedule-and-cancel). apps/web's PATCH /backup-config
      // calls this when frequency changes; the route forwards to SpaceDO
      // and writes backup_configurations.next_scheduled_at.
      const setFreq = SPACES_SET_FREQUENCY_RE.exec(url.pathname);
      if (setFreq) {
        return await spacesSetFrequencyHandler(
          request,
          env,
          ctx,
          locals,
          setFreq[1]!,
        );
      }

      // Per-Space DB provisioning (openspec/changes/system-per-space-db §2).
      // apps/web's POST /api/spaces calls this after creating a Space; the
      // engine creates the per-Space DB + applies the bo_at_* schema. Method
      // check inside the handler.
      const provisionDb = SPACES_PROVISION_DATABASE_RE.exec(url.pathname);
      if (provisionDb) {
        return await spacesProvisionDatabaseHandler(
          request,
          env,
          ctx,
          locals,
          provisionDb[1]!,
        );
      }

      // Per-Space DB write path (openspec/changes/system-per-space-db §3).
      // The workflows backup writer POSTs captured schema + records here; the
      // engine diffs vs the per-Space DB and writes the bo_at_* tables.
      const schemaSync = SPACES_SCHEMA_SYNC_RE.exec(url.pathname);
      if (schemaSync) {
        return await spacesSchemaSyncHandler(request, env, ctx, locals, schemaSync[1]!);
      }
      const recordsSync = SPACES_RECORDS_SYNC_RE.exec(url.pathname);
      if (recordsSync) {
        return await spacesRecordsSyncHandler(request, env, ctx, locals, recordsSync[1]!);
      }

      // Workspace rediscovery — manual rescan. apps/web's POST
      // /api/spaces/:spaceId/rescan-bases proxies here. Method-check inside
      // handler so non-POST returns 405. Same alarm pure-fn runs in Phase 4
      // (SpaceDO) for scheduled rediscovery.
      const rescanBases = SPACES_RESCAN_BASES_RE.exec(url.pathname);
      if (rescanBases) {
        return await spacesRescanBasesHandler(
          request,
          env,
          ctx,
          locals,
          rescanBases[1]!,
        );
      }

      // Storage-destination credential read for the workflows runner
      // (openspec/changes/shared-byos-drive Phase 3). Decrypts + lazy-refreshes
      // Drive tokens; returns plaintext access token + Drive folder ID.
      const storageDest =
        SPACES_STORAGE_DESTINATION_RE.exec(url.pathname);
      if (storageDest) {
        return await spacesStorageDestinationHandler(
          request,
          env,
          ctx,
          locals,
          storageDest[1]!,
        );
      }

      // Schema Docs broker (openspec/changes/shared-schema-docs §2). apps/web's
      // authenticated /api/spaces/:spaceId/{documents,docs-by-entity} routes
      // proxy here; the browser never touches the per-Space DB.
      const docItem = SPACES_DOCUMENT_RE.exec(url.pathname);
      if (docItem) {
        return await spacesDocumentHandler(request, env, ctx, locals, docItem[1]!, docItem[2]!);
      }
      const docCollection = SPACES_DOCUMENTS_RE.exec(url.pathname);
      if (docCollection) {
        return await spacesDocumentsHandler(request, env, ctx, locals, docCollection[1]!);
      }
      const docsByEntity = SPACES_DOCS_BY_ENTITY_RE.exec(url.pathname);
      if (docsByEntity) {
        return await spacesDocsByEntityHandler(request, env, ctx, locals, docsByEntity[1]!);
      }
      const schemaRead = SPACES_SCHEMA_READ_RE.exec(url.pathname);
      if (schemaRead) {
        return await spacesSchemaReadHandler(request, env, ctx, locals, schemaRead[1]!);
      }

      // Attachment dedup (openspec/changes/server-attachments). The workflows
      // downloader hits /lookup (batch read + last_seen bump) before
      // downloading, and /record (batch upsert) after streaming a miss to the
      // StorageWriter. Both method-check inside the handler.
      if (url.pathname === "/api/internal/attachments/lookup") {
        return await attachmentsLookupHandler(request, env, ctx, locals);
      }
      if (url.pathname === "/api/internal/attachments/record") {
        return await attachmentsRecordHandler(request, env, ctx, locals);
      }

      return notFound();
    } finally {
      // Tear down only if a handler actually built the masterDb. Avoids a
      // wasted `sql.end` cycle on health / ping which never query.
      if (slot.value) ctx.waitUntil(slot.value.sql.end({ timeout: 5 }));
    }
  },

  async scheduled(
    _event: ScheduledEvent,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    // TODO(phase-2): dispatch background jobs by event.cron.
  },
};
