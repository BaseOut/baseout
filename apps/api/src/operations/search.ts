// Search endpoints (api-search-tools) — Dan's "search and open sidebars"
// directive. Four dedicated hyphenated paths (D1 — the router has no
// static-over-param precedence, so `/documents/search` would collide with
// `/documents/{documentId}`):
//   record-search      → server data-search broker (ILIKE over record values +
//                        field names, scan-budgeted `partial` flag) — data:read
//   document-search    → documents list broker's `q` (title/excerpt) — documents:read
//   report-search      → master DB in-Worker (report_definitions by name) — reports:read
//   attachment-search  → media broker filters + filename `q` — data:read
// appUrl deep links are added MCP-side (src/mcp/app-urls.ts), not here — REST
// responses stay pure resource representations (design D4).

import { and, asc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { reportDefinitions } from "../db/schema";
import { invalidRequest, upstreamUnavailable } from "../lib/errors";
import { requireSpace } from "../lib/guards";
import { json } from "../lib/responses";
import { serverClient, type ServerResult } from "../lib/server-client";
import type { Operation, OperationContext } from "../lib/registry";

const qs = (params: Record<string, string | null | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");

function requireQ(c: OperationContext): string {
  const q = (c.query.get("q") ?? "").trim();
  if (!q) throw invalidRequest("invalid_request", "q is required.", "q");
  return q;
}

/** Broker call → body, mapping non-200 to the schema-ops posture (400 through, else 502). */
function unwrap(res: ServerResult | null): Record<string, unknown> {
  if (!res) throw upstreamUnavailable();
  if (res.status === 400) {
    const b = res.body as { param?: string; message?: string };
    throw invalidRequest("invalid_request", b.message ?? "Invalid search request.", b.param);
  }
  if (res.status !== 200) throw upstreamUnavailable();
  return res.body as Record<string, unknown>;
}

const limitQuery = { limit: z.number().int().min(1).max(100).optional(), cursor: z.string().optional() };

export const searchOperations: Operation[] = [
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/record-search",
    scope: "data:read",
    summary: "Search record values and field names across the Space's backed-up data (grouped base → table; `partial` flags a hit scan budget).",
    querySchema: z.object({ q: z.string(), baseId: z.string().optional(), tableId: z.string().optional() }),
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "data:read");
      const q = requireQ(c);
      const b = unwrap(
        await serverClient.dataSearch(c.env, spaceId, qs({ q, baseId: c.query.get("baseId"), tableId: c.query.get("tableId") })),
      );
      return json({ data: b.groups ?? [], partial: b.partial ?? false, pagination: { nextCursor: null } }, c.requestId);
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/document-search",
    scope: "documents:read",
    summary: "Search documents by title or excerpt.",
    querySchema: z.object({ q: z.string() }),
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "documents:read");
      const q = requireQ(c);
      const b = unwrap(await serverClient.documentsList(c.env, spaceId, qs({ q })));
      return json({ data: b.documents ?? [], pagination: { nextCursor: null } }, c.requestId);
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/report-search",
    scope: "reports:read",
    summary: "Search the Space's report definitions by name.",
    querySchema: z.object({ q: z.string() }),
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "reports:read");
      const q = requireQ(c);
      const rows = await c.db
        .select({
          id: reportDefinitions.id,
          name: reportDefinitions.name,
          sections: reportDefinitions.sections,
          isDefault: reportDefinitions.isDefault,
          scheduleCadence: reportDefinitions.scheduleCadence,
          scheduleEnabled: reportDefinitions.scheduleEnabled,
          nextRunAt: reportDefinitions.nextRunAt,
        })
        .from(reportDefinitions)
        .where(and(eq(reportDefinitions.spaceId, spaceId), ilike(reportDefinitions.name, `%${escapeLike(q)}%`)))
        .orderBy(asc(reportDefinitions.name));
      return json(
        {
          data: rows.map((r) => ({ ...r, nextRunAt: r.nextRunAt ? r.nextRunAt.toISOString() : null })),
          pagination: { nextCursor: null },
        },
        c.requestId,
      );
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/attachment-search",
    scope: "data:read",
    summary: "Search captured attachments by filename, with class/base/table/size/date filters.",
    querySchema: z.object({
      q: z.string().optional(),
      class: z.string().optional(),
      baseId: z.string().optional(),
      tableId: z.string().optional(),
      minSize: z.number().int().optional(),
      maxSize: z.number().int().optional(),
      after: z.string().optional(),
      before: z.string().optional(),
      ...limitQuery,
    }),
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "data:read");
      // Filename q optional here — the filters alone are a valid attachment query.
      const query = qs({
        q: c.query.get("q"),
        class: c.query.get("class"),
        baseId: c.query.get("baseId"),
        tableId: c.query.get("tableId"),
        minSize: c.query.get("minSize"),
        maxSize: c.query.get("maxSize"),
        after: c.query.get("after"),
        before: c.query.get("before"),
        limit: c.query.get("limit"),
        cursor: c.query.get("cursor"),
      });
      const b = unwrap(await serverClient.mediaList(c.env, spaceId, query));
      return json({ data: b.items ?? [], pagination: { nextCursor: b.nextCursor ?? null } }, c.requestId);
    },
  },
];

/** LIKE-metacharacter escape (matches the server-side escapeLike). */
export function escapeLike(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
