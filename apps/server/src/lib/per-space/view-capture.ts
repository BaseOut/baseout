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
 * Gated syncs sweep the base's still-`active` bo_at_views rows to `unknown` —
 * only when the gate resolved CLOSED. An open gate (Enterprise or override)
 * observes views normally and must not sweep.
 */
export function shouldSweepUnknownViews(setting: ViewCaptureSetting): boolean {
  return setting === false;
}

/**
 * Resolve the gate for a run: backup_runs.connection_id →
 * connections.platform_config. A missing run/connection resolves closed.
 */
export async function resolveViewCaptureForRun(
  db: AppDb,
  backupRunId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ platformConfig: connections.platformConfig })
    .from(backupRuns)
    .innerJoin(connections, eq(connections.id, backupRuns.connectionId))
    .where(eq(backupRuns.id, backupRunId))
    .limit(1);
  return row ? isEnterpriseViewCapture(row.platformConfig) : false;
}
