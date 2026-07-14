# Tasks

## 1. Spike (gates everything)

- [ ] 1.1 Verify a real Connection OAuth access token authenticates against `https://mcp.airtable.com/mcp` and `tools/call list_pages_for_base` returns the documented envelope; record accepted/required scopes + a scrubbed response fixture in this change's README. **If rejected:** stop, document the dark-ship fallback (design Decision 2), and surface to the owner.

## 2. MCP client

- [ ] 2.1 `trigger/tasks/_lib/mcp-client.ts`: `fetchInterfacePages({ baseId, accessToken, endpoint, timeoutMs })` — Streamable HTTP handshake (`initialize` → capture optional `Mcp-Session-Id` header → `notifications/initialized` → `tools/call`), `Accept: application/json, text/event-stream` on every POST, envelope validation (`interfaces[]`, `standaloneForms[]`), 2 MB cap, typed `{ ok, raw, capturedAt } | { ok:false, reason }` result.
- [ ] 2.1b SSE response handling in the same module: when a response arrives as `text/event-stream`, parse `data:` frames as JSON-RPC messages, discard notifications (progress/log), resolve on the message whose `id` matches the request, error if the stream closes without it; single AbortController covers the whole exchange incl. stream body time.
- [ ] 2.2 Vitest (node) with msw: happy path as plain JSON; happy path as SSE (fixture result preceded by notification frames); session-id echo; timeout mid-stream; stream closes without matching id; 401; 5xx; malformed envelope; oversized payload.

## 3. Task integration

- [ ] 3.1 Thread `interfaces_enabled` through the task payload (engine → task), defaulting false; skip capture (silently) when false.
- [ ] 3.2 `backup-base.ts`: run capture concurrently with the first record-export step; attach `interfacePages` to the schema-sync POST body only on `ok`; report `skipped(reason)` in run progress otherwise; 401 additionally emits the connection-scope notice.
- [ ] 3.3 Tests on the pure orchestration module: capture success rides schema-sync; each failure mode leaves run outcome untouched; below-tier makes zero MCP requests.

## 4. Contract + docs

- [ ] 4.1 Cross-check the `interfacePages` payload field shape against `server-mcp-interface-pages` (single source: that change's spec) before landing; land server-first.
- [ ] 4.2 Update apps/workflows README (capture step, env override for the MCP endpoint in tests, failure-isolation contract).

## 5. Verification

- [ ] 5.1 `pnpm --filter @baseout/workflows test` + typecheck green.
- [ ] 5.2 Staging end-to-end: run a backup against a base with interfaces; confirm engine received `interfacePages` (server change's verification covers persistence/diff); confirm a base with no interfaces yields an empty-but-ok capture.
- [ ] 5.3 Failure drill on staging: point the endpoint override at a black hole; confirm the run completes normally with `skipped(timeout)`.
