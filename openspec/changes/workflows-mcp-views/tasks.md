# Tasks

## 0. Sequencing + spike

- [ ] 0.1 `server-mcp-views` contract landed (owns `views` field + `viewCaptureMode` flag).
- [ ] 0.2 Spike: `tools/list` + view tool call against a real Connection; scrubbed fixture + envelope depth (config or id/name/type) in README; scope check (new scope → STOP); 2 MB cap sanity on a view-heavy base; one-handshake-three-calls check.

## 1. Client

- [ ] 1.1 `fetchViews` wrapper on `callMcpTool` per spike envelope; Vitest ok/timeout/auth/invalid-envelope/oversized.
- [ ] 1.2 Extract `_lib/mcp-capture-common.ts` (skip reasons + progress helper); interface/automation wrappers consume it; their tests pass unmodified.

## 2. Task integration

- [ ] 2.1 Thread `viewCaptureMode` through payload types (default `'rest'`-compatible absence handling).
- [ ] 2.2 Capture step concurrent with schema fetch; attach `views` on ok only; progress entry.
- [ ] 2.3 Orchestration tests: mcp-mode happy path; rest-mode untouched; off-mode; isolation from other captures.

## 3. Verification

- [ ] 3.1 `pnpm --filter @baseout/workflows test` + typecheck green.
- [ ] 3.2 Dev E2E with server half: non-enterprise connection backup → `bo_at_views` rows appear (previously empty); enterprise connection unchanged.
