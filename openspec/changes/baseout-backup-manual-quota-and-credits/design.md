## Overview

Eight phases. The load-bearing chain is A (schema) → B (resolver) → C (quota gate) → D (per-op reporter). E/F/G/H are layered surfaces. The gate at C ships first as a "block-only-but-don't-charge" milestone so the user-facing 402 behavior is correct before the credit ledger has any rows in it (zero-credit MVP).

The architectural call: **the credit ledger lives entirely in apps/web; the engine reports raw counts.** This keeps the engine ignorant of pricing policy. The engine writes `recordCount`, `attachmentBytes`, `basesProcessed`, `triggerSource` to `/runs/complete`; apps/web does the arithmetic + the ledger inserts. Future re-pricing changes nothing in apps/server.

## Phase A — Schema design

### `credit_ledger`

Append-only log. Every credit transaction (debit or credit) is one row.

```sql
CREATE TABLE baseout.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES baseout.organizations(id) ON DELETE CASCADE,
  space_id uuid NULL REFERENCES baseout.spaces(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('debit', 'credit')),
  operation text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  run_id uuid NULL REFERENCES baseout.backup_runs(id) ON DELETE SET NULL,
  billing_period_start timestamp with time zone NOT NULL,
  metadata jsonb NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX credit_ledger_org_period_idx ON baseout.credit_ledger (organization_id, billing_period_start);
CREATE INDEX credit_ledger_run_idx ON baseout.credit_ledger (run_id) WHERE run_id IS NOT NULL;
```

No UPDATE/DELETE at the application layer. If a credit row needs to be reversed, insert a compensating row (`direction='credit'`, `operation='admin_reversal'`, `metadata={ reversedLedgerId: ... }`).

### `credit_balances`

Materialized per-period summary. Updated incrementally on every ledger INSERT (via app-layer trigger logic in the same transaction, not a Postgres trigger). Lets the dashboard render without a full ledger scan.

```sql
CREATE TABLE baseout.credit_balances (
  organization_id uuid NOT NULL REFERENCES baseout.organizations(id) ON DELETE CASCADE,
  billing_period_start timestamp with time zone NOT NULL,
  total_granted integer NOT NULL DEFAULT 0,
  total_consumed integer NOT NULL DEFAULT 0,
  overage_credits integer NOT NULL DEFAULT 0,
  overage_dollars_cents integer NOT NULL DEFAULT 0,
  last_updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (organization_id, billing_period_start)
);
```

### Per-run column + Org overage settings

```sql
ALTER TABLE baseout.backup_runs ADD COLUMN credits_charged integer NOT NULL DEFAULT 0;

ALTER TABLE baseout.organizations
  ADD COLUMN overage_mode text NOT NULL DEFAULT 'cap' CHECK (overage_mode IN ('auto', 'cap')),
  ADD COLUMN overage_dollar_cap_cents integer NULL,
  ADD COLUMN cap_action text NOT NULL DEFAULT 'pause' CHECK (cap_action IN ('pause', 'notify_only'));
```

If `organizations` doesn't exist or has a different shape, these columns may need to live on `subscription_items` instead. Check before generating the migration.

## Phase B — Capability resolution

In `apps/web/src/lib/billing/capabilities.ts`:

```ts
type ManualBackupQuota = {
  available: boolean
  includedPerPeriod: number
  overageCreditCost: number
}

resolveManualBackupQuota(tier: TierName): ManualBackupQuota
// Trial/Starter:     { available: false, includedPerPeriod: 0,  overageCreditCost: 10 }
// Launch:            { available: true,  includedPerPeriod: 2,  overageCreditCost: 10 }
// Growth:            { available: true,  includedPerPeriod: 5,  overageCreditCost: 10 }
// Pro/Business/Ent:  { available: true,  includedPerPeriod: Infinity, overageCreditCost: 0 }

type CreditCosts = {
  recordTransferPer1000: number
  attachmentTransferPer50MB: number
  schemaMetadataPerBase: number
  manualBackupTrigger: number
  cleanupManualTrigger: number
}

resolveCreditCosts(): Promise<CreditCosts>
// Reads from a DB-backed `credit_cost_config` row OR falls back to:
// { recordTransferPer1000: 1, attachmentTransferPer50MB: 1, schemaMetadataPerBase: 5,
//   manualBackupTrigger: 10, cleanupManualTrigger: 10 }
```

The async-on-`resolveCreditCosts` is the cost of the "rates stored in DB, adjustable without code deploy" requirement.

## Phase C — Quota gate

Inside the existing `apps/web/src/pages/api/spaces/[spaceId]/backup-runs.ts` POST handler, BEFORE the existing `BackupEngineClient.startRun(...)` call:

```ts
const quota = resolveManualBackupQuota(account.subscriptionTier)
if (!quota.available) {
  return new Response(JSON.stringify({ error: 'manual_backup_not_available_at_tier' }), { status: 403 })
}

const periodStart = currentBillingPeriodStart(account.organizationId)
const usedThisPeriod = await db.select(count(*)).from(backupRuns)
  .where(and(
    eq(backupRuns.spaceId, spaceId),
    eq(backupRuns.triggeredBy, 'manual'),
    gte(backupRuns.createdAt, periodStart),
  ))

if (usedThisPeriod >= quota.includedPerPeriod) {
  // Overage path
  const balance = await getCreditBalance(account.organizationId, periodStart)
  const cost = quota.overageCreditCost
  if (!checkOverageAllowed(balance, account.overageSettings, cost)) {
    return new Response(JSON.stringify({
      error: 'insufficient_credits_capped',
      creditsNeeded: cost,
      creditsAvailable: balance.remaining,
    }), { status: 402 })
  }
}
```

`checkOverageAllowed` logic:

```
remaining = total_granted - total_consumed
if remaining >= cost: return true
if overage_mode == 'auto': return true (will tip into overage_credits at /runs/complete time)
if overage_mode == 'cap' && cap_action == 'notify_only': return true (alert sent separately)
if overage_mode == 'cap' && cap_action == 'pause': return false
```

## Phase D — Per-operation credit reporter

### Engine-side additive payload

In `apps/server/src/pages/api/internal/runs/complete.ts`:

```ts
type CompletePayload = {
  // existing fields
  runId: string
  status: BackupRunStatus
  recordCount: number
  tableCount: number
  attachmentCount: number
  errorMessage?: string

  // new fields (additive)
  attachmentBytes: number
  basesProcessed: number
  triggerSource: 'manual' | 'scheduled' | 'webhook'
}
```

The engine populates these from the per-base task results. `attachmentBytes` is the sum of `size_bytes` from `attachment_dedup` inserts during this run (dedup hits don't count). `basesProcessed` is the number of `backup_run_bases` rows that reached `succeeded`.

### apps/web ledger writes

apps/web's existing `applyRunCompletion` path (Phase 8b) is the consumer. After it UPDATEs `backup_runs.status='succeeded'`:

```ts
const costs = await resolveCreditCosts()
const schemaCredits   = basesProcessed * costs.schemaMetadataPerBase
const recordCredits   = Math.ceil(recordCount / 1000) * costs.recordTransferPer1000
const attachmentCredits = Math.ceil(attachmentBytes / (50 * 1024 * 1024)) * costs.attachmentTransferPer50MB

const manualOverageCredits =
  triggerSource === 'manual' && (await countManualRunsThisPeriod(spaceId, periodStart, includingThisRun=true)) > quota.includedPerPeriod
    ? costs.manualBackupTrigger
    : 0

const totalCredits = schemaCredits + recordCredits + attachmentCredits + manualOverageCredits

await db.transaction(async (tx) => {
  if (schemaCredits > 0) await tx.insert(creditLedger).values({ ..., operation: 'backup_schema_metadata', credits: schemaCredits })
  if (recordCredits > 0) await tx.insert(creditLedger).values({ ..., operation: 'backup_record_transfer', credits: recordCredits, metadata: { records: recordCount } })
  if (attachmentCredits > 0) await tx.insert(creditLedger).values({ ..., operation: 'backup_attachment_transfer', credits: attachmentCredits, metadata: { bytes: attachmentBytes } })
  if (manualOverageCredits > 0) await tx.insert(creditLedger).values({ ..., operation: 'backup_manual_trigger', credits: manualOverageCredits })

  await tx.update(backupRuns).set({ creditsCharged: totalCredits }).where(eq(backupRuns.id, runId))

  await updateCreditBalance(tx, orgId, periodStart, +totalCredits)
})
```

`updateCreditBalance` is an UPSERT that increments `total_consumed`. If `total_consumed > total_granted`, the excess gets added to `overage_credits` instead. Whole logic is encapsulated in a pure function `applyCreditDebit(balance, credits): UpdatedBalance` for testing.

### Charge on the run-start path (manual-trigger overage)

Note: the manual-trigger 10-credit charge is **per-run**, not per-base. It charges only when `usedThisPeriod >= includedPerPeriod`. So:

| Tier | Included | Run #1 (free) | Run #2 (free) | Run #3 | Run #4 |
|---|---|---|---|---|---|
| Launch | 2 | 0 cr | 0 cr | 10 cr trigger + activity | 10 cr trigger + activity |
| Growth | 5 | 0–4: 0 cr each | | Run #6: 10 cr trigger + activity | |
| Pro+ | ∞ | every run: 0 cr trigger + activity | | | |

The "+ activity" part (schema + records + attachments credits) is charged on every run regardless of trigger source.

## Phase E — Dashboard

New page `apps/web/src/pages/billing/credits.astro`. SSR-loads:

```ts
const balance = await getCreditBalance(orgId, currentBillingPeriodStart(orgId))
const recentLedger = await db.select(...).from(creditLedger)
  .where(eq(creditLedger.organizationId, orgId))
  .orderBy(desc(creditLedger.createdAt))
  .limit(50)
const overageSettings = await db.select(...).from(organizations).where(eq(organizations.id, orgId))
```

UI components (under `apps/web/src/components/billing/`):

- `CreditUsageHeader.astro` — progress bar `total_consumed / total_granted` + period reset countdown.
- `RecentLedgerTable.astro` — `[ created_at | operation | direction | credits | space | run_id-link ]` table.
- `OverageSettingsCard.astro` — form for `overage_mode`, `overage_dollar_cap_cents`, `cap_action`, alert thresholds. PATCHes `/api/organizations/:id/overage-settings`.

## Phase F — Alerts

Two trigger points:

1. **Threshold crossing** — when `total_consumed / total_granted` crosses 50% / 75% / 90% / 100%, send the appropriate email. Implementation: a daily Trigger.dev cron task scans `credit_balances` and compares each Org's previous-day ratio to today's; on threshold crossing, dispatches email via Mailgun.
2. **Overage-cap reached** — when `total_consumed > total_granted` and `overage_mode='cap'` and `cap_action='pause'`, all subsequent creditable POSTs return 402. The 402 response shape and the alert email both include "raise cap" CTA + link.

## Phase G — Stripe overage reporting

Out of scope for this change. Documented as a contract:

- At billing period end (Stripe webhook `invoice.created`), apps/web queries each Org's `credit_balances.overage_credits` for the period and reports a Stripe usage event:
  ```
  POST /v1/subscription_items/<usage_meter_item_id>/usage_records
  Body: { quantity: overage_credits, timestamp: period_end, action: 'set' }
  ```
- The `overage_credits × tier_rate` arithmetic is Stripe-side (the usage meter is priced per-credit at the tier's overage rate).

## Wire shapes

| Direction | Path | Verb | Change |
|---|---|---|---|
| engine → apps/web | `/runs/complete` | POST | additive: `attachmentBytes`, `basesProcessed`, `triggerSource` |
| apps/web → apps/web | `/api/spaces/:id/backup-runs` | POST | additive responses: 402 `insufficient_credits_capped`, 403 `manual_backup_not_available_at_tier` |
| apps/web → apps/web | `/api/organizations/:id/overage-settings` | PATCH | new |
| apps/web → apps/web | `/api/organizations/:id/credit-balance` | GET | new (powers the dashboard) |

## Testing strategy

| Layer | Coverage |
|---|---|
| Pure | `resolveManualBackupQuota` — all seven tiers. |
| Pure | `resolveCreditCosts` — DB hit returns config; DB miss returns fallback. |
| Pure | `applyCreditDebit(balance, credits)` — under-grant: bumps `total_consumed`; at-grant: zero left, no overage; over-grant: increments `overage_credits`. |
| Pure | `checkOverageAllowed(balance, settings, cost)` — all combinations of `overage_mode × cap_action × remaining`. |
| Pure | `computeRunCredits(complete payload, costs)` — schema-only run; records-only; attachments-only; full run; manual-with-overage; scheduled (no manual trigger fee). |
| Integration | Manual-run POST quota gate — 401 / 403 unavailable-at-tier / 402 capped / 200 happy. |
| Integration | `applyRunCompletion` with credit insert — assert the ledger rows + `credits_charged` + `credit_balances` row are written atomically in one transaction. |
| Integration | Period rollover — Stripe webhook (mocked) advances the period, balance resets, ledger queries the new period's rows. |
| Playwright | Use up the Launch quota (2 included), click Run-backup-now, see the "10 credit" confirmation dialog, confirm, verify ledger row appears. |

## Master DB migration

`apps/web/drizzle/0010_credit_ledger_and_quota.sql`:

```sql
CREATE TABLE baseout.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES baseout.organizations(id) ON DELETE CASCADE,
  space_id uuid NULL REFERENCES baseout.spaces(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('debit', 'credit')),
  operation text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  run_id uuid NULL REFERENCES baseout.backup_runs(id) ON DELETE SET NULL,
  billing_period_start timestamp with time zone NOT NULL,
  metadata jsonb NULL,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX credit_ledger_org_period_idx ON baseout.credit_ledger (organization_id, billing_period_start);
CREATE INDEX credit_ledger_run_idx ON baseout.credit_ledger (run_id) WHERE run_id IS NOT NULL;

CREATE TABLE baseout.credit_balances (
  organization_id uuid NOT NULL REFERENCES baseout.organizations(id) ON DELETE CASCADE,
  billing_period_start timestamp with time zone NOT NULL,
  total_granted integer NOT NULL DEFAULT 0,
  total_consumed integer NOT NULL DEFAULT 0,
  overage_credits integer NOT NULL DEFAULT 0,
  overage_dollars_cents integer NOT NULL DEFAULT 0,
  last_updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (organization_id, billing_period_start)
);

ALTER TABLE baseout.backup_runs ADD COLUMN credits_charged integer NOT NULL DEFAULT 0;

ALTER TABLE baseout.organizations
  ADD COLUMN overage_mode text NOT NULL DEFAULT 'cap' CHECK (overage_mode IN ('auto', 'cap')),
  ADD COLUMN overage_dollar_cap_cents integer NULL,
  ADD COLUMN cap_action text NOT NULL DEFAULT 'pause' CHECK (cap_action IN ('pause', 'notify_only'));
```

## Operational concerns

- **Billing period boundary**: getting `currentBillingPeriodStart(orgId)` right is critical. Stripe stores the subscription's `current_period_start` on the `subscriptions` row; apps/web should already have this synced from Stripe webhooks. If not, this change blocks on adding the sync.
- **Atomicity**: all credit writes (ledger INSERT + balance UPSERT + `backup_runs.credits_charged` UPDATE) MUST happen in a single Postgres transaction. The `applyRunCompletion` flow is the orchestration boundary.
- **Backfill**: existing `backup_runs` (manual + scheduled) get `credits_charged=0`. No historical credit accounting; the meter starts at deploy. Acceptable.
- **Cost adjustment**: per Features §5.2, rates are DB-stored. Adjustment is a single `credit_cost_config` row update; no code deploy. Operational runbook: change the row, observe the next `/runs/complete` reads the new rate (no caching layer for first pass).

## What this design deliberately doesn't change

- The Trigger.dev backup task. The engine reports raw counts; arithmetic stays in apps/web.
- Stripe Checkout / subscription management. Separate billing-side change.
- Free Trial accounting. Out of scope — `baseout-backup-trial-quota-enforcement` owns the Trial-tier credit cap.
- The on-demand / scheduled distinction in `backup_runs.triggered_by`. Already exists; this change consumes it.
