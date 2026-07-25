# workflows-media-metadata — Proposal

## Why

[`server-media-index`](../server-media-index/proposal.md) gives the engine an asset index, but only the backup task knows what it exported: it already walks every attachment, computes the dedup checksum, and writes bytes to R2 or a BYOS destination. This change makes the task **report what it already knows** — attachment metadata batches to the engine's media-sync route — so the index fills as backups run. No new capture work; this is emission of in-hand facts.

## What Changes

- The `backup-base` task's attachment-export path **emits metadata per attachment** as it processes: checksum, content type, size, storage locator (R2 key or destination provider+path), Airtable attachment id, base/table/record/field ids, per-record filename.
- **Batched delivery during the fan-out** to `POST /api/internal/spaces/media-sync` (shape owned by the server change), with per-record `complete: true` only when that record's attachments all processed — the same deletion-safety contract as comments.
- **Failure isolation:** media-sync delivery is best-effort — transport failures mark `media: skipped|partial (reason)` in run progress and NEVER fail the run or the attachment export itself (bytes land regardless; the index self-heals next run since upserts are idempotent by checksum/attachment id).
- **Incremental awareness:** only records visited by the run report attachment metadata; the server's per-record rule keeps unvisited records safe.
- No new tier flag — emission follows whatever attachment export already does for the Space; the *library* tier gate is a read-side concern (server change blocker 0.1).

## Capabilities

### New Capabilities

- `media-metadata-capture`: per-backup emission of attachment metadata (identity, size/type, storage locator, provenance) to the engine's media index, batched, failure-isolated, incremental-safe.

### Modified Capabilities

None — attachment export behavior (dedup, writers, budgets) is unchanged; this taps its outputs.

## Impact

- **App:** `apps/workflows` only — attachment-export path emission + batch poster + tests (plain Vitest, injected `fetchImpl`).
- **Cross-repo contract:** consumes media-sync — owned by [`server-media-index`](../server-media-index/proposal.md); land server-first.
- **No new secrets/scopes.** No change to storage writers.
- **Risk:** attachment-heavy runs produce large metadata volumes — batch sizing (every N records / M attachments) mirrors comments; the run-progress `media` entry keeps partial delivery honest.
