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
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** Must match a registry operation's `path`. */
  path: string;
  /** JSON Schema properties for caller-supplied args (excludes orgId/platform). */
  argProps: Record<string, unknown>;
  /** Required arg names (spaceId is added conditionally by the catalog). */
  required?: string[];
  /**
   * Which args form the JSON request body: "all" = every non-path arg (search
   * shape); a name list = exactly those args (remaining non-path args → query).
   * Omitted = no body (all non-path args → query).
   */
  bodyArgs?: "all" | string[];
  /**
   * Override the method-derived readOnlyHint (GET → true, else false) — for
   * POST endpoints that are semantically reads (e.g. structured search).
   */
  readOnly?: boolean;
}

const S = { type: "string" } as const;
const INT = { type: "integer", minimum: 1, maximum: 100 } as const;
const limitCursor = { limit: INT, cursor: S };

// Shared arg-prop fragments for the document tools (api-documents-tools D7).
const DOC_BODY_PROPS = {
  markdown: { type: "string", description: "Document body as markdown (converted to the editor's format server-side). Provide this OR body, not both." },
  body: { type: "array", items: { type: "object" }, description: "Document body as a Plate node array (editor format). Prefer markdown." },
  tags: {
    type: "array",
    items: {
      type: "object",
      properties: {
        targetType: { type: "string", enum: ["base", "table", "field", "view"] },
        targetId: { type: "string" },
        addedVia: { type: "string", enum: ["inline", "manual"] },
      },
      required: ["targetType", "targetId"],
    },
    description: "Schema entities this document tags (full replacement).",
  },
  links: {
    type: "array",
    items: {
      type: "object",
      properties: { name: { type: "string" }, url: { type: "string" }, sortOrder: { type: "integer" } },
      required: ["url"],
    },
    description: "External links (full replacement).",
  },
} as const;
const TARGET_TYPE = { type: "string", enum: ["base", "table", "field", "view"] } as const;

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
    bodyArgs: "all",
    readOnly: true,
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

  // Documents (api-documents-tools): per-Space Schema Docs CRUD + entity tagging.
  { name: "list_documents", description: "List the Space's documents (title, excerpt, tag count, newest first).", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/documents", argProps: {} },
  { name: "get_document", description: "Get a document: body, tags (with removed-entity flags), links, diagrams.", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/documents/{documentId}", argProps: { documentId: S }, required: ["documentId"] },
  {
    name: "create_document",
    description: "Create a document. Write the body as markdown; optionally tag schema entities and attach links.",
    method: "POST",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/documents",
    bodyArgs: "all",
    argProps: { title: S, ...DOC_BODY_PROPS },
    required: ["title"],
  },
  {
    name: "update_document",
    description: "Update a document's title, body (markdown), tags, or links. Omitted fields are left unchanged; tags/links replace in full.",
    method: "PATCH",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/documents/{documentId}",
    bodyArgs: ["title", "markdown", "body", "tags", "links"],
    argProps: { documentId: S, title: S, ...DOC_BODY_PROPS },
    required: ["documentId"],
  },
  { name: "delete_document", description: "Delete a document and its tags, links, and diagrams. Irreversible.", method: "DELETE", path: "/v1/orgs/{orgId}/spaces/{spaceId}/documents/{documentId}", argProps: { documentId: S }, required: ["documentId"] },
  {
    name: "list_entity_documents",
    description: "List the documents that tag a schema entity (base, table, field, or view).",
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/entity-documents",
    argProps: { targetType: TARGET_TYPE, targetId: S },
    required: ["targetType", "targetId"],
  },
  {
    name: "tag_document",
    description: "Tag a document with a schema entity (idempotent). Returns the updated document.",
    method: "POST",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/documents/{documentId}/tags",
    bodyArgs: ["targetType", "targetId", "addedVia"],
    argProps: { documentId: S, targetType: TARGET_TYPE, targetId: S, addedVia: { type: "string", enum: ["inline", "manual"] } },
    required: ["documentId", "targetType", "targetId"],
  },
  // Search (api-search-tools): Dan's "search and open sidebars" — results carry
  // appUrl deep links (added by dispatch via src/mcp/app-urls.ts).
  {
    name: "search_records",
    description: "Search record values and field names across the Space's backed-up data. Hits come grouped base then table; `partial: true` means the scan budget was hit (narrow with baseId/tableId).",
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/record-search",
    argProps: { q: S, baseId: S, tableId: S },
    required: ["q"],
  },
  {
    name: "search_documents",
    description: "Search the Space's documents by title or excerpt.",
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/document-search",
    argProps: { q: S },
    required: ["q"],
  },
  {
    name: "search_reports",
    description: "Search the Space's report definitions by name (returns sections, schedule cadence, next run).",
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/report-search",
    argProps: { q: S },
    required: ["q"],
  },
  {
    name: "search_attachments",
    description: "Search captured attachments by filename and/or filters: content class (image|document|spreadsheet|...), base, table, size bounds, captured-date window.",
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/attachment-search",
    argProps: {
      q: S,
      class: S,
      baseId: S,
      tableId: S,
      minSize: { type: "integer" },
      maxSize: { type: "integer" },
      after: S,
      before: S,
      ...limitCursor,
    },
  },

  // Usage (api-productionization): the quota surface.
  {
    name: "get_api_usage",
    description: "The Organization's plan, monthly API-call allowance, and month-to-date usage (usageAvailable: false when usage metering reads are not configured).",
    method: "GET",
    path: "/v1/orgs/{orgId}/api-usage",
    argProps: {},
  },

  // Saved views (api-views-tools): Data Browse presets.
  { name: "list_views", description: "List the Space's saved views (Data Browse presets): name, table, pinned, config.", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/views", argProps: {} },
  { name: "get_view", description: "Get a saved view: name, table, and its full filter/sort/column config.", method: "GET", path: "/v1/orgs/{orgId}/spaces/{spaceId}/views/{viewId}", argProps: { viewId: S }, required: ["viewId"] },
  {
    name: "create_view",
    description: "Create a saved view (Data Browse preset). The table choice is locked at creation — a view can never move to another table.",
    method: "POST",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/views",
    bodyArgs: "all",
    argProps: {
      name: S,
      tableId: S,
      config: { type: "object", description: "The view's filter/sort/column configuration (the Data page's preset config shape). At minimum { \"tableId\": ..., \"hiddenCols\": [], \"filterTree\": { \"kind\": \"group\", \"conjunction\": \"and\", \"children\": [] }, \"sortField\": \"\", \"sortDir\": 1, \"query\": \"\", \"showRecId\": false, \"colOrder\": [] }." },
      pinned: { type: "boolean" },
      sortOrder: { type: "integer" },
    },
    required: ["name", "tableId", "config"],
  },
  {
    name: "update_view",
    description: "Update a saved view's name, config, pinned state, or sort order. The view's table can never change (table_locked).",
    method: "PATCH",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/views/{viewId}",
    bodyArgs: ["name", "config", "pinned", "sortOrder"],
    argProps: { viewId: S, name: S, config: { type: "object" }, pinned: { type: "boolean" }, sortOrder: { type: "integer" } },
    required: ["viewId"],
  },
  { name: "delete_view", description: "Delete a saved view. Irreversible.", method: "DELETE", path: "/v1/orgs/{orgId}/spaces/{spaceId}/views/{viewId}", argProps: { viewId: S }, required: ["viewId"] },

  {
    name: "untag_document",
    description: "Remove a document's tag by its target entity. Returns the updated document.",
    method: "DELETE",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/documents/{documentId}/tags",
    argProps: { documentId: S, targetType: TARGET_TYPE, targetId: S },
    required: ["documentId", "targetType", "targetId"],
  },
];
