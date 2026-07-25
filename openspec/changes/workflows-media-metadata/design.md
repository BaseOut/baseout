# workflows-media-metadata — Design

## Decision 1 — Tap the export path; never re-derive

Checksum, size, type, and the storage locator all exist at the moment the writer finishes an attachment — emission hooks that moment. No second pass, no re-hashing, no reading back from storage. If the writer skipped an attachment (dedup hit), the emission still fires with the existing checksum + the new ref's record context — that's precisely how multi-ref assets accrue.

## Decision 2 — Batch + `complete` semantics copied from comments

Same streaming-batches pattern (every N records / M attachments), same per-record `complete` flag once a record's attachments all processed, same honesty on partial failure. Kept as parallel constants with comments' batcher until a third batched emitter exists (house YAGNI rule — the same discipline the MCP captures followed before views made three).

## Decision 3 — Fire-and-forget with idempotent self-healing

Metadata delivery failing must never cost a backup: bytes are the product, the index is a view. Upserts are idempotent (asset by checksum, ref by attachment id), so any gap heals on the next run that visits the record. `media: captured {assets, refs} | partial | skipped (reason)` in run progress.

## Open questions

1. Batch sizing defaults (proposal: 50 records or 500 attachments, whichever first) — tune against a media-heavy fixture base.
2. Do BYOS writers currently retain the destination path in a form stable enough to be a locator? Verify per provider during implementation; if a provider's paths are unstable, store the provider + best-available reference and note the limitation.
