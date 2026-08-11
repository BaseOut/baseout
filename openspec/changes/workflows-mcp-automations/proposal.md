# workflows-mcp-automations — Proposal

## Why

Airtable's REST API does not expose Automations (PRD §2.9), which is why automation backup currently depends entirely on manual submission ([`server-automations-interfaces-docs`](../server-automations-interfaces-docs/proposal.md)). But Airtable's **official MCP server** recently added automations support (announced ~Jul 2026; surfaced at the Jul 24 sync — see [shared/internal/action-plan-2026-07-24.md](../../../shared/internal/action-plan-2026-07-24.md) §2). That gives Baseout an automatic, per-backup source for a base's automation inventory and configuration — the same premise change that [`workflows-mcp-interface-pages`](../workflows-mcp-interface-pages/proposal.md) already proved out for Interfaces, with the transport, auth, and failure-isolation questions all answered by that change's spike and E2E runs (standard OAuth grant accepted by `mcp.airtable.com`; SSE responses; no session id).

**Spec conflict to flag** (per CLAUDE.md §1): PRD §2.9 states Automations are "not available via the Airtable REST API and cannot be automatically backed up … must be submitted by the user through a Baseout intake method." MCP capture partially falsifies this — the weekend PRD update (action-plan §6) should amend the §2.9 collection-method table to "MCP capture + manual intake" for Automations, mirroring however Interfaces are recorded. The PRD §2.9 (Growth) vs Features §4.2 (Launch+) tier discrepancy noted in `server-automations-interfaces-docs` applies here too; this change follows that change's resolution: **Growth+**.

## What Changes

- The `backup-base` Trigger.dev task gains an **automations capture step**: alongside the existing interface-pages capture, call the Airtable MCP server's automations tool for the base, reusing the Connection's existing Airtable OAuth access token and the existing `_lib/mcp-client.ts` Streamable-HTTP/SSE plumbing (generalized from `fetchInterfacePages` to a shared `tools/call` core — the interface path's behavior must not change).
- **The exact MCP tool name and envelope are unverified** — the automations tool is newer than `list_pages_for_base` and no owner-verified sample is on file. A spike task (mirroring interface-pages task 1.1: `tools/list` against a real Connection token, then call the automations tool, record a scrubbed fixture in this change's README) gates the build.
- Captured automations ride the existing engine callback: the schema-sync POST body is extended with an optional `automations` field (`{ capturedAt, raw }`, forwarded verbatim — same wire pattern as `interfacePages`). Persistence + diffing are **server-side** — see the paired change [`server-mcp-automations`](../server-mcp-automations/proposal.md).
- **Failure isolation:** identical contract to interface capture — timeout, 401, tool errors, or envelope validation failure mark the capture `automations: skipped(reason)` in run progress and NEVER fail the backup run.
- Capability-gated to the automation-backup tier (**Growth+**): the engine stamps an `automationsEnabled` flag on the task payload (server change owns it); below-tier Spaces skip the call entirely.

## Capabilities

### New Capabilities

- `mcp-automation-capture`: per-backup automatic capture of a base's automations via the Airtable MCP server, reusing the Connection's OAuth token and the existing MCP client, with best-effort failure isolation and tier gating.

### Modified Capabilities

None in this change (the workflows→server callback contract gains an optional field, owned by the server change's spec delta; `mcp-interface-capture` behavior is unchanged by the client refactor).

## Impact

- **App:** `apps/workflows` only — `backup-base.ts` orchestration + `_lib/mcp-client.ts` generalization + tests (plain Vitest, injected `fetchImpl` per house convention).
- **Cross-repo contract:** extends the schema-sync payload with optional `automations` (additive; old servers ignore it, old workflows omit it). Contract shape is specced and landed by [`server-mcp-automations`](../server-mcp-automations/proposal.md); land server-first.
- **Secrets/config:** none new — reuses the Connection OAuth token and the `AIRTABLE_MCP_URL` test override already in place.
- **Risk:** whether the MCP automations tool returns full automation definitions (trigger + actions + script bodies) or only an inventory (id + name + enabled) is unknown until the spike; either is worth capturing, but the server change's diff granularity depends on it. If the tool is absent from `tools/list` for our grant, stop and fall back to manual intake (no schedule impact on other work).
- **Relationship to manual intake:** coexists with, does not supersede, `server-automations-interfaces-docs` — MCP is authoritative for existence/inventory; a manual submission's potentially richer payload (e.g. pasted script source) is preserved on its own row, exactly as interfaces reconcile.
