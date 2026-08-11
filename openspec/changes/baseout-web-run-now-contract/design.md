## Context

Web is the orchestrator: it owns the master DB schema for `backup_runs`, owns Stripe-backed capability gating, and owns the customer session. Server is the worker: it pulls work, talks to Airtable, writes to R2, and emits progress. The handoff between them is one HTTP call per run, with progress decoupled into the WebSocket contract (see `baseout-web-websocket-progress-contract`).

The wire shape needs to be small enough to be obviously correct, expressive enough to cover the trigger sources defined in PRD §2.1 (Backup), and stable enough that engine-core can implement once and not need to revisit when web's UI evolves.

## Goals

- Lock a JSON envelope for `POST /api/internal/runs/start`.
- Make the enqueue idempotent on `runId` (web pre-creates the row; server treats duplicates as no-ops).
- Document the `INTERNAL_TOKEN` header convention so server-side rejection is unambiguous.

## Non-Goals

- Live HTTP wiring on web — this is contract-only.
- Restore flow — separate future contract (`baseout-web-restore-now-contract`).
- Webhooks / cron flows — same envelope, different `triggeredBy` values; specified here so all run sources share a contract.
- Authentication of the customer — handled in middleware before the call ever reaches `/api/internal/*`. The internal endpoint trusts that the caller validated the user.

## Decisions

### D1 — Web pre-creates the `backup_runs` row in `queued` status; server transitions it

**Decision:** `apps/web` inserts a `backup_runs` row with `status='queued', triggered_by=...` BEFORE calling the server. Web includes the resulting `runId` in the request body.

**Why:** The `backup_runs` table is web-owned (per master-schema convention). Web has the session context and the connection-id resolution; pre-creating the row keeps the master DB writes inside web's authority. Server's job is to *transition* the row (queued → running → succeeded/failed/trial_complete), not to insert it.

**Trade-off:** Two writes per run instead of one (web INSERT, then server UPDATE). Acceptable — these are small rows and the writes are sequential, not contended.

### D2 — `runId` is the idempotency key

**Decision:** If server receives a `start` call for a `runId` that's already `running` or `succeeded`/`failed`, it returns `200 { ok: true, runId, queuedAt: <existing>, idempotent: true }` instead of re-enqueuing.

**Why:** Defends against retries from web (transient network errors won't double-enqueue) without a dedicated idempotency key. The `runId` (UUID) is unique per intent; server treats it as a logical handle.

### D3 — `triggeredBy` is a closed enum

**Decision:** `triggeredBy: 'manual' | 'scheduled' | 'webhook' | 'trial'`. Matches the values in [`apps/web/src/db/schema/core.ts`](../../../apps/web/src/db/schema/core.ts) `backup_runs.triggered_by` column comment.

**Why:** Closed enum is self-documenting. New trigger sources require a v2 contract. The `trial` value differs operationally (data caps apply per Features §10.x); server uses it to gate trial-only behavior.

### D4 — Response is `202 Accepted`, not `200 OK`

**Decision:** Successful enqueue returns HTTP `202`, not `200`. Body is `{ ok: true, runId, queuedAt }`.

**Why:** `202` semantically signals "received, will process asynchronously". HTTP semantics matter for cache layers (Cloudflare's edge respects `202` differently from `200`).

### D5 — Errors carry `code` field, not just `error` string

**Decision:** Failure body is `{ ok: false, code: '<machine_code>', error: '<human_message>' }`. Codes: `not_authenticated` (401), `forbidden` (403), `invalid_body` (400), `not_yet_implemented` (501), `internal_error` (500).

**Why:** Code is for programmatic handling (web client retries on `internal_error` but not `forbidden`), error is for logging.

### D6 — `connectionId` MUST be supplied even though `spaceId` could derive it

**Decision:** Web sends both `spaceId` AND `connectionId` in the request, even though the server could JOIN to find the connection.

**Why:** Web has the connection-resolution logic already (one Connection can serve multiple Spaces; the user might have selected a non-default Connection). Avoid implicit server-side resolution that could pick the wrong Connection.

### D7 — Heartbeat / liveness is a separate concern

**Decision:** This contract specifies enqueue only. Run progress, completion, and failure are signaled via the WebSocket contract — see `baseout-web-websocket-progress-contract`.

**Why:** Two contracts, two responsibilities. HTTP enqueue is request/response; progress is push.

## Risks / Trade-offs

| # | Risk | Likelihood | Mitigation |
|---|------|------------|------------|
| R1 | Server transitions `running` → `succeeded` but the `complete` WebSocket frame never reaches the client | Medium | DB is the source of truth — clients reconnect and re-read `backup_runs.status`. WebSocket frame is for live progress only. |
| R2 | Web inserts a `queued` row but the server call fails (network) | Medium | Web rolls the row back to a `cancelled` status (or deletes it) on HTTP failure. Recommended in spec. |
| R3 | Server-side worker dies mid-run; row stuck in `running` | Medium | A separate cron sweep (`baseout-server-cron-stuck-runs` — future) reaps rows older than 30 min in `running` and transitions to `failed`. Out of scope here. |
| R4 | Schema drift if `triggered_by` in DB and `triggeredBy` enum here diverge | Low | Server change implementing engine-core MUST cite this spec; web unit test verifies enum membership. |

## Verification

```bash
pnpm --filter @baseout/web typecheck     # 0 errors (Zod parser exists & validates)
pnpm --filter @baseout/web build          # clean
```

End-to-end (operator, dev server):

```
# Happy-path-ish: token valid, body valid → 501 with Spec header
curl -i -X POST https://localhost:4331/api/internal/runs/start \
  -H "x-internal-token: <INTERNAL_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"runId":"r_abc","spaceId":"s_x","connectionId":"c_y","triggeredBy":"manual","isTrial":false}'
# Expect: 501, header `Spec: openspec/changes/baseout-web-run-now-contract`, body { ok: false, code: 'not_yet_implemented', ... }

# No token → 401
curl -i -X POST https://localhost:4331/api/internal/runs/start -H "Content-Type: application/json" -d '{}'
# Expect: 401, body { ok: false, code: 'not_authenticated', ... }

# Bad body → 400
curl -i -X POST https://localhost:4331/api/internal/runs/start \
  -H "x-internal-token: <INTERNAL_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"runId":"r_abc"}'
# Expect: 400, body { ok: false, code: 'invalid_body', error: '<zod issue>', ... }
```
