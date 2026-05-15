## Phase A — Schema

- [ ] A.1 Verify which existing table owns Stripe subscription state (likely `subscription_items` or `subscriptions`). Reconcile column names with existing Stripe-sync code.
- [ ] A.2 Generate `apps/web/drizzle/0015_trial_quota_enforcement.sql` per design.md §Phase A.
- [ ] A.3 Apply migration; verify columns landed.
- [ ] A.4 Update `apps/web/src/db/schema/core.ts`.
- [ ] A.5 Engine mirror.
- [ ] A.6 Backfill script `apps/web/scripts/backfill-trial-state.mjs` for currently-trialing rows. Idempotent.

## Phase B — Trial-state resolver

- [ ] B.1 TDD red: `apps/web/src/lib/billing/trial-state.test.ts`. Pin every phase × every row-state combination per design.md §Phase B logic.
- [ ] B.2 Implement `apps/web/src/lib/billing/trial-state.ts` — `resolveTrialState` + `computeTrialPhaseFromRow` (pure). Watch green.

## Phase C — Pre-flight gates

### C.1 — Manual-run gate

- [ ] C.1.1 TDD red: extend the existing `apps/web/src/pages/api/spaces/[spaceId]/backup-runs.test.ts` with: 402 `trial_run_used`, 402 `trial_expired_upgrade_required`.
- [ ] C.1.2 Add the gate in the POST handler per design.md §Phase C.

### C.2 — Config PATCH gate

- [ ] C.2.1 TDD red: extend the backup-config PATCH test with `frequency='daily'` on a trial Space → 400.
- [ ] C.2.2 Add the gate.

### C.3 — SpaceDO alarm gate

- [ ] C.3.1 TDD red: extend the SpaceDO test (from `baseout-backup-schedule-and-cancel`) with a trial-run-used scenario → alarm fires but skips INSERT + log emitted.
- [ ] C.3.2 Add the trial check in `fireCronRun()`.

## Phase D — Engine /runs/complete callback

- [ ] D.1 TDD red: extend `apps/server/tests/integration/runs-complete.test.ts` with a `status='trial_complete'` case → `trial_backup_run_used=true` UPDATE issued.
- [ ] D.2 Add the conditional UPDATE in `apps/server/src/pages/api/internal/runs/complete.ts`.

## Phase E — Email lifecycle

### E.1 — Templates

- [ ] E.1.1 New React Email templates `apps/web/src/emails/trial-welcome.tsx`, `trial-expiry-warning.tsx`, `trial-expired.tsx`.
- [ ] E.1.2 Snapshot tests for each.

### E.2 — Sign-up Welcome email

- [ ] E.2.1 Wire the Welcome email into the existing sign-up flow (better-auth post-create hook).

### E.3 — Day 5 / Day 7 cron (workflows sibling)

Trial-email cron task owned by [`baseout-workflows-trial-quota-enforcement`](../baseout-workflows-trial-quota-enforcement/tasks.md). Server side owns:

- [ ] E.3.1 New `apps/server/src/pages/api/internal/trials/expiring.ts` — GET `?in=7,3,1,0` → list of orgs with trials expiring in the requested windows.
- [ ] E.3.2 New `apps/server/src/pages/api/internal/orgs/:id/trial-email.ts` — POST `{ daysRemaining }` → Mailgun template render + send.
- [ ] E.3.3 Idempotency columns `trial_expiry_warning_sent_at` + `trial_expired_email_sent_at` prevent duplicate sends.
- [ ] E.3.4 Tests: pure function `decideTrialEmails(row, now)` → which emails to send. Lives in `apps/server/tests/integration/`.

## Phase F — Conversion flow

### F.1 — Start-conversion route

- [ ] F.1.1 New apps/web route `POST /api/billing/start-conversion` per design.md §Phase F.
- [ ] F.1.2 TDD: 401 / 404 (no trial) / 200 with Stripe Checkout URL.

### F.2 — Stripe webhook handler

- [ ] F.2.1 Extend the existing Stripe webhook handler for `customer.subscription.updated`.
- [ ] F.2.2 Detect trial → paid transition; update `subscription_items` columns per design.md §Phase F.
- [ ] F.2.3 Tests with mocked Stripe event payloads.

## Phase G — UI

### G.1 — Trial badge

- [ ] G.1.1 Extend [Sidebar.astro](../../../apps/web/src/components/layout/Sidebar.astro) to show trial badge per design.md §Phase G.
- [ ] G.1.2 Server-side data: trial state already loaded via account context.

### G.2 — Trial Expired modal

- [ ] G.2.1 New component `apps/web/src/components/layout/TrialExpiredModal.astro`. Renders on every page when `phase === 'expired_no_conversion'`.
- [ ] G.2.2 Upgrade button hits `/api/billing/start-conversion` and redirects to the returned Checkout URL.

### G.3 — 402 inline UX

- [ ] G.3.1 Update the Run-backup button click handler to detect 402 responses + render an inline upgrade prompt.
- [ ] G.3.2 Tests for the click-error-render path.

## Phase H — Doc sync

- [ ] H.1 Update [openspec/changes/baseout-server/specs/backup-engine/spec.md](../baseout-server/specs/backup-engine/spec.md) trial-cap requirement — link this change as the pre-flight gate.
- [ ] H.2 Update [openspec/changes/baseout-server-schedule-and-cancel/proposal.md](../baseout-server-schedule-and-cancel/proposal.md) Out-of-Scope.
- [ ] H.3 Update [shared/Baseout_Backlog_MVP.md](../../../shared/Baseout_Backlog_MVP.md).

## Phase I — Final verification

- [ ] I.1 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` — all green.
- [ ] I.2 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` — all green.
- [ ] I.3 Human checkpoint smoke:
  - New Org sign-up → Trial Welcome email received.
  - Trial badge shows "7d left" → 6 → 5.
  - Run a backup that hits the 1000-record cap → run lands `trial_complete` → run button disabled, "Trial run used — upgrade" CTA.
  - Mock day-5 by setting `trial_ends_at = now() + 2 days` → trial cron fires → Trial Expiry Warning email received.
  - Mock day-7 by setting `trial_ends_at = now() - 1 hour` → cron fires Trial Expired email + Trial Expired modal renders on next page load.
  - Click Upgrade → Stripe Checkout (sandbox) → return → badge gone, run button enabled.
- [ ] I.4 On approval: stage by name, commit locally.

## Out of this change (follow-ups, file separately)

- [ ] OUT-1 `baseout-trial-restart-on-cancel` — Allow re-trial after expiry.
- [ ] OUT-2 `baseout-trial-extend-by-admin` — Admin "grant extra days" button.
- [ ] OUT-3 `baseout-trial-multi-platform` — Per-platform trial scoping for future Notion/Salesforce.
- [ ] OUT-4 `baseout-trial-checkout-credit-card-precollect` — Pre-collect card at sign-up.
- [ ] OUT-5 `baseout-trial-conversion-discount` — Auto-apply discount on trial-to-paid conversion within X days.
