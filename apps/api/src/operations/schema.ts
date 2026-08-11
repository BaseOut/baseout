// Schema read endpoints — platform-scoped (bare `at` code), served THROUGH
// apps/server internal endpoints (design D3; api never touches per-Space DBs).
// Adds ETag/304 (derived from the base's schema_hash), `expand`, and the public
// envelope. Scope: schema:read.

import { notFound, upstreamUnavailable, invalidRequest, ApiError } from "../lib/errors";
import { requireSpace } from "../lib/guards";
import { json, notModified } from "../lib/responses";
import { serverClient } from "../lib/server-client";
import type { Operation, OperationContext } from "../lib/registry";

// v1: only Airtable. Any other code → 404 platform_not_found (design D2).
function requirePlatform(c: OperationContext): void {
  if (c.params.platform !== "at") throw notFound("platform_not_found", "No such platform for this Space.");
}

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Stable weak ETag over the involved bases' current schema hashes. */
function etagFor(schemaHashByBase: Record<string, string | null> | undefined): string | null {
  if (!schemaHashByBase) return null;
  const entries = Object.entries(schemaHashByBase).sort(([a], [b]) => (a < b ? -1 : 1));
  if (!entries.length || entries.every(([, h]) => h === null)) return null;
  return `W/"${fnv1a(entries.map(([b, h]) => `${b}:${h ?? ""}`).join("|"))}"`;
}

interface ScopedRead {
  rows: Record<string, unknown>[];
  nextCursor: string | null;
  schemaHashByBase: Record<string, string | null>;
}

/** Call server schema-read (scoped mode); map anything but 200 to 502. */
async function scopedRead(c: OperationContext, spaceId: string, query: string): Promise<ScopedRead> {
  const res = await serverClient.schemaRead(c.env, spaceId, query);
  if (!res || res.status !== 200) throw upstreamUnavailable();
  const b = res.body as { rows?: Record<string, unknown>[]; nextCursor?: string | null; schemaHashByBase?: Record<string, string | null> };
  return { rows: b.rows ?? [], nextCursor: b.nextCursor ?? null, schemaHashByBase: b.schemaHashByBase ?? {} };
}

/** Emit a schema list response with ETag + 304 short-circuit. */
function schemaJson(c: OperationContext, payload: { data?: unknown; pagination?: unknown } | Record<string, unknown>, schemaHashByBase: Record<string, string | null> | undefined): Response {
  const etag = etagFor(schemaHashByBase);
  if (etag && c.headers.get("if-none-match") === etag) return notModified(c.requestId, etag);
  return json(payload, c.requestId, etag ? { headers: { etag } } : {});
}

const qs = (params: Record<string, string | null | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");

export const schemaOperations: Operation[] = [
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/bases",
    scope: "schema:read",
    summary: "List the Space's bases.",
    handler: async (c) => {
      requirePlatform(c);
      const { spaceId } = await requireSpace(c, "schema:read");
      const r = await scopedRead(c, spaceId, qs({ entity: "bases", limit: c.query.get("limit"), cursor: c.query.get("cursor") }));
      return schemaJson(c, { data: r.rows, pagination: { nextCursor: r.nextCursor } }, r.schemaHashByBase);
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/bases/{baseId}",
    scope: "schema:read",
    summary: "Get a base's detail.",
    handler: async (c) => {
      requirePlatform(c);
      const { spaceId } = await requireSpace(c, "schema:read");
      const r = await scopedRead(c, spaceId, qs({ entity: "bases", ids: c.params.baseId }));
      const base = r.rows[0];
      if (!base) throw notFound("base_not_found", "Base not found.");
      return schemaJson(c, base, r.schemaHashByBase);
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/bases/{baseId}/tables",
    scope: "schema:read",
    summary: "List a base's tables.",
    handler: async (c) => {
      requirePlatform(c);
      const { spaceId } = await requireSpace(c, "schema:read");
      const r = await scopedRead(c, spaceId, qs({ entity: "tables", baseId: c.params.baseId, limit: c.query.get("limit"), cursor: c.query.get("cursor") }));
      return schemaJson(c, { data: r.rows, pagination: { nextCursor: r.nextCursor } }, r.schemaHashByBase);
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/tables/{tableId}",
    scope: "schema:read",
    summary: "Get a table (flat by id); ?expand=fields embeds its fields.",
    handler: async (c) => {
      requirePlatform(c);
      const { spaceId } = await requireSpace(c, "schema:read");
      const r = await scopedRead(c, spaceId, qs({ entity: "tables", ids: c.params.tableId }));
      const table = r.rows[0];
      if (!table) throw notFound("table_not_found", "Table not found.");
      const expand = (c.query.get("expand") ?? "").split(",").map((s) => s.trim());
      let payload: Record<string, unknown> = table;
      if (expand.includes("fields")) {
        const f = await scopedRead(c, spaceId, qs({ entity: "fields", tableId: c.params.tableId }));
        payload = { ...table, fields: f.rows };
      }
      return schemaJson(c, payload, r.schemaHashByBase);
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/tables/{tableId}/fields",
    scope: "schema:read",
    summary: "List a table's fields.",
    handler: async (c) => {
      requirePlatform(c);
      const { spaceId } = await requireSpace(c, "schema:read");
      const r = await scopedRead(c, spaceId, qs({ entity: "fields", tableId: c.params.tableId, limit: c.query.get("limit"), cursor: c.query.get("cursor") }));
      return schemaJson(c, { data: r.rows, pagination: { nextCursor: r.nextCursor } }, r.schemaHashByBase);
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/fields/{fieldId}",
    scope: "schema:read",
    summary: "Get a field (flat by id).",
    handler: async (c) => {
      requirePlatform(c);
      const { spaceId } = await requireSpace(c, "schema:read");
      const r = await scopedRead(c, spaceId, qs({ entity: "fields", ids: c.params.fieldId }));
      const field = r.rows[0];
      if (!field) throw notFound("field_not_found", "Field not found.");
      return schemaJson(c, field, r.schemaHashByBase);
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/changes",
    scope: "schema:read",
    summary: "Schema changelog (filterable, newest first).",
    handler: async (c) => {
      requirePlatform(c);
      const { spaceId } = await requireSpace(c, "schema:read");
      const baseId = c.query.get("baseId");
      if (!baseId) throw invalidRequest("invalid_request", "baseId is required.", "baseId");
      const query = qs({
        baseId,
        entityType: c.query.get("entityType"),
        changeType: c.query.get("changeType"),
        breaksData: c.query.get("breaksData"),
        from: c.query.get("from"),
        to: c.query.get("to"),
        limit: c.query.get("limit"),
        cursor: c.query.get("cursor"),
      });
      const res = await serverClient.schemaChangelog(c.env, spaceId, query);
      if (!res || res.status !== 200) throw upstreamUnavailable();
      const b = res.body as { entries?: unknown[]; nextCursor?: string | null };
      return json({ data: b.entries ?? [], pagination: { nextCursor: b.nextCursor ?? null } }, c.requestId);
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/versions",
    scope: "schema:read",
    summary: "Captured schema versions for a base.",
    handler: async (c) => {
      requirePlatform(c);
      const { spaceId } = await requireSpace(c, "schema:read");
      const baseId = c.query.get("baseId");
      if (!baseId) throw invalidRequest("invalid_request", "baseId is required.", "baseId");
      const res = await serverClient.schemaVersions(c.env, spaceId, qs({ baseId, limit: c.query.get("limit"), cursor: c.query.get("cursor") }));
      if (!res || res.status !== 200) throw upstreamUnavailable();
      const b = res.body as { versions?: unknown[]; nextCursor?: string | null };
      return json({ data: b.versions ?? [], pagination: { nextCursor: b.nextCursor ?? null } }, c.requestId);
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/search",
    scope: "schema:read",
    summary: "Convenience schema search (GET ?q=) — POST with defaults.",
    handler: async (c) => {
      requirePlatform(c);
      const { spaceId } = await requireSpace(c, "schema:read");
      const q = c.query.get("q");
      if (!q) throw invalidRequest("invalid_request", "q is required.", "q");
      return runSearch(c, spaceId, { query: q });
    },
  },
  {
    method: "POST",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/search",
    scope: "schema:read",
    summary: "Structured schema search (heterogeneous hits with ancestry).",
    handler: async (c) => {
      requirePlatform(c);
      const { spaceId } = await requireSpace(c, "schema:read");
      const body = (c.body && typeof c.body === "object") ? (c.body as Record<string, unknown>) : {};
      return runSearch(c, spaceId, body);
    },
  },
];

/** Forward a search config to server schema-search; map its 400 {param} to the public 400. */
async function runSearch(c: OperationContext, spaceId: string, config: Record<string, unknown>): Promise<Response> {
  const res = await serverClient.schemaSearch(c.env, spaceId, config);
  if (!res) throw upstreamUnavailable();
  if (res.status === 400) {
    const b = res.body as { param?: string; message?: string };
    throw new ApiError("invalid_request", "invalid_request", b.message ?? "Invalid search config.", { param: b.param });
  }
  if (res.status !== 200) throw upstreamUnavailable();
  const b = res.body as { hits?: unknown[]; nextCursor?: string | null };
  return json({ data: b.hits ?? [], pagination: { nextCursor: b.nextCursor ?? null } }, c.requestId);
}
