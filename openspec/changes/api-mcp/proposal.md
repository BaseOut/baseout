## Why

AI agents (Claude, Cursor, custom agents) are becoming a primary consumer of Baseout's read surface — "what changed in my schema", "when did the last backup run" are exactly the questions an agent asks mid-task. Rather than each customer hand-rolling HTTP calls, Baseout SHALL expose the public read API as a Model Context Protocol server so any MCP client can connect with an API token and get typed tools. The MCP server is strictly a wrapper over the REST operations defined in `api-rest-read` — it must stay in lockstep with the REST API by construction, not by discipline.

Scope note: the PRD/CLAUDE.md mark "MCP server" as V2-only unless explicitly requested; it was explicitly requested by the product owner on 2026-07-18. This change spearheads that scope with a read-only surface.

## What Changes

- Mount an MCP server (Streamable HTTP transport) on the existing `apps/api` Worker at `https://api.baseout.com/mcp` — no new Worker, no new domain (a cosmetic `mcp.baseout.com` alias can be added later as pure routing config).
- **Tools are generated from the same operation registry** that drives the REST router and OpenAPI (`api-rest-read` D8): each registry operation marked MCP-eligible becomes one tool (`list_spaces`, `list_backup_runs`, `get_backup_status`, `search_schema`, `list_schema_changes`, …) whose input schema derives from the operation's Zod schemas. A REST change propagates to the MCP catalog at build time; drift is structurally impossible.
- Tool execution calls the REST operation handlers **in-process** (no self-HTTP), under the same token auth, scope checks, tenant-safe 404 semantics, and usage metering (surface = `mcp`).
- **Auth**: same `Authorization: Bearer bo_live_…` header (`api_tokens`); MCP clients configure it as a custom header. OAuth 2.1 / dynamic client registration (needed for the claude.ai connector directory) is deferred and additive.
- **Agent ergonomics**: `orgId` is always injected from the token; `spaceId` is injected when the token is Space-bound, otherwise a required tool parameter. Read-only tool annotations set (`readOnlyHint`).
- Not in scope: write tools, MCP resources/prompts beyond a basic server-info surface, OAuth, sampling, a standalone MCP Worker.

## Capabilities

### New Capabilities

- `mcp-server`: MCP server on `apps/api` (Streamable HTTP at `/mcp`) exposing registry-generated read-only tools with token auth, grant-aware parameter injection, and lockstep-with-REST guarantees.

### Modified Capabilities

None in `openspec/specs/`. Depends on the sibling change `api-rest-read` (operation registry, auth middleware, metering); the `api-usage-tracking` spec there already reserves the `mcp` surface value.

## Impact

- **`apps/api`**: MCP transport handler at `/mcp`, tool-catalog generator over the operation registry, in-process dispatch adapter, contract tests (every MCP-eligible operation ⇔ exactly one tool with matching schema).
- **Dependencies**: `@modelcontextprotocol/sdk` (or a Workers-compatible Streamable HTTP implementation); no Durable Objects required (server is stateless — see design D3).
- **Docs**: connection instructions (server URL + header config for Claude Code / Claude Desktop / Cursor) published alongside the OpenAPI reference at `docs.baseout.com`.
- **Sequencing**: implementable only after `api-rest-read` lands its registry + auth middleware; file order reflects that.
- **Public contract stability**: tool names and input schemas follow the same additive-only policy as REST v1; renames/removals are treated as breaking.
