# server-mcp-automations — Proposal

## Why

The paired change [`workflows-mcp-automations`](../workflows-mcp-automations/proposal.md) starts capturing a base's automations from the Airtable MCP server on every backup run (Airtable's MCP automations support shipped ~Jul 2026 — Jul 24 sync; see [shared/internal/action-plan-2026-07-24.md](../../../shared/internal/action-plan-2026-07-24.md) §2). The engine must persist that capture into the per-Space DB, diff it run-over-run so automation add/remove/rename/config changes appear in the schema changelog, and reconcile it with the existing manual-submission path (`server-automations-interfaces-docs`) — otherwise the capture is dead weight. This is the automation twin of [`server-mcp-interface-pages`](../server-mcp-interface-pages/proposal.md) (shipped + dev-verified), reusing its established patterns: optional schema-sync field, `submitted_via='mcp'` provenance, lifecycle stamps, removal-only-on-successful-capture, changelog events.

## What Changes

- **schema-sync accepts an optional `automations` field** (raw MCP capture + `capturedAt`). Absent field = no automation processing (old workflows, skipped/below-tier captures) — never treated as "all automations deleted".
- **Entity extraction:** the engine flattens the capture into automation entities keyed by `airtable_entity_id`, persisted into the **EXISTING `bo_at_automations`** table (created by the manual-intake schema work — implementation finding, 2026-07-24: **no migration needed**) with `submitted_via='mcp'`, the table's submission-driven `first_seen_at`/`last_seen_at` timestamp lifecycle (stamped from `capturedAt`), and the definition payload (deployment status + trigger + graph nodes live inside `definition` — per-entry envelope granularity pending a populated capture).
- **Diffing:** run-over-run comparison in the same `withSpaceSchema` transaction as the schema diff — added/removed via lifecycle (removal only on a successful capture), renames and config changes (enabled/disabled flips, trigger/action deltas) as `bo_at_schema_updates` rows with `entity_type='automation'`, flowing into the existing changelog union.
- **Manual-submission reconciliation:** MCP rows and manually-submitted rows coexist keyed by `airtable_entity_id`; MCP is authoritative for existence, name, and enabled state; a manual submission's richer payload (e.g. pasted script source, which MCP may not expose) is preserved on its own row and surfaced together by the read path — the exact reconciliation contract `server-mcp-interface-pages` established.
- **Tier gating:** the engine stamps `automationsEnabled` (**Growth+**, per the PRD §2.9 vs Features §4.2 conflict resolution recorded in `server-automations-interfaces-docs`) on the task payload it already assembles per run.

## Capabilities

### New Capabilities

- `automations-sync`: engine-side persistence, lifecycle, and diffing of MCP-captured automations into `bo_at_automations` + `bo_at_schema_updates`, reconciled with manual submissions, feeding existing changelog machinery.

### Modified Capabilities

None — this populates the changelog from a new source; the changelog union gains `entity_type='automation'` rows through the same mechanism interface events use.

## Impact

- **App:** `apps/server` — schema-sync route + a new `per-space/automations-sync.ts` (pure extract/diff, modeled on `interfaces-sync.ts`) + `space-db-pg.ts` read/apply. **NO per-Space migration** (implementation finding, 2026-07-24): `bo_at_automations` already exists (manual-intake schema work), and the changelog's automation-removals reader (`schema-changelog-io.ts`, status + `last_seen_at`) already consumes exactly the lifecycle this change writes — zero changelog-side work and no `system-per-space-db` sequencing dependency.
- **Cross-repo contract:** the optional `automations` schema-sync field — shape owned by THIS change's spec; workflows consumes it. Land this change first.
- **Reads/consumers:** the web Automations tab (`web-automations-interfaces-tabs`) picks up MCP-sourced rows via `submitted_via`, same as interfaces; no web work in this change.
- **No new secrets, no master-DB schema change.**
- **PRD update dependency:** PRD §2.9 collection-method amendment (action-plan §6) should land with or before this pair so the spec matrix matches shipped behavior.
