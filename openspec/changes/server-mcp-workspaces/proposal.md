# server-mcp-workspaces — Proposal

## Why

Airtable's MCP server now exposes **workspace listing to all connections** (previously Enterprise-only via REST — founder direction, 2026-07-25). The engine needs it twice: (a) to serve the picker's workspace grouping (web proxies via the `BACKUP_ENGINE` service binding — see [`web-workspace-bases`](../web-workspace-bases/proposal.md) Decision 4), and (b) to power **workspace auto-enroll**: on each backup run for a Space with enrolled workspaces, detect bases created since the last sync and add them to the Space automatically. The engine already owns the verified MCP exchange pattern (interface-pages README), rediscovery reconciliation (`lib/rediscovery/run.ts`), and the run-start orchestration point (`lib/runs/start.ts` `processRunStart`) — this change composes them.

## What Changes

- **MCP client on the engine:** port the workflows `callMcpTool` core (`apps/workflows/trigger/tasks/_lib/mcp-client.ts`) into `apps/server/src/lib/mcp/` as a copy with a header comment naming the canonical source (parallel-until-third-consumer per house convention; extraction to a workspace package is the noted follow-up now that two apps carry it).
- **Spike-gated tool:** the workspace-listing tool name and envelope (workspaces with base membership? workspaces only?) are unverified — a spike task (`tools/list` + call against a real Connection token, scrubbed fixture in this change's README) gates the build, mirroring the automations spike.
- **Internal route `GET /api/internal/connections/:connectionId/workspaces`** (INTERNAL_TOKEN-gated): resolves the Connection token, calls the MCP tool, returns the normalized workspace list. **Short-TTL in-memory cache (~60s per connection)** — the picker path is interactive; the auto-enroll path tolerates staleness.
- **Rediscovery stamps workspace identity:** `runWorkspaceRediscovery` additionally fetches the workspace list and stamps `at_bases.workspace_id`/`workspace_name` during its existing reconcile.
- **New-workspace detection first (standing flag):** when `backup_configurations.auto_enroll_new_workspaces` is true, any workspace in the listing without a `space_workspaces` row is auto-enrolled on the spot (`enrolled_via='auto'`, `auto_enroll_future_bases=true`) with its own notification ("New workspace W enrolled") — then falls through to the base check below as an enrolled workspace. Existing rows are never modified by the flag (explicit opt-outs stand).
- **Auto-enroll check at run start:** in `processRunStart`, before `fetchIncludedBases`, for Spaces with `space_workspaces` rows where `auto_enroll_future_bases = true` (or the legacy-flag fallback per `web-workspace-bases` Decision 3 — legacy = all workspaces including future): fetch current bases of the enrolled workspaces, diff against configured bases, insert missing ones (`at_bases` if new, `backup_configuration_bases` with `isIncluded = true, isAutoDiscovered = true`), stamp `space_workspaces.last_checked_at`, include the new bases in the starting run, and emit a notification event ("N new bases added from workspace W"). **Tier cap:** additions stop at the Space's bases-per-Space cap; capped-out bases are skipped with a distinct notification ("new bases paused — plan limit"), matching the ui-only `workspace-auto-enroll` cap-blocked treatment.
- **Failure isolation:** MCP failure (or spike-absent tool) at run start SHALL never fail or delay the run — the check is skipped with a logged reason and the run proceeds on the configured base set.

## Capabilities

### New Capabilities

- `workspace-listing-and-auto-enroll`: engine-side MCP workspace listing (internal route + rediscovery stamping) and the per-run auto-enroll of new bases in enrolled workspaces, cap-aware and failure-isolated.

### Modified Capabilities

None — `processRunStart` gains a pre-step; existing run semantics (`no_bases_selected`, per-base enqueue) unchanged.

## Impact

- **App:** `apps/server` — `lib/mcp/` client port, internal route, rediscovery extension, run-start pre-step, notification event. Reads master-DB `space_workspaces`/`at_bases` (schema owned by `web-workspace-bases` — land that first).
- **Cross-repo contract:** the internal workspaces route response shape — owned by THIS change; web proxies it.
- **No new secrets** (Connection OAuth token, existing internal-token gate). **No per-Space DB change.**
- **Tier note:** auto-enroll itself rides the existing bases-per-Space capability — no new capability gate; the cap is the gate.
