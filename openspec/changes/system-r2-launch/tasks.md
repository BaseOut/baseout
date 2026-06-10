# Implementation tasks

> Phases are sequential — staging is gated on dev being fully green, prod on staging being fully green. Each verification step gets logged into `shared/internal/r2-setup.md` §5 with date + run ID so the audit trail builds as the rollout proceeds.

## Phase 0 — Pre-flight (one-time, no env-specific work)

- [ ] 0.1 Confirm Cloudflare account access. Cloudflare dashboard → R2. Verify the account ID matches `f094d60e8a0996752eb1efd971bda45a` (the value in the legacy `dev/baseout/baseout-backup-engine/wrangler.jsonc`). If the account ID has rotated, capture the new value — it goes into every `R2_ACCOUNT_ID` cell.
- [ ] 0.2 Confirm Trigger.dev project access. Trigger.dev dashboard → project `proj_lklmptmrmrkeaszrmhcs` (per `apps/workflows/trigger.config.ts`) → Environments. All three (Development / Staging / Production) must exist and be writable.
- [x] 0.3 Confirm the application code is on the deployed engine. `pnpm --filter @baseout/server deploy:dev` must have been run against the latest commit on `autumn/backup-fix-local` (or whichever branch this change ships on); the `/api/internal/attachments/{lookup,record}` routes must be live and the `attachment_dedup` migration applied to the master DB. Verify with `node apps/web/scripts/check-migrations.mjs` (silent exit = green). **2026-06-10**: migrations green locally; code committed (`d0ac323` + `84f7812`); engine redeploy `pnpm --filter @baseout/server deploy:dev` still owed by operator before Phase 3 smoke runs.
- [ ] 0.4 Confirm boss approval for bucket creation + token generation (per the justification doc this change captures in `shared/internal/r2-setup.md`).

## Phase 1 — Documentation scaffold (do BEFORE provisioning)

Write the runbook empty-shell so Phase 2+ has somewhere to record state as it proceeds. Mirrors the way `oauth-setup.md` was built.

- [x] 1.1 Create `shared/internal/r2-setup.md` with the seven sections from proposal.md §"Runbook docs":
  - §1 Environments — table with `Env / Bucket / Account ID / Trigger.dev env` columns; rows for dev/staging/prod with all four cells filled.
  - §2 Cred lifecycle — copy of design.md "Cred lifecycle" subsections (token generation, storage, rotation, deliberately-not).
  - §3 Per-env provisioning status — one subsection per env (`§3.1 dev`, `§3.2 staging`, `§3.3 prod`), each with a `Required item / Done? / Owner` table that starts all-❌ MISSING.
  - §4 Gap checklist — actionable items grouped by env, pointing at §3 rows.
  - §5 Verification protocol — copy of design.md "Verification protocol" §1–§6 with a placeholder row at the bottom for "Smoke run log: env / date / run ID / outcome".
  - §6 Failure modes — table from design.md.
  - §7 Cost monitoring — note Cloudflare dashboard locations + a "TODO: define alert thresholds" placeholder.
- [x] 1.2 Update `CLAUDE.md` §3.7 ("OAuth, Permissions, Routing — Consult the Runbook First") — add the R2 paragraph from design.md "CLAUDE.md addition". Tag with cross-reference to `shared/internal/r2-setup.md`.
- [x] 1.3 Update `apps/workflows/.env.example` — confirm the `R2_*` block exists (it already does per recent commit), add a pointer comment: `# See shared/internal/r2-setup.md §3 for which env-var-values to use, and §2 for token rotation procedure.`
- [x] 1.4 Update `apps/web/.dev.vars.example` and `apps/server/.dev.vars.example` — add a comment block at the top of each file noting that R2 creds **are not stored here**; they live in Trigger.dev's dashboard. Reference `shared/internal/r2-setup.md`.

## Phase 2 — Dev env provisioning

Cloudflare dashboard work. Update `shared/internal/r2-setup.md` §3.1 after each item.

- [ ] 2.1 Cloudflare dashboard → R2 → Create bucket `baseout-backups-dev`. Use the same Cloudflare account as the legacy engine. Set jurisdiction to default unless data-residency requires otherwise.
- [ ] 2.2 Cloudflare dashboard → R2 → Manage R2 API Tokens → Create API token:
  - Name: `baseout-backups-dev-rw`
  - Permissions: `Object Read & Write`
  - Specify bucket: `baseout-backups-dev` only
  - TTL: indefinite
  - Capture the resulting Access Key ID + Secret Access Key (Secret is shown ONCE — save to a password manager or paste directly into Trigger.dev in step 2.3).
- [ ] 2.3 Trigger.dev dashboard → project → Development → Environment Variables. Add four entries:
  - `R2_ACCOUNT_ID` = `f094d60e8a0996752eb1efd971bda45a` (or whichever value 0.1 confirmed)
  - `R2_ACCESS_KEY_ID` = (from 2.2)
  - `R2_SECRET_ACCESS_KEY` = (from 2.2)
  - `R2_BUCKET` = `baseout-backups-dev`
- [ ] 2.4 Update `apps/workflows/.env` (local) with the same four values, so `npx trigger.dev dev` picks them up.
- [ ] 2.5 Update `shared/internal/r2-setup.md` §3.1 — flip all four rows from ❌ MISSING to ✅ done, stamp the date and operator.

## Phase 3 — Dev env verification

Per design.md "Verification protocol". Each step's outcome logged in `shared/internal/r2-setup.md` §5.

- [ ] 3.1 **Step 1** — bucket reachable. Pre-flight `aws s3 ls s3://baseout-backups-dev --endpoint-url https://<account-id>.r2.cloudflarestorage.com`. Expect: empty (no objects yet) and no auth error. If auth fails, fix before Step 2.
- [ ] 3.2 **Step 2** — task completes with CSVs in R2. From `/integrations`, set storage to R2 (`r2_managed`) for a test Space with included bases; trigger a manual backup from `/backups`. Verify:
  - `backup_runs.status` flips to `succeeded`.
  - `aws s3 ls s3://baseout-backups-dev/<orgSlug>/<spaceName>/<baseName>/<runStartedAt>/` returns one CSV per included table.
  - CSV byte-equality vs the prior local_fs reference run (`diff -u local_fs/Tasks.csv <(aws s3 cp ... -)`).
- [ ] 3.3 **Step 3** — attachments land + dedup row created. Same test Space, ensure at least one base has a non-empty `multipleAttachments` field. Verify:
  - `attachment_count` on the run row > 0.
  - `aws s3 ls s3://baseout-backups-dev/<orgSlug>/<spaceName>/<baseName>/attachments/<compositeId>/` lists the attachment file.
  - `SELECT COUNT(*) FROM baseout.attachment_dedup WHERE space_id = '<spaceId>'` matches the expected attachment count.
- [ ] 3.4 **Step 4** — dedup on re-run. Trigger a second manual backup of the same Space. Verify:
  - `attachments_processed` in the new run's result is **0** (all hits).
  - Trigger.dev terminal shows no Airtable CDN fetches in the second run.
  - R2 object counts unchanged.
  - `attachment_dedup.last_seen_at` for the existing composite IDs is bumped.
- [ ] 3.5 **Step 5** — delete prefix works. Use the run-delete path on one of the test runs. Verify:
  - Response `deletedCount` matches the object count.
  - `aws s3 ls` on the prefix returns empty.
  - Re-deleting (idempotency) returns `{ deletedCount: 0 }` without error.
- [ ] 3.6 Update `shared/internal/r2-setup.md` §5 with the five run IDs and outcomes. If any step failed, do NOT proceed to Phase 4 — file a bug against the writer / dedup code, link it from §5, and resolve before moving on.

## Phase 4 — Staging env provisioning + verification

Repeat Phase 2 + Phase 3 against staging. Gating: dev §5 log must show all five green before starting.

- [ ] 4.1 Cloudflare dashboard — create bucket `baseout-backups-staging`. (Repeat 2.1 with the staging name.)
- [ ] 4.2 Cloudflare dashboard — create API token `baseout-backups-staging-rw` scoped to that bucket only.
- [ ] 4.3 Trigger.dev dashboard → Staging environment — set the four `R2_*` vars (account ID same; access key + secret from 4.2; bucket = `baseout-backups-staging`).
- [ ] 4.4 (Local dev does NOT mirror staging — skip the equivalent of 2.4.)
- [ ] 4.5 Update `shared/internal/r2-setup.md` §3.2 — flip rows to ✅ done.
- [ ] 4.6 Run Verification Protocol Steps 1–5 against the staging engine (`baseout-server-staging.openside.workers.dev` for now per the §1 Environments table in `oauth-setup.md`). Log results in §5.
- [ ] 4.7 If any step fails, halt rollout until resolved.

## Phase 5 — Prod env provisioning + verification

Gating: staging §5 log must show all five green. Production cred handoff happens to whoever holds prod Cloudflare access — likely the boss, not the implementer. Capture that handoff in §5.

- [ ] 5.1 Cloudflare dashboard — create bucket `baseout-backups-prod`.
- [ ] 5.2 Cloudflare dashboard — create API token `baseout-backups-prod-rw` scoped to that bucket only.
- [ ] 5.3 Trigger.dev dashboard → Production environment — set the four `R2_*` vars.
- [ ] 5.4 Update `shared/internal/r2-setup.md` §3.3 — flip rows to ✅ done.
- [ ] 5.5 Run Verification Protocol Steps 1–5 against the prod engine. **Use a controlled internal test Space** (NOT a customer's) for Steps 2–5 so we don't write test data into a customer's R2 prefix. Log results in §5.
- [ ] 5.6 If any step fails, halt customer rollout. Disable R2 selection in the prod StoragePicker if needed (revert `selectedStorageType` default to a BYOS provider — would require a code change, log here for traceability).

## Phase 6 — Memory + auto-memory updates

- [x] 6.1 Update auto-memory `project_r2_documented_pause.md` (and `MEMORY.md` pointer) — mark superseded by this change. R2 is no longer paused; it's live in V1 per `system-r2-launch`. Point at `shared/internal/r2-setup.md` for the canonical state.
- [x] 6.2 Add a new auto-memory `reference_r2_setup_runbook.md` pointing at `shared/internal/r2-setup.md`, mirroring the existing `project_oauth_app_registered_uris.md` memory. Add the MEMORY.md index entry.

## Phase 7 — Hand-off + close-out

- [x] 7.1 PR description references this change + the runbook. Reviewer checklist mirrors §3 of `r2-setup.md`. **Drafted as a "Suggested PR description" block in [`README.md`](./README.md); paste verbatim when the rollout PR is opened.**
- [x] 7.2 Open follow-up issues for the deferred items in proposal.md "Out of Scope" (multipart, retention, cost alerts, migration of legacy buckets) so they don't get lost. **Drafted as four titled issue bodies in [`README.md`](./README.md) "Follow-ups when launched". File them after Phase 5 §5.7 is green — per CLAUDE.md §8, get user approval before invoking `gh issue create`.**
- [ ] 7.3 Notify the boss + team channel that R2 is live in dev/staging/prod with links to the runbook + a one-line "what's different now" summary.

## Verification

- [ ] All Phase 0–7 boxes checked.
- [ ] `shared/internal/r2-setup.md` §3 has zero ❌ MISSING rows across dev/staging/prod.
- [ ] `shared/internal/r2-setup.md` §5 has at least 15 logged smoke runs (5 steps × 3 envs).
- [ ] `MEMORY.md` reflects the post-launch state (no stale "R2 paused" entries).
- [x] `CLAUDE.md` §3.7 includes the R2 runbook paragraph. (Verified 2026-06-10: heading renamed to "OAuth, R2, Permissions, Routing" + paragraph appended pointing at `shared/internal/r2-setup.md`.)
- [ ] At least one customer-facing prod backup written to R2 successfully (post-launch confidence signal; not a gating task here).
