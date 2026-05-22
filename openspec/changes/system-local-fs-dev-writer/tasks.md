Phase ordering A → B → C → D → E → V. Phases B and C can be parallelized; D depends on A; E is paperwork after the code lands.

Per the local-only-commits workflow, surface each smoke command to the user for human-test approval before committing. Never push, never open a PR.

## Phase A — Schema widening

- [ ] A.1 Confirm `0013_shared_byos_box_widen_checks.sql` is applied locally: `pnpm --filter @baseout/web db:check` exits 0. If pending, apply with `pnpm --filter @baseout/web db:migrate` first.
- [ ] A.2 Edit [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) line ~511 — extend the inline comment listing allowed `storage_destinations.type` values to include `'local_fs'`.
- [ ] A.3 Same file line ~530 — extend the CHECK constraint sql literal to `IN ('r2_managed','google_drive','dropbox','box','local_fs')`. Leave `oauth_states.provider` untouched.
- [ ] A.4 Run `pnpm --filter @baseout/web db:generate` → produces `apps/web/drizzle/0014_system_local_fs_widen_checks.sql` + `meta/0014_snapshot.json` + journal entry.
- [ ] A.5 Hand-review the generated SQL: must contain exactly two ALTER statements against `storage_destinations` (DROP CONSTRAINT + ADD CONSTRAINT). Must NOT touch `oauth_states`.
- [ ] A.6 Apply locally: `pnpm --filter @baseout/web db:migrate`. Confirm `pnpm --filter @baseout/web db:check` still exits 0.
- [ ] A.7 Edit [apps/server/src/db/schema/storage-destinations.ts](../../../apps/server/src/db/schema/storage-destinations.ts) — extend the inline comment listing allowed `type` values to include `'local_fs'`.

## Phase B — Workflows-side writer (TDD)

- [ ] B.1 RED: author [apps/workflows/tests/storage-writers/local-fs.test.ts](../../../apps/workflows/tests/storage-writers/local-fs.test.ts) mirroring [`dropbox.test.ts`](../../../apps/workflows/tests/storage-writers/dropbox.test.ts) shape. Pass `rootDir: tmpdir()`-prefixed unique paths per test. Assertions:
  - `writeFile(string, path)` writes UTF-8 bytes; `destinationKey` is the absolute path; `sizeBytes === Buffer.byteLength(csv, "utf8")`.
  - `writeFile(Uint8Array, path)` writes raw bytes; `sizeBytes === bytes.byteLength`.
  - Nested path triggers `mkdir(..., { recursive: true })` — parent dir created.
  - Path-traversal guard: a `path` containing `..` rejects with `StorageWriteError` of `kind: "bad_request"`; nothing written to disk.
  - `proxyStreamMode === false`.
  - `init()` resolves without touching fs (verify by passing a non-existent `rootDir` and confirming no error).
  - Factory dispatch: `makeStorageWriter({ type: "local_fs" }, { refreshClient: vi.fn() })` returns a writer; `refreshClient` is never invoked after `init()` + `writeFile()`.
  - Regression guard: factory does NOT require `accessToken` or `providerFolderId` for `local_fs`.
  - `afterEach`: remove the temp directory.
- [ ] B.2 GREEN: implement [apps/workflows/trigger/tasks/_lib/storage-writers/local-fs.ts](../../../apps/workflows/trigger/tasks/_lib/storage-writers/local-fs.ts). ~70-90 lines. Public surface: `createLocalFsWriter(opts?: { rootDir?: string }): StorageWriter`. Default `rootDir` resolves to `apps/workflows/.backups/` (note: four `..` segments because this file is nested deeper than the legacy `local-fs-write.ts`).
- [ ] B.3 Edit [apps/workflows/trigger/tasks/_lib/storage-writers/types.ts](../../../apps/workflows/trigger/tasks/_lib/storage-writers/types.ts) line ~22-26 — add `| "local_fs"` to `StorageDestinationType`.
- [ ] B.4 Edit [apps/workflows/trigger/tasks/_lib/storage-writers/index.ts](../../../apps/workflows/trigger/tasks/_lib/storage-writers/index.ts) — import `createLocalFsWriter`; add `case "local_fs": return createLocalFsWriter();` above the `box` case. Drop the stale `STORAGE_DEV_MODE` reference in the surrounding comment.
- [ ] B.5 `pnpm --filter @baseout/workflows test` green. Drive + Dropbox suites still pass.
- [ ] B.6 `pnpm --filter @baseout/workflows typecheck` green.

## Phase C — Server-side type-union mirror

- [ ] C.1 RED: extend `apps/server/tests/integration/storage/storage-writer.test.ts` with `it("throws for 'local_fs' — workflows-only", ...)` mirroring the existing `r2_managed` throw test.
- [ ] C.2 GREEN: edit [apps/server/src/lib/storage/storage-writer.ts](../../../apps/server/src/lib/storage/storage-writer.ts) line ~17-22 — add `| "local_fs"` to `StorageDestinationType`. Add `case "local_fs":` to the factory between `r2_managed` and `google_drive`, throwing `Error("local_fs StorageWriter is workflows-runner-only (Node fs) — the Worker never instantiates one")`.
- [ ] C.3 `pnpm --filter @baseout/server typecheck` green.
- [ ] C.4 `pnpm --filter @baseout/server test storage-writer` green.

## Phase D — Unblock kickoff

- [ ] D.1 RED: add a test fixture to `apps/server/tests/integration/runs-start.test.ts` (or wherever `processRunStart` is exercised): "Space with no destination row → kickoff calls `ensureLocalFsDestination` → re-fetches a `local_fs` row → kickoff proceeds." Also add the inverse regression: "Space with an existing Drive destination → `ensureLocalFsDestination` is NOT called, kickoff uses the existing row."
- [ ] D.2 Add `ensureLocalFsDestination(spaceId: string, userId: string | null): Promise<StorageDestinationRow | null>` to the `ProcessRunStartDeps` interface in [apps/server/src/lib/runs/start.ts](../../../apps/server/src/lib/runs/start.ts) (alongside `fetchStorageDestinationBySpace`).
- [ ] D.3 GREEN: replace the `if (!destination) return { ok: false, error: "no_storage_destination" };` block at line 141-144 of [`start.ts`](../../../apps/server/src/lib/runs/start.ts) with:
  ```ts
  let destination = await deps.fetchStorageDestinationBySpace(run.spaceId);
  if (!destination) {
    destination = await deps.ensureLocalFsDestination(
      run.spaceId,
      run.requestedByUserId ?? null,
    );
  }
  if (!destination) return { ok: false, error: "no_storage_destination" };
  ```
  Update the comment block at lines 137-140 to describe the auto-provision behavior.
- [ ] D.4 Wire the real implementation in [apps/server/src/lib/runs/start-deps.ts](../../../apps/server/src/lib/runs/start-deps.ts): `ensureLocalFsDestination` does `db.insert(storageDestinations).values({...}).onConflictDoNothing(...)` against the `storage_destinations.space_id` unique constraint, then re-fetches via the existing `fetchStorageDestinationBySpace` query. Use `connectedByUserId: userId` and `connectedAt: new Date()`.
- [ ] D.5 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` green.
- [ ] D.6 Smoke at the DB layer (optional but valuable): after applying 0014, attempt `INSERT INTO baseout.storage_destinations (space_id, type) VALUES ('<existing-space-id>', 'local_fs')` directly. Expect success. `DELETE WHERE type = 'local_fs'` to clean up.

## Phase E — Doc + comment touch-ups

- [ ] E.1 Edit [apps/server/CLAUDE.md](../../../apps/server/CLAUDE.md) "Storage destinations" section — backups land in `apps/workflows/.backups/`, NOT `apps/server/.backups/`. Note that local-fs flows through `makeStorageWriter({ type: "local_fs" })` factory case (and, transitionally, the legacy `writeCsv?` seam — both write to the same root).
- [ ] E.2 Edit [apps/workflows/README.md](../../../apps/workflows/README.md) `_lib/` tree — add a line for `storage-writers/local-fs.ts`. Leave the existing `local-fs-write.ts` line; Phase W.2 of `shared-byos-drive-dropbox` owns its deletion.

## Phase V — Verification

End-to-end smoke (the "engine kickoff → CSV on disk" loop that worked at 2e31a55):

- [ ] V.1 Schema state green: `pnpm --filter @baseout/web db:check` exits 0.
- [ ] V.2 Repo-wide typecheck green: `pnpm -r typecheck`.
- [ ] V.3 Repo-wide tests green: `pnpm -r test`.
- [ ] V.4 No stray `console.*` / `debugger` in the diff (per CLAUDE.md §3.5): `git diff --cached -G 'console\.|debugger' --name-only`.
- [ ] V.5 Manual factory smoke (node REPL inside `apps/workflows/`):
  ```js
  const { makeStorageWriter } = await import("./trigger/tasks/_lib/storage-writers/index.ts");
  const w = makeStorageWriter({ type: "local_fs" }, { refreshClient: () => { throw new Error("never") } });
  await w.init();
  const r = await w.writeFile("hello,world\r\n", "smoke/test.csv");
  console.log(r); // { destinationKey: ".../apps/workflows/.backups/smoke/test.csv", sizeBytes: 14 }
  ```
- [ ] V.6 DB constraint smoke (after 0014 applied):
  ```sql
  INSERT INTO baseout.storage_destinations (space_id, type) VALUES ('<existing-space-id>', 'local_fs');
  -- expect: success
  DELETE FROM baseout.storage_destinations WHERE type = 'local_fs';
  ```
- [ ] V.7 **User-facing smoke** — surface to the human-tester:
  - Pick a dev Space with NO connected storage destination (or DELETE any existing row).
  - From `apps/web`, click "Run backup now."
  - Confirm: `apps/server/.../runs/start` returns success (not `no_storage_destination`); a `local_fs` row appears in `storage_destinations`; the Trigger.dev task fires; a CSV tree appears under `apps/workflows/.backups/<orgSlug>/<spaceId>/<runStartedAt>/<base>/<table>.csv`; the `backup_runs` row flips to `succeeded`.
- [ ] V.8 OpenSpec validation: `pnpm openspec validate system-local-fs-dev-writer`.

## Out of scope (deferred)

- [ ] OUT-1 Replace `backup-base.ts`'s `writeCsv?` seam with `makeStorageWriter()` dispatch — owned by Phase W.2 of [`shared-byos-drive-dropbox`](../shared-byos-drive-dropbox/) (its OUT-10).
- [ ] OUT-2 Delete [`apps/workflows/trigger/tasks/_lib/local-fs-write.ts`](../../../apps/workflows/trigger/tasks/_lib/local-fs-write.ts) — same Phase W.2 owns it.
- [ ] OUT-3 `LOCAL_FS_BACKUP_ROOT` env-var override for staging-on-VM smokes. Today the `rootDir` constructor argument is test-only.
