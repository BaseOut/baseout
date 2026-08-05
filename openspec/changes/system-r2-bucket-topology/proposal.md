# system-r2-bucket-topology

> **Depends on**: [`system-r2-revive`](../system-r2-revive/proposal.md) (S3-API-on-Node architecture, shipped), [`workflows-r2-writer`](../workflows-r2-writer/proposal.md) (`R2Writer`, shipped). **Coordinate with**: [`system-r2-launch`](../system-r2-launch/proposal.md) (per-env provisioning + `shared/internal/r2-setup.md` runbook). **Consumed by**: [`shared-entitlements`](../shared-entitlements/proposal.md) (per-bucket storage metrics as the reconciliation-sweep cross-check; clean per-account churn deletion).

## Why

Decision **D16** (founder, 2026-08-03; recorded in [`shared-entitlements/design.md`](../shared-entitlements/design.md)) supersedes the shared-bucket-per-environment model with **one managed R2 bucket per customer account**. That decision has no implementing change today — this change is its home. D16 explicitly says: *"Implementation belongs to the storage change family, not `shared-entitlements`."*

Why per-account buckets (from D16 + the pricing model):

1. **Independently meterable storage.** The pricing model meters *file storage under management* per organization (Lite 50 / Core 250 / Plus 500 / Max 1,500 GB — [Features §3](../../../shared/Baseout_Features.md)). A per-account bucket makes Cloudflare's own per-bucket storage metrics a free cross-check for the `shared-entitlements` reconciliation sweep, instead of summing prefixes inside one shared bucket.
2. **Clean erasure story.** Churn/GDPR deletion becomes "empty + delete the bucket" — auditable and complete — versus prefix-delete inside a shared bucket.
3. **Platform-feasible.** R2 allows 1,000,000 buckets per account, bucket creation is API-driven, and bucket-management ops rate-limit at 50/sec — per-customer provisioning is comfortably inside all limits.

Coupled sub-decision (pricing §3.2; [`shared-entitlements`](../shared-entitlements/design.md) D5): **document bodies move from the per-Space `bo_at_documents.body` column to one R2 file per document**, so their bytes count on the file-storage meter rather than against the (separately-capped) database-size meter.

Today's model is one shared bucket per deployment env (`baseout-backups-{dev,staging,prod}`) with org key prefixes, and a credential-less read-only `BACKUPS_R2` Worker binding on `apps/server` for media download. Both assumptions break under per-account buckets.

## What Changes

Runtime code + docs. No customer-facing behavior change beyond where bytes physically live.

### 1. Bucket naming + lazy provisioning
- Name: `baseout-{env}-org-{organizationId}` — the **immutable org ID** (not the renamable slug) as identity; ≤63 chars (bucket names are account-global).
- Created **lazily on first managed-R2 write** (not at signup — avoids orphan buckets and keeps signup un-failable on storage). Creation is idempotent + concurrency-safe (two simultaneous first-writes must not double-create).
- A lifecycle-rule template is applied at creation; template changes roll forward via a sweep.
- The resolved bucket name is recorded on the org's managed storage-destination row (single source of truth for the read path).

### 2. Key layout
- Managed-R2 keys root at the Space — `{SpaceName}/{BaseName}/{DateTime}/{TableName}.csv` — dropping the now-redundant org root segment. Attachments: `{SpaceName}/{BaseName}/attachments/{compositeId}/{filename}`.
- `buildR2Key` keeps the org segment **only for BYOS** destinations (where it renders as the customer-visible root folder in their own storage).
- Files: `apps/workflows/trigger/tasks/_lib/r2-path.ts`, `apps/workflows/trigger/tasks/_lib/storage-writers/r2.ts`.

### 3. Read path off the static binding
- The credential-less `BACKUPS_R2` binding cannot address per-account buckets. The media download route moves to the **S3 API** (aws4fetch, the same account-scoped R2 credentials the write path uses, bucket name read from the org's storage-destination row).
- File: the `apps/server` media/download route added by `server-media-index`.

### 4. Document bodies → R2
- Relocate `bo_at_documents.body` from a per-Space DB column to one R2 object per document; document CRUD routes read/write the body via R2 and count it on the file-storage meter.
- Per-Space schema change (both dialects) — see design; **not** purely additive (a column changes role/drops), so it needs a real step in `packages/db-schema/src/space/pg-ddl-upgrade.ts`, a `SPACE_SCHEMA_VERSION` bump, and the four parity/count/version tests updated.

### 5. Churn deletion
- Wire "empty + delete the whole bucket" into the account-deletion / churn-grace-expiry path (the deletion the `shared-entitlements` churn lifecycle triggers).

### 6. Runbook + standards (CLAUDE.md §3.7)
- Update [`shared/internal/r2-setup.md`](../../../shared/internal/r2-setup.md) for the per-account topology and the new server read-path credential rule (the read path now needs the same S3 creds the writer uses — previously binding-only).
- Confirm CLAUDE.md §3.7's R2 rule still reads correctly against per-account buckets.

## Out of Scope

| Deferred to | Item |
|---|---|
| `shared-entitlements` | The file-storage **meter** itself and the reconciliation sweep. This change only makes per-bucket metrics *available* as the cross-check. |
| `system-r2-launch` | Per-env cred/token provisioning + the runbook baseline. This change extends the runbook; it does not stand up the base creds. |
| Future change | Migration of existing shared-bucket **dev** data (test data; the prod bucket is unprovisioned per the runbook, so per-account topology lands cleanly before launch — D16). |
| `server-retention-and-cleanup` | Per-tier retention windows. This change sets only the bucket-creation lifecycle template, not retention policy. |
