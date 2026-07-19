## 1. Registry Extension (depends on api-rest-read §1)

- [ ] 1.1 Extend the operation registry type with an `mcp` block (eligible flag, tool name, agent-facing description) and annotate all read operations
- [ ] 1.2 Catalog generator: Zod → JSON Schema tool inputs, `readOnlyHint` annotations, grant-aware parameter elision metadata (which path params are injectable)
- [ ] 1.3 Contract tests: one tool per eligible operation, schema round-trip snapshot, additive-only check (rename/removal fails)

## 2. MCP Transport & Dispatch

- [ ] 2.1 Streamable HTTP handler at `/mcp` (stateless JSON-RPC; initialize, tools/list, tools/call), Workers-compatible
- [ ] 2.2 Wire REST auth middleware in front of the transport; reject unauthenticated before handshake; scope-filtered `tools/list`
- [ ] 2.3 In-process dispatch adapter: tool args + injected grants → operation handler call → REST JSON as tool result; REST error → MCP tool error mapping (tests: 404/403/400 parity with REST)
- [ ] 2.4 Metering integration: surface `mcp`, tool name as route template, shadow rate-limit evaluation per token

## 3. Verification & Docs

- [ ] 3.1 End-to-end test with a real MCP client SDK: initialize → list → call `list_spaces`/`get_backup_status`/`search_schema` against seeded data (org-wide and Space-bound tokens)
- [ ] 3.2 Tool-description copy pass with product owner (agent-facing wording; follow positioning: backups-as-best-practice + schema intelligence, no recovery-led copy)
- [ ] 3.3 Connection docs at `docs.baseout.com`: server URL + header setup for Claude Code, Claude Desktop custom connector, Cursor
- [ ] 3.4 Decide/record deferred items: OAuth 2.1 + DCR follow-up change for claude.ai directory; `mcp.baseout.com` alias timing
