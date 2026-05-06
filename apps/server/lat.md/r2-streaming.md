# R2 Streaming

Backup output streams directly to R2 (managed) or to a BYOS destination. Buffering a whole base in memory is forbidden — Airtable bases routinely exceed Worker memory limits.

BYOS destinations: Google Drive, Dropbox, Box, OneDrive, S3, Frame.io.

This file documents the rule and the planned helper interface. Phase 1 lands the first streaming writer.

## Why Streaming Only

A single Airtable base can hold tens of gigabytes of records + attachments. Workers and Trigger.dev tasks both have memory ceilings well below that. The patterns we use:

- **Records → JSON Lines (`.jsonl`)** — emit one record per line, write into a `WritableStream` piped to R2.
- **Attachments → individual object writes** — fetch from Airtable's signed URL, stream the response body straight to the destination, never `await response.arrayBuffer()`.
- **Schema + manifest → small JSON** — these are bounded so a single PUT is fine.

Per CLAUDE.md §5.1, no I/O object may be retained across a Worker `fetch`. Streams must complete (or be deliberately cancelled) before the response returns.

## Writer Interface (Planned)

The eventual `apps/server/src/lib/storage/` package exposes one writer per destination behind a common interface. Anticipated shape:

```ts
interface StorageWriter {
  putObject(key: string, body: ReadableStream, contentType: string): Promise<void>
  beginMultipart(key: string): Promise<MultipartUpload>
}
```

Each implementation maps to its destination:

| Destination | Implementation notes |
|---|---|
| R2 (managed) | `env.BACKUPS_R2.put(key, body)` — accepts ReadableStream natively |
| S3 | AWS SDK v3 `Upload` for multipart; direct PUT for small objects |
| Google Drive / Dropbox / Box / OneDrive | Resumable upload sessions; chunked PUTs |
| Frame.io | Their multipart asset endpoint |

## R2 vs BYOS

Managed R2 backs every plan; BYOS unlocks at Pro+ (per [root pricing-tiers](../../../lat.md/pricing-tiers.md)).

The writer used at runtime is selected per-Space from the customer's Storage Destination configuration — the engine doesn't care which it is, only that it implements the writer interface.

## Encryption

Backup files at rest in R2 are encrypted by Cloudflare's server-side encryption (per [root security-model](../../../lat.md/security-model.md)).

BYOS destinations rely on the customer's provider-side encryption — Baseout does not double-encrypt customer files in BYOS. That trade-off is documented in the BYOS Terms.

## Where to Look

Pointers into related rules and the eventual implementation.

- Root security rules (encryption + secrets): [root security-model](../../../lat.md/security-model.md)
- BYOS tier matrix: [root pricing-tiers](../../../lat.md/pricing-tiers.md)
- Backup PRD: [shared/Baseout_PRD.md §7.2](../../../shared/Baseout_PRD.md)
- Implementation: `src/lib/storage/` (planned)
