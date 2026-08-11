# server-media-index — Design

## Decision 1 — Asset/ref split, keyed by the checksum the writer already computes

The attachment writer dedups by content checksum today — that identity becomes `bo_at_assets`' natural key per Space. Refs carry everything record-shaped (ids, per-record filename, attachment id). This makes the UI's "one asset, appears in 3 records" free, sizes/totals honest (dedup counted once), and re-uploads of identical bytes across bases converge. Rejected: one flat table (dedup becomes a GROUP BY guess; filename conflicts get ugly).

## Decision 2 — Ingest mirrors comments-sync, not records-sync

Attachment metadata is discovered during the attachment-export fan-out on the workflows side, on its own cadence and volume profile — a dedicated batched route with per-record `complete` semantics reuses the deletion-safety contract comments established (refs removed only on a confident re-capture of their record; unvisited records untouched on incremental runs). Assets themselves are never deleted by sync — zero-ref assets are flagged for the retention machinery, which owns object deletion (R2) and row cleanup together.

## Decision 3 — Downloads stream through a native R2 binding; destination assets are links

The standing rule ("no R2 creds in `.dev.vars` — Workers don't reach R2") governs **S3-API credentials**; a wrangler `r2_buckets` binding is credential-less and workerd-native. A read-only binding on apps/server streams downloads with zero egress cost and the INTERNAL_TOKEN + space-scoping gate in front. Destination-stored (BYOS) assets return `{kind:'destination', provider, locator}` — the engine never fetches from a customer's Drive/S3 to proxy bytes; the privacy posture ("we don't hold your data") stays honest in the API shape itself. Presigned URLs rejected (would require S3 creds on the Worker — exactly what the rule prevents).

## Decision 4 — Thumbnails: schema now, generation later

`thumbnail_status ('none'|'pending'|'ready') + thumbnail_key` land now so the read API's shape is stable, but generation (image resize at backup time on the Node runner, or on-demand via Cloudflare Images) is a follow-up change with its own cost analysis. The UI's zero-thumbnail state is the launch state.

## Decision 5 — Read API is engine-owned; web proxies

Consistent with the workspaces route: the engine owns per-Space IO; web reaches it over the `BACKUP_ENGINE` service binding and adds auth/middleware. Filters map to indexed columns (content-type class derived at write time into its own column — don't LIKE-match mime strings per query; size; captured stamp; base/table via refs join).

## Open questions

1. Content-type classing (image/video/audio/document/other) — one mapping table at write time; where do Airtable's occasionally-absent mime types land? (`other`, with extension fallback — confirm against real capture data.)
2. Historical backfill: existing backups' attachments predate the index. Options: backfill task walking R2/manifests, or index-from-next-run-forward with a "coverage begins {date}" note in the UI. Recommend forward-only + backfill as an optional follow-up; Dan confirms.
3. Very large Spaces (1M+ refs): pagination is keyset by (captured_at, id); totals query needs the summed-size column indexed — revisit materialization only if measured slow.
