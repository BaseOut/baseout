# Tasks — baseout-web-websocket-progress-contract

Contract-only. ≤ 45 minutes.

## 1 — Spec

- [ ] 1.1 Author [specs/web-websocket-progress-contract/spec.md](./specs/web-websocket-progress-contract/spec.md): subscription URL pattern, token mint endpoint, frame envelope (4 types), reconnect/replay policy, error semantics.

## 2 — Web stub for token mint

- [ ] 2.1 Create [apps/web/src/pages/api/me/run-progress-token.ts](../../../apps/web/src/pages/api/me/run-progress-token.ts):
  - `POST` handler.
  - Returns 401 if `locals.user` is null.
  - Returns 400 if request body lacks `runId` (string).
  - Returns `501` with header `Spec: openspec/changes/baseout-web-websocket-progress-contract` and body `{ ok: false, code: 'not_yet_implemented', spec: '...' }`.

## 3 — Verification

- [ ] 3.1 `pnpm --filter @baseout/web typecheck` — 0 errors.
- [ ] 3.2 `pnpm --filter @baseout/web build` — clean.
- [ ] 3.3 No `console.*` or `debugger` (CLAUDE.md §3.5).

## Out of scope

- Live WSS endpoint on `apps/server` — depends on `baseout-server-durable-objects` and `baseout-server-engine-core`.
- Live token-mint logic — depends on `BASEOUT_WSS_TOKEN_SECRET` provisioning.
- Web `/backups/[runId]/` page that subscribes — future change `baseout-web-backup-run-page`.
- Ack mechanism (`frameId` sequence numbers) — deferred to v2 if frame rate increases.
