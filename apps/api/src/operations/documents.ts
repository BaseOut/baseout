// Document endpoints (api-documents-tools) — per-Space Schema Docs CRUD +
// entity tagging, served THROUGH the apps/server brokers (this app never
// touches per-Space DBs). Platform-free paths, mirroring the internal broker
// shape. Reads under documents:read, writes under documents:write (D2).
//
// Body contract (D3): create/update accept `markdown` (string, agent path) OR
// `body` (Plate array, editor path) — never both; markdown→Plate conversion
// happens here so agents never hand-author editor nodes. Diagrams are not
// writable through the public API. Attribution (D4): the token's issuing user
// becomes createdByUserId on create.

import { z } from "zod";
import { ApiError, invalidRequest, notFound, upstreamUnavailable } from "../lib/errors";
import { markdownToPlate } from "../lib/markdown-plate";
import { requireSpace } from "../lib/guards";
import { json } from "../lib/responses";
import { serverClient, type ServerResult } from "../lib/server-client";
import type { Operation, OperationContext } from "../lib/registry";

const TARGET_TYPES = ["base", "table", "field", "view"] as const;

const tagInput = z.object({
  targetType: z.enum(TARGET_TYPES),
  targetId: z.string().min(1),
  addedVia: z.enum(["inline", "manual"]).optional(),
});
const linkInput = z.object({
  name: z.string().optional(),
  url: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

const markdownXorBody = (d: { markdown?: unknown; body?: unknown }) =>
  !(d.markdown !== undefined && d.body !== undefined);
const XOR_MESSAGE = "Provide markdown OR body (Plate array), not both.";

export const createDocumentBody = z
  .object({
    title: z.string().min(1),
    markdown: z.string().optional(),
    body: z.array(z.unknown()).optional(),
    tags: z.array(tagInput).optional(),
    links: z.array(linkInput).optional(),
  })
  .refine(markdownXorBody, { message: XOR_MESSAGE, path: ["markdown"] });

export const updateDocumentBody = z
  .object({
    title: z.string().min(1).optional(),
    markdown: z.string().optional(),
    body: z.array(z.unknown()).optional(),
    tags: z.array(tagInput).optional(),
    links: z.array(linkInput).optional(),
  })
  .refine(markdownXorBody, { message: XOR_MESSAGE, path: ["markdown"] });

export const tagBody = z.object({
  targetType: z.enum(TARGET_TYPES),
  targetId: z.string().min(1),
  addedVia: z.enum(["inline", "manual"]).optional(),
});

/** Resolve `markdown` to a Plate `body`; passthrough of the remaining fields. */
export function resolveBodyInput<T extends { markdown?: string; body?: unknown[] }>(
  input: T,
): Omit<T, "markdown"> {
  const { markdown, ...rest } = input;
  if (markdown !== undefined) return { ...rest, body: markdownToPlate(markdown) };
  return rest;
}

/**
 * Broker error posture (D6): 404 passes through with the broker's code,
 * 400 → public 400, anything else (409 space-not-ready, 501 backend, 500,
 * transport failure) → 502 upstream_unavailable.
 */
export function mapBrokerError(res: ServerResult | null): ApiError {
  if (!res) return upstreamUnavailable();
  if (res.status === 404) {
    const code = (res.body as { error?: string })?.error ?? "document_not_found";
    return notFound(code, code === "tag_not_found" ? "Tag not found on this document." : "Document not found.");
  }
  if (res.status === 400) return invalidRequest("invalid_request", "The document service rejected the request.");
  return upstreamUnavailable();
}

/** Unwrap a broker `{ ok: true, ... }` payload or throw the mapped error. */
function unwrap(res: ServerResult | null): Record<string, unknown> {
  if (!res || res.status < 200 || res.status >= 300) throw mapBrokerError(res);
  return res.body as Record<string, unknown>;
}

const listEnvelope = (c: OperationContext, documents: unknown, extra: Record<string, unknown> = {}) =>
  json({ data: documents ?? [], pagination: { nextCursor: null }, ...extra }, c.requestId);

export const documentOperations: Operation[] = [
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/documents",
    scope: "documents:read",
    summary: "List the Space's documents (newest first, with tag counts).",
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "documents:read");
      const b = unwrap(await serverClient.documentsList(c.env, spaceId));
      return listEnvelope(c, b.documents);
    },
  },
  {
    method: "POST",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/documents",
    scope: "documents:write",
    summary: "Create a document (markdown or Plate body).",
    bodySchema: createDocumentBody,
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "documents:write");
      const input = resolveBodyInput(c.body as z.infer<typeof createDocumentBody>);
      const b = unwrap(
        await serverClient.documentsCreate(c.env, spaceId, { ...input, createdByUserId: c.grant.createdByUserId }),
      );
      return json(b.document, c.requestId, { status: 201 });
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/documents/{documentId}",
    scope: "documents:read",
    summary: "Get a document (body, tags with removed-entity flags, links, diagrams).",
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "documents:read");
      const b = unwrap(await serverClient.documentGet(c.env, spaceId, c.params.documentId!));
      return json(b.document, c.requestId);
    },
  },
  {
    method: "PATCH",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/documents/{documentId}",
    scope: "documents:write",
    summary: "Update a document (title, markdown or Plate body, tags, links).",
    bodySchema: updateDocumentBody,
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "documents:write");
      const patch = resolveBodyInput(c.body as z.infer<typeof updateDocumentBody>);
      const b = unwrap(await serverClient.documentUpdate(c.env, spaceId, c.params.documentId!, patch));
      return json(b.document, c.requestId);
    },
  },
  {
    method: "DELETE",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/documents/{documentId}",
    scope: "documents:write",
    summary: "Delete a document and its tags, links, and diagrams.",
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "documents:write");
      unwrap(await serverClient.documentDelete(c.env, spaceId, c.params.documentId!));
      return json({ id: c.params.documentId, deleted: true }, c.requestId);
    },
  },
  {
    method: "GET",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/entity-documents",
    scope: "documents:read",
    summary: "Documents tagging a schema entity (base, table, field, or view).",
    querySchema: z.object({ targetType: z.enum(TARGET_TYPES), targetId: z.string().min(1) }),
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "documents:read");
      const targetType = c.query.get("targetType");
      const targetId = c.query.get("targetId");
      if (!targetType || !(TARGET_TYPES as readonly string[]).includes(targetType)) {
        throw invalidRequest("invalid_request", "targetType must be base, table, field, or view.", "targetType");
      }
      if (!targetId) throw invalidRequest("invalid_request", "targetId is required.", "targetId");
      const b = unwrap(
        await serverClient.docsByEntity(
          c.env,
          spaceId,
          `targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`,
        ),
      );
      return listEnvelope(c, b.documents, { entityRemoved: b.entityRemoved ?? false });
    },
  },
  {
    method: "POST",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/documents/{documentId}/tags",
    scope: "documents:write",
    summary: "Tag a document with a schema entity (idempotent).",
    bodySchema: tagBody,
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "documents:write");
      const b = unwrap(await serverClient.documentTagAdd(c.env, spaceId, c.params.documentId!, c.body));
      return json(b.document, c.requestId);
    },
  },
  {
    method: "DELETE",
    path: "/v1/orgs/{orgId}/spaces/{spaceId}/documents/{documentId}/tags",
    scope: "documents:write",
    summary: "Remove a document's tag by its target entity.",
    querySchema: z.object({ targetType: z.enum(TARGET_TYPES), targetId: z.string().min(1) }),
    handler: async (c) => {
      const { spaceId } = await requireSpace(c, "documents:write");
      const targetType = c.query.get("targetType");
      const targetId = c.query.get("targetId");
      if (!targetType || !targetId) {
        throw invalidRequest("invalid_request", "targetType and targetId are required.", !targetType ? "targetType" : "targetId");
      }
      const b = unwrap(
        await serverClient.documentTagRemove(
          c.env,
          spaceId,
          c.params.documentId!,
          `targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`,
        ),
      );
      return json(b.document, c.requestId);
    },
  },
];
