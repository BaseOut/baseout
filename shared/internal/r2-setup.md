# Cloudflare R2 — Per-Environment Setup

Canonical source-of-truth for the managed-R2 storage destination ([PRD §7.2](../Baseout_PRD.md),
[Features §4 / §7](../Baseout_Features.md)) — bucket inventory, credential
lifecycle, per-env provisioning status, verification protocol, failure modes,
and cost-monitoring pointers.

Owner: whoever is touching managed-R2 wiring in `apps/workflows` (writer + cred
plumbing) or `apps/server` (engine-side observability). Update this doc in
the same change that provisions a new bucket, generates / rotates an R2 API
token, stands up a new env, or changes the `R2Writer` interface.

Related: [oauth-setup.md](./oauth-setup.md) (per-provider OAuth state — parallel
runbook for the BYOS providers), [ops-setup.md](./ops-setup.md)
(Cloudflare/DigitalOcean/GitHub provisioning).

Architecture rationale (why S3-API and not a Worker R2 binding) lives in
[`openspec/changes/system-r2-revive/proposal.md`](../../openspec/changes/system-r2-revive/proposal.md).
The implementation/launch plan this file backs lives in
[`openspec/changes/system-r2-launch/`](../../openspec/changes/system-r2-launch/).

---

## 1. Environments

| Env     | R2 bucket name             | Trigger.dev env  | Engine Worker (writes via `INTERNAL_TOKEN`) |
|---------|----------------------------|------------------|---------------------------------------------|
| dev     | `baseout-backups-dev`      | Development      | `baseout-server-dev`                        |
| staging | `baseout-backups-staging`  | Staging          | `baseout-server-staging`                    |
| prod    | `baseout-backups-prod`     | Production       | `baseout-server`                            |

Shared across all three envs:

- **`R2_ACCOUNT_ID`**: `f094d60e8a0996752eb1efd971bda45a`
  (Same Cloudflare account ID the legacy `baseout-backup-engine` used —
  see `dev/baseout/baseout-backup-engine/wrangler.jsonc`.)
- **S3 endpoint URL**: `https://f094d60e8a0996752eb1efd971bda45a.r2.cloudflarestorage.com`
- **Region**: `auto` (R2 convention; `aws4fetch` passes this verbatim).

**Local dev mirrors the dev env** — `npx trigger.dev dev` reads
`apps/workflows/.env`, which holds the same four `R2_*` values as the
Trigger.dev Development environment. There is no separate "localhost"
bucket; local backup smoke runs write into `baseout-backups-dev`.

> ⚠️ **R2 creds do NOT live in any `.dev.vars` file.** Both
> `apps/server/.dev.vars` (engine Worker) and `apps/web/.dev.vars` (frontend
> Worker) are workerd contexts that never reach R2. The Trigger.dev Node
> runner is the only consumer. Putting `R2_*` keys in `.dev.vars` creates a
> false signal and they'll be ignored. See [§2](#2-credential-lifecycle).

---

## 2. Credential lifecycle

### 2.1 Token generation (one-time per env)

Per env, in Cloudflare dashboard → **R2** → **Manage R2 API Tokens** → Create
API token:

| Field           | Value                                                                         |
|-----------------|-------------------------------------------------------------------------------|
| **Token name**  | `baseout-backups-<env>-rw` (e.g. `baseout-backups-dev-rw`)                    |
| **Permissions** | `Object Read & Write` (Read is required — `deletePrefix` calls `ListObjectsV2`) |
| **Specify bucket** | the single env-scoped bucket from [§1](#1-environments). Do NOT use a global / account-wide token. |
| **TTL**         | Indefinite — rotation is event-driven, not calendar-driven (see [§2.3](#23-rotation)) |

Cloudflare reveals the **Secret Access Key once**, at creation time. Capture
it immediately. If lost, the token must be regenerated.

### 2.2 Storage of secrets

| Consumer                                            | Where the secret lives                     |
|-----------------------------------------------------|--------------------------------------------|
| **Trigger.dev runner** (dev / staging / prod tasks) | Trigger.dev project → Environments → Environment Variables — per env |
| **Local `npx trigger.dev dev`**                     | `apps/workflows/.env` (gitignored)         |
| **Cloudflare Workers** (`apps/server`, `apps/web`)  | NEVER. The Workers never reach R2.         |

Trigger.dev encrypts env vars at rest. They're injected into the task's
`process.env` at task start, read by `buildR2Creds()` in
[apps/workflows/trigger/tasks/backup-base.task.ts](../../apps/workflows/trigger/tasks/backup-base.task.ts),
and passed to `runBackupBase` via the `getR2Creds` dep.

### 2.3 Rotation

Two triggers:

- **Compromise** (token leaked, screenshot circulated, etc.) — rotate immediately.
- **Off-boarding** (admin who held the token leaves the company) — rotate within 24h.

No calendar rotation. Calendar-rotated tokens generate more incidents (rollover
race conditions, missed cron firings) than they prevent on a small,
bucket-scoped surface like this.

#### Rotation procedure

1. Cloudflare dashboard → R2 → Manage R2 API Tokens → **revoke** the old token.
2. Generate a replacement with the same scope ([§2.1](#21-token-generation-one-time-per-env)).
3. Update the four `R2_*` values in the affected Trigger.dev environment.
4. If the env was dev, update `apps/workflows/.env` too.
5. Smoke-test one backup against that env (Steps 2–3 of [§5](#5-verification-protocol)).
   No engine / Worker restart is required — Trigger.dev re-reads env vars at
   the start of every task.
6. Record the rotation date + operator in the appropriate [§3](#3-per-env-provisioning-status) sub-table.

### 2.4 What we deliberately do NOT do

- **No `R2_*` in `.dev.vars` (Cloudflare).** Workers never reach R2.
- **No hand `wrangler secret put` for R2.** Same reason. (Also see auto-memory
  `feedback_no_hand_wrangler_secret_put.md` — manual secret puts drift.)
- **No account-wide R2 token.** Buckets are scoped per-env; tokens follow. A
  dev-token compromise must not blast-radius into staging/prod.
- **No shared token across envs.** Each env's `R2_ACCESS_KEY_ID` /
  `R2_SECRET_ACCESS_KEY` pair must be unique to that env.
- **No R2 binding in any `wrangler.jsonc`.** The architecture decision in
  [`system-r2-revive`](../../openspec/changes/system-r2-revive/proposal.md)
  invalidated that path.

---

## 3. Per-env provisioning status

As of 2026-06-10. **Update every row here when a bucket / token /
env-var is created, rotated, or removed.**

### 3.1 dev

| Required item                                                                         | Done? | Date / Operator     |
|---------------------------------------------------------------------------------------|-------|---------------------|
| R2 bucket `baseout-backups-dev` exists in Cloudflare account `f094d60e8a09…`         | ❌ MISSING | —              |
| R2 API token `baseout-backups-dev-rw` (Object Read+Write, scoped to that bucket)      | ❌ MISSING | —              |
| Trigger.dev **Development** env: `R2_ACCOUNT_ID` set                                  | ❌ MISSING | —              |
| Trigger.dev **Development** env: `R2_ACCESS_KEY_ID` set                               | ❌ MISSING | —              |
| Trigger.dev **Development** env: `R2_SECRET_ACCESS_KEY` set                           | ❌ MISSING | —              |
| Trigger.dev **Development** env: `R2_BUCKET=baseout-backups-dev`                      | ❌ MISSING | —              |
| `apps/workflows/.env` (local) mirrors the four values above                           | ❌ MISSING | —              |

### 3.2 staging

| Required item                                                                          | Done? | Date / Operator     |
|----------------------------------------------------------------------------------------|-------|---------------------|
| R2 bucket `baseout-backups-staging` exists                                            | ❌ MISSING | —              |
| R2 API token `baseout-backups-staging-rw` (Object Read+Write, bucket-scoped)          | ❌ MISSING | —              |
| Trigger.dev **Staging** env: all four `R2_*` vars set                                 | ❌ MISSING | —              |

### 3.3 prod

| Required item                                                                          | Done? | Date / Operator     |
|----------------------------------------------------------------------------------------|-------|---------------------|
| R2 bucket `baseout-backups-prod` exists                                               | ❌ MISSING | —              |
| R2 API token `baseout-backups-prod-rw` (Object Read+Write, bucket-scoped)             | ❌ MISSING | —              |
| Trigger.dev **Production** env: all four `R2_*` vars set                              | ❌ MISSING | —              |

---

## 4. Gap checklist

Each item below is a single dashboard action. Tick the box and update [§3](#3-per-env-provisioning-status) when done.

### 4.1 Cloudflare (boss / Cloudflare-admin owned)

- [ ] Create bucket `baseout-backups-dev` in Cloudflare account `f094d60e8a09…`.
- [ ] Create bucket `baseout-backups-staging`.
- [ ] Create bucket `baseout-backups-prod`.
- [ ] Generate API token `baseout-backups-dev-rw`, Object Read+Write, scoped to `baseout-backups-dev`. Capture Access Key ID + Secret immediately.
- [ ] Generate API token `baseout-backups-staging-rw`, Object Read+Write, scoped to `baseout-backups-staging`. Capture credentials.
- [ ] Generate API token `baseout-backups-prod-rw`, Object Read+Write, scoped to `baseout-backups-prod`. Capture credentials.

### 4.2 Trigger.dev (dev-owned)

- [ ] Trigger.dev → project `proj_lklmptmrmrkeaszrmhcs` → Development → Env Vars → set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
- [ ] Same for **Staging** environment.
- [ ] Same for **Production** environment.

### 4.3 Local dev (engineer's machine)

- [ ] Edit `apps/workflows/.env` — set the four `R2_*` values to the dev-env token. Restart `npx trigger.dev dev` so the runner picks them up.

### 4.4 Engine redeploy (per environment, after the corresponding env's §4.1 + §4.2 are done)

- [ ] `pnpm --filter @baseout/server deploy:dev` — pushes the latest `apps/server` code (attachments routes, etc.) so the engine in that env is on the branch that introduced R2 wiring.
- [ ] `pnpm --filter @baseout/server deploy:staging` (when staging rollout starts).
- [ ] `pnpm --filter @baseout/server deploy:production` (when prod rollout starts).

---

## 5. Verification protocol

Per env, in order. Each step must pass before the next runs. Each step's
outcome logged in [§5.7](#57-smoke-run-log) with date + run ID.

### 5.1 Step 1 — bucket reachable

Pre-Trigger.dev sanity check using `aws` CLI (or a one-shot Node script with
`aws4fetch`):

```bash
aws s3 ls s3://baseout-backups-<env> \
  --endpoint-url https://f094d60e8a0996752eb1efd971bda45a.r2.cloudflarestorage.com \
  --profile baseout-r2-<env>
```

Expected: a successful listing (empty for a fresh bucket; non-empty after
later steps). If the token is wrong or bucket name mistyped, this surfaces
before Trigger.dev hides the failure.

### 5.2 Step 2 — task completes with CSVs in R2

A Space configured for `storage_type='r2_managed'` runs a manual backup
from `/backups`. Expected:

- `npx trigger.dev dev` terminal: three `backup-base` runs complete, no errors.
- `backup_runs.status` flips to `succeeded`; `record_count > 0`.
- `aws s3 ls s3://baseout-backups-<env>/<orgSlug>/<spaceName>/<baseName>/<runStartedAt>/`
  returns one CSV per included table.
- CSV byte-equality vs the reference local_fs run for the same Space.

### 5.3 Step 3 — attachments land + dedup row created

Same Space, ensuring at least one base has a non-empty `multipleAttachments`
field. Expected:

- `attachment_count` on the run row is > 0.
- `aws s3 ls s3://baseout-backups-<env>/<orgSlug>/<spaceName>/<baseName>/attachments/<compositeId>/`
  returns the attachment file.
- `SELECT COUNT(*) FROM baseout.attachment_dedup WHERE space_id = '<spaceId>'`
  equals the expected attachment count.

### 5.4 Step 4 — dedup on re-run

Re-trigger the same backup immediately. Expected:

- `attachments_processed` on the new run = **0** (all hits).
- Trigger.dev terminal shows no Airtable CDN fetches.
- R2 object counts unchanged (no duplicate writes).
- `attachment_dedup.last_seen_at` for the existing composite IDs is bumped.

### 5.5 Step 5 — `deletePrefix` cleanup

Use the engine's per-run delete path. Expected:

- Response `deletedCount` matches the object count under the prefix.
- `aws s3 ls` on the prefix returns empty.
- A second delete on the same (now-empty) prefix returns
  `{ deletedCount: 0 }` without error (idempotency).

### 5.6 Step 6 — staging / prod repeat

Same five steps, against the next env. Gating: previous env's [§5.7](#57-smoke-run-log)
must show all five rows green before this env starts.

### 5.7 Smoke run log

| Env | Step | Date | Run ID (backup_runs.id or Trigger.dev run_*) | Outcome | Operator |
|-----|------|------|-----------------------------------------------|---------|----------|
| _placeholder — fill in once Phase 3 starts_ | — | — | — | — | — |

---

## 6. Failure modes (so you don't re-learn them)

| Symptom                                                                                              | Likely cause                                                                                         | Where to look                                                                                                       |
|------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| `backup_runs.error_message = 'missing_r2_creds'`                                                     | Trigger.dev env vars not set, OR set in wrong environment, OR `.env` missing locally                  | Trigger.dev dashboard → Environment Variables for the env the task ran in. Confirm all four `R2_*` keys present.   |
| SigV4 `403 SignatureDoesNotMatch` from R2                                                            | `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` pair mismatched (mixed across env regenerations), or clock skew on runner | Regenerate the pair atomically (don't reuse half a pair); verify runner system time.                              |
| `404 NoSuchBucket`                                                                                    | `R2_BUCKET` typo, OR bucket exists in a different Cloudflare account than `R2_ACCOUNT_ID` points to    | Confirm bucket exists in dashboard (right account); confirm name matches case-sensitively.                          |
| `403 AccessDenied` on `ListObjectsV2` (called by `deletePrefix`)                                     | Token's permission set is Write-only; missing Read                                                    | Regenerate token with `Object Read & Write` permission set.                                                         |
| Attachments uploaded but no `attachment_dedup` rows created                                          | Engine's `/api/internal/attachments/record` route returned non-200, OR `attachment_dedup` table missing | First case: check engine `wrangler tail`. Second case (recurring 2026-06-09): `pnpm --filter @baseout/web db:migrate`. |
| Large attachment upload aborts with 5xx mid-PUT                                                      | Single-PUT exceeded R2's 5 GB per-object ceiling                                                      | Deferred to future `workflows-r2-multipart` change. For V1, document the per-attachment ceiling.                    |
| `backup_runs.status` stays `'running'` indefinitely                                                  | Task crashed before `postCompletion` (was the silent-hang failure mode before `workflows-task-startup-error-reports`) | Trigger.dev dashboard → run history for that env. Fix #1 should have prevented this; if it recurs, file a bug.    |

---

## 7. Cost monitoring

R2 pricing (current as of 2026):

- **Storage**: $0.015 / GB-month after the 10 GB free tier.
- **Class A operations** (writes — PUT, POST, COPY, LIST): $4.50 / million after 1M free / month.
- **Class B operations** (reads — GET, HEAD): $0.36 / million after 10M free / month.
- **Egress**: $0 (R2's competitive advantage over S3).

### Where to watch

- Cloudflare dashboard → R2 → bucket → **Metrics** tab. Shows storage GB, Class A / B counts, per-region.
- Cloudflare dashboard → Billing → Usage → R2 line items.

### Alert thresholds

**TODO** — alert thresholds not yet defined. When the product team / finance
sets them, capture here. Suggested initial signals to monitor (no current
thresholds):

- Daily storage growth > 2× the prior 7-day moving average.
- Class A ops / hour > some-multiple of normal (indicates a run-away backup loop).
- Per-Space storage > the tier cap defined in [Features §4](../Baseout_Features.md).

---

## 8. Process: adding a new env or rotating an account

### 8.1 New environment (e.g. a per-PR preview)

1. Add a row to [§1 Environments](#1-environments).
2. Add a `§3.N` provisioning-status subsection with all the unchecked items.
3. File the bucket + token + Trigger.dev work in [§4](#4-gap-checklist).
4. Document the deploy command in [`oauth-setup.md`](./oauth-setup.md) §6
   (which holds the master deploy-command table for all envs).
5. Run [§5](#5-verification-protocol) Steps 1–5 against the new env.

### 8.2 New Cloudflare account (rare — acquisition / consolidation)

Updates required:

1. `R2_ACCOUNT_ID` in every Trigger.dev environment + `apps/workflows/.env`.
2. Endpoint URL references in this doc (§1 and §5.1).
3. Cross-reference in [`system-r2-revive`](../../openspec/changes/system-r2-revive/proposal.md)
   if it cites the old account ID.
4. Buckets re-created on the new account (R2 doesn't support cross-account
   bucket moves); historical data migration is its own change — see
   `system-r2-launch` proposal "Out of Scope".
