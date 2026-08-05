# system-r2-bucket-topology — tasks

TDD per CLAUDE.md §3.4. Pure path/naming helpers get Vitest first. R2 API interactions mocked at the HTTP boundary (msw / the writer's existing test seam). Land the document-body relocation (§4) last — it carries the only real migration.

## 1. Bucket naming + provisioning

- [ ] 1.1 Pure `resolveManagedBucketName(env, organizationId)` → `baseout-{env}-org-{orgId}`; length/charset assertions; Vitest
- [ ] 1.2 Lazy provisioning helper: `ensureAccountBucket(...)` — idempotent `CreateBucket` (treat-exists-as-success) + lifecycle-template apply; concurrency-safe single-writer gate that records the bucket name on the org's managed storage-destination row exactly once; tests for the race
- [ ] 1.3 Lifecycle-template rollforward sweep (server cron or ops script): re-apply the current template to existing account buckets; test the template diff/apply logic

## 2. Key layout

- [ ] 2.1 `buildR2Key` branches on destination kind — managed R2 = Space-rooted (`{SpaceName}/{BaseName}/{DateTime}/{TableName}.csv`), BYOS = org-rooted (unchanged); attachments Space-rooted for managed; sanitization + traversal guard unchanged; exhaustive Vitest over both branches (`apps/workflows/trigger/tasks/_lib/r2-path.ts`)
- [ ] 2.2 `R2Writer` targets the resolved per-account bucket (from the org row) for managed writes; BYOS/local unchanged; writer tests updated

## 3. Read path

- [ ] 3.1 Media download route resolves `{bucket, creds}` (bucket from org row, creds = writer's account-scoped R2 S3 keys) and issues signed `GetObject` via aws4fetch; integration test vs a mocked S3 endpoint (`apps/server` media route)
- [ ] 3.2 Retire the `BACKUPS_R2` binding from `apps/server/wrangler.jsonc(.example)` once the route is cut over; env.d.ts updated

## 4. Document bodies → R2  (land last — real migration)

- [ ] 4.1 Per-Space schema change in **both** dialects: `bo_at_documents` body column → R2 object key (+ optional byte count) — `packages/db-schema/src/space/{pg,sqlite}.ts`; regenerate both `.sql` migrations + `pg-ddl.ts`; bump `SPACE_SCHEMA_VERSION`; hand-author the non-additive step in `pg-ddl-upgrade.ts`; update the four guard tests (`space-schema-parity`, `space-pg-ddl-parity`, `pg-ddl-upgrade`, `webhook-deltas`)
- [ ] 4.2 Backfill: copy existing in-DB document bodies to R2 per Space **before** the column change; verification that every document has a readable R2 body; gate 4.1's cutover on this
- [ ] 4.3 Document CRUD routes read/write body via R2; body bytes reported to the file-storage meter (feeds `shared-entitlements` task 3.2a); tests

## 5. Churn deletion

- [ ] 5.1 `deleteAccountBucket(...)` — list + batch-delete all objects (reuse `deletePrefix` internals) then `DeleteBucket`; idempotent (missing bucket = success); wired into the account-deletion / churn-grace-expiry path; tests with a mocked bucket

## 6. Runbook + verification

- [ ] 6.1 Update `shared/internal/r2-setup.md`: per-account bucket topology, naming, lazy-provision lifecycle, the **server read-path credential rule** (read path now needs the writer's S3 creds), churn-deletion procedure (CLAUDE.md §3.7)
- [ ] 6.2 Confirm CLAUDE.md §3.7 R2 rule reads correctly for per-account buckets; adjust wording if needed
- [ ] 6.3 End-to-end smoke (documented as the Verification demo): run a managed-R2 backup for a fresh org → bucket `baseout-{env}-org-<id>` is created and filled at Space-rooted keys → media download works via the S3 path → a document body reads from R2 → churn deletion empties + removes the bucket
- [ ] 6.4 Typecheck, build, `db:check`, and the db-schema/server/workflows suites green
