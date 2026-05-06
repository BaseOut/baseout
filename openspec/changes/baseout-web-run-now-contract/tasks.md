# Tasks — baseout-web-run-now-contract

Contract-only. ≤ 60 minutes.

## 1 — Spec (the deliverable for the server agent)

- [ ] 1.1 Author [specs/web-run-now-contract/spec.md](./specs/web-run-now-contract/spec.md) covering request body, response body (202 + 4xx/5xx), required headers, idempotency, and the web-pre-creates-row rule (D1).

## 2 — Web stub

- [ ] 2.1 Create [apps/web/src/lib/server-client.ts](../../../apps/web/src/lib/server-client.ts):
  - Exports `EnqueueRunRequest`, `EnqueueRunResponse`, `EnqueueRunErrorCode` types.
  - Exports a Zod schema for the request body (`enqueueRunRequestSchema`).
  - Exports `enqueueRun(payload): Promise<EnqueueRunResponse>` that throws `NotImplementedError` until `baseout-server-engine-core` lands.
- [ ] 2.2 Create [apps/web/src/pages/api/internal/runs/start.ts](../../../apps/web/src/pages/api/internal/runs/start.ts):
  - `POST` handler.
  - Validates `x-internal-token` header against `env.INTERNAL_TOKEN` using constant-time comparison (mirrors the server middleware).
  - Validates request body via Zod schema from `server-client.ts`.
  - Returns `501` with header `Spec: openspec/changes/baseout-web-run-now-contract` and body `{ ok: false, code: 'not_yet_implemented', error: '...' }`.
  - Returns `401` (no token) / `403` (bad token) / `400` (bad body) per spec.

## 3 — Verification

- [ ] 3.1 `pnpm --filter @baseout/web typecheck` — 0 errors.
- [ ] 3.2 `pnpm --filter @baseout/web build` — clean.
- [ ] 3.3 No `console.*` or `debugger` (CLAUDE.md §3.5).
- [ ] 3.4 Manual `curl` checks per design.md "Verification" section.

## Out of scope

- Live HTTP wiring to `apps/server` — depends on `baseout-server-engine-core` landing first. Future change: `baseout-web-run-now`.
- Retry / circuit-breaker logic in `enqueueRun` — added when the live caller exists.
- `backup_runs` row lifecycle (queued → running → done) — split between this contract (web's queued INSERT pre-condition is documented) and `baseout-server-engine-core` (server's transitions).
- WebSocket progress — separate contract.
