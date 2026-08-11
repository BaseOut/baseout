## Overview

Eight phases. Phase A (schema) → B (resolver) → C (gates) lands first as the load-bearing "trial blocks subsequent runs" milestone. D (engine callback) is a one-line UPDATE in the existing complete-handler. E (emails) and F (conversion) layer on top. G (UI) and H (docs) close the loop.

The architectural call: **the trial state machine lives entirely in `apps/web`**. The engine doesn't know about phases or emails — it only knows about the per-run record / table / attachment caps and which run-status to assign. apps/web reads the engine's terminal status, updates `subscription_items.trial_backup_run_used`, then gates subsequent runs at the route layer.

## Phase A — Schema

```sql
-- Whichever table owns Stripe subscription state. Likely `subscription_items` or `subscriptions`.
ALTER TABLE baseout.subscription_items
  ADD COLUMN is_trial boolean NOT NULL DEFAULT false,
  ADD COLUMN trial_started_at timestamp with time zone,
  ADD COLUMN trial_ends_at timestamp with time zone,
  ADD COLUMN trial_backup_run_used boolean NOT NULL DEFAULT false,
  ADD COLUMN trial_converted_at timestamp with time zone,
  ADD COLUMN trial_expiry_warning_sent_at timestamp with time zone,
  ADD COLUMN trial_expired_email_sent_at timestamp with time zone;
```

Backfill: existing subscriptions that are currently the trial flavour get `is_trial=true` + a computed `trial_ends_at` (from `created_at + interval '7 days'`).

## Phase B — Trial-state resolver

```ts
// apps/web/src/lib/billing/trial-state.ts

type TrialState =
  | { phase: 'none' }
  | { phase: 'active'; daysRemaining: number; runUsed: boolean; endsAt: Date }
  | { phase: 'expired_no_conversion'; expiredAt: Date }
  | { phase: 'converted'; convertedAt: Date }

resolveTrialState(orgId: string, platform: string = 'airtable', now: Date = new Date()): Promise<TrialState>
```

Logic:

```
SELECT * FROM subscription_items WHERE org_id = $1 AND platform = $2
if (!row) return { phase: 'none' }
if (row.trial_converted_at) return { phase: 'converted', convertedAt: row.trial_converted_at }
if (!row.is_trial) return { phase: 'none' }  // never was a trial
if (now > row.trial_ends_at) return { phase: 'expired_no_conversion', expiredAt: row.trial_ends_at }
const daysRemaining = ceil((row.trial_ends_at - now) / (24 * 60 * 60 * 1000))
return { phase: 'active', daysRemaining, runUsed: row.trial_backup_run_used, endsAt: row.trial_ends_at }
```

Pure modulo the DB lookup. Tests inject a `dbRow` stub + `now`.

## Phase C — Pre-flight gates

### Manual-run gate

```ts
// apps/web/src/pages/api/spaces/[spaceId]/backup-runs.ts
const trial = await resolveTrialState(account.organizationId)
switch (trial.phase) {
  case 'active':
    if (trial.runUsed) return 402 { error: 'trial_run_used' }
    break
  case 'expired_no_conversion':
    return 402 { error: 'trial_expired_upgrade_required', expiredAt: trial.expiredAt }
  case 'none':
  case 'converted':
    // proceed
}
```

### Config PATCH gate

```ts
// apps/web/src/pages/api/spaces/[spaceId]/backup-config.ts
const trial = await resolveTrialState(account.organizationId)
if (trial.phase === 'active' || trial.phase === 'expired_no_conversion') {
  const allowed = ['monthly']
  if (!allowed.includes(body.frequency)) {
    return 400 { error: 'frequency_not_available_at_tier', allowed }
  }
}
```

### Scheduled-run gate (SpaceDO alarm)

In `SpaceDO.fireCronRun()` (from `server-schedule-and-cancel`):

```ts
const trial = await resolveTrialState(orgId)
if (trial.phase === 'active' && trial.runUsed) {
  log({ event: 'trial_scheduled_run_skipped_run_used', spaceId })
  return  // skip the INSERT and the engine call
}
if (trial.phase === 'expired_no_conversion') {
  log({ event: 'trial_scheduled_run_skipped_expired', spaceId })
  return
}
// proceed with the INSERT + run start
```

## Phase D — Engine post-run callback

In `apps/server/src/pages/api/internal/runs/complete.ts`, after the existing UPDATE that sets `backup_runs.status`:

```ts
if (input.status === 'trial_complete' || input.status === 'trial_truncated') {
  // Flip the run-used flag
  await db.update(subscriptionItems)
    .set({ trialBackupRunUsed: true })
    .where(and(
      eq(subscriptionItems.organizationId, run.organizationId),
      eq(subscriptionItems.platform, 'airtable'),
      eq(subscriptionItems.isTrial, true),
    ))
  log({ event: 'trial_run_used_flipped', orgId: run.organizationId })
}
```

The engine doesn't need to know about emails or upgrade flows — it just sets the flag.

## Phase E — Email lifecycle

### Templates

Under `apps/web/src/emails/`:

- `trial-welcome.tsx` — sent on sign-up. Subject: "Welcome to Baseout — your 7-day trial starts now".
- `trial-expiry-warning.tsx` — sent on day 5. Subject: "Your Baseout trial ends in 2 days".
- `trial-expired.tsx` — sent on day 7. Subject: "Your Baseout trial has ended — upgrade to keep going".

### Cron task

`apps/workflows/trigger/tasks/trial-email-cron.task.ts` runs daily:

```ts
const subs = await db.select(...).from(subscriptionItems).where(eq(subscriptionItems.isTrial, true))
for (const sub of subs) {
  const trial = computeTrialPhaseFromRow(sub, new Date())

  if (trial.phase === 'active' && trial.daysRemaining === 2 && !sub.trial_expiry_warning_sent_at) {
    await sendEmail('trial-expiry-warning', sub.organizationId)
    await db.update(...).set({ trial_expiry_warning_sent_at: new Date() })
  }
  if (trial.phase === 'expired_no_conversion' && !sub.trial_expired_email_sent_at) {
    await sendEmail('trial-expired', sub.organizationId)
    await db.update(...).set({ trial_expired_email_sent_at: new Date() })
  }
}
```

Welcome email is sent inline from the sign-up flow (not via cron) — it's transactional, not scheduled.

## Phase F — Conversion flow

### Upgrade button → Stripe Checkout

```ts
// apps/web/src/pages/api/billing/start-conversion.ts
const subItem = await db.select(...).from(subscriptionItems).where(...)
const session = await stripe.checkout.sessions.create({
  customer: subItem.stripe_customer_id,
  subscription: subItem.stripe_subscription_id,  // existing $0 subscription
  payment_method_collection: 'always',
  mode: 'subscription',
  line_items: [{ price: targetTierPriceId, quantity: 1 }],
  // Stripe handles the price swap on the existing subscription
})
return new Response(JSON.stringify({ checkoutUrl: session.url }))
```

### Stripe webhook handler

```ts
// apps/web/src/pages/api/webhooks/stripe.ts (extend)
case 'customer.subscription.updated': {
  const sub = event.data.object
  const wasTrial = sub.metadata?.previously_trial === 'true'
  const isNowPaid = sub.items.data[0].price.unit_amount > 0

  if (wasTrial && isNowPaid) {
    await db.update(subscriptionItems)
      .set({
        is_trial: false,
        trial_converted_at: new Date(),
        trial_backup_run_used: false,  // unblock manual runs
      })
      .where(eq(subscriptionItems.stripe_subscription_id, sub.id))
  }
}
```

## Phase G — UI

### Trial badge

`apps/web/src/components/layout/Sidebar.astro` — header section:

```astro
{trialState.phase === 'active' && (
  <span class={`badge ${trialState.daysRemaining <= 2 ? 'badge-warning' : 'badge-info'}`}>
    Trial · {trialState.daysRemaining}d left
  </span>
)}
{trialState.phase === 'expired_no_conversion' && (
  <span class="badge badge-error">Trial expired</span>
)}
```

### Trial Expired modal

A daisyUI `<dialog>` triggered on every page load when `phase === 'expired_no_conversion'`. Blocks interaction; "Upgrade now" button → `/api/billing/start-conversion`.

### 402 response handling

When the manual-run button receives a 402 `trial_run_used` or `trial_expired_upgrade_required`, show an inline upgrade prompt instead of a generic error toast.

## Wire shapes

| Direction | Path | Verb | Change |
|---|---|---|---|
| apps/web → apps/web | `/api/spaces/:id/backup-runs` POST | response: 402 `trial_run_used` / `trial_expired_upgrade_required` added |
| apps/web → apps/web | `/api/spaces/:id/backup-config` PATCH | response: 400 `frequency_not_available_at_tier` added for trial |
| apps/web → apps/web | `/api/billing/start-conversion` POST | new — returns Stripe Checkout URL |
| engine → apps/web (existing `/runs/complete`) | unchanged | side effect: flips trial_backup_run_used |

## Testing strategy

| Layer | Coverage |
|---|---|
| Pure | `resolveTrialState(row, now)` — every (`is_trial × trial_ends_at vs now × trial_backup_run_used × trial_converted_at`) combination. |
| Pure | `computeTrialPhaseFromRow(row, now)` — used by cron without DB hit. |
| Integration | apps/web manual-run gate — 200 / 402 trial_run_used / 402 trial_expired. |
| Integration | apps/web config-PATCH gate — 400 frequency_not_available_at_tier for Trial setting `daily`. |
| Integration | SpaceDO alarm fire — skips when run-used, fires when not. |
| Integration | Engine /runs/complete — flips flag on `trial_complete` status. |
| Integration | Trial-email cron — sends day-5 warning + day-7 expiry idempotently. |
| Integration | Stripe webhook — converts trial to paid; flag cleared. |
| Playwright | New Org sign-up → confirm trial badge shows 7d → run a backup, hit cap → see trial_complete → Run button disabled with "Trial run used — upgrade" CTA → click Upgrade → Stripe Checkout (mocked) → return → badge gone, Run button enabled. |

## Master DB migration

`apps/web/drizzle/0015_trial_quota_enforcement.sql` per Phase A. Engine schema mirror updated.

## Operational concerns

- **Existing trials**: backfill `is_trial`, `trial_started_at`, `trial_ends_at` from `created_at + 7 days` for currently-trialing subscriptions. Script: `apps/web/scripts/backfill-trial-state.mjs`. Idempotent.
- **Stripe-side trial**: Stripe has its own trial-period concept. We track ours separately because the cap logic (1 run + record/table/attachment limits) isn't time-based — and Stripe's `trial_end` doesn't auto-trigger anything on our side except the auto-conversion to paid. Keep both consistent: `trial_ends_at` matches `stripe_subscription.trial_end`.
- **Email deliverability**: trial emails are high-value; ensure they land in inbox not promotions. Operational follow-up: set up DMARC + DKIM for the sending domain per [PRD §15.5](../../../shared/Baseout_PRD.md).
- **Race condition on conversion**: customer clicks Upgrade while the cron fires the Day 7 expiry email. Either order is acceptable; idempotent `_sent_at` flags prevent duplicates.

## What this design deliberately doesn't change

- The engine's per-run cap logic. Already enforces records/tables/attachments mid-run; this change only enforces post-run blocking.
- Stripe Checkout flow shape. Reuses existing patterns; doesn't introduce a new mode.
- The Org/Space hierarchy. Trial is per platform per Org; per-Space rules unchanged.
- The auth flow. Trial sign-up reuses better-auth magic-link path.
