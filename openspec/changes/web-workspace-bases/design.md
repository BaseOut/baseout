# web-workspace-bases — Design

## Decision 1 — Workspace identity lives on `at_bases`, not a workspace registry table

Bases need `workspace_id`/`workspace_name` for grouping; a normalized `at_workspaces` registry adds a join and a sync obligation for two denormalized strings. Names drift rarely and are re-stamped on every rescan/rediscovery — denormalized columns are enough. Revisit only if workspace-level metadata beyond identity accumulates.

## Decision 2 — `space_workspaces` is enrollment, not membership

The table records *intent* ("this Space auto-adds from these workspaces"), not which bases belong to which workspace (that's `at_bases.workspace_id`). Un-enrolling a workspace removes future auto-adds but never touches already-configured bases. `last_checked_at` is stamped by the engine's per-run check so the settings UI can show freshness.

## Decision 2b — A standing flag for future workspaces, not a magic "all" row

"All workspaces" via a macro over per-workspace rows is a snapshot — it can't cover a workspace created next month, and new workspaces are common (founder, 2026-07-25). Rather than a sentinel "all" row (special-cases every read) the Space carries `backup_configurations.auto_enroll_new_workspaces`: the engine materializes a real `enrolled_via='auto'` row the moment a new workspace is first seen, so after discovery the system state is always plain rows — the flag only governs the transition from unknown→known. Un-enrolling an auto-enrolled workspace later just flips its row; the flag keeps applying to the *next* new workspace (explicit opt-outs are respected because their rows already exist).

## Decision 3 — Legacy `autoAddFutureBases` precedence

Existing rule (connection-wide flag on `backup_configurations`) maps to: no `space_workspaces` rows → legacy flag governs, interpreted as "all workspaces of the connection" (current behavior preserved exactly). Any rows present → rows govern, legacy flag ignored. The first save from the new UI materializes rows (one per workspace, flag per the user's toggles), after which the legacy flag is inert for that Space. No data backfill — Spaces migrate lazily on first edit.

## Decision 4 — Web proxies workspace listing from the engine; it does not grow an MCP client

The engine needs MCP workspace listing anyway (per-run auto-enroll check), already holds the verified MCP exchange pattern, and web already reaches it over the `BACKUP_ENGINE` service binding. One MCP consumer (server), two callers. The picker path is interactive, so the engine route carries a short TTL cache (design owned by `server-mcp-workspaces`); web treats a listing failure as "grouping unavailable" (picker falls back to flat — the ui-only spec's unknown-workspace behavior), never an error page.

## Decision 5 — Nullable-first, never blocking

Workspace columns are nullable and every path tolerates their absence (old rows, MCP failure, non-Airtable platforms). Grouping is a progressive enhancement over a working flat picker.

## Open questions

1. Does MCP workspace listing return bases-per-workspace directly, or workspaces only (requiring a base→workspace join from base metadata)? Spike-owned by `server-mcp-workspaces`; the `at_bases` stamping path adapts to either.
2. Should `space_workspaces` also gate *initial* base listing in the picker (only enrolled workspaces shown)? Default: no — picker always shows everything; enrollment only affects future auto-adds.
