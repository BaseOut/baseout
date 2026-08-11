# server-mcp-workspaces — Design

## Decision 1 — The engine is the single MCP workspace consumer

Web could call MCP directly, but the engine needs the identical call for auto-enroll and rediscovery, already holds token resolution (`resolve-airtable-token.ts`) and the proven exchange pattern. One client, one cache, three callers (picker proxy, rediscovery, run-start check). The client is a **copy** of the workflows core with a canonical-source header comment — extracting `packages/mcp-client` is a follow-up `system-*` change now that two apps carry the code; not done here to keep this change single-app.

## Decision 2 — Auto-enroll runs at run start, not on a separate schedule

The founder framing is "on each backup run, check for new bases since our last sync" — piggybacking `processRunStart` means no new scheduling surface, natural `last_checked_at` semantics, and the new bases join the very run that discovered them (first backup immediately, matching the feature's promise). Manual runs get the same check (no hidden mode split). **Rejected:** a SpaceDO cron lane (new alarm plumbing for zero added freshness — bases only need protecting when backups run) and rescan-time-only (leaves gaps between UI visits).

## Decision 3 — Cap behavior: add-until-cap, skip the rest, notify both ways

Additions are ordered (workspace order then base name) and stop at the bases-per-Space cap. Below cap → "N bases added" notification; at cap with skips → "new bases paused — plan limit" notification naming the workspace. Never partial-silent, never blocking the run. Skipped bases are re-considered next run (they'll appear as new again — idempotent by `at_base_id` diff, no skip-list state).

## Decision 4 — Cache is per-connection, in-memory, ~60s TTL

The picker path wants sub-second responses; MCP round-trips are slower. A DO-free in-memory map on the Worker instance is acceptable staleness for grouping (workspaces change rarely); auto-enroll bypasses the cache (correctness path, once per run). No persistent cache — YAGNI.

## Decision 5 — Base→workspace mapping tolerates either envelope

If the workspace tool returns base membership, the diff is direct. If it returns workspaces only, membership comes from stamping `at_bases.workspace_id` during the same fetch (Meta list-bases + workspace association per the spike's finding). The pure module (`lib/workspaces/auto-enroll.ts`) takes `(enrolledWorkspaces, currentWorkspaceBases, configuredBaseIds, cap)` and returns `(toAdd, skipped)` — envelope differences stay in the fetch layer.

## Open questions (spike resolves)

1. Tool name + envelope (`list_workspaces`? base membership included?).
2. Does the standard OAuth grant unlock the tool, or is a new scope needed? New scope → STOP (re-consent; surface before building).
3. Workspace rename propagation: re-stamp names on every listing (cheap) — confirm no consumer treats `workspace_name` as stable.
