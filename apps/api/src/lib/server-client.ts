// Client for apps/server internal schema endpoints, reached over the SERVER
// service binding + x-internal-token (design D3; the endpoints ship in the paired
// change server-rest-read-support). Never connects to per-Space DBs directly.
// Timeout / transport failure → 502 upstream_unavailable (mapped by the caller).

import type { Env } from "../env";

const TIMEOUT_MS = 10_000;

export interface ServerResult {
  status: number;
  body: unknown;
}

/** Returns null on transport failure/timeout/misconfig → caller maps to 502. */
async function call(env: Env, path: string, init: RequestInit): Promise<ServerResult | null> {
  if (!env.SERVER || !env.INTERNAL_TOKEN) return null;
  const headers = new Headers(init.headers);
  headers.set("x-internal-token", env.INTERNAL_TOKEN);
  const req = new Request(`https://baseout-server${path}`, { ...init, headers });
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
  try {
    const res = (await Promise.race([env.SERVER.fetch(req), timeout])) as Response | null;
    if (!res) return null;
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  } catch {
    return null;
  }
}

const enc = encodeURIComponent;

export const serverClient = {
  schemaRead: (env: Env, spaceId: string, query: string) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/schema${query ? `?${query}` : ""}`, { method: "GET" }),
  schemaSearch: (env: Env, spaceId: string, config: unknown) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/schema-search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(config),
    }),
  schemaVersions: (env: Env, spaceId: string, query: string) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/schema-versions${query ? `?${query}` : ""}`, { method: "GET" }),
  schemaChangelog: (env: Env, spaceId: string, query: string) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/schema-changelog${query ? `?${query}` : ""}`, { method: "GET" }),

  // Schema Docs brokers (api-documents-tools).
  documentsList: (env: Env, spaceId: string, query = "") =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/documents${query ? `?${query}` : ""}`, { method: "GET" }),
  documentsCreate: (env: Env, spaceId: string, input: unknown) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/documents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  documentGet: (env: Env, spaceId: string, documentId: string) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/documents/${enc(documentId)}`, { method: "GET" }),
  documentUpdate: (env: Env, spaceId: string, documentId: string, patch: unknown) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/documents/${enc(documentId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  documentDelete: (env: Env, spaceId: string, documentId: string) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/documents/${enc(documentId)}`, { method: "DELETE" }),
  docsByEntity: (env: Env, spaceId: string, query: string) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/docs-by-entity?${query}`, { method: "GET" }),
  documentTagAdd: (env: Env, spaceId: string, documentId: string, tag: unknown) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/documents/${enc(documentId)}/tags`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(tag),
    }),
  documentTagRemove: (env: Env, spaceId: string, documentId: string, query: string) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/documents/${enc(documentId)}/tags?${query}`, { method: "DELETE" }),

  // Saved-views broker (api-views-tools / server-saved-views).
  viewsList: (env: Env, spaceId: string) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/views`, { method: "GET" }),
  viewsCreate: (env: Env, spaceId: string, input: unknown) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/views`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  viewGet: (env: Env, spaceId: string, viewId: string) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/views/${enc(viewId)}`, { method: "GET" }),
  viewUpdate: (env: Env, spaceId: string, viewId: string, patch: unknown) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/views/${enc(viewId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  viewDelete: (env: Env, spaceId: string, viewId: string) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/views/${enc(viewId)}`, { method: "DELETE" }),

  // Search brokers (api-search-tools).
  dataSearch: (env: Env, spaceId: string, query: string) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/data/search?${query}`, { method: "GET" }),
  mediaList: (env: Env, spaceId: string, query: string) =>
    call(env, `/api/internal/spaces/${enc(spaceId)}/media${query ? `?${query}` : ""}`, { method: "GET" }),
};
