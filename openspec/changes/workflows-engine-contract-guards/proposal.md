# workflows-engine-contract-guards — Proposal

## Why

The backup task trusts every engine internal-route response blindly. On 2026-07-14, `BACKUP_ENGINE_URL` in `apps/workflows/.env` pointed at `http://localhost:8787` — a port owned that day by a DIFFERENT project's dev server — and the task's `/token` POST got an unrelated 200 response, parsed `accessToken: undefined`, and called Airtable with a garbage bearer. The failure surfaced as `Airtable returned 401 AUTHENTICATION_REQUIRED`, which sent the investigation toward OAuth/token health instead of the actual cause (wrong engine). A misconfigured or hijacked engine URL must fail loudly and name itself.

## What Changes

- A small shared guard in `trigger/tasks/_lib/` (e.g. `expectEngineJson(res, route, validate)`) that every engine internal call in the task helpers passes through: checks `content-type`, parses, and validates the minimal expected shape.
- **`/token`**: `accessToken` must be a non-empty string → otherwise the task fails with `engine_contract_token` (naming the engine URL host, never the token), not a downstream Airtable 401.
- **`/schema-sync`**: `recordsEnabled` boolean + `baseRunId` string on 200.
- **`/attachments/lookup`**: `hits` object when 200.
- `storage-destination` already throws on malformed responses — align its error naming with the new convention.
- Restore-task helpers get the same guards (mirrored lifecycle).

## Capabilities

### New Capabilities

- `engine-contract-guards`: workflows-side response-shape validation on engine internal routes, converting wrong-engine/wrong-URL conditions into explicit `engine_contract_<route>` task failures.

### Modified Capabilities

None — behavior on conforming responses is unchanged.

## Impact

- **App:** `apps/workflows` only — `_lib` helper + call-site edits in `backup-base.ts` / `backup-base.task.ts` / restore equivalents + Vitest coverage.
- **Cross-repo contract:** none; this validates the EXISTING contract, shapes stay owned by the engine routes.
- **Risk:** over-strict validation breaking on additive engine changes → guards check only the fields the task actually reads.
