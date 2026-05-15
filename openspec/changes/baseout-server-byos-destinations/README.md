# baseout-backup-byos-destinations

Adds the Bring-Your-Own-Storage (BYOS) destinations defined in [PRD §7.2](../../../shared/Baseout_PRD.md) and [Features §6.6](../../../shared/Baseout_Features.md): Google Drive, Dropbox, Box, OneDrive, Amazon S3, and Frame.io. Today's engine writes every backup to managed Cloudflare R2; the `StoragePicker` UI only enables `r2_managed`. This change ships the OAuth/IAM connect flows, secret persistence, per-provider `StorageWriter` strategy implementations, proxy-streaming for Box and Dropbox, and the UI to pick a destination per Space.

Cross-app: `apps/web` owns the OAuth connect flow + secret persistence in `storage_destinations`; `apps/server` owns the per-provider `StorageWriter` strategies used inside `backup-base.task.ts`. Both share the encrypted-secrets pattern from `@baseout/shared` (AES-256-GCM).

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).

When tasks are complete, run `/opsx:apply` to drive implementation.
