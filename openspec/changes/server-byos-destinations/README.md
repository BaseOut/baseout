# server-byos-destinations

Adds the Bring-Your-Own-Storage (BYOS) destinations defined in [PRD §7.2](../../../shared/Baseout_PRD.md) and [Features §6.6](../../../shared/Baseout_Features.md): Google Drive, Dropbox, Box, OneDrive, Amazon S3, and Frame.io. Today's engine writes every backup to managed Cloudflare R2; the `StoragePicker` UI only enables `r2_managed`. This change ships the OAuth/IAM connect flows, secret persistence, per-provider `StorageWriter` strategy implementations, proxy-streaming for Box and Dropbox, and the UI to pick a destination per Space.

Cross-app: `apps/web` owns the OAuth connect flow + secret persistence in `storage_destinations`; `apps/server` owns the per-provider `StorageWriter` strategies used inside `backup-base.task.ts`. Both share the encrypted-secrets pattern from `@baseout/shared` (AES-256-GCM).

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).

When tasks are complete, run `/opsx:apply` to drive implementation.

## Status note (2026-05-22)

The Google Drive portion is now superseded by [`shared-byos-drive`](../shared-byos-drive/) which ships Drive end-to-end (schema, web OAuth, engine internal credential endpoint, workflows GoogleDriveWriter, UI enablement). The umbrella here still covers Dropbox, Box, OneDrive, S3, Frame.io. R2 re-introduction (Phase 0 of this umbrella) remains paused per [`system-r2-park`](../../specs/) — see also the user-confirmed BYOS-only V1 stance.

When subsequent providers are picked up they follow the same per-provider-change pattern (`shared-byos-dropbox`, `shared-byos-box`, …) rather than landing as one umbrella PR.
