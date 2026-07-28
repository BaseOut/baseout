// Shared MCP-capture failure taxonomy + progress-outcome helper
// (workflows-mcp-views task 1.2, design Decision 3).
//
// The interface-pages and automations changes kept their failure taxonomies
// parallel "until a third capture kind exists" — views are the third, so the
// skip-reason union and the run-progress outcome mapping now live here and are
// consumed by all three wrappers (mcp-client.ts) and by the backup-base
// orchestration. Extraction is behavior-preserving: the pre-existing
// interface-pages and automations test matrices pass unmodified (the spec's
// hard rule for this refactor).

/**
 * Every way an MCP capture can fail. Maps 1:1 onto the `skipped(reason)`
 * strings surfaced in run progress. Owned here since workflows-mcp-views;
 * mcp-client.ts re-exports it for back-compat with existing imports.
 */
export type McpSkipReason =
  | "timeout"
  | "auth"
  | "transport"
  | "invalid_envelope"
  | "payload_too_large"
  | "rpc_error"
  | "no_result"
  | `http_${number}`;

/**
 * Run-progress outcome for one MCP capture kind (interfacePages / automations
 * / views on BackupBaseResult). `skipped` NEVER affects the run's status —
 * failure isolation is each capture spec's hard rule. `notice:
 * 'connection_scope'` flags a token the MCP server rejected (401/403) so
 * support can spot scope problems on the run.
 */
export type McpCaptureOutcome =
  | { status: "captured" }
  | { status: "skipped"; reason: string; notice?: "connection_scope" };

/**
 * Map a wrapper result onto the run-progress outcome. Centralizes the
 * auth → connection_scope notice rule all three captures share.
 */
export function mcpCaptureOutcome(
  result: { ok: true } | { ok: false; reason: McpSkipReason },
): McpCaptureOutcome {
  if (result.ok) return { status: "captured" };
  return {
    status: "skipped",
    reason: result.reason,
    ...(result.reason === "auth" ? { notice: "connection_scope" as const } : {}),
  };
}
