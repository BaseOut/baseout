# server-attachment-upload-status

Extends the `attachment_dedup` table (shipped by [`server-attachments`](../server-attachments/README.md)) so each row records whether its bytes are merely **staged** (`upload_status='ready'`) or already at the real destination (`upload_status='uploaded'`), plus the source **filename** and an `uploaded_at` timestamp. This is the explicit upload-status model agreed in the **Jun 10, 2026 Dan / Autumn Sync** — "track the upload status of each file… 'ready' versus 'uploaded' — to prevent processing the same file multiple times."

Server-side scope only: the canonical master-DB migration + `core.ts` edit (apps/web owns master schema), the engine schema mirror, and the `/api/internal/attachments/{lookup,record}` endpoint extensions. The consumer-side wiring (downloader stamps the status) is the paired [`workflows-attachment-upload-status`](../workflows-attachment-upload-status/README.md) change.

See [proposal.md](./proposal.md), [design.md](./design.md), and [tasks.md](./tasks.md).

When tasks are complete, run `/opsx:apply` to drive implementation.
