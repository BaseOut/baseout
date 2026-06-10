# Design

## Goals (in priority order)

1. **Make R2 actually work in dev** — close the gap between `storage_type='r2_managed'` being the PRD default and the runtime failing with `missing_r2_creds`.
2. **Stage → prod rollout repeatable.** The same provisioning + verification sequence used for dev applies verbatim to staging and prod. No special-casing.
3. **No code regressions.** Existing BYOS providers (Drive, Box, Dropbox, OneDrive) and the dev `local_fs` writer continue to work unchanged. R2 enabling is purely additive.
4. **Documented audit trail** — anyone onboarding, rotating tokens, or chasing a "managed backup failed" alert in 6 months can find the live config + the procedure that put it there.

## Non-goals

- No migration of historical data from legacy buckets (deferred — see proposal Out of Scope).
- No automated provisioning (no Terraform / Pulumi). The Cloudflare R2 bucket + token surface is small and changes rarely; a documented dashboard procedure is the right tool. If we later add IaC for the whole Cloudflare account, R2 buckets join it then.
- No customer-facing UX changes. The StoragePicker already renders R2 as the enabled default; the only effect of this change for users is that selecting R2 stops failing.

## Environment topology

Three environments, three buckets, three tokens, three sets of Trigger.dev env vars. All share one Cloudflare account ID.

| Env | Cloudflare R2 bucket | Trigger.dev environment | Token scope |
|---|---|---|---|
| dev | `baseout-backups-dev` | Development | Object Read+Write on `baseout-backups-dev` |
| staging | `baseout-backups-staging` | Staging | Object Read+Write on `baseout-backups-staging` |
| prod | `baseout-backups-prod` | Production | Object Read+Write on `baseout-backups-prod` |

Account ID `f094d60e8a0996752eb1efd971bda45a` is the same value the legacy `baseout-backup-engine/wrangler.jsonc` used. Confirmed still valid; reused.

**Local dev mirrors the dev env** — `npx trigger.dev dev` reads `apps/workflows/.env`, which holds the same four `R2_*` values as the Trigger.dev Development environment. This is intentional: a dev-bucket smoke run locally exercises the same code path as a deployed dev-engine smoke. There is no separate "localhost" bucket.

## Cred lifecycle

### Token generation

Per env, in Cloudflare dashboard → R2 → "Manage R2 API Tokens" → Create API token:

- **Permissions:** `Object Read & Write`.
- **Specify bucket:** scoped to that env's bucket only. Do **not** create a global / account-wide token.
- **TTL:** indefinite. Rotation is event-driven (compromise, off-boarding) — not calendar-driven, per the principle that calendar rotation creates more incidents than it prevents (cf. `oauth-setup.md` §6's approach).
- **Output:** one Access Key ID + one Secret. Secret is shown ONCE; capture immediately.

### Storage of secrets

- **Trigger.dev runtime (dev / staging / prod):** Trigger.dev project → Environments → Environment Variables. Set the four `R2_*` keys per environment. Trigger.dev encrypts these at rest and they're injected into the task's `process.env` at task start.
- **Local `npx trigger.dev dev`:** `apps/workflows/.env`. This file is gitignored. `.env.example` documents the four keys.
- **Cloudflare Workers (`apps/server`, `apps/web`):** R2 creds are **NOT** present in `.dev.vars`. The Workers never reach R2 directly; only the Trigger.dev Node runner does. Documenting this in the `.dev.vars.example` files prevents future engineers from putting them in the wrong place.

### Rotation

Two triggers: compromise (immediate) or off-boarding of an admin who held the token (within 24h). Procedure:

1. Cloudflare dashboard → R2 → Manage R2 API Tokens → revoke the old token.
2. Generate a new token with the same scope.
3. Update Trigger.dev's env-var UI for the affected environment(s).
4. Update `apps/workflows/.env` if local dev was using the rotated token.
5. Smoke-test a backup. If the new token works, the rollover is complete; no Worker / engine restart required (Trigger.dev re-reads env on next task start).
6. Update `shared/internal/r2-setup.md` §3 status table with the rotation date.

There is no need to coordinate the rotation with apps/server or apps/web deploys — neither Worker reaches R2.

### What we deliberately do NOT do

- **No `R2_*` vars in `.dev.vars` files** (Cloudflare Workers). Workers never reach R2. Adding them would be a misleading false-signal for future engineers.
- **No `wrangler secret put` for R2 vars.** Same reason. Per memory `feedback_no_hand_wrangler_secret_put.md`, hand-writing Worker secrets causes drift; here the worse outcome is that the secret simply isn't reachable from where it's used.
- **No account-wide R2 token.** Buckets are scoped per-env; tokens follow. A compromised dev token must not blast-radius into staging or prod.

## Verification protocol

Per env, in order. Each step must pass before moving to the next. Each step is logged in `shared/internal/r2-setup.md` §5 with date + run ID.

### Step 1 — Token can authenticate to the bucket

Pre-Trigger.dev sanity check using `aws` CLI or a one-shot Node script with `aws4fetch`:

```
# expected: bucket lists with 0 objects (fresh bucket) or some objects (after later steps)
aws s3 ls s3://baseout-backups-dev \
  --endpoint-url https://f094d60e8a0996752eb1efd971bda45a.r2.cloudflarestorage.com \
  --profile baseout-r2-dev
```

If this fails, the token is wrong or the bucket name is wrong — fix before touching Trigger.dev.

### Step 2 — Trigger.dev task runs to completion with R2 writes

A Space configured with `storage_type='r2_managed'` runs a manual backup. Expected:

- `apps/workflows` Trigger.dev terminal: three `backup-base` tasks complete, no errors.
- `backup_runs` row flips to `succeeded` with non-zero `record_count`.
- `aws s3 ls s3://baseout-backups-dev/<orgSlug>/<spaceName>/<baseName>/<runStartedAt>/` returns one CSV per table.
- CSV content matches the local_fs reference run (same Space, prior local_fs smoke).

### Step 3 — Attachments write + dedup record

Same Space, same backup — but the Space's bases include at least one `multipleAttachments` field with at least one non-empty cell. Expected:

- `attachment_count` on the `backup_runs` row is non-zero.
- `aws s3 ls s3://baseout-backups-dev/<orgSlug>/<spaceName>/<baseName>/attachments/<compositeId>/` returns the attachment file.
- `select count(*) from baseout.attachment_dedup where space_id = '<spaceId>'` returns the expected count.

### Step 4 — Dedup on re-run

Re-trigger the same backup immediately. Expected:

- `attachments_processed` in the Trigger.dev result is **zero** (all hits, no misses).
- `apps/workflows` terminal log shows no attachment-download fetch URLs.
- `attachment_dedup.last_seen_at` is bumped (engine `/attachments/lookup` updates this).
- Object counts in R2 are unchanged (no duplicate writes).

### Step 5 — Delete prefix works

Use the engine's per-run delete path (`POST /api/internal/runs/:runId/delete` if available, or the manual delete UI). Expected:

- The corresponding R2 prefix is fully cleared (verified via `aws s3 ls`).
- `deletedCount` on the response matches the file count.
- Absent-prefix delete idempotent: a second delete returns `{ deletedCount: 0 }` without error.

### Step 6 — Smoke against staging / prod

Same five steps, against the staging or prod bucket, using the corresponding Trigger.dev environment. Pre-prod step gate: staging smoke must be 100% green before prod gets credentials.

## Failure-mode handling

Documented in `shared/internal/r2-setup.md` §6. The expected categories:

| Symptom | Likely cause | Fix |
|---|---|---|
| `missing_r2_creds` (already visible after [Fix #1](#)) | Trigger.dev env vars not set OR `.env` missing locally OR vars set in wrong env | Confirm the four `R2_*` vars present in the Trigger.dev environment that runs the task. |
| SigV4 `403 SignatureDoesNotMatch` | `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` mismatched, or clock skew on the runner | Regenerate the pair (don't reuse half a pair); verify runner clock. |
| `404 NoSuchBucket` | `R2_BUCKET` typo, or bucket not provisioned in the right env's account | Confirm bucket exists in dashboard; confirm name matches case-sensitively. |
| `403 AccessDenied` on `ListObjectsV2` (called by `deletePrefix`) | Token's permission set lacks `Object Read` (only Write was selected) | Regenerate token with `Object Read & Write`. |
| Attachments uploaded but dedup not recorded | `/attachments/record` route returned non-200 OR `attachment_dedup` table missing | First case: check engine logs. Second case (recurring from 2026-06-09): run `pnpm --filter @baseout/web db:migrate`. |
| Large attachment upload aborts with 5xx | Single-PUT exceeded 5 GB ceiling | Deferred to `workflows-r2-multipart`; for V1, document the per-attachment ceiling. |

## Rollback strategy

If the new R2-backed backups misbehave in any way that affects customers (data corruption, persistent upload failures, cost spike):

1. **Trigger.dev env-var rollback** — clear / unset the four `R2_*` vars in the affected environment. The next task with `storage_type='r2_managed'` will throw the visible `missing_r2_creds` failure; backups stop attempting R2 immediately. No code deploy needed.
2. **Per-Space fallback** — affected Spaces can be UPDATEd in the master DB to `storage_type='local_fs'` (dev) or a BYOS provider (staging/prod) until R2 is re-stabilized. Customer impact is bounded.
3. **Bucket-level revocation** — Cloudflare dashboard → revoke the API token. Existing in-flight tasks fail on next R2 call; queued tasks fail at start. Use only for compromise scenarios, not for normal rollback.
4. **No code rollback needed** in the rollback path. The R2 writer code can stay deployed; the entire mechanism is gated on credential presence (the `missing_r2_creds` guard added by [`workflows-task-startup-error-reports`](#)).

## CLAUDE.md addition

Add R2 to [CLAUDE.md §3.7](../../../CLAUDE.md) "Consult the Runbook First" — currently OAuth-only. New paragraph at the end of §3.7:

> Same rule applies to managed Cloudflare R2: [`shared/internal/r2-setup.md`](../../shared/internal/r2-setup.md) is the source-of-truth for per-env bucket + cred status. Read it before any change that touches R2 cred resolution, bucket naming, `R2Writer` behavior, or the per-Space `storage_type='r2_managed'` dispatch. Update it in the same change that rotates a token, provisions a new env, or changes the writer interface.

## Trade-offs considered (and rejected)

- **Generating one global R2 token shared across envs** — rejected. Compromise of dev token would force a triple-rotation across staging/prod. Per-env tokens cost nothing more and contain blast radius.
- **Storing R2 creds in `apps/server/.dev.vars` "for symmetry"** — rejected. The Worker doesn't reach R2 (only the Node runner does). Putting them there creates a false symmetry and tempts future engineers to access R2 from a place that can't actually do so. Documented in `.dev.vars.example` to make the absence intentional.
- **Auto-rotating tokens on a calendar** — rejected for V1 per the principle in oauth-setup.md (calendar rotation creates more incidents than it prevents). Add later if compliance demands it; document the cadence then.
- **Provisioning via Terraform now** — rejected because (a) no other Cloudflare surface in the repo is IaC-managed yet (wrangler.jsonc is the closest thing), and (b) the cost-of-mistake on a static three-bucket surface is low. Revisit when the broader Cloudflare account gets IaC.
