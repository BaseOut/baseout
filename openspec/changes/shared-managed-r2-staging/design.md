# Design — shared-managed-r2-staging

## Context

The managed-R2 write path is settled architecture (`system-r2-revive`): backups run on the Trigger.dev **Node** runner and reach R2 via its S3 API with `aws4fetch`; credentials are the four `R2_*` env vars read by `buildR2Creds()` in `apps/workflows/trigger/tasks/backup-base.task.ts` and injected per-environment from the Trigger.dev dashboard. The engine Worker carries only the credential-less read-only `BACKUPS_R2` binding (media download). Nothing in this change alters that architecture — it fixes the last UI defect on the setup path, reconciles stale docs, and executes the staging leg of the rollout.

## D1 — Bucket-name source of truth is the committed wrangler.jsonc

The runbook says `baseout-backups-{env}`; the committed 3-env `apps/server/wrangler.jsonc` binds `baseout-dev` / `baseout-staging` / `baseout-live`. The wrangler config is what Dan's Sep-1 env model actually deployed, so **the wrangler names win** and the runbook is corrected to match. The Trigger.dev Staging env therefore gets `R2_BUCKET=baseout-staging` — the *same* bucket the staging Worker's read binding points at, which is required anyway (writer and media-download route must address the same objects).

Alternative rejected: renaming buckets to match the runbook. R2 buckets can't be renamed (delete + recreate only), the `baseout-backups-*` names may never have been created, and the wrangler config is already committed and deployed.

## D2 — Verify-then-record, never assume, for §3 provisioning state

The runbook's own header contradicts its §3.1 table (dev bucket "LIVE" vs "❌ MISSING"). Every §3 cell this change touches gets re-baselined from an actual observation: a dashboard screenshot/listing from Dan, or an `aws s3 ls` against the S3 endpoint with the env's token. No cell flips to ✅ on memory or inference.

## D3 — Ownership split: app-level vs account-level (Dan)

Per standing constraint (no admin access to the Cloudflare account), work splits:

| Owner | Work |
|---|---|
| **Dan (account-level)** | Confirm/create bucket `baseout-staging` on the staging account; create R2 API token `baseout-staging-rw` (Object Read & Write, scoped to that bucket only, indefinite TTL); hand over Access Key ID + Secret once. Filed as one precise ask with exact names/settings. |
| **Autumn (app-level)** | Trigger.dev dashboard → Staging env vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=baseout-staging`); wizard code fix; runbook edits; verification runs. |

If the staging account ID differs from the historical `f094d60e8a09…` (the env-model split moved prod to a separate account), the value Dan reports is captured into the runbook §1 — do not assume the old ID.

## D4 — Wizard fix stays minimal; the mapping is the tested unit

The defect: `injectDestOption(kind, …)` hardcoded the radio value `dest-new-${kind}`, and the Review step reads that radio's value as `chosenStorageType`. Fix (already drafted): an optional `value` parameter, with the managed-save call site passing `pendingDest.type === 'local_fs' ? 'local_fs' : 'r2_managed'`.

Testing: the wizard is an inline-script Astro view, so a full DOM test is disproportionate (§3.2 blast radius). Coverage = (a) a unit test on the storage-type mapping if it can be extracted without reshaping the view — otherwise the E2E/manual smoke in the verification protocol is the regression gate, recorded in the commit's Verification section; (b) staging Step 2 of the protocol exercises the exact wizard→PATCH path that previously 422'd.

## D5 — Verification protocol runs as written, logged as it runs

r2-setup.md §5 Steps 1–5 run in order against staging; each step's date + run ID lands in §5.7 before the next step starts. Step 2's "CSV byte-equality vs local_fs reference" uses a dev local_fs run of the same Space as the reference. `system-r2-launch` Phase 4 checkboxes are ticked in the same commits, so the two changes stay reconciled (spec-sync discipline).

## Risks

- **Trigger.dev Staging env may not exist or may lack a deployed worker version** — backups would sit `running` until the queue TTL (known failure mode). Pre-check: `npx trigger.dev deploy` state for Staging before Step 2.
- **Shared dev Postgres saturation** (~19 conns, Hyperdrive capped 15) can mimic an R2 failure as a silent hang — probe the DB first on any stall (runbook §6 discipline).
- **Dan latency** on the bucket/token ask gates Steps 1–5; the wizard fix and runbook reconciliation land independently so the change isn't all-blocked.
