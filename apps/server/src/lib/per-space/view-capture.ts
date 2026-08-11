// Enterprise view-capture gate (system-per-space-db §8.2).
//
// bo_at_views is included in the per-Space schema, but CAPTURE is gated to
// Airtable Enterprise customers — the plan at which view metadata is
// meaningfully available; empty otherwise (design "Open items", resolved
// 2026-06-22). The signal is OAuth-scope-derived: apps/web stamps
// connections.platform_config.is_enterprise_scope at Connect time when the
// granted scopes include any `enterprise.*` scope
// (apps/web/src/lib/airtable/persist.ts). The gate defaults CLOSED — a
// missing/malformed config means "not Enterprise".
//
// Enforcement is engine-side on the full-backup /schema-sync path (the only
// path that persists bo_at_views): gated captures have their views stripped
// BEFORE hashing/diffing/storing, so neither bo_at_views, the schema hash,
// nor the bo_at_schema_versions JSON carries view metadata. Prior view rows
// captured before the gate existed are left untouched (not false-removed).
// The incremental path already skips view events unconditionally
// (planSchemaWrites) — full runs own view capture.

import { eq } from "drizzle-orm";
import { backupRuns, connections } from "../../db/schema";
import type { AppDb } from "../../db/worker";
import type { CapturedBase } from "./schema-diff";

/** True only for a well-formed platform_config with is_enterprise_scope === true. */
export function isEnterpriseViewCapture(platformConfig: unknown): boolean {
  if (typeof platformConfig !== "object" || platformConfig === null || Array.isArray(platformConfig)) {
    return false;
  }
  return (platformConfig as Record<string, unknown>).is_enterprise_scope === true;
}

/** Empty every table's views — pure, input untouched. */
export function stripCapturedViews(captured: CapturedBase): CapturedBase {
  return { ...captured, tables: captured.tables.map((t) => ({ ...t, views: [] })) };
}

/**
 * How the gate resolved for a sync: `true` = the connection is
 * Airtable-Enterprise-scoped, `"override"` = the VIEW_CAPTURE_OVERRIDE env var
 * opened it (server-view-capture-override), `false` = closed. Truthiness is
 * preserved so `if (viewCapture)` callers keep working.
 */
export type ViewCaptureSetting = boolean | "override";

/**
 * Env-var override in front of the per-run DB resolution
 * (server-view-capture-override): exactly `"1"` opens the gate as
 * `"override"` without calling `resolveFromDb` at all (dev Workers skip the
 * master-DB round-trip); any other value defers to the resolver unchanged.
 */
export async function resolveViewCaptureSetting(
  envValue: string | undefined,
  resolveFromDb: () => Promise<boolean>,
): Promise<ViewCaptureSetting> {
  if (envValue === "1") return "override";
  return resolveFromDb();
}

/**
 * How a run captures views (server-mcp-views): `'rest'` = enterprise-scope
 * connection, views ride the REST schema payload exactly as before this
 * change; `'mcp'` = everyone else — the workflows task captures views via the
 * Airtable MCP server and forwards them on schema-sync's optional `views`
 * field; `'off'` = capture disabled (unresolvable run/connection — default
 * closed).
 */
export type ViewCaptureMode = "rest" | "mcp" | "off";

/** Mode for a connection's platform_config: enterprise → 'rest', else 'mcp'. */
export function viewCaptureModeFromConnection(platformConfig: unknown): ViewCaptureMode {
  return isEnterpriseViewCapture(platformConfig) ? "rest" : "mcp";
}

/**
 * Env-var override in front of the per-run mode resolution: exactly `"1"`
 * resolves `'rest'` without calling `resolveFromDb` at all — the legacy dev
 * escape (server-view-capture-override) opened the REST gate for every
 * connection, and `'rest'` is that behavior in mode terms (REST payload views
 * captured, no MCP call). Any other value defers to the resolver unchanged.
 */
export async function resolveViewCaptureMode(
  envValue: string | undefined,
  resolveFromDb: () => Promise<ViewCaptureMode>,
): Promise<ViewCaptureMode> {
  if (envValue === "1") return "rest";
  return resolveFromDb();
}

/**
 * Sweep the base's still-`active` bo_at_views rows to `unknown` only when the
 * run captured views from NO source (design Decision 3): `unknown` means "we
 * lost visibility", removal means "it's gone", and a successful MCP capture is
 * a full sighting. `viewsSighted` = the MCP capture was processed OK, or the
 * REST payload carried views (belt-and-braces — a non-enterprise payload
 * shouldn't, but if it did, visibility wasn't lost).
 */
export function shouldSweepUnknownViews(mode: ViewCaptureMode, viewsSighted: boolean): boolean {
  if (mode === "rest") return false;
  if (mode === "mcp") return !viewsSighted;
  return true;
}

/**
 * Resolve the run's view-capture mode: backup_runs.connection_id →
 * connections.platform_config. Enterprise scope keeps today's REST path;
 * everyone else is MCP; a missing run/connection resolves 'off' (closed).
 */
export async function resolveViewCaptureModeForRun(
  db: AppDb,
  backupRunId: string,
): Promise<ViewCaptureMode> {
  const [row] = await db
    .select({ platformConfig: connections.platformConfig })
    .from(backupRuns)
    .innerJoin(connections, eq(connections.id, backupRuns.connectionId))
    .where(eq(backupRuns.id, backupRunId))
    .limit(1);
  return row ? viewCaptureModeFromConnection(row.platformConfig) : "off";
}
