## Context

`api-rest-read` establishes the public read REST API on `apps/api` with a single operation registry (method, path, scope, Zod schemas, handler) feeding the router and OpenAPI. The product owner wants those endpoints exposed as MCP tools, has asked for a recommendation on placement (same Worker vs own server; path vs own domain), and has set the core constraint: as the REST API evolves, the MCP server must stay in line with it.

## Goals / Non-Goals

**Goals**

- MCP server any client can reach at a stable URL with an `api_tokens` Bearer header.
- Zero-drift: the MCP tool catalog is a build artifact of the REST operation registry.
- Same security posture as REST: identical auth, scoping, tenant-safe 404s, metering.

**Non-Goals**

- Write tools, OAuth 2.1/DCR, MCP resources/prompts/sampling, session persistence, a standalone Worker, stdio transport (remote-only product).

## Decisions

### D1. Placement: same `apps/api` Worker, mounted at `/mcp`

Recommendation (per the "push back on location" ask): the MCP server is a **thin protocol adapter over in-process handlers**, so it belongs where the handlers live.

- Same Worker ⇒ tools invoke REST operation handlers as function calls — same deploy atomically updates REST + tools, making the "keep MCP in line with REST" requirement a build-time property instead of an ops procedure.
- Separate Worker (*rejected*): would have to call REST over HTTP — adds a hop, splits deploys (the exact drift window the owner wants to avoid), duplicates auth/metering middleware. The isolation argument is weak: both surfaces are stateless read layers with identical blast radius.
- URL: `https://api.baseout.com/mcp` (outside `/v1` — MCP negotiates its own protocol version; the *tools* map to v1 operations and say so in their descriptions). A `mcp.baseout.com` custom-domain alias routing to the same Worker can be added later purely in Cloudflare config if marketing wants it; not part of this change.

### D2. Zero-drift mechanism: tools generated from the operation registry

Each registry operation carries an `mcp` block: eligibility flag, tool name (`list_backup_runs`, `get_backup_status`, `search_schema`, …), and description. The tool's input schema is derived from the operation's path/query/body Zod schemas; results return the operation's JSON response in the tool result content.

- Adding/extending a REST endpoint updates the tool catalog on next build with no separate MCP edit.
- Contract test: every MCP-eligible operation has exactly one tool whose JSON Schema round-trips from the Zod source; catalog snapshot reviewed in PRs (a rename/removal fails the additive-only check).
- *Alternative rejected*: hand-written tool list calling REST over HTTP — this is the drift scenario the change exists to prevent. *Alternative rejected*: auto-generating from the OpenAPI document — lossy (loses handler binding for in-process dispatch); the registry is upstream of OpenAPI and strictly better as the source.

### D3. Transport: stateless Streamable HTTP, no Durable Objects

All tools are stateless reads; nothing needs session affinity.

- POST-per-request Streamable HTTP (client sends JSON-RPC, gets JSON or SSE-stream response) with authentication on every request; no server-held session state beyond the protocol handshake.
- *Alternative rejected for now*: Cloudflare Agents SDK `McpAgent` (Durable-Object-backed sessions) — right tool for stateful/streaming agents, unnecessary state and cost for a read-only wrapper; revisit if long-running tools or subscriptions arrive.

### D4. Auth: Bearer header now, OAuth later (additive)

Same middleware as REST: `Authorization: Bearer bo_live_…` validated against `api_tokens`; scopes gate tool visibility (a `backups:read`-only token doesn't see schema tools in `tools/list`) and execution. Claude Code, Claude Desktop (custom connectors), and Cursor all support per-server headers. OAuth 2.1 + dynamic client registration — required for the claude.ai remote-connector directory — is deferred; it layers in front of token issuance without changing tools.

### D5. Grant-aware parameter injection

Tools never ask the agent for what the token already fixes: `orgId` is always injected; `spaceId` and `platform` are injected when the token is Space-bound (platform = the Space's single V1 platform), otherwise `spaceId` is a required parameter (and a `list_spaces` call is the natural first tool). Keeps tool signatures small — materially better agent success rates than 9-segment-path mirroring.

### D6. Observability

Every tool call is metered through the `api-usage-tracking` pipeline with `surface = "mcp"` and the tool name as the route template — usage dashboards see REST and MCP consumption in one dataset from day one.

## Risks / Trade-offs

- [MCP spec churn (transport/auth details still evolving)] → we expose one stateless transport and standard tool semantics only; churn lands in the adapter, not the registry.
- [Agents over-calling tools inflate load] → same shadow rate limiting per token as REST; AE data will show whether MCP needs its own limit key before enforcement turns on.
- [No OAuth = no claude.ai directory listing at launch] → accepted; header-based connectors cover developer clients now, OAuth is an additive follow-up change.
- [Large tool results (e.g. full field listings) blow up agent context] → tools default to the REST `limit` default (50) and support `fields` sparse selection inherited from the operations.

## Migration Plan

Ships as a route addition to `apps/api` after `api-rest-read` is implemented; no data changes. Rollback = unmount `/mcp`. No migration for consumers (none exist yet).

## Open Questions

- Tool-description copy pass: descriptions are agent-facing prompt surface; product-owner review before launch (positioning rule: lead with backups-as-best-practice + schema intelligence, never recovery).
- Whether `search_schema` should also be exposed as an MCP *resource template* in addition to a tool — defer until a client need appears.
- Timing of the `mcp.baseout.com` alias (cosmetic, ops-only).
