# api-documents-tools

> **Filed for sequencing** (Phase 2 of `plans/2026-08-27-mcp-app-parity.md`). Design + tasks are
> authored when the phase starts, after `api-reports-tools` proves the write pattern.

## Why

Dan (2026-08-27): "create/edit/ask the documents" from MCP. The backend is complete — per-Space
`bo_at_documents` (+tags/links/diagrams, Plate JSON body, server-derived excerpt) behind server
brokers `documents.ts`/`document.ts`/`docs-by-entity.ts` with full CRUD. Only the apps/api layer
is missing. One latent piece gets routed on the way: `addTag`/`removeTag` exist in the lib but no
endpoint calls them.

## What Changes

- `apps/api/src/operations/documents.ts` + ~7 MCP tools: list/get/create/update/delete,
  docs-for-entity (base|table|field|view), tag/untag.
- Body contract: accept **markdown or Plate JSON** on create/update; markdown→Plate conversion
  server-side so agents never hand-author editor nodes; excerpt derivation stays server-owned.
- Scopes: reads under `schema:read` stay untouched; document reads get their own read via the
  documents operations (decide read-scope naming in design); writes under `documents:write`.
- Attribution per plan D3 (token's issuing user → `createdByUserId`).

## Impact

apps/api + a small broker addition (tag routes) in apps/server. Depends on api-write-foundation.
Full-text document search deliberately rides `api-search-tools`, not this change.
