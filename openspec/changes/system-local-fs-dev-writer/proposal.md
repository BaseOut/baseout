## Why

At commit [2e31a55](https://github.com/) the dev backup loop worked end-to-end: clicking "Run backup now" on a Space wrote CSVs to `apps/workflows/.backups/<orgSlug>/<spaceName>/<runStartedAt>/<base>/<table>.csv` via [`apps/workflows/trigger/tasks/_lib/local-fs-write.ts`](../../../apps/workflows/trigger/tasks/_lib/local-fs-write.ts). It was the smoke loop the team used to validate every other change.

The R2 churn that followed broke that loop in two ways:

1. [`52c1315`](../server-byos-destinations/proposal.md) (Phase 0 of `server-byos-destinations`) added a `StorageWriter` abstraction with a typed `StorageDestinationType` union — `r2_managed | google_drive | dropbox` (later widened to add `box` by [`shared-byos-box`](../shared-byos-box/proposal.md) Phase A). The local-fs writer was *not* represented in that union — it remained a side-channel via `BackupBaseDeps.writeCsv?`.
2. [`37fb95a`](../system-r2-park/proposal.md) (Phase 2 of `system-r2-park`) flipped [`apps/server/src/lib/runs/start.ts:141-144`](../../../apps/server/src/lib/runs/start.ts) to refuse enqueueing a backup unless a `storage_destinations` row exists. Combined with the union excluding `local_fs`, dev Spaces with no OAuth-connected destination return `no_storage_destination` and never reach the workflows task.

Filing `system-local-fs-dev-writer` adds `local_fs` as a first-class `StorageDestinationType` so it slots into the same factory Drive / Dropbox / Box use, and auto-provisions a `local_fs` destination row when a Space has none. The result restores the 2e31a55 smoke loop without rebuilding the legacy `writeCsv?` side-channel — and reserves the factory slot Phase W.2 of [`shared-byos-drive-dropbox`](../shared-byos-drive-dropbox/proposal.md) (OUT-10) will eventually call into.

Naming as `system-*` over `shared-*` follows the [`system-r2-park`](../system-r2-park/proposal.md) precedent: this is a structural decision-of-record about storage posture (dev-time local-fs is a permanent slot in the abstraction, not a BYOS provider), filed alongside R2's park and a future R2-revive change.

## What Changes

Phase ordering A → B → C → D → E. Each phase is small; the load-bearing change is D.

- **Phase A — Schema widening.** One migration on the master DB:
  - `apps/web/drizzle/0014_system_local_fs_widen_checks.sql` — `ALTER TABLE baseout.storage_destinations DROP CONSTRAINT storage_destinations_type_check; ADD CONSTRAINT … CHECK (type IN ('r2_managed','google_drive','dropbox','box','local_fs'));`
  - Extend the inline-comment value list on [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) and [apps/server/src/db/schema/storage-destinations.ts](../../../apps/server/src/db/schema/storage-destinations.ts).
  - `oauth_states.provider` is **not** touched — local-fs has no OAuth flow.
- **Phase B — Workflows-side writer.** New `apps/workflows/trigger/tasks/_lib/storage-writers/local-fs.ts` exporting `createLocalFsWriter(opts?: { rootDir?: string }): StorageWriter`. Mechanics ported verbatim from the legacy [`local-fs-write.ts`](../../../apps/workflows/trigger/tasks/_lib/local-fs-write.ts): same `apps/workflows/.backups/` root, same substring-match path-traversal guard. `proxyStreamMode: false`, `init()` no-op, `writeFile(body, path)` returns `{ destinationKey: abs, sizeBytes }`. Add `'local_fs'` to the `StorageDestinationType` union in [`storage-writers/types.ts`](../../../apps/workflows/trigger/tasks/_lib/storage-writers/types.ts) and a `case 'local_fs':` branch to the factory in [`storage-writers/index.ts`](../../../apps/workflows/trigger/tasks/_lib/storage-writers/index.ts). New test `apps/workflows/tests/storage-writers/local-fs.test.ts` mirroring the Drive + Dropbox suites.
- **Phase C — Server-side type-union mirror.** Add `'local_fs'` to `StorageDestinationType` in [apps/server/src/lib/storage/storage-writer.ts](../../../apps/server/src/lib/storage/storage-writer.ts) and a throwing `case 'local_fs':` branch to the factory (mirror of the `google_drive` / `dropbox` / `box` pattern — the workflows runner instantiates; the Worker never does). Add one throw-assertion to `apps/server/tests/integration/storage/storage-writer.test.ts`.
- **Phase D — Unblock kickoff.** Replace the unconditional `no_storage_destination` short-circuit at [apps/server/src/lib/runs/start.ts:141-144](../../../apps/server/src/lib/runs/start.ts) with an idempotent auto-provision: when `fetchStorageDestinationBySpace` returns `null`, call a new `deps.ensureLocalFsDestination(spaceId, userId)` that does `INSERT … ON CONFLICT (space_id) DO NOTHING` against `storage_destinations` with `type = 'local_fs'`, then re-fetches. Add the dep to [start-deps.ts](../../../apps/server/src/lib/runs/start-deps.ts) using the existing Drizzle `onConflictDoNothing` pattern already used in the Dropbox callback. Add an integration test for "Space with no destination → auto-provisions local_fs row → kickoff proceeds."
- **Phase E — Doc + comment touch-ups.** Fix [apps/server/CLAUDE.md](../../../apps/server/CLAUDE.md) "Storage destinations" section: backups land in `apps/workflows/.backups/` (not `apps/server/.backups/`); local-fs flows through `makeStorageWriter({ type: 'local_fs' })`. Add a sibling line to [apps/workflows/README.md](../../../apps/workflows/README.md)'s `_lib/` tree for `storage-writers/local-fs.ts`. Drop the stale `STORAGE_DEV_MODE` reference in `storage-writers/index.ts` comments.

### What this change does NOT do

- **Does not remove the `writeCsv?` seam** in [`backup-base.ts`](../../../apps/workflows/trigger/tasks/backup-base.ts). The orchestrator continues to call `writeCsvToLocalDisk` via the legacy module. Phase W.2 of `shared-byos-drive-dropbox` (OUT-10) owns the seam removal — after that lands, `backup-base.task.ts` will fetch the destination, call `makeStorageWriter()`, and dispatch through the factory. Until then the new `local_fs` writer is a dead-code factory case (verified by tests, unreachable from the runner).
- **Does not delete [`local-fs-write.ts`](../../../apps/workflows/trigger/tasks/_lib/local-fs-write.ts).** Same deferral — Phase W.2 owns it.
- **Does not surface local-fs in the UI.** [`StoragePicker.astro`](../../../apps/web/src/components/backups/StoragePicker.astro), capability resolvers in [capabilities.ts](../../../apps/web/src/lib/billing/capabilities.ts), the MVP allowlist in [persist-policy.ts](../../../apps/web/src/lib/backup-config/persist-policy.ts), and `oauth_states` all stay frozen. `local_fs` is a dev-runner-only destination — invisible to end users.
- **Does not synthesize an env-var gate.** `STORAGE_DEV_MODE` was declared in [`fbdc26e`](../system-r2-park/proposal.md) but never read; `system-r2-park` Phase 2.2.1 removed it. We do not resurrect it — the BYOS user gate is "did you OAuth-connect a provider?"; the local-fs path activates on absence, not on a flag.

## Supersedes

None. Additive structural change that complements [`system-r2-park`](../system-r2-park/proposal.md) (records managed-R2 posture) and unblocks Phase W.2 of [`shared-byos-drive-dropbox`](../shared-byos-drive-dropbox/proposal.md) (reserves the factory slot Phase W.2 will dispatch into).

## Out of Scope

| Deferred to | Item |
|---|---|
| [`shared-byos-drive-dropbox` Phase W.2 (OUT-10)](../shared-byos-drive-dropbox/tasks.md) | Replace `backup-base.ts`'s `writeCsv?` seam with `makeStorageWriter(destination).writeFile()` dispatched from `backup-base.task.ts` after fetching the destination via the engine's internal route. |
| Same | Delete [`apps/workflows/trigger/tasks/_lib/local-fs-write.ts`](../../../apps/workflows/trigger/tasks/_lib/local-fs-write.ts) once nothing references it. |
| Future change — `system-r2-revive` | If managed R2 returns, the factory's `r2_managed` throw flips to a real strategy. Local-fs and R2 coexist as the two "no user OAuth" writers — local for dev, R2 for managed-storage-tier customers. |
| Future change — local-fs path picker | Letting an ops operator override the default `apps/workflows/.backups/` root via env var (`LOCAL_FS_BACKUP_ROOT`) for staging-on-VM smokes. Today the `rootDir` constructor argument exists only for tests. |

## Capabilities

### New capabilities

None. This change adds a destination-type slot to an existing capability surface; the [PRD §7.2](../../../shared/Baseout_PRD.md) destinations table does not gain a customer-facing row.

### Modified capabilities

None directly. The capabilities defined in [`server-byos-destinations`](../server-byos-destinations/proposal.md) (`backup-storage-writer-interface`, `backup-storage-destination-persistence`) are unchanged — `local_fs` is a new instance under the existing writer-interface capability, not a new capability.

## Impact

- **Master DB**: a single ALTER on `storage_destinations.type` CHECK. Generated migration `apps/web/drizzle/0014_system_local_fs_widen_checks.sql`. Stacks on top of [`0013_shared_byos_box_widen_checks.sql`](../../../apps/web/drizzle/0013_shared_byos_box_widen_checks.sql) (which adds `'box'`).
- **Cross-app contract**: the `INTERNAL_TOKEN`-gated engine endpoints between `apps/web` and `apps/server` are unchanged. The wire format on `POST /api/internal/runs/start` is unchanged — auto-provisioning happens server-side, the web caller is unaware.
- **Code blast radius**:
  - New: `apps/workflows/trigger/tasks/_lib/storage-writers/local-fs.ts` + `apps/workflows/tests/storage-writers/local-fs.test.ts`.
  - Edit: `apps/workflows/trigger/tasks/_lib/storage-writers/{types,index}.ts`, `apps/server/src/lib/storage/storage-writer.ts`, `apps/server/src/lib/runs/{start,start-deps}.ts`, `apps/web/src/db/schema/core.ts`, `apps/server/src/db/schema/storage-destinations.ts`, `apps/server/tests/integration/storage/storage-writer.test.ts`, `apps/server/tests/integration/runs-start.test.ts`, `apps/server/CLAUDE.md`, `apps/workflows/README.md`.
  - New migration + snapshot: `apps/web/drizzle/0014_system_local_fs_widen_checks.sql` + regenerated `meta/0014_snapshot.json`.
- **Trigger.dev workflows**: the new writer is wired into `makeStorageWriter` but is dead code until Phase W.2 of `shared-byos-drive-dropbox` consumes it. [`backup-base.ts`](../../../apps/workflows/trigger/tasks/backup-base.ts) and [`local-fs-write.ts`](../../../apps/workflows/trigger/tasks/_lib/local-fs-write.ts) are unchanged.
- **User-facing UX**: zero. `local_fs` does not appear in the StoragePicker. The only observable change is that "Run backup now" on a Space with no OAuth destination now succeeds and writes to disk, where today it returns `no_storage_destination`.

## Reversibility

High. Revival cost is one-line union edits + one file deletion + one SQL drop-recreate.

To revert:

1. Delete `apps/workflows/trigger/tasks/_lib/storage-writers/local-fs.ts` + the matching test file.
2. Remove `'local_fs'` from `StorageDestinationType` in `types.ts` (workflows) and `storage-writer.ts` (server).
3. Remove the `case 'local_fs':` branches from both factories.
4. Restore the unconditional `no_storage_destination` short-circuit in `start.ts` (delete the `ensureLocalFsDestination` call).
5. Generate `0015_drop_local_fs_check.sql` that re-narrows the CHECK constraint.
6. Before applying that migration: `DELETE FROM baseout.storage_destinations WHERE type = 'local_fs';` (dev-only rows; no customer data).

No data migration risk — `local_fs` rows are auto-provisioned in dev and have no corresponding user-visible state.
