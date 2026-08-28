# Design — api-documents-tools

## D1 — Registry operations over the existing server brokers, platform-free paths

Documents are per-Space but not platform-scoped (the internal brokers
`/api/internal/spaces/:spaceId/documents*` are platform-free), so the public paths mirror the
backups shape: `/v1/orgs/{orgId}/spaces/{spaceId}/documents[/{documentId}]`. Eight operations:

| Op | Scope | Backing broker |
| --- | --- | --- |
| GET documents | `documents:read` | `spacesDocumentsHandler` GET |
| POST documents | `documents:write` | `spacesDocumentsHandler` POST |
| GET documents/{documentId} | `documents:read` | `spacesDocumentHandler` GET |
| PATCH documents/{documentId} | `documents:write` | `spacesDocumentHandler` PATCH |
| DELETE documents/{documentId} | `documents:write` | `spacesDocumentHandler` DELETE |
| GET entity-documents | `documents:read` | `spacesDocsByEntityHandler` |
| POST documents/{documentId}/tags | `documents:write` | NEW tag broker (addTag) |
| DELETE documents/{documentId}/tags | `documents:write` | NEW tag broker (removeTagByTarget) |

`entity-documents` (not `documents/for-entity`) because `{documentId}` would swallow the
literal segment — the router has no static-over-param precedence.

Untag addresses the tag by `(targetType, targetId)` query params, not the tag row id — agents
know the entity they tagged, not our surrogate key.

## D2 — Scope: `documents:read` joins the vocabulary (ninth scope)

Reads do NOT ride `schema:read`: schema structure and internal documentation are different
sensitivity classes, and the explicit-composition rule (write ≠ read) argues for a symmetric
read scope. Additive to Phase 0's `SCOPES`, web's `ALLOWED_SCOPES` + checkbox list (read
scopes stay checked-by-default), and the auth tests.

## D3 — Body contract: markdown in, Plate stored, conversion in apps/api

Agents send `markdown` (string) on create/update; humans' editor sends `body` (Plate array).
Exactly one of the two is accepted per request (Zod refine → 400 `invalid_body`). Conversion
lives in apps/api (`src/lib/markdown-plate.ts`, pure): the broker stores `body` as opaque JSON
and must stay editor-agnostic, so the API layer owns the translation.

The converter is deliberately conservative — it emits ONLY what the web editor
(`DocBodyEditor.tsx`: paragraphs + Bold/Italic/Underline plugins) renders natively:
blank-line-separated blocks → `{type:"p", children:[…]}`; `**bold**`/`*italic*`/`_italic_` →
text marks; `#`-headings → a bold-mark paragraph; list items keep their `- `/`1. ` prefix as
text. Lossy by design; fidelity grows if/when the editor grows plugins. Excerpt derivation
stays server-owned (broker calls `deriveExcerpt`).

Diagrams (React Flow state) are NOT writable through the public API — same rationale as never
hand-authoring editor nodes. `tags` and `links` are accepted on create/update (replace
semantics, matching the broker).

## D4 — Attribution

`grant.createdByUserId` (Phase 0 D5) threads into the broker's `createdByUserId` on create.
Updates don't reattribute (the broker has no editor-tracking column — out of scope).

## D5 — Server-side tag broker (small apps/server addition)

`POST/DELETE /api/internal/spaces/:spaceId/documents/:documentId/tags`, new handler mirroring
the existing broker files' shape (UUID gates, `resolveSpaceDb`, 409/501 posture). `addTag`
already exists (idempotent upsert); `removeTagByTarget(tx, documentId, targetType, targetId)`
is a new lib function (the existing `removeTag` wants the tag row id). Both verify the
document exists first → 404 `document_not_found`. Flagged per the proposal: this is the one
cross-app touch, deliberately scoped as a broker addition inside this change.

## D6 — Upstream error mapping

Same posture as the schema operations: broker 404 → public 404 (`document_not_found`),
broker 400 → public 400, anything else (409 space-not-ready, 501 backend, 500) → 502
`upstream_unavailable`. No new public error types.

## D7 — MCP tools

Eight tools, 1:1 with the operations: `list_documents`, `get_document`, `create_document`,
`update_document`, `delete_document`, `list_entity_documents`, `tag_document`,
`untag_document`. Mutations use `bodyArgs: "all"`; untag's args ride the DELETE query string.
Annotations method-derived (delete gets `destructiveHint`). Names extend the additive-only
stability snapshot; argProps are pinned by the Phase 0 schema-agreement test automatically.
