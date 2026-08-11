# workflows-mcp-views — Proposal

## Why

View capture is Enterprise-gated today: the per-Space `bo_at_views` machinery only fills when `platform_config.is_enterprise_scope` is true, and non-enterprise runs strip views before hash/diff/store (`view-capture.ts`). Airtable's MCP server now exposes **view listing to all connections** (founder direction, 2026-07-25) — so every customer's views can be captured, and possibly with configuration detail beyond the REST meta id/name/type. This is the capture half; the gate-widening and persistence are the paired [`server-mcp-views`](../server-mcp-views/proposal.md). Third MCP capture kind — the client core (`callMcpTool`) and failure taxonomy already exist.

## What Changes

- The `backup-base` task gains a **views capture step** when the payload carries `viewCaptureMode: 'mcp'` (stamped by the engine — `'rest'` enterprise connections keep today's path untouched; `'off'` skips): call the MCP view-listing tool per base with the Connection's OAuth token via the existing `callMcpTool` core, new `fetchViews` wrapper.
- **Spike-gated tool + envelope:** tool name (`list_views_for_base`?) and whether the envelope carries configuration (filters/sorts/field visibility) or only id/name/type are unverified — spike task with scrubbed fixture gates the build (same drill as automations).
- Captured views ride the existing **schema-sync POST** as an optional `views` field (`{ capturedAt, raw }`, forwarded verbatim); persistence/diffing is server-side.
- **Failure isolation:** identical contract to the other MCP captures — `views: skipped(reason)` in run progress, never fails the run, never disturbs the interface-pages or automations captures.
- **Third capture kind = extract the shared failure-taxonomy constants** the automations design deferred ("parallel until a third exists" — this is the third).

## Capabilities

### New Capabilities

- `mcp-view-capture`: per-backup capture of a base's views via the Airtable MCP server for non-enterprise connections, riding schema-sync, failure-isolated.

### Modified Capabilities

None (interface/automation capture behavior unchanged; the shared-constants extraction is refactoring under existing specs' behavior).

## Impact

- **App:** `apps/workflows` only — `backup-base.ts` + `_lib/mcp-client.ts` `fetchViews` wrapper + shared skip-reason constants + tests (plain Vitest, injected `fetchImpl`).
- **Cross-repo contract:** optional `views` schema-sync field — shape owned by [`server-mcp-views`](../server-mcp-views/proposal.md); land server-first. `viewCaptureMode` payload flag also owned there.
- **No new secrets/scopes** (pending spike confirmation — a new scope is a STOP).
- **Risk:** if MCP views duplicate what REST meta already provides (id/name/type only, no config), the capture still has value — it opens views to non-enterprise connections — but the server change's config-diffing branch goes dormant. Either envelope ships.
