# Design

## Inherited contracts

This change adds one strategy to the abstraction already locked in by [`shared-byos-drive-dropbox`](../shared-byos-drive-dropbox/design.md). The load-bearing contracts inherited verbatim:

- **`StorageWriter` interface** ([`apps/workflows/trigger/tasks/_lib/storage-writers/types.ts`](../../../apps/workflows/trigger/tasks/_lib/storage-writers/types.ts) lines 101-138): `init()`, `writeFile(body, path, mimeType?)`, optional `cleanup()`, optional `proxyStreamMode` flag.
- **Error taxonomy** (`StorageWriteError.kind`): `auth_failed | rate_limited | transient | bad_request | not_found | unknown`.
- **Buffered input** (`body: Uint8Array | string`): CSVs are already buffered by `pageToCsv`. The streaming-CSV refactor is OUT-10 of `shared-byos-drive-dropbox`.
- **Factory shape** (`makeStorageWriter(destination, { refreshClient, fetchImpl? })`): one factory dispatches by `destination.type`. Each strategy is a factory function returning a `StorageWriter`.
- **No `getDownloadUrl` / `delete`** on the workflows-side interface — those exist on the server-side mirror in [`apps/server/src/lib/storage/storage-writer.ts`](../../../apps/server/src/lib/storage/storage-writer.ts) but are unused today.

## What this change adds

### `createLocalFsWriter(opts?: { rootDir?: string }): StorageWriter`

Public surface, exported from `apps/workflows/trigger/tasks/_lib/storage-writers/local-fs.ts`:

- **`rootDir` default**: `resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.backups")`. This file is nested one level deeper than the legacy [`local-fs-write.ts`](../../../apps/workflows/trigger/tasks/_lib/local-fs-write.ts) (`storage-writers/local-fs.ts` vs `local-fs-write.ts` directly under `_lib/`), so the `..` count is four, not three. Resolves to `apps/workflows/.backups` — same root as the legacy module so both write paths share a tree.
- **`proxyStreamMode: false`** — local writes don't proxy.
- **`init()`** — no-op resolved promise. No fs touch (verified by test).
- **`writeFile(body, path, _mimeType?)`**:
  - Path-traversal guard preserves the legacy substring check verbatim: `if (path.includes("..")) throw new StorageWriteError("bad_request", "invalid_path")`. This is intentionally over-strict (rejects benign filenames like `foo..bar`); relaxing it is a separate decision.
  - `body: Uint8Array | string → Uint8Array` via an inline `toBytes()` helper (same pattern as [`dropbox.ts`](../../../apps/workflows/trigger/tasks/_lib/storage-writers/dropbox.ts) — `typeof body === "string" ? new TextEncoder().encode(body) : body`).
  - `mkdir(dirname(abs), { recursive: true })` then `writeFile(abs, bytes)` via `node:fs/promises`.
  - Returns `{ destinationKey: abs, sizeBytes: bytes.byteLength }`.
- **No `cleanup`** — the legacy module had none, and there's no temp state to flush.
- **No `RefreshClient`** — local-fs has no credentials. The factory passes `refreshClient` through but it's never invoked (verified by test).

### `destinationKey` policy

Drive returns Drive file IDs. Dropbox returns Dropbox file IDs (`id:…`). Box returns numeric strings. Local-fs returns absolute filesystem paths.

Today no downstream consumer treats `destinationKey` as a URL or API resource ID — it is opaque to the engine completion handler. Worth flagging here so Phase W.2 of `shared-byos-drive-dropbox` (the consumer of these writers) doesn't accidentally string-format `destinationKey` into a customer-facing URL.

### Auto-provisioning policy (Phase D)

When `apps/server/src/lib/runs/start.ts` calls `fetchStorageDestinationBySpace(spaceId)` and gets `null`, the engine calls `deps.ensureLocalFsDestination(spaceId, userId)` which does:

```ts
await db
  .insert(storageDestinations)
  .values({
    spaceId,
    type: "local_fs",
    connectedByUserId: userId,
    connectedAt: new Date(),
  })
  .onConflictDoNothing({ target: storageDestinations.spaceId });

return db.query.storageDestinations.findFirst({
  where: eq(storageDestinations.spaceId, spaceId),
});
```

Two correctness properties:

1. **Idempotent under concurrent kickoffs.** The `storage_destinations.space_id` `unique` constraint (added in `shared-byos-drive-dropbox` Phase A) is the race-condition guard — concurrent inserts both attempt; one wins via the unique constraint; the other no-ops via `onConflictDoNothing`; both re-fetch the same row.
2. **Does not stomp on user OAuth.** If a user OAuth-connects a Drive/Dropbox/Box destination *after* a `local_fs` row exists, the connect-callback's `UPSERT` writes against the same unique-on-`space_id` row and overwrites it. If the user has *already* connected a Drive/Dropbox/Box destination, the auto-provision path is not reached (the initial `fetchStorageDestinationBySpace` returns the existing row).

There is no env-var gate (no resurrected `STORAGE_DEV_MODE`). The behavior is: "if a Space has no destination, give it `local_fs`." In production this is fine because:

- Production Spaces complete the OAuth Connect flow before their first backup (Stripe webhook or onboarding flow). They never hit the auto-provision path.
- If a production Space *did* somehow trigger a backup without a destination, getting CSVs on the Trigger.dev runner's local disk (which gets recycled per run) is a better failure mode than silently dropping the backup — the operator notices "where did my backup go?" via the run-history widget pointing at `local_fs` and reconnects.

### Why the server factory throws

Mirrors the pattern Drive/Dropbox/Box had before their workflows implementations landed: the server-side `makeStorageWriter` factory case for `'local_fs'` throws `Error("local_fs StorageWriter is workflows-runner-only (Node fs) — the Worker never instantiates one")`.

Two reasons:

1. **Workerd cannot reach `node:fs`.** A Cloudflare Worker has no local filesystem. Any code path that ends up calling `createLocalFsWriter` from inside the Worker is a bug; the throw catches it loudly at instantiation rather than silently failing on first `writeFile`.
2. **Type-union honesty.** The server-side `StorageDestinationType` union must accept whatever the database CHECK constraint accepts, otherwise queries like `SELECT type FROM storage_destinations WHERE space_id = $1` would have a mismatched return type. Adding `'local_fs'` to the union without a factory case would force TypeScript exhaustiveness errors at every consumer of the union; adding it *with* a throwing factory case keeps the union honest while flagging the unreachable code path.

### Migration sequencing

Lands as `0014_system_local_fs_widen_checks.sql`, stacks on top of `0013_shared_byos_box_widen_checks.sql` (which widens to add `'box'`). The two are independent — `0013` is filed under [`shared-byos-box`](../shared-byos-box/) and may archive before or after this change.

If `0013` is applied first (the common case), this change generates `0014` that drops the same constraint and re-adds it with `'local_fs'` appended.

If `0014` somehow lands before `0013` (e.g. `shared-byos-box` stalls), `drizzle-kit` will sequence them in journal order on the next migrate. The risk is that the CHECK constraint between migrations briefly lacks `'box'` — irrelevant in dev because no one is inserting box rows pre-Box-OAuth-Connect. In production, the order is controlled by deploy sequence (`shared-byos-box` ships → migrate → `system-local-fs-dev-writer` ships → migrate).

The `oauth_states.provider` CHECK constraint is **not** touched. Local-fs has no OAuth flow — adding it to that CHECK would be a semantic error.

### Why `system-*` not `shared-*`

CLAUDE.md §3.6 distinguishes:

- `shared-*` — code change touching ≥2 apps as a unit (e.g. service-binding wiring across web + server).
- `system-*` — structural / repo-shape / tooling / decision-of-record. "Rarely touches runtime code at all."

This change touches code in three apps (`apps/web` schema CHECK + comment, `apps/server` type union + factory + start.ts, `apps/workflows` writer + factory + tests). By the literal rule, that's `shared-*` territory.

We file as `system-*` for two reasons:

1. **Precedent.** [`system-r2-park`](../system-r2-park/proposal.md) touched runtime code in `apps/web` (persist-policy, StoragePicker, schema), `apps/server` (storage-writer, runs/start, env), and `apps/workflows` (none, by accident). It was filed as `system-*` because the *load-bearing change* was a decision-of-record about storage posture, not a feature. Same shape here: the load-bearing change is "local-fs is a permanent first-class slot in the storage abstraction, not a side-channel."

2. **The user explicitly named it `system-local-fs-dev-writer`.** When the user picks a name in this gray zone, honor it. The future revive change [`system-r2-revive`](../system-r2-park/proposal.md) (anticipated) sits in the same `system-*` posture, and the three together form a coherent set of decisions about V1 storage paths.

## Reversal cost

One-line union edits + delete one file + one SQL drop-recreate. See [proposal.md §Reversibility](./proposal.md#reversibility).

The only piece that *cannot* be cleanly reverted is auto-provisioning: if dev Spaces have accumulated `local_fs` rows over weeks of use and you DELETE them, the next "Run backup now" on those Spaces gets the new behavior (whatever Phase D becomes post-revert). This is fine — `local_fs` rows in dev are stateless; deletion is safe.
