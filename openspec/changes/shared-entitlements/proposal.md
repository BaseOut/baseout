# shared-entitlements

## Why

The final pricing model (`research/pricing/pricing-guide.md`, locked 2026-08-03) defines four plans, ~24 tiered levers, a flat add-on library, and warn-at-90%/enforce-at-100% limit behavior — but the codebase has no way to represent, resolve, meter, or enforce any of it. Today capabilities are resolved from Stripe product metadata (`platform` + `tier`, Features §5.5) with values hardcoded in specs, there is no per-account exception mechanism, and nothing measures usage against limits. This change builds the entitlement backbone: a DB-native plan + feature catalog, per-account resolution with sparse overrides and add-ons, Space-level usage metering rolled up to the master DB, and enforcement with notification skeletons wired into the sync flow.

## What Changes

- **Plan catalog** — a `plans` table (status lifecycle so plans can be deactivated without deletion) mapped to Stripe products, and a `plan_prices` table mapping each plan to its Stripe prices (monthly/annual, amounts cached).
- **Feature catalog** — `feature_groups` (display grouping: Backup, Restore & retention, Data access, AI & intelligence, Collaboration, Governance & security, Support) and `features` (stable slug, typed: `boolean | limit | enum`, unit, meter linkage), plus `plan_features` holding each feature's value per plan. The full pricing-guide matrix is seeded as data.
- **Account entitlements** — subscriptions link an Organization to a plan price (Stripe-synced, multiple purchasable items per subscription); **sparse per-account overrides** (`account_feature_overrides`) that replace the plan value for one feature on one org, so plan edits propagate everywhere except where intentionally overridden; **add-on purchases** (recurring or one-time, one-time rows carrying an expiration) that stack quantity on top of the base value; and a single **effective-entitlement resolution** function: `effective = (override ?? plan value) + active add-on quantity`.
- **BREAKING — capability resolution moves off Stripe metadata.** Stripe metadata keeps only the stable plan slug for reconciliation; values live in the catalog. Supersedes Features §5.5's "gate from product metadata" rule (already queued for rewrite by the pricing lock).
- **Usage metering** — usage is *measured* at the Space level (backup runs, per-Space DB size, file bytes, AI/API/SQL calls) and *stored authoritatively* in the master DB: per-Space usage samples reported through the existing engine callback flow plus a periodic reconciliation sweep; org-level rollups per meter per billing period (flow meters reset on the subscription period; stock meters are point-in-time levels).
- **Limit enforcement + notification skeletons** — a per-org/per-meter evaluation in the sync/rollup flow: warning state at 90% of the effective limit, enforcement signal at 100%, honoring never-fail-mid-job (background meters pause at the next job boundary; interactive meters stop at point of use; creation caps block at the action). A notification state machine (`ok → warned_90 → warned_100 → enforced`, reset each period) deduplicates alerts; the actual notification senders are **skeleton functions** (placeholder implementations receiving meter, usage, limit, and overage-percent details).
- **Utilization UI wiring** — the existing Space-dashboard utilization placeholders get real data, plus a **settings Usage page** showing overall account usage and a per-Space breakdown of every meterable feature, with warning states surfaced in both. (Visual/UX design of the views is authored in the paired ui-only change `usage-and-billing`; this change owns endpoints, wiring, and data shape.)
- **Notifications are a simple email, not just skeletons** (scope expanded 2026-08-03) — the warning/enforced notifiers send a basic email (existing Mailgun + React Email stack) naming the feature, usage, limit, and overage percent, with the matching add-on/upgrade link. Content polish is future work; delivery is real.
- **Billing checkout & plan changes** (scope expanded) — in-app purchase of plans (monthly/annual), upgrades/downgrades with Stripe proration, and add-on purchase/cancellation, driving the subscription + `addon_purchases` state this change defines.
- **Trial lifecycle** (scope expanded) — the 14-day deletion clock: trial state tracking, escalating "your backup will be deleted on {date}" emails, the deletion job at expiry, and upgrade-cancels-clock.
- **Legacy migration registry** (scope expanded) — a `legacy_customers` table (schema only — the On2Air export/import itself is out of scope) holding email, legacy plan, mapped Baseout tier, and redemption state. At signup, a match auto-applies the 20% lifetime floating discount (Stripe coupon) and surfaces it in the signup/checkout UI.
- **Enterprise contracts via overrides** (decision, was an open question) — Enterprise orgs sit on an `enterprise` base plan row and receive their contracted values as **per-account overrides for every contracted feature**, managed through the admin panel (paired change `admin-entitlements`).

## Capabilities

### New Capabilities

- `plan-catalog`: the plans table, Stripe product/price mapping, and plan status lifecycle.
- `feature-catalog`: feature groups, typed features, per-plan values, and the seeded pricing matrix.
- `account-entitlements`: subscription→plan linkage, sparse overrides, add-on purchases (recurring/one-time with expiry), and the effective-entitlement resolution rule.
- `usage-metering`: Space-level measurement, master-DB rollup, and billing-period-anchored usage accounting for every metered feature.
- `limit-enforcement`: the 90%/100% evaluation, per-class enforcement behavior, notification state machine, and simple-email notifiers.
- `usage-visibility`: the usage/limits data endpoints, Space-dashboard utilization wiring, and the settings Usage page.
- `billing-checkout`: plan purchase, upgrade/downgrade with proration, and add-on purchase flows.
- `trial-lifecycle`: the 14-day trial deletion clock, warning emails, deletion job, and upgrade cancellation.
- `legacy-migration-registry`: the `legacy_customers` table, signup matching, and automatic 20% lifetime discount application.

### Modified Capabilities

_None in `openspec/specs/` (no archived capability owns subscription gating). Supersessions of un-archived material are noted in place: Features §5.5 metadata-gating (this proposal), the `subscription_items.tier` text column as the gating source (kept as a cached display value only), and `overage_records`' role (retained for future metered per-unit billing; purchased add-ons are a new, separate concept)._

## Impact

- **Multi-app (`shared-` prefix), decomposable into follow-ups once the schema lands:**
  - `apps/web` — owns all master-DB migrations (new tables + seed data); Stripe webhook handling extended to sync subscription/add-on state; entitlement resolution library; usage/limits API endpoints; dashboard utilization wiring; ops/admin surfaces read the same resolution.
  - `apps/server` — usage rollup ingestion (`/api/internal/*`), the enforcement evaluation in the scheduler/sync flow, pre-run limit checks in the per-Space scheduler DO, notification skeleton dispatch.
  - `apps/workflows` — backup tasks report usage counters (records, file bytes, DB size) in their existing progress/complete callbacks; incremental tasks report deltas.
  - `packages/db-schema` — shared table definitions consumed by web (canonical migrations), server, and admin mirrors.
- **DB:** new tables (`plans`, `plan_prices`, `feature_groups`, `features`, `plan_features`, `account_feature_overrides`, `addon_purchases`, `usage_rollups`, `usage_notification_state`, per-Space usage sample ingestion); `subscription_items` gains a `plan_id` reference; no destructive changes to existing tables.
- **Stripe:** products/prices for the four plans + add-on SKUs; webhooks drive subscription and add-on lifecycle; one-time packs expire at period end via `addon_purchases.expiresAt`.
- **Security:** entitlement writes (overrides, plan edits) are staff-only and audit-logged; internal usage-report routes stay behind `INTERNAL_TOKEN`; no customer-facing mutation surfaces beyond Stripe-driven purchases.
- **Specs supersession:** `shared/Baseout_Features.md` §3–§5 (tier matrix, quotas, Stripe metadata schema) must be reconciled to the pricing guide + this model — flagged, not bundled here.
- **Paired changes:** `admin-entitlements` (apps/admin — catalog CRUD, override management, Enterprise contract editor, legacy-registry browser) in this repo; `usage-and-billing` in the ui-only repo (visual design of the usage page, utilization warnings, checkout/upgrade flows, signup discount banner). Cross-referenced, no code coupling — this change's endpoints and schema are their substrate.
- **Supersedes (absorbed, do not build in parallel):** `server-trial-quota-enforcement` + `workflows-trial-quota-enforcement` (retired 7-day/1,000-record trial → Phase 7 trial-lifecycle); `server-manual-quota-and-credits` + `workflows-manual-quota-and-credits` (retired credit-metered auto-overage → Phase 3 metering + Phase 4 creation-cap enforcement + the flat add-on library). Each carries a supersession banner pointing here.
- **Consumes / gated by structural changes:** `system-r2-bucket-topology` (per-account R2 buckets, D16 — the file-storage meter substrate + clean churn deletion) and `shared-db-isolation-ladder` (per-Space DB provisioning across the isolation ladder — the `database_isolation_class` gate + `database_size` meter substrate). Filed separately; this change represents and measures the levers, those changes provision them.
