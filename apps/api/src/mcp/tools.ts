// MCP tool catalog (api-mcp §1). Each read operation in the REST registry that is
// MCP-eligible is declared here as one tool, referencing the operation by
// (method, path) — a contract test asserts every tool resolves to a real
// operation and vice-versa, so REST/MCP drift fails CI (design: "drift
// structurally impossible"). `orgId` and `{platform}` are always injected from
// the token / v1 default and never appear as tool args; `spaceId` is injected
// when the token is Space-bound, otherwise a required arg (grant-aware elision,
// handled by the catalog). Tools are read-only (readOnlyHint).

export interface McpToolDef {
  name: string;
  description: string;
  method: "GET" | "POST";
  /** Must match a registry operation's `path`. */
  path: string;
  /** JSON Schema properties for caller-supplied args (excludes orgId/platform). */
  argProps: Record<string, unknown>;
  /** Required arg names (spaceId is added conditionally by the catalog). */
  required?: string[];
  /** POST tools: caller args become the request body (else they become query/path). */
  bodyTool?: boolean;
}

const S = { type: "string" } as const;
const INT = { type: "integer", minimum: 1, maximum: 100 } as const;
const limitCursor = { limit: INT, cursor: S };

export const MCP_TOOLS: McpToolDef[] = [
  { name: "get_org", description: "Get the Organization's profile (name, created date, plan).", method: "GET", path: "/v1/orgs/{orgId}", argProps: {} },
  { name: "list_spaces", description: "List the Organization's Spaces (id, name, status, platforms, base count).", method: "GET", path: "/v1/orgs/{orgId}/spaces", argProps: { ...limitCursor } },
  { name: "get_space", description: "Get a Space's detail (status, settings, onboarding, connected platforms).", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}", argProps: {} },
  { name: "list_platforms", description: "List a Space's connected platforms with connection status.", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/platforms", argProps: {} },

  { name: "list_backup_runs", description: "List backup runs (newest first). Backups are a data-protection best practice; use this to review recent backup activity.", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/backups/runs", argProps: { status: S, kind: S, from: S, to: S, baseId: S, ...limitCursor } },
  { name: "get_backup_run", description: "Get one backup run with its per-base and per-table breakdown.", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/backups/runs/{runId}", argProps: { runId: S }, required: ["runId"] },
  { name: "get_backup_configuration", description: "Get the Space's backup configuration (frequency, mode, scope, included bases, next scheduled).", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/backups/configuration", argProps: {} },
  { name: "get_backup_retention", description: "Get the Space's backup retention policy.", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/backups/retention", argProps: {} },
  { name: "get_backup_status", description: "Backup status rollup: last run, next scheduled, 30-day success rate, consecutive failures.", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/backups/status", argProps: {} },

  { name: "list_bases", description: "List the Space's Airtable bases (schema intelligence).", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/bases", argProps: { ...limitCursor } },
  { name: "get_base", description: "Get a base's schema detail.", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/bases/{baseId}", argProps: { baseId: S }, required: ["baseId"] },
  { name: "list_base_tables", description: "List a base's tables.", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/bases/{baseId}/tables", argProps: { baseId: S, ...limitCursor }, required: ["baseId"] },
  { name: "get_table", description: "Get a table by id; set expand=fields to embed its fields.", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/tables/{tableId}", argProps: { tableId: S, expand: S }, required: ["tableId"] },
  { name: "list_table_fields", description: "List a table's fields (type, options, isPrimary).", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/tables/{tableId}/fields", argProps: { tableId: S, ...limitCursor }, required: ["tableId"] },
  { name: "get_field", description: "Get a field by id.", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/fields/{fieldId}", argProps: { fieldId: S }, required: ["fieldId"] },
  { name: "list_schema_changes", description: "Schema changelog for a base (newest first), filterable.", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/changes", argProps: { baseId: S, entityType: S, changeType: S, breaksData: S, from: S, to: S, ...limitCursor }, required: ["baseId"] },
  { name: "list_schema_versions", description: "Captured schema versions for a base.", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/versions", argProps: { baseId: S, ...limitCursor }, required: ["baseId"] },
  {
    name: "search_schema",
    description: "Search a Space's schema (bases/tables/fields/views) by name, description, or select options. Returns heterogeneous hits with full ancestry.",
    method: "POST",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/search",
    bodyTool: true,
    argProps: {
      query: S,
      types: { type: "array", items: { type: "string", enum: ["base", "table", "field", "view"] } },
      match: { type: "object", properties: { mode: { type: "string", enum: ["contains", "exact", "prefix"] }, in: { type: "array", items: { type: "string", enum: ["name", "description", "options"] } } } },
      filters: { type: "object", properties: { baseIds: { type: "array", items: S }, fieldTypes: { type: "array", items: S }, isPrimary: { type: "boolean" }, changedAfter: S } },
      limit: INT,
      cursor: S,
    },
    required: ["query"],
  },
];
