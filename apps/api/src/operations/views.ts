// Saved-view endpoints (api-views-tools) — Data Browse presets, served THROUGH
// the apps/server saved-views broker (server-saved-views). Platform-free paths
// (the preset model is per-Space). Reads under views:read, writes under
// views:write. `config` is the web-owned SerializedConfig, validated only as
// "a JSON object" here — opaque to the API exactly as it is to the engine.
// `tableId` is create-only: the PATCH body passes through to the broker, whose
// table_locked enforcement rejects any attempt to move a view (Dan's
// Save-locks-table rule) — surfaced here with the same code.

import { z } from "zod";
import { ApiError, invalidRequest, notFound, upstreamUnavailable } from "../lib/errors";
import { requireSpace } from "../lib/guards";
import { json } from "../lib/responses";
import { serverClient, type ServerResult } from "../lib/server-client";
import type { Operation } from "../lib/registry";

export const createViewBody = z.object({
  name: z.string().min(1),
  tableId: z.string().min(1),
  config: z.object({}).passthrough(),
  pinned: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// Passthrough, deliberately: a `tableId` key must REACH the broker so its
// table_locked enforcement answers with the right code — Zod's default
// unknown-key stripping would silently ignore the attempted move instead.
export const updateViewBody = z
  .object({
    name: z.string().min(1).optional(),
    config: z.object({}).passthrough().optional(),
    pinned: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .passthrough()
  // tableId counts as "a field was provided" so a tableId-only patch reaches
  // the broker and gets the honest table_locked answer, not an empty-patch 400.
  .refine((d) => ["name", "config", "pinned", "sortOrder", "tableId", "table_id"].some((k) => k in d), {
    message: "Provide at least one field to update.",
  });

/**
 * Broker error posture: 404 → view_not_found; 400 passes the broker's code
 * through (table_locked included — it matters to agents); everything else
 * (409 space-not-ready, 501 backend, 500, transport) → 502 upstream_unavailable.
 */
export function mapViewsBrokerError(res: ServerResult | null): ApiError {
  if (!res) return upstreamUnavailable();
  const code = (res.body as { error?: string })?.error;
  if (res.status === 404) return notFound("view_not_found", "Saved view not found.");
  if (res.status === 400) {
    if (code === "table_locked") {
      return invalidRequest("table_locked", "A saved view's table is locked — duplicate the view to use another table.");
    }
    return invalidRequest("invalid_request", "The views service rejected the request.");
  }
  return upstreamUnavailable();
}

function unwrap(res: ServerResult | null): Record<string, unknown> {
  if (!res || res.status < 200 || res.status >= 300) throw mapViewsBrokerError(res);
  return res.body as Record<string, unknown>;
}

export const viewOperations: Operation[] = [
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/views",
    scope: "views:read",
    summary: "List the Space's saved views (Data Browse presets).",
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "views:read");
      const b = unwrap(await serverClient.viewsList(c.env, spaceId));
      return json({ data: b.views ?? [], pagination: { nextCursor: null } }, c.requestId);
    },
  },
  {
    method: "POST",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/views",
    scope: "views:write",
    summary: "Create a saved view. The table choice is locked at creation.",
    bodySchema: createViewBody,
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "views:write");
      const b = unwrap(
        await serverClient.viewsCreate(c.env, spaceId, {
          ...(c.body as z.infer<typeof createViewBody>),
          createdByUserId: c.grant.createdByUserId,
        }),
      );
      return json(b.view, c.requestId, { status: 201 });
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/views/{viewId}",
    scope: "views:read",
    summary: "Get a saved view (name, table, full config).",
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "views:read");
      const b = unwrap(await serverClient.viewGet(c.env, spaceId, c.params.viewId!));
      return json(b.view, c.requestId);
    },
  },
  {
    method: "PATCH",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/views/{viewId}",
    scope: "views:write",
    summary: "Update a saved view's name, config, pinned, or sort order (never its table).",
    bodySchema: updateViewBody,
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "views:write");
      const b = unwrap(await serverClient.viewUpdate(c.env, spaceId, c.params.viewId!, c.body));
      return json(b.view, c.requestId);
    },
  },
  {
    method: "DELETE",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/views/{viewId}",
    scope: "views:write",
    summary: "Delete a saved view.",
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "views:write");
      unwrap(await serverClient.viewDelete(c.env, spaceId, c.params.viewId!));
      return json({ id: c.params.viewId, deleted: true }, c.requestId);
    },
  },
];
