# MCP/API app-parity — full implementation plan (2026-08-27)

## Dan's directive (message, 2026-08-27 — the scope statement)

> "i started the new environment for live baseout but will need more time to finish, so in
> meantime if need something to work on, next task for us is to improve the MCP/API to be able
> to do things within the app like:
>
> - create/update/ask of the views within schema/data
> - create/edit/ask the documents
> - create/edit/ask the reports
> - search and open sidebars based on querying for records/fields/attachments/tables/bases/etc
>
> Essentially everything within the app under Schema/Data/Reports should be doable from MCP
> (leave out the management of the backup itself as I think that should go through the UI for
> now)"

Consequences: the env split stays Dan's and stays unfinished (staging items remain parked);
**backup management is explicitly OUT of MCP scope** (existing read-only backup tools stay, no
write tools for runs/config); MCP work jumps the queue. Spec note: PRD §7.7 labels MCP "V2" —
this directive is the explicit-request exception (CLAUDE.md §1), and Features §3 already prices
MCP call allowances at every tier. Cite both in the proposals.

## Ground truth (surveyed today, both halves)

**The platform half is further along than expected.** `apps/api` is a real worker: 18 read-only
MCP tools over a 19-operation REST registry, streamable-HTTP transport (hand-rolled, workerd-safe,
POST-only), Bearer token auth (SHA-256 → `api_tokens`, org- or space-scoped, 3 read scopes),
grant-aware tool catalogs, in-process dispatch, shadow rate-limiting + Analytics Engine metering.
Contract tests enforce REST↔MCP parity (every tool must be a REST operation first).

**The app half splits into four very different readiness levels:**

| Area | Backend state | What MCP needs |
|---|---|---|
| **Reports** | COMPLETE — CRUD + run + export + history + resend, master-DB `report_definitions/_runs/_deliveries`, web proxies + server brokers all live | apps/api operations + tools only |
| **Documents** | COMPLETE — CRUD, per-Space `bo_at_documents` + tags/links/diagrams (Plate JSON body, server-derived excerpt) | apps/api operations + tools only (+ route the existing-but-unrouted tag add/remove) |
| **Views/Presets** | **NOTHING server-side** — the whole Save/Draft/lock model lives in a localStorage "PERSISTENCE BLOCK" inside `DataBrowse.astro` (its comment literally says "the monorepo engineer swaps this block for real API"); no table, no route, no openspec change anywhere. Schema has no saved-view concept at all (diagrams persist only inside Documents) | build from the DDL up |
| **Search / open-sidebar** | schema search live (already an MCP tool). **Record/data search is BUILT server-side and ORPHANED** — `data-search.ts` + `record-search-io.ts` have zero consumers. Deep links: `?tab=`, `?comment=`, `?asset=` work today; **no `?entity=`** — schema panels are event-only (`schema:openEntity`) | wire the orphan; add `?entity=`; tools return deep-link URLs |

**Platform blockers found:**
- `apps/api` is **deploy-blocked** (placeholder Hyperdrive id, no `api.baseout.com` route, empty
  env blocks) — the route/Hyperdrive provisioning overlaps Dan's env work.
- Zero write paths exist anywhere in apps/api; the router has never carried PATCH/DELETE.
- Dispatch footguns for growth: hardcoded `PATH_PARAMS` list (new id params are silently dropped),
  hand-written tool JSON Schemas (drift vs the Zod op schemas is only partially test-caught),
  hardcoded `platform="at"`.
- Report creation's entitlement cap (`active_reports`) is enforced in the **web proxy**, not the
  server broker — an API write path that goes straight to the broker would bypass it.
- Per-Space reads in the server are **managed_pg-only** (501 on D1) — fine for now, D1 spaces
  degrade explicitly.

## Design decisions to lock early (D-numbers referenced by phases)

- **D1 — Writes enter through the same registry.** Every mutation is a REST operation first
  (POST/PATCH/DELETE on the existing resource tree), then a thin MCP tool — preserving the
  parity contract tests. New scopes: `documents:write`, `reports:write`, `views:read|write`,
  `data:read`. Read scopes stay untouched so existing tokens keep working.
- **D2 — Entitlement enforcement moves DOWN to the server broker** (single choke point for web
  AND api callers), starting with the reports `active_reports` cap. The web proxy keeps its
  check as UX (friendly error), the broker check is the boundary.
- **D3 — Attribution for token writes.** `created_by_user_id` (documents) / `created_by`
  (reports) get the token's issuing user; response payloads carry `via: "api"` where the UI
  shows provenance. (api_tokens already records the creator.) No service-ghost users.
- **D4 — "Open sidebars" = deep-link URLs, not remote control.** MCP cannot reach into a
  browser session; the mechanism is every search/get tool returning an `appUrl` that opens the
  right surface. That requires the app to be URL-addressable: `?entity=` for schema panels
  (pattern already proven by `?comment=`/`?asset=` in DataComments/DataMedia), `?record=` for
  the Data records panel, plus existing `?tab=`. One small web change makes every tool's
  results clickable.
- **D5 — Views/Presets persist in the per-Space DB** (`bo_at_saved_views`), beside
  `bo_at_documents` — they reference `tblXXX`/`fldXXX` ids, so they live with the schema they
  describe. The wire format is the existing localStorage `SerializedPreset`/`SerializedConfig`
  shape, extracted into a tested `lib/data-browse/preset-serialize.ts` FIRST so client, broker,
  and MCP share one format. localStorage becomes the offline/draft layer, server is truth for
  `saved` presets.
- **D6 — Backup tools stay read-only** (Dan's exclusion). The 8 existing backup read tools
  remain; no run/config mutations ship even though the plumbing would be easy.
- **D7 — The in-app chat does NOT go through the MCP server** (Dan, 2026-08-28). Chat calls the
  server brokers directly (same functions the API operations call); it must not be configured
  against `/mcp`, and no MCP-specific UI exists or should be invented. Sharing logic = share the
  broker, not the transport.

## Phases (each = one openspec change per §3.6 naming; sizes are working-day estimates)

### Phase 0 — `api-write-foundation` (~1–1.5d) — unblocks everything
Router support for PATCH/DELETE; write-scope vocabulary + `authorizeGrant` extension; dispatch
fixes (PATH_PARAMS → derived from the path template; JSON-Schema-from-Zod or a schema-agreement
test); request-body plumbing for tools (`bodyTool` generalization); audit fields on mutations.
**Deploy the worker somewhere real**: workers.dev + dev Hyperdrive now (usable by MCP clients
immediately); `api.baseout.com` + prod Hyperdrive ride Dan's env completion — flag to him that
apps/api needs a lane in the new setup.

### Phase 1 — `api-reports-tools` (~1d) — biggest value, zero backend build
Operations: list/get/create/update/delete definitions; run-now; get-run; runs-list; resend;
artifact link. Tools (~9): `list_reports`, `get_report`, `create_report`, `update_report`,
`delete_report`, `run_report`, `get_report_run`, `list_report_runs`, `resend_report_deliveries`.
Includes D2 (cap enforcement into the broker) and D3. Optional server gaps (cross-definition
runs list) only if the tool shape demands it.

### Phase 2 — `api-documents-tools` (~1d)
Operations + tools (~7): `list_documents`, `get_document`, `create_document`, `update_document`,
`delete_document`, `docs_for_entity`, `tag_document`/`untag_document` (routes the existing
unrouted `addTag`/`removeTag`). Body contract: accept markdown OR Plate JSON on create/update —
markdown→Plate conversion server-side so agents never hand-author Plate nodes; excerpt stays
server-derived. ("ask the documents" = get/list/docs-for-entity now; full-text doc search rides
Phase 4's search work.)

### Phase 3 — `server-saved-views` + `web-saved-views` + `api-views-tools` (~2.5–3d, the build)
The §3.6 pairing: (a) db-schema: `bo_at_saved_views` per-Space table (id, name, table_id,
config jsonb, pinned, sort, created_by, timestamps) + DDL for pg (D1 explicitly 501 like the
rest); (b) server broker pair `views.ts`/`view.ts` cloned from the documents shape; (c) engine
client + web proxy routes; (d) extract `preset-serialize.ts` from the DataBrowse inline script
(+ vitest) and swap the PERSISTENCE BLOCK to the API (localStorage keeps drafts); (e) apps/api
operations + tools: `list_views`, `get_view`, `create_view`, `update_view`, `delete_view` —
"views within schema/data": Data presets are THE view object; Schema's equivalents (diagrams)
already persist under Documents and are reachable via Phase 2.

### Phase 4 — `api-search-tools` + `web-entity-deeplinks` (~1.5d)
(a) Wire the ORPHANED record search: engine-client method + web proxy for `data-search`
(the Data page gains real record search as a side effect), + apps/api operation `search_records`
(scope `data:read`); (b) extend search coverage: documents (ILIKE over title/excerpt — small
broker addition), reports (definitions by name — master DB), media/attachments (the existing
media endpoint's filters exposed as `search_attachments`); (c) `web-entity-deeplinks`: `?entity=`
on /schema (dispatch `schema:openEntity` after load — the DataComments `?comment=` pattern),
`?record=` on /data; (d) every search/get tool's results carry `appUrl` built from
`PUBLIC_APP_URL` + those params. Tools: `search_records`, `search_documents`, `search_reports`,
`search_attachments`, plus `appUrl` retrofit on the existing 18.

### Phase 5 — `api-productionization` (~1d + Dan dependencies)
Flip rate-limit enforcement + real numbers (Features §3 monthly call allowance model), tier
resolution for `plan` + quota debiting off the AE dataset, OAuth 2.1/DCR if claude.ai connector
listing is wanted, and the support-portal API/MCP manual: the docs pages under
`apps/support/src/content/docs/{api,mcp}/` are deliberate templates waiting for exactly these
endpoints — filling them is a `/support-docs-update` run and closes the loop with the docs
program (the `api:` frontmatter slugs finally get real targets).

## Decisions needed from Dan (none block Phases 0–2)
1. apps/api's lane in the new env setup (route `api.baseout.com`, prod Hyperdrive) — Phase 0
   deploys to workers.dev regardless.
2. Rate-limit/quota numbers when enforcement flips (Phase 5).
3. claude.ai connector-directory ambition (drives OAuth 2.1 work, Phase 5).

## Order + interaction with the other streams
MCP parity (this plan) is now Stream C and jumps the queue per Dan. Astro 7 (Stream A) is
independent — interleave it whenever a day is free; it doesn't touch apps/api (tsup, not astro).
Support backends (Stream B) stay behind both. Suggested start: Phase 0 + Phase 1 back-to-back
(~2.5d to "an MCP client can create and run a report"), demo that to Dan, then 2 → 3 → 4 → 5.
