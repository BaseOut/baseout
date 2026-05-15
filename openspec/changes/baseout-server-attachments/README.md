# baseout-backup-attachments

Replaces the `[N attachments]` placeholder text that the current backup engine writes into CSV exports with real attachment-file downloads from Airtable, deduplicated by composite ID, written to managed R2 (or BYOS once `baseout-backup-byos-destinations` ships), with proxy-streaming support for destinations that require it (Box, Dropbox). Without this change, customers paying for any tier above Trial are losing the attachment half of every "schema + records + attachments" backup the PRD promises.

Cross-app: `apps/server` owns the download / R2 write / dedup table; `apps/web` owns the per-Space `Backup includes attachments` status + the optional opt-out toggle (Pro+).

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).

When tasks are complete, run `/opsx:apply` to drive implementation.
