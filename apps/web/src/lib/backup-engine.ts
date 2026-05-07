/**
 * Internal-API client for @baseout/server (the backup engine).
 *
 * apps/web calls into the engine over plain HTTP (configurable URL), gated by
 * INTERNAL_TOKEN sent as the `x-internal-token` header. Today this client
 * exposes a single method (`whoami`) that proves a Connection's stored token
 * still works against Airtable. Future engine endpoints (run-now, cancel-run,
 * list-progress, etc.) extend this same client — they reuse the URL + token
 * resolution and the typed-error shape below.
 *
 * The internal token NEVER reaches the browser. This client runs server-side
 * inside the Astro Worker; the browser POSTs to apps/web routes that wrap it.
 *
 * Wire format mirrors the engine's status-code matrix at:
 *   apps/server/src/pages/api/internal/connections/whoami.ts
 *
 * URL configuration:
 *   - Local dev: env.BACKUP_ENGINE_URL = http://localhost:8787 (apps/server's
 *     wrangler dev port, default).
 *   - Deployed: env.BACKUP_ENGINE_URL = the deployed @baseout/server URL
 *     (e.g. https://baseout-server.openside.workers.dev), set via
 *     `wrangler secret put BACKUP_ENGINE_URL --env <env>` per environment.
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

export interface BackupEngineOptions {
  /** Engine base URL, e.g. http://localhost:8787 in dev. */
  url: string;
  /** Shared secret matching the engine's INTERNAL_TOKEN. */
  internalToken: string;
  /** Optional fetch override for tests. */
  fetchImpl?: typeof fetch;
}

export interface BackupEngineClient {
  whoami(connectionId: string): Promise<EngineWhoamiResult>;
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

function joinUrl(base: string, path: string): string {
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${trimmed}${path}`;
}

export function createBackupEngine(
  options: BackupEngineOptions,
): BackupEngineClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async whoami(connectionId) {
      const path = `/api/internal/connections/${encodeURIComponent(connectionId)}/whoami`;
      let res: Response;
      try {
        res = await fetchImpl(joinUrl(options.url, path), {
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
  };
}
