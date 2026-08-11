# workflows-mcp-interface-pages — Proposal

## Why

Airtable's REST API does not expose Interfaces at all (verified through mid-2026; research `N-7`), which is why interface backup currently depends entirely on manual submission (`server-automations-interfaces-docs`). But Airtable's **official MCP server** exposes a `list_pages_for_base` tool that returns the interface pages of a base — an automatic, per-backup source for the interface *inventory* (which pages exist, their names/types) that customers otherwise have to hand-submit. Capturing it during every backup closes a visible gap in the backup matrix and feeds the schema changelog with interface add/remove/rename events no competitor can produce.

## What Changes

- The `backup-base` Trigger.dev task gains an **interface-pages capture step**: after schema capture, call the Airtable MCP server's `list_pages_for_base` tool for the base, reusing the Connection's existing Airtable OAuth access token (the MCP server authenticates with the same Airtable identity; a spike task verifies token acceptance and required scopes before build).
- The tool returns substantially more than an inventory (owner-verified sample on file in the design): `interfaces[]` (Interface apps: `pbd…` id + name) each containing `pages[]` (`pag…` id, name, `pageType`, `sourceTableId`, and `tablesByTableId` — the exact tables/fields each page uses, with per-field `isEditable`), plus `standaloneForms[]`. This is both backup content *and* field→interface dependency data.
- The MCP call is a direct JSON-RPC 2.0 exchange over Streamable HTTP (initialize → `tools/call`) in a new pure helper `_lib/mcp-client.ts` — no MCP SDK dependency, mockable at the HTTP boundary like the REST client.
- Captured pages ride the existing engine callback: the schema-sync POST body is extended with an optional `interfacePages` array (page id, name, type/url, raw payload). Persistence + diffing are **server-side** — see the paired change [`server-mcp-interface-pages`](../server-mcp-interface-pages/proposal.md).
- **Failure isolation:** MCP capture is best-effort — timeout, 401, or tool errors mark the capture `interface_pages: skipped(reason)` in run progress and NEVER fail the backup run (the MCP surface is newer and less stable than the REST API).
- Capability-gated to the same tier as interface backup (Growth+, per the PRD-vs-Features conflict resolution recorded in `server-automations-interfaces-docs`): below-tier Spaces skip the call entirely.

## Capabilities

### New Capabilities

- `mcp-interface-capture`: per-backup automatic capture of a base's interface pages via the Airtable MCP server tool `list_pages_for_base`, reusing the Connection's OAuth token, with best-effort failure isolation and tier gating.

### Modified Capabilities

None in this change (the workflows→server callback contract gains an optional field, owned by the server change's spec delta).

## Impact

- **App:** `apps/workflows` only — `backup-base.ts` orchestration + new `_lib/mcp-client.ts` + tests (plain Vitest, HTTP mocked with msw).
- **Cross-repo contract:** extends the schema-sync payload with optional `interfacePages` (additive; old servers ignore it, old workflows omit it). Contract change is specced and landed by [`server-mcp-interface-pages`](../server-mcp-interface-pages/proposal.md); both changes cross-reference and should land server-first.
- **Secrets/config:** none new — reuses the Connection OAuth token already provided to the task; MCP endpoint URL is a constant (`https://mcp.airtable.com/mcp`) with an env override for testing.
- **Risk:** whether Baseout's OAuth access token is accepted by the MCP server (vs requiring a separate MCP OAuth client/registration) is unverified — spike task 1.1 gates the rest of the build and, if it fails, the fallback is documented in the design (defer to manual intake; no schedule impact on other work).
