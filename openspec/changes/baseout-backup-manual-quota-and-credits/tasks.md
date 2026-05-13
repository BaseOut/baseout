## Phase A — Schema

### A.1 — Migration

- [ ] A.1.1 Verify `organizations` table exists with the expected shape (id, etc.). If not, surface a blocker — overage settings need a home. Migration target: `apps/web/drizzle/0010_credit_ledger_and_quota.sql`.
- [ ] A.1.2 Generate the migration per design.md §"Master DB migration".
- [ ] A.1.3 Apply via `pnpm --filter @baseout/web db:migrate`. Verify all three tables + new columns landed.
- [ ] A.1.4 Update [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) — add `creditLedger`, `creditBalances` table defs + new `backupRuns.creditsCharged` + new `organizations` columns.

### A.2 — Engine awareness (minimal)

- [ ] A.2.1 The engine only needs to read `subscription_items` (which it likely already does for tier-based behavior). No new mirror needed; engine doesn't read the ledger.

## Phase B — Capability resolution

### B.1 — `resolveManualBackupQuota`

- [ ] B.1.1 TDD red: extend `apps/web/src/lib/billing/capabilities.test.ts` with `resolveManualBackupQuota` cases. Pin every tier per [Features §4.2](../../../shared/Baseout_Features.md).
- [ ] B.1.2 Implement in [apps/web/src/lib/billing/capabilities.ts](../../../apps/web/src/lib/billing/capabilities.ts). Watch green.

### B.2 — `resolveCreditCosts`

- [ ] B.2.1 New table `credit_cost_config` (single-row config, seed with defaults). Migration `0011_credit_cost_config.sql`.
- [ ] B.2.2 TDD red: `resolveCreditCosts` returns DB row when present; falls back to hardcoded defaults when DB row missing.
- [ ] B.2.3 Implement. Watch green.

### B.3 — `resolveOverageRate`

- [ ] B.3.1 TDD red: pin all seven tiers per [Features §5.1](../../../shared/Baseout_Features.md).
- [ ] B.3.2 Implement.

## Phase C — Quota gate

### C.1 — Pure helpers

- [ ] C.1.1 TDD red: `countManualRunsThisPeriod(spaceId, periodStart)` — happy path + edge case where `triggered_by` was 'scheduled' (doesn't count).
- [ ] C.1.2 TDD red: `checkOverageAllowed(balance, settings, cost)` — all combinations per design.md §Phase C `checkOverageAllowed` logic table.
- [ ] C.1.3 Implement both. Watch green.

### C.2 — Wire into run-start route

- [ ] C.2.1 Update [apps/web/src/pages/api/spaces/[spaceId]/backup-runs.ts](../../../apps/web/src/pages/api/spaces/%5BspaceId%5D/backup-runs.ts) POST handler. Add the quota gate per design.md §Phase C.
- [ ] C.2.2 Extend the test file with: 403 unavailable-at-tier (Trial/Starter); 200 within included; 200 over included with overage_mode=auto; 402 over included with overage_mode=cap+pause; 200 over included with overage_mode=cap+notify_only.

### C.3 — Period-start resolver

- [ ] C.3.1 `currentBillingPeriodStart(orgId)` — reads from `subscriptions.current_period_start` if synced from Stripe. Else fall back to the Org's `created_at` calendar-month boundary. Document in tests.
- [ ] C.3.2 If Stripe sync doesn't exist, file blocker. Acceptable for MVP: hardcode "calendar month from Org `created_at`" with a TODO.

## Phase D — Per-operation credit reporter

### D.1 — Engine payload extension

- [ ] D.1.1 Update the `/runs/complete` request schema in `apps/server/src/pages/api/internal/runs/complete.ts` to accept `attachmentBytes`, `basesProcessed`, `triggerSource`. Make them optional during rollout, then strict.
- [ ] D.1.2 Update `apps/server/trigger/tasks/backup-base.ts` to track `attachmentBytesByBase` and emit it as part of the per-base completion payload.
- [ ] D.1.3 Update the aggregator in `apps/server/src/pages/api/internal/runs/complete.ts` to sum these across bases.

### D.2 — Credit-cost arithmetic

- [ ] D.2.1 TDD red: `computeRunCredits(payload, costs)` cases per design.md §Phase D testing. Schema-only; records-only; attachments-only; full run; manual-with-overage; scheduled (no trigger fee).
- [ ] D.2.2 Implement `apps/web/src/lib/billing/compute-run-credits.ts`.

### D.3 — Ledger writes

- [ ] D.3.1 TDD red: `applyRunCompletionWithCredits(payload, deps)` — extends the existing `applyRunCompletion` (Phase 8b) with credit insertion. Asserts ledger rows + balance UPSERT + `credits_charged` UPDATE all happen atomically.
- [ ] D.3.2 Implement. Use `db.transaction` per Drizzle conventions.

### D.4 — `applyCreditDebit` pure function

- [ ] D.4.1 TDD red: `applyCreditDebit(balance, credits)` — under-grant + at-grant + over-grant paths.
- [ ] D.4.2 Implement in `apps/web/src/lib/billing/apply-credit-debit.ts`.

## Phase E — Dashboard

### E.1 — Server-side data load

- [ ] E.1.1 New page `apps/web/src/pages/billing/credits.astro` per design.md §Phase E. Server-side loads `balance`, `recentLedger`, `overageSettings`.
- [ ] E.1.2 New components `apps/web/src/components/billing/CreditUsageHeader.astro`, `RecentLedgerTable.astro`, `OverageSettingsCard.astro`.

### E.2 — PATCH overage-settings route

- [ ] E.2.1 TDD red: `PATCH /api/organizations/:id/overage-settings` — 401 / 403 (non-admin) / 400 (invalid values) / 200.
- [ ] E.2.2 Implement.

### E.3 — Per-run history widget

- [ ] E.3.1 Extend [BackupHistoryWidget.astro](../../../apps/web/src/components/backups/BackupHistoryWidget.astro) — add `credits_charged` column.
- [ ] E.3.2 Update [apps/web/src/lib/backups/format.ts](../../../apps/web/src/lib/backups/format.ts) — `formatCreditsCharged(n)` helper.

### E.4 — Run-now button confirmation

- [ ] E.4.1 When clicked, the run-backup button calls a `/api/spaces/:id/quota-preview` route that returns the per-run cost if this would be an overage run. The dialog shows: "This is run #3 / 2 included — cost: 10 credits. Continue?".
- [ ] E.4.2 Vitest for the confirmation dialog logic.

## Phase F — Alerts

### F.1 — Threshold-crossing detection

- [ ] F.1.1 New Trigger.dev scheduled task `apps/server/trigger/tasks/credit-balance-alerts.task.ts`. Daily cron. For each Org with credit activity, compare yesterday's `total_consumed/total_granted` ratio to today's; on crossing 50/75/90/100%, enqueue an email via Mailgun.
- [ ] F.1.2 Tests: pure function `detectCrossings(prevRatio, currRatio): Threshold[]` covers all cases.

### F.2 — Email templates

- [ ] F.2.1 React Email templates under `apps/web/src/emails/credit-alert-{50,75,90,100}.tsx`. Subject + body shaped per Features §5.5.
- [ ] F.2.2 Test snapshots.

### F.3 — 402 response includes alert metadata

- [ ] F.3.1 Update the 402 response shape from Phase C.2 to include `remaining`, `granted`, `capDollars`, `raiseCapUrl`.

## Phase G — Stripe overage reporting (documented, not implemented)

- [ ] G.1 Document the contract per design.md §Phase G in this change's README. Phase G implementation lives in a separate `baseout-billing-stripe-overage-reporting` change.

## Phase H — Documentation scope-lock

- [ ] H.1 Update [openspec/changes/baseout-backup-schedule-and-cancel/proposal.md](../baseout-backup-schedule-and-cancel/proposal.md) — link this change as the resolved credit-charge surface.
- [ ] H.2 Update [openspec/changes/baseout-backup-retention-and-cleanup/proposal.md](../baseout-backup-retention-and-cleanup/proposal.md) — link this change as resolving the Phase D credit-charge interlock.
- [ ] H.3 Add `apps/web/.claude/CLAUDE.md` (or relevant CLAUDE.md) note on how to charge credits from a new operation: `(1) add operation name to ledger; (2) extend resolveCreditCosts to expose its rate; (3) call applyCreditDebit in transaction`.

## Phase I — Final verification

- [ ] I.1 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` — all green.
- [ ] I.2 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` — all green.
- [ ] I.3 Human checkpoint smoke:
  - Seed a Launch Space. Confirm run 1+2 are free; run 3 prompts a 10-credit confirm + writes a ledger row.
  - Visit `/billing/credits` — confirm balance bar + recent transactions match.
  - Toggle `overage_mode=cap`, set cap to $0; attempt run 4 — observe 402 + alert email.
- [ ] I.4 On approval: stage by name, commit locally.

## Out of this change (follow-ups, file separately)

- [ ] OUT-1 `baseout-billing-stripe-overage-reporting` — End-of-period Stripe usage events for overage billing.
- [ ] OUT-2 `baseout-credit-addon-purchase` — Stripe checkout flow for one-time + recurring credit packs.
- [ ] OUT-3 `baseout-credit-promo-grants` — Admin surface for issuing promotional / onboarding credits.
- [ ] OUT-4 `baseout-credit-export-csv` — Ledger CSV export for accounting.
- [ ] OUT-5 `baseout-credit-cost-admin-ui` — Admin UI for editing `credit_cost_config` rates without DB access.
