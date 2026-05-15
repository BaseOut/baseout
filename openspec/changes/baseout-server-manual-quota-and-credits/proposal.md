## Why

Manual backup runs are free today. The route at [apps/web/src/pages/api/spaces/[spaceId]/backup-runs.ts](../../../apps/web/src/pages/api/spaces/%5BspaceId%5D/backup-runs.ts) accepts any POST from an authenticated user and triggers `BackupEngineClient.startRun(...)` without checking quota or charging credits. Per [Features §4.2](../../../shared/Baseout_Features.md):

| Tier | Included manual runs/mo |
|---|---|
| Trial / Starter | 0 (manual not available) |
| Launch | 2 |
| Growth | 5 |
| Pro / Business / Enterprise | Unlimited |

And per [Features §5.2](../../../shared/Baseout_Features.md):

> | Operation | Credit Cost | Unit |
> |---|---|---|
> | Schema / metadata backup | 5 credits | Per base, per run |
> | Record data transfer | 1 credit | Per 1,000 records |
> | Attachment data transfer | 1 credit | Per 50 MB |
> | Manual backup trigger | 10 credits | Per on-demand run (beyond included monthly count) |
> | Smart cleanup — manual trigger | 10 credits | Per manual trigger |

So a real implementation needs three independent meters:

1. **Per-run included-count meter** — `manualBackupRunsThisPeriod` per Space, reset on Stripe billing period rollover. After the included count is consumed, manual runs cost 10 credits each.
2. **Per-activity credit meter** — every scheduled or manual backup run consumes credits for schema + records + attachments per the §5.2 schedule. Today's engine reports nothing.
3. **Overage policy enforcement** — per [Features §5.5 overage control settings](../../../shared/Baseout_Features.md), each Org has `overage_mode ∈ {auto, cap}` and a dollar cap. When credits run out and `overage_mode='cap'`, all creditable activity pauses.

Without this change, customers on the Launch tier can spam manual backup runs at no cost, and customers on every tier are burning credits without observability. Both are real bugs the moment we charge for the product.

This change does not implement Stripe billing reconciliation for credits — that's a separate concern owned by Stripe webhooks and end-of-period charge reporting. This change owns the per-activity meter and the user-facing dashboard that shows the balance.

**One cross-change dependency to flag**: `baseout-backup-retention-and-cleanup` Phase D charges 10 credits per manual cleanup trigger. The credit-charge surface lives here. If this change ships first, the retention change consumes it. If retention ships first, it ships with a TODO that this change resolves.

## What Changes

### Phase A — Credit-ledger schema

- **New table `credit_ledger`** in master DB. One row per credit transaction (debit or credit):
  - `id uuid PK`
  - `organization_id uuid FK → organizations.id`
  - `space_id uuid NULL FK → spaces.id` (NULL for org-level transactions like add-on purchases)
  - `direction text NOT NULL CHECK (direction IN ('debit', 'credit'))`
  - `operation text NOT NULL` — e.g. `'backup_record_transfer'`, `'backup_attachment_transfer'`, `'backup_schema_metadata'`, `'backup_manual_trigger'`, `'cleanup_manual_trigger'`, `'monthly_plan_grant'`, `'addon_purchase'`, `'overage_reset'`
  - `credits int NOT NULL` — always positive; direction encodes sign
  - `run_id uuid NULL FK → backup_runs.id` (NULL when not run-attributable)
  - `billing_period_start timestamp with time zone NOT NULL` — denormalized for fast period-balance queries
  - `metadata jsonb NULL` — operation-specific extra info (e.g. `{ records: 12345 }`)
  - `created_at timestamp with time zone DEFAULT now()`
- **New table `credit_balances`** — fast-lookup running balance per Org per billing period:
  - `organization_id uuid`, `billing_period_start timestamp with time zone` — composite PK
  - `total_granted int` — plan credits + add-on credits + onboarding/promo
  - `total_consumed int` — sum of debits this period
  - `overage_credits int DEFAULT 0` — credits consumed beyond `total_granted`
  - `overage_dollars_cents int DEFAULT 0` — denormalized dollar value of `overage_credits` × tier rate
  - `last_updated_at timestamp with time zone`
- **New column on `backup_runs`**: `credits_charged int DEFAULT 0`. Set on `/runs/complete` after the engine reports per-operation counts. Lets the history widget show per-run cost.
- **New columns on `organizations`** (or on `subscription_items`, depending on how the existing billing schema is shaped): `overage_mode text DEFAULT 'cap' CHECK (overage_mode IN ('auto', 'cap'))`, `overage_dollar_cap_cents int NULL`, `cap_action text DEFAULT 'pause' CHECK (cap_action IN ('pause', 'notify_only'))`. The exact home for these depends on existing schema; the resolver in Phase B abstracts it.

### Phase B — Capability resolution

Extend `apps/web/src/lib/billing/capabilities.ts` with:

- `resolveManualBackupQuota(tier) → { includedPerPeriod: number, overageCreditCost: 10, available: boolean }`. Trial/Starter return `available: false`.
- `resolveCreditCosts() → { recordTransferPer1000: 1, attachmentTransferPer50MB: 1, schemaMetadataPerBase: 5, manualBackupTrigger: 10, cleanupManualTrigger: 10 }`. Read from a DB-backed config table per [Features §5.2](../../../shared/Baseout_Features.md) note "All rates are stored in the database and can be adjusted without code deploys". If no DB row, fall back to the table.
- `resolveOverageRate(tier) → { dollarsPerCredit: 0.008 | 0.007 | 0.006 | 0.005 | 0.004 }` per [Features §5.1](../../../shared/Baseout_Features.md).

### Phase C — Pre-flight gate for manual runs

The existing `POST /api/spaces/:spaceId/backup-runs` route gains a quota gate **before** it INSERTs the `backup_runs` row:

```ts
const quota = await resolveManualBackupQuota(account.tier)
if (!quota.available) {
  return 403 { error: 'manual_backup_not_available_at_tier' }
}
const usedThisPeriod = await countManualRunsThisPeriod(spaceId, currentBillingPeriodStart)
if (usedThisPeriod >= quota.includedPerPeriod) {
  // Overage path
  const balance = await getCreditBalance(orgId, currentBillingPeriodStart)
  const overageAllowed = checkOverageAllowed(balance, account.overage_settings, quota.overageCreditCost)
  if (!overageAllowed) {
    return 402 { error: 'insufficient_credits_capped', creditsNeeded: 10, creditsAvailable: balance.remaining }
  }
}
// Insert run + charge credits at end via /runs/complete
```

### Phase D — Per-operation credit reporter

Engine emits per-operation counts in the `/runs/complete` payload (additive):

```ts
{
  runId,
  status,
  recordCount, tableCount, attachmentCount,
  attachmentBytes,    // NEW — total bytes downloaded this run (sum of dedup-miss sizes)
  basesProcessed,     // count of bases that completed schema fetch
  triggerSource,      // 'manual' | 'scheduled' | 'webhook'
}
```

apps/web's `/runs/complete` consumer computes credit cost:

```
schemaCredits   = basesProcessed × resolveCreditCosts().schemaMetadataPerBase
recordCredits   = ceil(recordCount / 1000) × resolveCreditCosts().recordTransferPer1000
attachmentCredits = ceil(attachmentBytes / (50 * 1024 * 1024)) × resolveCreditCosts().attachmentTransferPer50MB
manualOverageCredits = (triggerSource === 'manual' && quotaOver) ? 10 : 0
totalCredits = schemaCredits + recordCredits + attachmentCredits + manualOverageCredits
```

Then INSERTs the ledger rows (one per operation type) + updates `credit_balances.total_consumed` + sets `backup_runs.credits_charged = totalCredits`.

### Phase E — Dashboard surfaces

- **Settings page** `apps/web/src/pages/billing/credits.astro`:
  - Header: "X / Y credits used this period" + a progress bar + the period reset date.
  - Recent transactions table — last 50 ledger rows.
  - Overage settings card — `overage_mode` toggle, `overage_dollar_cap_cents` input, alert threshold checkboxes (50% / 75% / 90% / 100%).
- **Per-run history widget**: each row in [BackupHistoryWidget.astro](../../../apps/web/src/components/backups/BackupHistoryWidget.astro) gains a `credits_charged` column.
- **Run-now button**: when included-count is exhausted, the button label becomes `Run backup now (10 credits)` and a confirmation dialog shows the credit balance + impact.

### Phase F — Alert system

When the credit balance crosses a threshold (50% / 75% / 90% / 100%), the system emails the Org admins per [Features §5.5](../../../shared/Baseout_Features.md). Cron-based check or balance-update hook (decision in design.md). When `overage_mode='cap'` and the dollar cap is reached, send `cap_action == 'pause'` → 402 on every creditable operation; `cap_action == 'notify_only'` → continue + send alert.

### Phase G — Stripe overage reporting

End-of-period: emit a Stripe usage event for each Org's `overage_credits × tier_rate`. Out of scope for first pass — this change captures the credits; the Stripe webhook integration is a separate billing-side change. Document the contract here so the Stripe side knows the source-of-truth shape.

### Phase H — Doc sync

- Update [openspec/changes/baseout-server-schedule-and-cancel/proposal.md](../baseout-server-schedule-and-cancel/proposal.md) and [openspec/changes/baseout-server-retention-and-cleanup/proposal.md](../baseout-server-retention-and-cleanup/proposal.md) to link this change as the resolved credit-charge surface.
- Add a CLAUDE.md section in `apps/web/.claude/` describing the credit ledger + how to charge from a new operation.

## Out of Scope

| Deferred to | Item |
|---|---|
| Future change `baseout-billing-stripe-overage-reporting` | End-of-period Stripe usage events for overage billing. This change tracks `overage_credits` but does not push to Stripe. |
| Future change `baseout-credit-addon-purchase` | Stripe add-on purchase flow for one-time / recurring credit packs per Features §5.4. |
| Future change `baseout-credit-promo-grants` | Admin-side surface for issuing promotional credits + onboarding credits. |
| Future change `baseout-credit-export-csv` | CSV export of the ledger for accounting. |
| Bundled with `baseout-backup-trial-quota-enforcement` | Trial-tier credit grant ($0 + activity pauses when credits exhausted per Features §5.1). Trial has no overage path; this change's overage logic treats Trial as `cap, pause, $0_cap`. |
| Bundled with `baseout-backup-attachments` | Attachment-bytes counting. The engine reports `attachmentBytes` in `/runs/complete`; this change consumes it. If attachments hasn't shipped, `attachmentBytes=0` and the credit cost is just schema + records. |

## Capabilities

### New capabilities

- `backup-credit-ledger` — append-only ledger of credit debits/credits per Org. Owned by `apps/web`.
- `backup-credit-balance` — running per-period balance with overage tracking. Owned by `apps/web`.
- `backup-manual-quota` — included-per-period counter for manual runs with tier-gated overage. Owned by `apps/web`.

### Modified capabilities

- `backup-engine` — `/runs/complete` payload gains `attachmentBytes`, `basesProcessed`, `triggerSource` fields. Engine doesn't compute credit cost; that's the frontend's job.
- `backup-runs-history-ui` — adds `credits_charged` column per row.
- `account-settings-ui` — adds `/billing/credits` settings page + overage controls.
- `capability-resolution` — gains `resolveManualBackupQuota`, `resolveCreditCosts`, `resolveOverageRate`.

## Impact

- **Master DB**: one additive migration with two new tables + nullable columns on `organizations` (or wherever overage settings land). Indexed for fast period-balance queries.
- **Stripe**: no Stripe API changes in MVP. Phase G (overage reporting) is the integration point for the follow-up.
- **Cron**: one new daily cron (Trigger.dev scheduled task) to refresh `credit_balances` rows after a billing-period rollover. Or hook to Stripe webhook for the period boundary. Decision in design.md.
- **Cost surface**: this change captures the credit-cost-of-doing-business. Engine R2 + Trigger.dev compute costs are unchanged.
- **Observability**: `event: 'credit_charged'` log per ledger insert with `{ orgId, operation, credits, runId? }`. PostHog event for credit milestones (first overage, alert threshold crossed, etc.).
- **Security**: ledger is append-only at the application layer (DB has no constraint enforcing this — the route layer rejects UPDATEs to ledger rows). Overage settings live under Org-admin permissions only.
- **Cross-app contract**:
  - engine → apps/web (`/runs/complete`): additive fields per Phase D.
  - apps/web → apps/web (`POST /api/spaces/:id/backup-runs`): additive response codes — 402 `insufficient_credits_capped`, 403 `manual_backup_not_available_at_tier`.
  - new internal: `apps/server` does NOT need to read the ledger. Credit decisions are all frontend-side.

## Reversibility

- **Phase A** (schema): additive.
- **Phase B** (resolver): pure function addition.
- **Phase C** (quota gate): turning off the gate falls back to the current behavior (anything goes).
- **Phase D** (per-op reporter): engine fields are additive; apps/web can ignore them.
- **Phase E** (dashboard): pure UI add.
- **Phase F** (alerts): feature-flag the email send; alerts can be silenced.
- **Phase G** (Stripe): not implemented here.

The only forward-only data is the `credit_ledger` table itself — ledger rows can be inserted but never updated (by convention). If we ship the gate, then realize a tier is mis-configured and customers got blocked, recovery is to grant compensating credits via a new ledger row (`direction='credit'`, `operation='admin_grant'`).
