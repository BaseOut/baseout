# workflows-r2-writer

Adds the managed-R2 `StorageWriter` to the Trigger.dev Node runner (`apps/workflows`), reviving R2 as a backup destination per the [`system-r2-revive`](../system-r2-revive/proposal.md) decision.

R2 is reached via its **S3-compatible API** (SigV4, `aws4fetch`) — not a Cloudflare Worker binding — because backups run on the Node runner. Once registered in `resolveStorageWriter`, `storageType === 'r2_managed'` writes per-table CSVs to R2 instead of falling through to `LocalFsWriter`. This change delivers **static CSVs → R2** end-to-end on its own; attachments → R2 follow in [`workflows-attachments`](../workflows-attachments/proposal.md) once the shared `writeBlob` interface method lands.

See [proposal.md](./proposal.md), [design.md](./design.md), [tasks.md](./tasks.md).
