## 1. Registry Extension (depends on api-rest-read §1)

- [x] 1.1 Extend the operation registry with MCP metadata (tool name, agent-facing description) for the read operations. → `src/mcp/tools.ts` declares one tool per eligible operation, referencing it by (method, path). (Kept alongside the registry rather than inline on `Operation` to avoid editing 19 ops; the contract test — 1.3 — makes drift impossible either way.) 18 read tools.
- [x] 1.2 Catalog generator: tool inputs as JSON Schema, `readOnlyHint`, grant-aware parameter elision (which path params are injected). → `src/mcp/catalog.ts` (`buildToolCatalog`/`toolInputSchema`): scope-filtered, `readOnlyHint: true`, orgId + `{platform}` always injected, spaceId elided for Space-bound tokens / required for org-wide. (Input schemas authored directly as JSON Schema — no zod-to-json-schema dep, consistent with api-rest-read.)
- [x] 1.3 Contract tests: one tool per eligible operation, additive-only check (rename/removal fails). → `tests/mcp.test.ts`: every tool resolves to a real operation (fails if an op path is renamed/removed), unique names, scope filter, spaceId elision.

## 2. MCP Transport & Dispatch

- [x] 2.1 Streamable HTTP handler at `/mcp` (stateless JSON-RPC; initialize, tools/list, tools/call, ping, initialized), Workers-compatible. → `src/mcp/transport.ts` (no SDK dep — minimal Workers-native JSON-RPC 2.0, single + batch, 202 for notification-only).
- [x] 2.2 REST auth in front of the transport; reject unauthenticated before handshake; scope-filtered `tools/list`. → `src/index.ts` `/mcp` branch authenticates (401 before any dispatch); catalog is scope-filtered per token.
- [x] 2.3 In-process dispatch adapter: tool args + injected grants → operation handler → REST JSON as tool result; REST error → MCP tool error. → `src/mcp/dispatch.ts` (`callTool`); tests assert 404/403/400 parity (isError with the REST body) + missing-spaceId + unknown-tool.
- [x] 2.4 Metering: surface `mcp`, tool name as route template, shadow rate-limit per token. → `/mcp` branch meters `surface: "mcp"`, `routeTemplate: "mcp:tools/call:<tool>"`, and evaluates the shadow rate limit.

## 3. Verification & Docs

- [~] 3.1 End-to-end with a real MCP client SDK. → **Raw JSON-RPC smoke shipped** (`openspec/changes/api-mcp/smoke.mjs`: initialize → tools/list → tools/call get_backup_status/list_spaces + 401), runnable against local `wrangler dev`. A full client-SDK e2e is deferred with the deploy bindings.
- [ ] 3.2 **DEFERRED (product-owner):** tool-description copy pass (agent-facing wording; backups-as-best-practice + schema-intelligence positioning, no recovery-led copy). Descriptions are drafted in that spirit in `tools.ts`; final copy pending review.
- [ ] 3.3 **DEFERRED (docs hosting):** connection docs at `docs.baseout.com` (server URL + header setup for Claude Code / Desktop / Cursor) — same hosting open question as api-rest-read 5.1.
- [ ] 3.4 **DEFERRED (recorded):** OAuth 2.1 + DCR follow-up change for the claude.ai connector directory (Bearer-header auth ships now); `mcp.baseout.com` alias is cosmetic routing config for the deploy step.
