/**
 * Internal-API client for @baseout/server (the backup engine).
 *
 * apps/web calls into the engine via a Cloudflare service binding (no public
 * URL hop), gated by INTERNAL_TOKEN. Today this client exposes a single
 * method (`whoami`) that proves a Connection's stored token still works
 * against Airtable. Future engine endpoints (run-now, cancel-run, list-
 * progress, etc.) extend this same client — they reuse the binding-fetcher
 * resolution and the typed-error shape below.
 *
 * The internal token NEVER reaches the browser. This client runs server-side
 * inside the Astro Worker; the browser POSTs to apps/web routes that wrap it.
 *
 * Wire format mirrors the engine's status-code matrix at:
 *   apps/server/src/pages/api/internal/connections/whoami.ts
 *
 * Service binding declared in apps/web/wrangler.jsonc — `services[].binding =
 * BACKUP_ENGINE`, pointing at the worker named "baseout-server". The URL host
 * passed to `fetcher.fetch(...)` is a placeholder ignored by Cloudflare;
 * routing is by binding, not DNS. Local dev: both wrangler-dev instances
 * find each other via the dev registry. Deployed: routed worker-to-worker
 * inside Cloudflare.
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
  /**
   * Cloudflare service binding to @baseout/server. Tests pass a stub
   * Fetcher; production code passes `env.BACKUP_ENGINE`.
   */
  fetcher: Fetcher;
  /** Shared secret matching the engine's INTERNAL_TOKEN. */
  internalToken: string;
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

// Placeholder host for Fetcher.fetch — Cloudflare ignores it, routing by
// service binding instead of DNS. Required because URL must parse.
const ENGINE_PLACEHOLDER_HOST = "https://engine";

export function createBackupEngine(
  options: BackupEngineOptions,
): BackupEngineClient {
  const fetcher = options.fetcher;
  return {
    async whoami(connectionId) {
      const url = `${ENGINE_PLACEHOLDER_HOST}/api/internal/connections/${encodeURIComponent(connectionId)}/whoami`;
      let res: Response;
      try {
        res = await fetcher.fetch(url, {
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
