# workflows-attachment-upload-status

Makes the attachment downloader stamp each recorded attachment with its source **filename** and the correct **`upload_status`** for the active storage destination — `ready` for `local_fs` staging, `uploaded` for managed R2 / BYOS — so the `attachment_dedup` table reflects the ready/uploaded model agreed in the **Jun 10, 2026 Dan / Autumn Sync** end-to-end.

Workflows-side scope only: the downloader module + the `backup-base` task wiring. The schema columns and the `/lookup` + `/record` endpoint shapes are owned by the paired [`server-attachment-upload-status`](../server-attachment-upload-status/README.md) change, which must ship first.

See [proposal.md](./proposal.md) and [tasks.md](./tasks.md).

When tasks are complete, run `/opsx:apply` to drive implementation.
