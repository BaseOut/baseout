/**
 * Internal-API client for @baseout/server (the backup engine).
 *
 * apps/web calls into the engine over a Cloudflare Worker service binding,
 * gated by INTERNAL_TOKEN sent as the `x-internal-token` header. Today this
 * client exposes a single method (`whoami`) that proves a Connection's
 * stored token still works against Airtable. Future engine endpoints (run-
 * now, cancel-run, list-progress, etc.) extend this same client — they
 * reuse the binding + token plumbing and the typed-error shape below.
 *
 * The internal token NEVER reaches the browser. This client runs server-side
 * inside the Astro Worker; the browser POSTs to apps/web routes that wrap it.
 *
 * Wire format mirrors the engine's status-code matrix at:
 *   apps/server/src/pages/api/internal/connections/whoami.ts
 *
 * Transport:
 *   - apps/web declares `services: [{ binding: "BACKUP_ENGINE", service:
 *     "baseout-server-<env>" }]` in wrangler.jsonc.example. At runtime
 *     `env.BACKUP_ENGINE` is a `Fetcher` that routes through Cloudflare's
 *     internal Worker-to-Worker network — never public DNS, no RFC1918
 *     edge ban, identical behaviour in `wrangler dev --remote` and in
 *     deployed envs.
 *   - The placeholder host on the request URL is irrelevant — Cloudflare
 *     binds by name, not by Host header. apps/server reads only the path
 *     + headers + body.
 *
 * Per CLAUDE.md §5.2 + §3.3 — same wire format used in production.
 */

export interface EngineWhoamiSuccess {
  ok: true;
  connectionId: string;
  airtable: {
    id: string;
    scopes: string[];
    email?: string;
  };
}

/**
 * Non-2xx outcomes from the engine. Callers map `code` to user-facing copy.
 *
 * `code` enumerates the known engine error codes (best-effort — unknown codes
 * fall through as `engine_error`). `status` is the HTTP status the engine
 * returned, useful for surfacing upstream details.
 */
export interface EngineWhoamiError {
  ok: false;
  code:
    | "unauthorized"
    | "invalid_connection_id"
    | "connection_not_found"
    | "connection_status"
    | "server_misconfigured"
    | "decrypt_failed"
    | "airtable_token_rejected"
    | "airtable_upstream"
    | "engine_unreachable"
    | "engine_error";
  status: number;
  /** Echo of the engine's `status` field on connection_status (e.g. 'pending_reauth'). */
  connectionStatus?: string;
  /** Echo of the engine's `upstream_status` on airtable_upstream. */
  upstreamStatus?: number;
}

export type EngineWhoamiResult = EngineWhoamiSuccess | EngineWhoamiError;

export interface EngineStartRunSuccess {
  ok: true;
  runId: string;
  /** One Trigger.dev run id per included base — order matches the at_bases selection. */
  triggerRunIds: string[];
}

/**
 * Non-2xx outcomes from POST /api/internal/runs/:runId/start. The codes
 * mirror `ProcessRunStartResult["error"]` in @baseout/server (see
 * apps/server/src/lib/runs/start.ts) plus the middleware's `unauthorized`
 * and the client-only `engine_unreachable` / `engine_error`.
 */
export interface EngineStartRunError {
  ok: false;
  code:
    | "unauthorized"
    | "run_not_found"
    | "run_already_started"
    | "connection_not_found"
    | "invalid_connection"
    | "config_not_found"
    | "unsupported_storage_type"
    | "no_bases_selected"
    | "engine_unreachable"
    | "engine_error";
  status: number;
}

export type EngineStartRunResult = EngineStartRunSuccess | EngineStartRunError;

export interface BackupEngineOptions {
  /**
   * Service binding to the @baseout/server Worker. Provided by Cloudflare
   * at runtime as `env.BACKUP_ENGINE`. Tests inject a `Fetcher`-shaped stub.
   */
  binding: Fetcher;
  /** Shared secret matching the engine's INTERNAL_TOKEN. */
  internalToken: string;
}

export interface BackupEngineClient {
  whoami(connectionId: string): Promise<EngineWhoamiResult>;
  startRun(runId: string): Promise<EngineStartRunResult>;
}

const KNOWN_ERROR_CODES: ReadonlySet<EngineWhoamiError["code"]> = new Set([
  "unauthorized",
  "invalid_connection_id",
  "connection_not_found",
  "connection_status",
  "server_misconfigured",
  "decrypt_failed",
  "airtable_token_rejected",
  "airtable_upstream",
]);

const KNOWN_START_RUN_ERROR_CODES: ReadonlySet<EngineStartRunError["code"]> =
  new Set([
    "unauthorized",
    "run_not_found",
    "run_already_started",
    "connection_not_found",
    "invalid_connection",
    "config_not_found",
    "unsupported_storage_type",
    "no_bases_selected",
  ]);

export function createBackupEngine(
  options: BackupEngineOptions,
): BackupEngineClient {
  return {
    async whoami(connectionId) {
      const path = `/api/internal/connections/${encodeURIComponent(connectionId)}/whoami`;
      // Service bindings expose `.fetch(input, init?)` exactly like global
      // fetch. The base URL is irrelevant — Cloudflare routes by binding,
      // not by Host header — but `Fetcher.fetch()` requires an absolute URL
      // input, so we use a stable placeholder. apps/server reads only the
      // path + headers + body.
      let res: Response;
      try {
        res = await options.binding.fetch(`https://engine${path}`, {
          method: "POST",
          headers: {
            "x-internal-token": options.internalToken,
            accept: "application/json",
          },
        });
      } catch {
        return { ok: false, code: "engine_unreachable", status: 0 };
      }

      if (res.ok) {
        const body = (await res.json()) as Omit<EngineWhoamiSuccess, "ok">;
        return { ok: true, ...body };
      }

      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        // engine returned non-JSON (rare); fall through with empty body
      }
      const rawCode = typeof body.error === "string" ? body.error : undefined;
      const code: EngineWhoamiError["code"] =
        rawCode && KNOWN_ERROR_CODES.has(rawCode as EngineWhoamiError["code"])
          ? (rawCode as EngineWhoamiError["code"])
          : "engine_error";
      const out: EngineWhoamiError = {
        ok: false,
        code,
        status: res.status,
      };
      if (typeof body.status === "string") out.connectionStatus = body.status;
      if (typeof body.upstream_status === "number") {
        out.upstreamStatus = body.upstream_status;
      }
      return out;
    },

    async startRun(runId) {
      const path = `/api/internal/runs/${encodeURIComponent(runId)}/start`;
      let res: Response;
      try {
        res = await options.binding.fetch(`https://engine${path}`, {
          method: "POST",
          headers: {
            "x-internal-token": options.internalToken,
            accept: "application/json",
          },
        });
      } catch {
        return { ok: false, code: "engine_unreachable", status: 0 };
      }

      if (res.ok) {
        const body = (await res.json()) as Omit<EngineStartRunSuccess, "ok">;
        return { ok: true, ...body };
      }

      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        // engine returned non-JSON (rare); fall through with empty body
      }
      const rawCode = typeof body.error === "string" ? body.error : undefined;
      const code: EngineStartRunError["code"] =
        rawCode &&
        KNOWN_START_RUN_ERROR_CODES.has(rawCode as EngineStartRunError["code"])
          ? (rawCode as EngineStartRunError["code"])
          : "engine_error";
      return { ok: false, code, status: res.status };
    },
  };
}
