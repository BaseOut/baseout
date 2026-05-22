# Triggering Trigger.dev tasks from the server Worker

Trigger.dev task **definitions** live in `apps/workflows/` and run on Trigger.dev's Node runner — NOT inside this Cloudflare Worker. This Worker only **enqueues** them via `@trigger.dev/sdk`. See `apps/workflows/CLAUDE.md` for how tasks themselves are written.

**MUST use `@trigger.dev/sdk`, NEVER `client.defineJob`**

## Triggering Tasks

### From Backend Code

```ts
import { tasks } from "@trigger.dev/sdk";
import type { processData } from "@baseout/workflows";

// Single trigger
const handle = await tasks.trigger<typeof processData>("process-data", {
  userId: "123",
  data: [{ id: 1 }, { id: 2 }],
});

// Batch trigger (up to 1,000 items, 3MB per payload)
const batchHandle = await tasks.batchTrigger<typeof processData>("process-data", [
  { payload: { userId: "123", data: [{ id: 1 }] } },
  { payload: { userId: "456", data: [{ id: 2 }] } },
]);
```

Use `import type` for task references — the Worker bundle stays SDK-only, the task body stays on the Trigger.dev runner.

### Debounced Triggering

Consolidate multiple triggers into a single execution:

```ts
// Multiple rapid triggers with same key = single execution
await myTask.trigger(
  { userId: "123" },
  {
    debounce: {
      key: "user-123-update",  // Unique key for debounce group
      delay: "5s",              // Wait before executing
    },
  }
);

// Trailing mode: use payload from LAST trigger
await myTask.trigger(
  { data: "latest-value" },
  {
    debounce: {
      key: "trailing-example",
      delay: "10s",
      mode: "trailing",  // Default is "leading" (first payload)
    },
  }
);
```

**Debounce modes:**
- `leading` (default): Uses payload from first trigger, subsequent triggers only reschedule
- `trailing`: Uses payload from most recent trigger

## Key Points

- **Result vs Output**: `triggerAndWait()` returns a `Result` object with `ok`, `output`, `error` properties — NOT the direct task output
- **Type safety**: Use `import type` for task references when triggering
- **Debounce + idempotency**: Idempotency keys take precedence over debounce settings

## NEVER Use (v2 deprecated)

```ts
// BREAKS APPLICATION
client.defineJob({
  id: "job-id",
  run: async (payload, io) => {
    /* ... */
  },
});
```

Use SDK (`@trigger.dev/sdk`), check `result.ok` before accessing `result.output`

## Storage destinations

Managed R2 paused per [`system-r2-park`](../../openspec/changes/system-r2-park/proposal.md); prod write paths are BYOS via the `StorageWriter` interface (see [`server-byos-destinations`](../../openspec/changes/server-byos-destinations/proposal.md)). The Trigger.dev backup-base task writes CSVs to `apps/workflows/.backups/` in dev.

The local-fs path is now a first-class member of the `StorageWriter` abstraction — see [`system-local-fs-dev-writer`](../../openspec/changes/system-local-fs-dev-writer/proposal.md). The engine auto-provisions a `local_fs` `storage_destinations` row when a Space has none (in [`src/lib/runs/start.ts`](src/lib/runs/start.ts) via `ensureLocalFsDestination`), so dev smokes work end-to-end without an OAuth Connect step. The workflows-side writer is in [`apps/workflows/trigger/tasks/_lib/storage-writers/local-fs.ts`](../workflows/trigger/tasks/_lib/storage-writers/local-fs.ts). The legacy [`local-fs-write.ts`](../workflows/trigger/tasks/_lib/local-fs-write.ts) is still in use via `backup-base.ts`'s `writeCsv?` seam — both paths write to the same `apps/workflows/.backups/` root; the seam is retired by Phase W.2 of [`shared-byos-drive-dropbox`](../../openspec/changes/shared-byos-drive-dropbox/proposal.md).
