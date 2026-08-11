# Design: `apps/workflows/` boundary

## Context

`server` (renamed from `server`) is a Cloudflare Worker: workerd runtime, ≈30s wall clock per request, no `process.env`, postgres-js bound to per-request lifetimes. Backup execution exceeds those budgets (a single base can take minutes; a whole Org can take hours). The original plan ran backups on Trigger.dev v3 from inside the same workspace package as the Worker, with the Trigger.dev task files under `apps/server/trigger/`.

Co-locating worked while there was only one task (`backup-base`). Once additional long-running workloads landed in the backlog (cleanup cron, trial-email cron, attachment downloads, BYOS writers, dynamic DB provisioning, incremental backup, credit-balance alerts), the cost showed:

- **Two runtimes, one tree.** Reviewers couldn't tell which file ran in workerd vs Node. `import { mkdir } from "node:fs/promises"` next to `import { DurableObject } from "cloudflare:workers"` is confusing and easy to bundle wrong.
- **Bundled dependencies.** `papaparse` is a task-side CSV serializer. With the task in `apps/server/`, it shipped in the Worker bundle even though the Worker never called it.
- **Confused tests.** The Trigger.dev tests imported from `@cloudflare/vitest-pool-workers` because the surrounding suite did, even though the code under test ran on Node.
- **OpenSpec confusion.** Every in-flight change that added a Trigger.dev task piggybacked on the data-plane parent, so the parent grew un-archivable.

## Decision

Extract `apps/workflows/` as a sibling workspace package. The Cloudflare Worker stays in `apps/server/`. The Trigger.dev task project moves out. Both apps deploy independently, to different platforms, on different schedules.

## What lives where

| Concern                                 | apps/server (Worker)                   | apps/workflows (Trigger.dev runner) |
| --------------------------------------- | -------------------------------------- | ----------------------------------- |
| HTTP entry points (`/api/health`, `/api/internal/*`) | yes                          | no                                  |
| Durable Objects (ConnectionDO, SpaceDO) | yes                                    | no                                  |
| Cron handlers that fit in Worker wall clock (OAuth refresh) | yes                | no                                  |
| Trigger.dev task definitions            | no                                     | yes                                 |
| Per-base backup orchestration (`runBackupBase`) | no                             | yes (pure module + task wrapper)    |
| CSV serialization, Airtable HTTP, BYOS writes | no                               | yes (`_lib/` helpers)               |
| Master DB schema mirrors                | yes (per-request postgres-js)          | no (tasks call back to `/api/internal/*` for state changes) |
| `@trigger.dev/sdk` `tasks.trigger()` enqueue | yes (`src/lib/trigger-client.ts`) | no (tasks don't enqueue themselves at the boundary; intra-task `triggerAndWait` allowed inside workflows) |
| Test runner                             | `@cloudflare/vitest-pool-workers`      | plain Vitest, `environment: "node"` |

## Why pure orchestration + thin task wrapper

Every task in `apps/workflows/` follows the same two-file pattern:

- `<task-name>.ts` — pure async function. Takes a typed input + a typed `deps` object (engine URL, internal token, `fetch` impl, `sleep` impl, optional client stubs). No side effects beyond `deps`. Unit-testable without the Trigger.dev SDK.
- `<task-name>.task.ts` — Trigger.dev wrapper. Defined with `task({ id, maxDuration, run })`. Reads `process.env` for engine URL + token, instantiates real `fetch` + clients, calls the pure function. Wraps the body in try/catch so an unexpected throw still POSTs `/complete` with `status='failed'`.

The pure module is what `tests/` exercises. The wrapper is what Trigger.dev discovers via `trigger.config.ts` `dirs: ["./trigger"]`.

## Why type-only re-exports from `index.ts`

`apps/workflows/trigger/tasks/index.ts` re-exports task references as `export type`. The Worker's `trigger-client.ts` imports them with `import type { backupBaseTask } from "@baseout/workflows"` and calls `tasks.trigger<typeof backupBaseTask>("backup-base", payload)`. The SDK only needs the task ID string at runtime; the type is purely for the payload generic. This keeps the Worker bundle SDK-only.

If a future task needs the wire payload shape mirrored on the Worker side, declare the interface separately on the Worker (as `lib/runs/start.ts` already does for `BackupBaseTaskPayload`). Importing the task body itself would pull `@trigger.dev/sdk` runtime + `papaparse` into the Worker bundle, which defeats the split.

## Engine-callback contract

Tasks post back to the Worker at two well-known internal endpoints:

- `POST /api/internal/runs/:runId/progress` — per-table progress event (`triggerRunId`, `atBaseId`, `recordsAppended`, `tableCompleted`). Fire-and-forget; transport errors swallowed. The route is idempotent: it bumps counters atomically against the run row and tolerates missing rows.
- `POST /api/internal/runs/:runId/complete` — final result (`triggerRunId`, `atBaseId`, `status`, counts, optional `errorMessage`). Same fire-and-forget posture. The route is idempotent: a duplicate complete against a terminal row no-ops. The ConnectionDO lock alarm + Phase 11 reconciliation (TBD) are the safety nets if the call is lost.

Both routes are gated by `x-internal-token: $INTERNAL_TOKEN`, byte-equal between the Worker and the Trigger.dev env-vars UI.

## Why one openspec change per app boundary instead of merging into the parent

The data-plane parent (`server`, renamed from `server`) describes capabilities visible at the system boundary: a backup run starts, progresses, completes, persists output, emits notifications. *Where* each step executes is an implementation detail of the data plane — but the implementation boundary is durable enough that it deserves its own change to anchor cross-cutting workflows-only requirements (Node runtime, env-var sourcing, task-vs-Worker bundle separation, type-only re-export pattern, fire-and-forget callback posture).

Sibling `workflows-<topic>` changes are paired with `server-<topic>` changes for each in-flight workload. The pairing makes review-by-runtime tractable: workflows reviewers focus on the task body + pure module; server reviewers focus on the orchestration entry points + DO state machine + master-DB writes.

## Open questions

- **When to extract `_lib/` to a shared package?** Once a second consumer needs the Airtable client or CSV serializer (e.g. an On2Air migration script that lives outside the Trigger.dev runtime), move to `packages/airtable/` and `packages/csv/`. Premature today.
- **Local FS writer post-R2-removal.** `local-fs-write.ts` is a stand-in for R2 / BYOS until storage destinations land. The `BACKUP_ROOT` anchor under `apps/workflows/.backups/` is local-dev only; production deploys will swap to the real `StorageWriter` per `storage-destinations` spec.
- **Test parity with workerd.** Workflows tests run on Node, but the Worker side proxies HTTP between tasks and the DO. A future end-to-end suite that boots both apps + a fake Airtable + a real Postgres would catch wire-shape drift — currently only the unit tests on each side enforce it.
