## Why

[PRD §1.5](../../../shared/Baseout_PRD.md) defines the trial:

> - **Time-limited:** 7 days from sign-up; subscription ends at day 7 with upgrade prompt
> - **Data-capped:** Max 1,000 records, 5 tables, 100 attachments. Backup completes successfully at the cap and notifies the user it was a limited trial preview
> - **No credit card required** for trial. Stripe subscription created automatically at $0 on sign-up

And [PRD §11 Open Question #21 resolved](../../../shared/Baseout_PRD.md):

> Trial: 7 days + 1 backup run; caps: 1,000 records, 5 tables, 100 attachments

The engine has the building blocks today (per [openspec/changes/baseout-server/specs/backup-engine/spec.md](../baseout-server/specs/backup-engine/spec.md) Requirement "Trial cap enforcement"): it caps records + tables + attachments mid-run and sets `status='trial_complete'`. What's missing:

1. **`subscription_items.trial_backup_run_used`** column writes — engine never flips it; subsequent run-start has no gate.
2. **Per-run-start gate** — refuses subsequent runs when `trial_backup_run_used=true`.
3. **7-day expiry** — there's no cron that flips trials to expired on day 7.
4. **Frequency lockout** — a Trial Space picking `daily` or `instant` should be rejected at config-PATCH time.
5. **Email lifecycle** — Trial Welcome (sign-up), Trial Expiry Warning (day 5), Trial Expired (day 7).
6. **Conversion flow** — collect credit card → swap subscription from $0 trial to paid plan per [PRD §17.1](../../../shared/Baseout_PRD.md).

[Features §5.6.4](../../../shared/Baseout_Features.md) adds that trials are per-platform; trial eligibility is one-per-platform-per-Org-ever. The conversion path is Stripe-native (the trial subscription converts to paid automatically on Stripe's side at day 7 unless cancelled).

## What Changes

### Phase A — Schema

- **New columns on `subscription_items`** (or `subscriptions` depending on existing shape):
  - `is_trial boolean NOT NULL DEFAULT false`
  - `trial_started_at timestamp with time zone NULL`
  - `trial_ends_at timestamp with time zone NULL`
  - `trial_backup_run_used boolean NOT NULL DEFAULT false`
  - `trial_converted_at timestamp with time zone NULL`
- **Schema mirror** in engine.
- The schema may overlap with existing Stripe-sync columns; reconcile before generating the migration.

### Phase B — Trial-state resolver

- New helper `apps/web/src/lib/billing/trial-state.ts`:

  ```ts
  type TrialState =
    | { phase: 'none' }
    | { phase: 'active'; daysRemaining: number; runUsed: boolean }
    | { phase: 'expired_no_conversion'; expiredAt: Date }
    | { phase: 'converted'; convertedAt: Date }

  resolveTrialState(orgId: string, platform: string, now: Date): Promise<TrialState>
  ```

### Phase C — Pre-flight enforcement

Three gates added at the apps/web routes:

1. **`POST /api/spaces/:id/backup-runs`** (manual-run): if `trialState.phase === 'active' && trialState.runUsed`, return 402 `trial_run_used`. If `phase === 'expired_no_conversion'`, return 402 `trial_expired_upgrade_required`.
2. **`PATCH /api/spaces/:id/backup-config`** (frequency): reject `frequency ∈ ('daily', 'weekly', 'instant')` for Trial-tier per [Features §4.2](../../../shared/Baseout_Features.md) — Trial allows monthly only. Trial-eligible Spaces can still pick `monthly` and run their one scheduled backup before the 7-day expiry.
3. **Scheduled-run alarm fire** (in SpaceDO from `baseout-backup-schedule-and-cancel`): on alarm, check trial state; if `phase === 'active' && runUsed`, skip the alarm-fire INSERT and log `event: 'trial_scheduled_run_skipped_run_used'`.

### Phase D — Engine post-run callback

The engine's `/runs/complete` already sets `status='trial_complete'` or `'trial_truncated'` when caps hit. Add: on either of those statuses, UPDATE `subscription_items.trial_backup_run_used=true` for the Org's Airtable subscription item. Subsequent run-start gate blocks until conversion.

### Phase E — Email lifecycle

Three new emails via Mailgun + React Email templates (per CLAUDE.md §3.3):

1. **Trial Welcome** — sent on sign-up. Onboarding CTA.
2. **Trial Expiry Warning** — sent on day 5 of the 7-day trial. Upgrade CTA.
3. **Trial Expired** — sent on day 7 when the engine refuses a run.

A daily Trigger.dev scheduled task checks `subscriptions.trial_ends_at` against `now()`, dispatches the day-5 warning + day-7 expiry emails. Idempotent — `subscriptions.trial_expiry_warning_sent_at` + `trial_expired_email_sent_at` columns track which emails have been sent.

### Phase F — Conversion flow

Per [PRD §17.1](../../../shared/Baseout_PRD.md):

> Stripe subscription created at sign-up — $0 free trial subscription, no credit card required. On upgrade, credit card collected and subscription price swapped to paid plan on the existing subscription object

- **Upgrade button** on the Trial Expired page (and on settings → billing): redirects to Stripe Checkout in "swap subscription" mode.
- **Stripe webhook handler** for `customer.subscription.updated` events: when the new tier ≠ trial, set `subscription_items.trial_converted_at` + clear the run-used block. Subsequent runs proceed.

### Phase G — UI

- **Trial badge** in the dashboard header: "Trial · N days remaining" with a colour change at < 2 days.
- **Trial Expired modal** on every page when `phase === 'expired_no_conversion'`. Blocks interaction until Convert button is clicked.
- **Onboarding wizard** writes the trial subscription on Org create (already exists in some form).

### Phase H — Doc sync

- Update [openspec/changes/baseout-server/specs/backup-engine/spec.md](../baseout-server/specs/backup-engine/spec.md) trial-cap requirement — point to this change as the implementation of the pre-flight gate.
- Update [openspec/changes/baseout-server-schedule-and-cancel/proposal.md](../baseout-server-schedule-and-cancel/proposal.md) Out-of-Scope.
- Update [shared/Baseout_Backlog_MVP.md](../../../shared/Baseout_Backlog_MVP.md).

## Out of Scope

| Deferred to | Item |
|---|---|
| Future change `baseout-trial-restart-on-cancel` | Allow re-trial after the first trial expires. Today: one trial per platform per Org, ever. |
| Future change `baseout-trial-extend-by-admin` | Admin-side "grant extra trial days" button. MVP relies on the fixed 7-day window. |
| Future change `baseout-trial-multi-platform` | When Notion / Salesforce trials launch, the per-platform trial scoping. MVP: Airtable-only. |
| Future change `baseout-trial-checkout-credit-card-precollect` | Pre-collecting card at sign-up (optional, simplifies conversion). MVP: collect at conversion time. |
| Bundled with `baseout-backup-attachments` | The 100-attachment trial cap. Engine reports `attachmentsDownloaded`; gate consumed here. |
| Bundled with `baseout-backup-manual-quota-and-credits` | Trial-tier credit cap ($0 → activity pauses). The credit-ledger change treats Trial as `cap, pause, $0`. |

## Capabilities

### New capabilities

- `trial-state-resolution` — central resolver for trial phase + days remaining + run-used flag. Owned by `apps/web`.
- `trial-enforcement-gate` — pre-flight checks on manual-run + config-PATCH + scheduled-run-alarm paths.
- `trial-email-lifecycle` — Welcome / Day 5 / Day 7 emails.

### Modified capabilities

- `backup-engine` — `/runs/complete` flips `trial_backup_run_used=true` on trial-terminal statuses.
- `subscriptions-management` — adds `is_trial`, `trial_*` lifecycle columns; Stripe webhook handler updates them.
- `backup-config-policy` — frequency gating per trial.
- `space-do` (cron-fire path) — checks trial state before firing.

## Impact

- **Master DB**: additive columns on `subscription_items`.
- **Stripe**: no new Stripe surface in MVP. Conversion uses Stripe's existing subscription-update flow.
- **Cron**: one daily scheduled task for trial-expiry emails.
- **Customer effort**: zero added burden. The trial limits enforce themselves; the customer sees upgrade prompts at the right times.
- **Cross-app contract**:
  - apps/web → engine: existing `POST /api/spaces/:id/backup-runs` gains 402 responses for trial states. No new wire shapes.
  - engine → apps/web: `/runs/complete` body unchanged; the trial-status values were already in the response schema. Side-effect of flipping `trial_backup_run_used` is internal to apps/server's complete-handler.

## Reversibility

- **Phase A** (schema): additive.
- **Phase B–C** (state + gate): roll-forward. Reverting removes the 402 responses; runs proceed unchecked (current behavior).
- **Phase D** (engine callback): pure-additive UPDATE.
- **Phase E** (emails): feature-flag.
- **Phase F–G**: roll-forward; UI / Stripe-webhook removal restores pre-change behavior.

The only forward-only data is the `trial_backup_run_used` flag transitioning to `true` on a Space. If we revert, the flag persists; future re-enable consumes it correctly.
