# Tasks

## 1. Guard helper — TDD

- [ ] 1.1 RED: tests for `expectEngineJson(res, route, validate)` — non-JSON 200 (HTML), JSON missing required field, valid + extra fields (passes), error naming includes route + host but never body/credential material.
- [ ] 1.2 GREEN: `trigger/tasks/_lib/engine-contract.ts`.

## 2. Call sites

- [ ] 2.1 `/token` in `backup-base.ts` → `engine_contract_token` failure path (structured `failed(...)`, so `/complete` still fires and the run terminalizes with the real cause).
- [ ] 2.2 `/schema-sync` + `/attachments/lookup` in the wrapper helpers; align `storage-destination`'s existing malformed-response errors with the naming convention (no behavior change on conforming responses).
- [ ] 2.3 Restore-task mirror (`restore-base` helpers) — same guards.
- [ ] 2.4 Tests: each call site's contract failure produces its named error and never a downstream provider call.

## 3. Verification

- [ ] 3.1 `pnpm --filter @baseout/workflows test` + typecheck green.
- [ ] 3.2 Dev drill: point `BACKUP_ENGINE_URL` at an unrelated local server, run a backup, confirm the run fails with `engine_contract_token` naming the host (the 2026-07-14 misdiagnosis, now impossible).
