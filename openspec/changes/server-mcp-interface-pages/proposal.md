# server-mcp-interface-pages — Proposal

## Why

The paired change [`workflows-mcp-interface-pages`](../workflows-mcp-interface-pages/proposal.md) starts capturing a base's interface apps, pages, and standalone forms from the Airtable MCP server on every backup run. The engine must persist that capture into the per-Space DB, diff it run-over-run so interface add/remove/rename/composition changes appear in the schema changelog, and reconcile it with the existing manual-submission path — otherwise the capture is dead weight. Interface change events are exactly the "what changed, when" visibility the REST API can never provide; the changelog union already reserves `entityType='interface'` for them.

## What Changes

- **schema-sync accepts an optional `interfacePages` field** (raw MCP capture + `capturedAt`). Absent field = no interface processing (old workflows, skipped captures) — never treated as "all interfaces deleted".
- **Entity extraction:** the engine flattens the capture into interface entities: one per Interface app (`pbd…`), one per page (`pag…`, definition = the page payload incl. `pageType`, `sourceTableId`, `tablesByTableId`), and one per standalone form. Persisted as `bo_at_interfaces` rows keyed by `airtable_entity_id`, `submitted_via='mcp'`, with `first_seen_at`/`last_seen_at` lifecycle stamps.
- **Diffing:** run-over-run comparison of MCP-sourced entities in the same transaction as the schema diff — added/removed via lifecycle (removal only on a successful capture, mirroring the "confident full capture" invariant), renames and composition changes (pageType, sourceTableId, per-page field usage from `tablesByTableId`) as `bo_at_schema_updates` rows with `entity_type='interface'` — flowing into the existing changelog union with zero changelog-side work beyond the already-scoped interface events.
- **Manual-submission reconciliation:** MCP rows and manually-submitted rows coexist keyed by `airtable_entity_id`; MCP is authoritative for existence, name, and page composition; a manual submission's richer payload is preserved on its own row (`submitted_via` distinguishes them) and surfaced together by the read path.
- **Tier gating:** the engine includes `interfaces_enabled` (Growth+) in the task payload it already assembles per run, so workflows knows whether to capture.

## Capabilities

### New Capabilities

- `interface-pages-sync`: engine-side persistence, lifecycle, and diffing of MCP-captured interface apps/pages/forms into `bo_at_interfaces` + `bo_at_schema_updates`, reconciled with manual submissions, feeding existing changelog interface events.

### Modified Capabilities

None — `bo_at_interfaces`, `bo_at_schema_updates`, and the changelog's interface event taxonomy already exist; this change populates them from a new source. (If the changelog interface events land first via `server-schema-changelog` §3–§5, this change only feeds them; coordinate, don't duplicate.)

## Impact

- **App:** `apps/server` — schema-sync route + a new `per-space/interfaces-sync.ts` (pure diff/extract) + `space-db-pg.ts` writes; `packages/db-schema` only if a column gap emerges (target: none — `definition` jsonb carries `interfaceId` parentage).
- **Cross-repo contract:** the optional `interfacePages` schema-sync field — shape owned by THIS change's spec; workflows consumes it. Land this change first.
- **Reads/consumers:** existing web Interfaces tab + schema changelog pick up MCP-sourced rows via `submitted_via`; `tablesByTableId` stays in `definition` as raw material for `server-schema-entity-graph` (named follow-up, not built here).
- **No new secrets, no master-DB schema change.**
