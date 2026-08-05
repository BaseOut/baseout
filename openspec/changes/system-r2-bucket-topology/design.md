# system-r2-bucket-topology — design

## Context

Implements decision **D16** ([`shared-entitlements/design.md`](../shared-entitlements/design.md)) plus the coupled document-body relocation (pricing §3.2, `shared-entitlements` D5). The R2 write path already runs on Trigger.dev's Node runner via the S3-compatible API signed with `aws4fetch` (`system-r2-revive` Decision 2; `apps/workflows/trigger/tasks/_lib/storage-writers/r2.ts`). What changes is *which bucket* a write targets and *how the read path authenticates*.

## Decisions

### T1 — Bucket name derives from the immutable org ID, resolved once and stored
`baseout-{env}-org-{organizationId}`. The org **ID** (not the renamable slug) is the identity so a rename never orphans a bucket. The resolved name is written to the org's managed storage-destination row on first provision; every subsequent write/read/delete reads the name from that row rather than re-deriving — one source of truth, and it survives any future naming-scheme change.

### T2 — Lazy, idempotent, concurrency-safe provisioning
Buckets are created on **first managed-R2 write**, not at signup. Creation must tolerate races (two bases in the same Space backing up concurrently on the org's first run): treat "bucket already exists" as success, and gate the storage-destination-row write so exactly one row records the name. `CreateBucket` + apply the lifecycle template; both idempotent. Signup never touches R2, so it can never fail on storage.

### T3 — `buildR2Key` branches on destination kind, not on a flag
Managed R2 → Space-rooted key (`{SpaceName}/{BaseName}/{DateTime}/{TableName}.csv`); BYOS → org-rooted key (unchanged, so the customer sees a single Baseout folder in their own Drive/S3). The function already receives the destination context; the branch is on `destinationType === 'r2_managed'`. Path-traversal guard and segment sanitization (`:`→`-`, `/`→`_`) are unchanged.

### T4 — Read path uses the writer's credentials, bucket from the org row
The credential-less `BACKUPS_R2` binding is retired for per-account addressing. The media download route resolves `{ bucket, accountId, accessKeyId, secretAccessKey }` (bucket from the org storage-destination row; creds the same account-scoped R2 S3 keys the writer already uses) and issues a signed `GetObject`. This is the "accepted cost" D16 names; the runbook's credential rules extend to the server read path (CLAUDE.md §3.7).

### T5 — Document body becomes an R2 object; the DB row keeps a pointer
`bo_at_documents` keeps its metadata row but the `body` content moves to an R2 object (key under the document's Space, e.g. `{SpaceName}/documents/{documentId}.json`). The row carries the object key (and optionally a byte count for cheap meter reads). Read/write of a document body goes through R2 in the document CRUD routes.

**Migration invariant:** this is **not** additive — `pg-ddl-upgrade.ts`'s "additive-only" guarantee (`CREATE TABLE/INDEX IF NOT EXISTS`) does not cover a column role change or drop. So this needs: a real backfill step (copy existing in-DB bodies to R2 before the column is dropped/repurposed), a hand-authored non-additive step in `pg-ddl-upgrade.ts`, a `SPACE_SCHEMA_VERSION` bump, and the four guard tests updated (`space-schema-parity`, `space-pg-ddl-parity`, `pg-ddl-upgrade`, `webhook-deltas`). Authored in **both** `pg.ts` and `sqlite.ts` per the parity test. Sequence the backfill before the column change so no body is lost.

### T6 — Churn deletion empties then deletes the bucket
The account-deletion / churn-grace-expiry path (triggered by `shared-entitlements`' churn lifecycle) lists + batch-deletes all objects (reuse `R2Writer.deletePrefix`'s ListObjectsV2 + batched DeleteObjects), then `DeleteBucket`. Idempotent: a missing bucket is success.

## Risks / edge cases

- **[Bucket-name collision / length]** org IDs are UUIDs → `baseout-prod-org-<uuid>` is ~45 chars, within the 63-char limit; no collision risk with immutable IDs.
- **[First-write race double-provisions]** mitigated by treat-exists-as-success + a single-writer gate on the storage-destination row (T2).
- **[Lifecycle-template drift]** a sweep re-applies the current template to existing buckets; new buckets get it at creation (T2).
- **[Doc-body backfill loss]** the backfill (T5) must complete and be verified per Space before the column is repurposed; gate the schema step on backfill completion.
- **[Read path now needs creds]** previously the media route was binding-only; it now carries the same secret set as the writer — the runbook + `.dev.vars`/env guidance must say so (CLAUDE.md §3.7), and least-privilege token scoping still applies.

## Migration Plan

1. `buildR2Key` branch + writer bucket resolution (T3) behind the per-account path; managed writes target the org bucket, BYOS unchanged.
2. Lazy provisioning + storage-destination-row bucket-name recording (T1/T2).
3. Media read path to the S3 API (T4); retire the `BACKUPS_R2` binding once the route is cut over.
4. Document-body relocation: backfill → per-Space schema change → route cutover (T5). Highest-risk step; land last, gated on backfill verification.
5. Churn deletion wiring (T6).
6. Runbook + CLAUDE.md §3.7 updates in the same change (T4).
7. Rollback: steps 1–3 are per-write/per-read branches (flip back to shared bucket + binding); step 4 is the only one with a real migration — keep the in-DB body readable until R2 bodies are verified.
