# Implementation tasks

> Phases 1–2 are code/docs and land independently. Phase 3 (Dan ask) gates Phase 4–5. Every verification outcome is logged in `shared/internal/r2-setup.md` §5.7 with date + run ID, and the matching `system-r2-launch` Phase 4 checkbox is ticked in the same commit.

## Phase 1 — Wizard fix (apps/web)

- [x] 1.1 Land the drafted fix in `apps/web/src/views/IntegrationsSetupWizard.astro`: `injectDestOption` accepts an optional `value`; the managed-destination save call site passes `local_fs` or `r2_managed` (never `dest-new-file`). Keep the explanatory comment about the Review-step PATCH. *(2026-09-01: in working tree; both values confirmed members of `ALLOWED_STORAGE_TYPES` in `persist-policy.ts`; the only managed dtypes offered are `local_fs` + `r2`, so the ternary is total. Commit pending human smoke approval.)*
- [x] 1.2 Regression coverage per design D4: extract-and-unit-test the storage-type mapping if it comes out cleanly; otherwise document the manual smoke (wizard → Managed R2 → Review → PATCH 200) in the commit's Verification section. *(Resolved: extraction would be a drive-by reshape of the inline wizard script (§3.2) — coverage = manual smoke in the commit's Verification section + staging protocol Step 4.2, which exercises this exact path.)*
- [ ] 1.3 Local smoke (HUMAN — needs magic-link login): `pnpm --filter @baseout/web dev`, run the wizard end-to-end with a managed destination against dev; confirm the final PATCH no longer 422s (`unsupported_storage_type` gone) and `spaces.storage_type` lands as `r2_managed`.
- [x] 1.4 `pnpm --filter @baseout/web typecheck` + build green; no stray `console.*` in the diff (§3.5). *(2026-09-01: build green; diff clean of console/debugger; `astro check` has PRE-EXISTING errors (middleware.ts `handleSsoAccountLinked`, DataBrowse.astro null-checks) with zero errors in the wizard file — verified identical error set with the diff stashed.)*

## Phase 2 — Runbook reconciliation (shared/internal/r2-setup.md)

- [x] 2.1 §1 Environments: replace `baseout-backups-{dev,staging,prod}` with the committed wrangler names `baseout-dev` / `baseout-staging` / `baseout-live`; replace the per-env Worker names with the current one-Worker `--env {dev,staging,production}` model; note prod lives on a separate Cloudflare account (account ID per D3 — recorded, not assumed).
- [x] 2.2 Resolve the header-vs-§3.1 contradiction: rewrite the READ-path amendment table and §3 provisioning tables so every cell reflects a verified observation (design D2). Cells that can't be verified yet stay ❌ with a note naming who can verify.
- [x] 2.3 §5.1 / §5.2 example commands: update bucket names and endpoint to the staging account's values.
- [x] 2.4 Cross-check `system-r2-launch` tasks.md Phase 4 wording (it names `baseout-backups-staging` and `baseout-server-staging`) — add a dated re-basing note pointing at this change rather than rewriting its history.

## Phase 3 — Staging provisioning (dashboard; split per design D3)

- [ ] 3.1 File the Dan ask (one message, exact settings): confirm/create R2 bucket `baseout-staging` on the staging account; create API token `baseout-staging-rw`, permissions `Object Read & Write`, scoped to `baseout-staging` only, indefinite TTL; report the account ID + Access Key ID + Secret (secret shown once).
- [ ] 3.2 On receipt: Trigger.dev dashboard → project `proj_lklmptmrmrkeaszrmhcs` → **Staging** → Environment Variables: set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=baseout-staging`. (Never in any `.dev.vars` — runbook §2.4.)
- [ ] 3.3 Confirm a Trigger.dev **Staging** worker deployment exists for the current tasks (`npx trigger.dev deploy` against Staging if stale) — pre-empts the backups-stuck-`running` TTL failure mode.
- [ ] 3.4 Update runbook §3.2 rows to ✅ with date + operator.

## Phase 4 — Staging verification (r2-setup.md §5, in order, each step logged in §5.7)

- [ ] 4.1 Step 1 — bucket reachable: `aws s3 ls s3://baseout-staging --endpoint-url https://<staging-account-id>.r2.cloudflarestorage.com` with the new token succeeds.
- [ ] 4.2 Step 2 — full backup lands: on staging web, run the wizard (exercising the Phase 1 fix) to set a test Space to Managed R2; manual backup from `/backups`; `backup_runs.status='succeeded'`, `record_count > 0`, one CSV per included table under the run prefix; byte-equality spot-check vs a local_fs reference run.
- [ ] 4.3 Step 3 — attachments + dedup rows: run a Space with a non-empty `multipleAttachments` field; `attachment_count > 0`, attachment objects present, `attachment_dedup` row count matches.
- [ ] 4.4 Step 4 — dedup on re-run: immediate re-trigger shows `attachments_processed = 0`, no CDN fetches, unchanged object counts, bumped `last_seen_at`.
- [ ] 4.5 Step 5 — deletePrefix: run-delete path reports matching `deletedCount`; prefix empties; second delete returns `{ deletedCount: 0 }`.
- [ ] 4.6 Tick the corresponding `system-r2-launch` Phase 4 boxes (4.1–4.6) with a pointer to this change's §5.7 log entries.

## Phase 5 — Close-out

- [ ] 5.1 Update `lat.md` graph where managed-R2 staging state is load-bearing (bucket names, env model) — after the verification is green, not before.
- [ ] 5.2 Surface the smoke summary for human approval, then commit locally per the no-PR loop (§3.8 Verification sections on every commit; no push without approval).
- [ ] 5.3 If any protocol step fails: file the bug (with the failing run ID) against the writer/dedup/engine code as its own change; do not proceed to the next step or to any prod planning until resolved.
