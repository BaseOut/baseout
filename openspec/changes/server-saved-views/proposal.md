# server-saved-views

> **Filed for sequencing** (Phase 3 of `plans/2026-08-27-mcp-app-parity.md` — the only phase
> that builds a backend from scratch). Paired follow-ups to file when it starts: `web-saved-views`
> (serializer extraction + persistence-block swap) and `api-views-tools` (operations + MCP tools),
> per §3.6 single-app pairing. Design + tasks authored then.

## Why

Dan (2026-08-27): "create/update/ask of the views within schema/data" from MCP. There is NOTHING
server-side to call: the entire Data Browse preset model (Save/Discard/Draft/lock — Dan's
2026-07-23 rules) lives in a localStorage "PERSISTENCE BLOCK" inside `DataBrowse.astro` whose own
comment says "the monorepo engineer swaps this block for real API". No table, no route, no engine-
client method exists (surveyed 2026-08-27). Schema-side "views" (diagram/canvas state) already
persist as Document children and are reachable via `api-documents-tools`.

## What Changes

- Per-Space table `bo_at_saved_views` (id, name, table_id, config jsonb, pinned, sort_order,
  created_by_user_id, timestamps) in `@baseout/db-schema` (pg + DDL; D1 explicitly 501 like the
  rest of the per-Space read path).
- Server broker pair `views.ts`/`view.ts` cloned from the documents broker shape; engine-client
  methods; wire format = the existing `SerializedPreset`/`SerializedConfig` shape EXTRACTED from
  the DataBrowse inline script into a tested `lib/data-browse/preset-serialize.ts` (the web half
  owns that extraction; this change consumes the format).

## Impact

db-schema + apps/server here; apps/web and apps/api in the paired follow-ups. Depends on
api-write-foundation (for the api half) and nothing else. The web swap keeps localStorage as the
draft layer; server becomes truth for saved presets.
