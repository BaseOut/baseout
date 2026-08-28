# Design — api-search-tools

## D1 — Four dedicated search paths, no `{documentId}`-style collisions

`/v1/orgs/{orgId}/spaces/{spaceId}/record-search|document-search|report-search|
attachment-search` (GET). Dedicated hyphenated segments because the router has no
static-over-param precedence — `/documents/search` would be swallowed by
`/documents/{documentId}` (the `entity-documents` lesson). One tool per operation:
`search_records`, `search_documents`, `search_reports`, `search_attachments`.

## D2 — Scopes: records/attachments under `data:read`; `reports:read` joins (tenth scope)

Record values and attachment metadata are the Space's DATA → `data:read` (already in the
vocabulary, previously unused — this change gives it its first operations). Document search
rides `documents:read`. Reports had only `:write` — a `reports:read` scope is added
(symmetric with documents, Phase 2 D2 rationale) and covers `search_reports` now and the
Phase 1 report reads later. Web's checkbox list + `ALLOWED_SCOPES` extend accordingly.

## D3 — Sources

- **record-search**: the orphaned server broker `data-search.ts` (ILIKE over record values +
  field names, scan-budgeted, `partial` flag) — wired via serverClient; response passes
  through as `{ data: groups, partial }`.
- **document-search**: the documents list broker gains a `q` param (ILIKE over
  title/excerpt) — the "small broker addition" the proposal names.
- **report-search**: master DB in-Worker (`report_definitions` mirrored read-only:
  ILIKE over name, Space-scoped) — no server hop, same posture as the backup reads.
- **attachment-search**: the existing media broker's filters (class/base/table/size/
  captured-window) + one small addition: `q` = ILIKE over the refs' filename (an
  attachment search without a text query wouldn't be one). Cursor/limit pass through.

## D4 — `appUrl` deep links, enriched centrally at the MCP dispatch layer

A new `PUBLIC_APP_URL` var (apps/api env; dev worker → the dev console, production waits on
Dan's lane — unset ⇒ enrichment is a no-op). A pure module `src/mcp/app-urls.ts` maps
(toolName, args, parsed result) → the same result with `appUrl` fields:

- per-hit on the four search tools and `search_schema` (`/schema?entity=<id>`,
  `/data?record=<id>&table=<t>`, `/data?tab=docs`, `/reports/<id>`,
  `/data?tab=attachments&asset=<id>`);
- top-level on entity gets (`get_base/get_table/get_field` → `/schema?entity=`,
  `get_document` → `/data?tab=docs`, backup tools → `/backups`, views → `/data`).

Dispatch parses the 2xx result text once, enriches, re-stringifies. MCP-only by design —
REST responses stay pure resource representations (the link belongs to the agent UX, and
the REST caller knows its own console origin). Org-level tools get no appUrl (nothing
entity-addressable to open).

## D5 — Paired change `web-entity-deeplinks`

The `?entity=` / `?record=` params those URLs rely on ship in the paired web change (plus
the record-search proxy so the Data page can adopt real search later). This change's URLs
degrade gracefully meanwhile — the pages load, the panel just doesn't auto-open until the
web half lands (both land together in this phase anyway).
