## Why

Workflows-side counterpart to [`baseout-server-byos-destinations`](../baseout-server-byos-destinations/proposal.md). The server-side change owns the `StorageDestination` master-DB table, the per-provider OAuth flow on apps/web, the credential-encryption + refresh path, and the `loadStorageDestination(spaceId)` helper. This change owns the workflows-side `StorageWriter` interface implementations and the call site in `backup-base.task.ts`.

## What Changes

- Introduce a `StorageWriter` interface in `apps/workflows/trigger/tasks/_lib/storage-writers/`. One implementation per supported destination: `r2-managed.ts`, `google-drive.ts`, `dropbox.ts`, `box.ts`, `onedrive.ts`, `s3.ts`, `frame-io.ts`. Each exposes `init()`, `writeFile(key, body)`, `cleanup()`.
- Add a `makeStorageWriter(destination, env, masterKey)` factory in `apps/workflows/trigger/tasks/_lib/storage-writers/index.ts`.
- Refactor `apps/workflows/trigger/tasks/backup-base.task.ts` to call `loadStorageDestination(spaceId)` (via engine-callback `POST /api/internal/spaces/:id/storage-destination`) → `makeStorageWriter(...)` → `writer.init()` → use across the per-table loop → `writer.cleanup()`.

## Out of Scope

- The `StorageDestination` master-DB table, the apps/web OAuth flows for each provider, the credential-decrypt helper invoked over engine-callback — all server-side.
- BYOS quota accounting, BYOS cleanup, BYOS retention — separate changes per provider.
