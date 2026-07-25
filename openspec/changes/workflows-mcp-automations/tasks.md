# Tasks

## 1. Spike (gates everything)

- [x] 1.1 Against a real Connection OAuth token: `tools/list` on `https://mcp.airtable.com/mcp` — confirm the automations tool exists for our grant; call it for a dev base; record tool name, arg shape, scopes, and a scrubbed response fixture in this change's README. ✅ 2026-07-24 — `list_automations` + `get_automation` advertised (41 tools, up from 30 on Jul 14) and ACCEPTED with the standard grant; empty-envelope fixture + V1 list-only decision in [README.md](README.md). Per-entry shape unverified until 1.2.
- [ ] 1.2 Create at least one automation on a dev base (test/demo workspace — action-plan §4) so a populated fixture and the E2E have non-empty content. **Owner action — blocks 5.2 only.**

## 2. MCP client generalization

- [x] 2.1 Extract `callMcpTool` core from `fetchInterfacePages` in `trigger/tasks/_lib/mcp-client.ts`; re-implement `fetchInterfacePages` on top of it — its existing 15 tests stay green UNCHANGED. ✅ 2026-07-24 (15/15 unmodified).
- [x] 2.2 `fetchAutomations({ baseId, accessToken, endpoint, timeoutMs })` with envelope validation (`automations[]`); typed `{ ok, raw, capturedAt } | { ok:false, reason }`. ✅
- [x] 2.3 Vitest (node, injected `fetchImpl`): `tests/mcp-client-automations.test.ts` — 10 tests: happy JSON + SSE + text-fallback + empty envelope; auth/http_5xx/invalid_envelope/rpc_error/transport/payload_too_large. ✅

## 3. Task integration

- [x] 3.1 Thread `automationsEnabled` through `BackupBaseTaskPayload` + `BackupBaseInput` (default false; engine stamps it — server change task 3.3). ✅
- [x] 3.2 `backup-base.ts`: capture concurrent with schema fetch (step 2c, twin of 2b); attach `automations` to schema-sync body (4th `syncSchema` arg) only on `ok`; `skipped(reason)` in run progress otherwise; 401 emits the connection-scope notice; outcome forwarded additively on the completion POST. ✅
- [x] 3.3 Orchestration tests (`tests/backup-base-automation-capture.test.ts`, 10 tests): success rides schema-sync; every failure mode leaves run outcome untouched; below-tier/flag-absent/no-sync make zero MCP requests; interface capture unaffected (both directions); both-captures-succeed; schema-only runs still capture. ✅

## 4. Contract + docs

- [x] 4.1 Cross-check the `automations` field shape against `server-mcp-automations` (single source: that change's `automations-sync.ts`); land server-first. ✅ `{ capturedAt, raw }` matches `parseAutomationsField`; **server dev-deploy deferred** (in-flight tree — see server change task 4.1).
- [x] 4.2 README updated with spike findings + V1 list-only capture decision. ✅

## 5. Verification

- [x] 5.1 `pnpm --filter @baseout/workflows test` + typecheck green. ✅ 2026-07-24 — 297 tests (20 new) + `tsc --noEmit` clean.
- [ ] 5.2 Dev E2E: backup run against the dev base from 1.2 shows `automations: {status:'captured'}`, and the paired server change's rows/changelog events appear. **Blocked on 1.2 (seeded automation) + server dev deploy.**
- [ ] 5.3 Failure drill: black-hole `AIRTABLE_MCP_URL` → run succeeds with `automations: skipped`, records/attachments unaffected. (Unit-pinned already; deployed drill rides 5.2's setup.)
