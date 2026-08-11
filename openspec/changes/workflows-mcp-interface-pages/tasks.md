# Tasks

## 1. Spike (gates everything)

- [x] 1.1 Verify a real Connection OAuth access token authenticates against `https://mcp.airtable.com/mcp` and `tools/call list_pages_for_base` returns the documented envelope; record accepted/required scopes + a scrubbed response fixture in this change's README. **If rejected:** stop, document the dark-ship fallback (design Decision 2), and surface to the owner. ✅ 2026-07-14 — ACCEPTED with the standard grant (`data.records:read data.recordComments:read schema.bases:read webhook:manage`); transport findings + fixture in [README.md](README.md). Note: responses arrive as SSE even for single messages, and no `Mcp-Session-Id` is issued.

## 2. MCP client

- [x] 2.1 `trigger/tasks/_lib/mcp-client.ts`: `fetchInterfacePages({ baseId, accessToken, endpoint, timeoutMs })` — Streamable HTTP handshake (`initialize` → capture optional `Mcp-Session-Id` header → `notifications/initialized` → `tools/call`), `Accept: application/json, text/event-stream` on every POST, envelope validation (`interfaces[]`, `standaloneForms[]`), 2 MB cap, typed `{ ok, raw, capturedAt } | { ok:false, reason }` result.
- [x] 2.1b SSE response handling in the same module: when a response arrives as `text/event-stream`, parse `data:` frames as JSON-RPC messages, discard notifications (progress/log), resolve on the message whose `id` matches the request, error if the stream closes without it; single AbortController covers the whole exchange incl. stream body time.
- [x] 2.2 Vitest (node) — via injected `fetchImpl` (house convention; msw not used anywhere in this app): happy path as plain JSON; happy path as SSE (fixture result preceded by notification frames); session-id echo; timeout mid-stream; stream closes without matching id; 401; 5xx; malformed envelope; oversized payload.

## 3. Task integration

- [x] 3.1 Thread `interfaces_enabled` through the task payload (engine → task), defaulting false; skip capture (silently) when false. → `interfacesEnabled?: boolean` on `BackupBaseTaskPayload` + `BackupBaseInput`; the engine already stamps it (server change task 3.1).
- [x] 3.2 `backup-base.ts`: capture runs concurrently with the Airtable SCHEMA fetch (deviation from design recorded in README — `interfacePages` must be in the schema-sync body, which records-sync depends on); attach `interfacePages` to the schema-sync POST body only on `ok`; report `skipped(reason)` in run progress otherwise; 401 additionally emits the connection-scope notice.
- [x] 3.3 Tests on the pure orchestration module (`tests/backup-base-interface-capture.test.ts`, 11 tests): capture success rides schema-sync; each failure mode leaves run outcome untouched; below-tier makes zero MCP requests.

## 4. Contract + docs

- [x] 4.1 Cross-check the `interfacePages` payload field shape against `server-mcp-interface-pages` (single source: that change's spec) before landing; land server-first. → `{ capturedAt: ISO string, raw: envelope }` matches the engine's `parseInterfacePagesField` (apps/server/src/lib/per-space/interfaces-sync.ts); server change landed AND deployed to dev first. ✔
- [x] 4.2 apps/workflows has NO README — capture-step docs live in this change's README.md instead. Update apps/workflows README (capture step, env override for the MCP endpoint in tests, failure-isolation contract).

## 5. Verification

- [x] 5.1 `pnpm --filter @baseout/workflows test` + typecheck green. → 224 tests (26 new: 15 mcp-client + 11 orchestration) + `tsc --noEmit` clean, 2026-07-14.
- [x] 5.2 Dev end-to-end (2026-07-14, deployed dev engine + local worker): run e4f3e44c — payload carried `interfacesEnabled: true` (Growth gate via a dev subscription row), all 3 bases reported `interfacePages: {status:'captured'}` against the REAL mcp.airtable.com, run succeeded (8 tables / 50 records). All 3 dev bases have zero interfaces → empty-but-ok captures (0 `bo_at_interfaces` rows, correctly). **Remaining half:** a base WITH interfaces — owner to create one on a dev base, then re-run a backup and see rows + changelog events appear.
- [x] 5.3 Failure drill (2026-07-14): worker restarted with `AIRTABLE_MCP_URL=https://10.255.255.1:444/mcp`; run 016220b2 completed `succeeded` with `interfacePages: {status:'skipped', reason:'transport'}` on all 3 bases (black-hole IP fast-fails at connect → `transport`; the literal `skipped(timeout)` path is unit-pinned in mcp-client tests).
