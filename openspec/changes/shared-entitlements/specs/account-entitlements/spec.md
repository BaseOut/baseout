# account-entitlements

What an Organization is actually entitled to: plan × overrides × add-ons.

## ADDED Requirements

### Requirement: Subscriptions link Organizations to plans via Stripe

`subscription_items` SHALL reference the `plans` row (`plan_id`) alongside the existing Stripe identifiers; subscription lifecycle (create/update/cancel, period boundaries) SHALL be maintained by Stripe webhooks with idempotent, event-ID-keyed handlers. An Organization MAY hold multiple purchasable items (its plan plus add-on items) under its subscription. The legacy `tier` text remains as cached display only.

#### Scenario: Webhook updates plan linkage

- **WHEN** a Stripe webhook reports a subscription item moved to the Plus plan's price
- **THEN** the item's `plan_id` resolves to Plus via `plan_prices`, and subsequent entitlement resolutions use Plus values

### Requirement: Sparse per-account overrides

The system SHALL store `account_feature_overrides` — one row per (organization, feature) intentional exception, with a typed value matching the feature's type, a required reason, the granting staff user, an optional expiry, and audit logging on every write. Overrides SHALL be the only per-account entitlement storage: no per-account copies of un-overridden features exist.

#### Scenario: One-off grant without a plan change

- **WHEN** staff grants an Organization 20 Spaces while its plan includes 10
- **THEN** a single override row exists, the Organization resolves 20, and every other plan value for that Organization continues to track the plan

#### Scenario: Plan edits skip overridden accounts only

- **WHEN** the plan's Spaces value later changes from 10 to 12
- **THEN** the overridden Organization still resolves 20, and all non-overridden Organizations resolve 12

#### Scenario: Expired override falls back

- **WHEN** an override with an expiry passes its expiration
- **THEN** resolution returns the plan value again without any manual cleanup

### Requirement: Add-on purchases stack on the base value

The system SHALL store `addon_purchases` — Stripe-synced purchases of add-on SKUs with feature slug, quantity, unit amount (per the locked library, e.g. +100K records, +2 GB DB, +1,000 credits), kind (`recurring | one_time`), status, and for one-time purchases an `expires_at` (set to the current billing-period end). Expired or cancelled purchases SHALL stop contributing.

#### Scenario: Recurring add-on raises the limit

- **WHEN** a Core Organization buys 2× the records add-on (+100K each)
- **THEN** its effective records limit resolves to 950,000 for as long as the add-on items are active

#### Scenario: One-time pack expires at period end

- **WHEN** a one-time 1,000-credit pack is purchased mid-cycle
- **THEN** it contributes until the period ends and contributes nothing afterward

### Requirement: Single effective-entitlement resolution

The system SHALL expose one resolution function used by every consumer (web, server, admin): `effective(org, feature) = (override.value ?? plan value) + Σ active add-on quantities` (add-on stacking applies to limit-type features only; boolean/enum features resolve override-else-plan). Consumers SHALL NOT gate on Stripe metadata, `tier` strings, or direct table reads.

#### Scenario: Override and add-on compose

- **WHEN** an Organization has a records override of 1,000,000 and one +100K add-on
- **THEN** the effective records limit is 1,100,000 (override replaces the plan value; add-on stacks on top)

#### Scenario: Every consumer answers identically

- **WHEN** web middleware, the server scheduler, and the admin console each resolve the same Organization's `backup_frequency_max`
- **THEN** all three return the same value from the shared resolution logic

### Requirement: Lapsed and cancelled subscriptions have defined entitlements

During Stripe dunning (`past_due`), entitlements SHALL continue resolving from the plan unchanged (payment recovery, not punishment — Stripe's retry schedule governs). On cancellation (`cancelled` / subscription ended), the Organization SHALL enter a **churn grace state**: scheduled backups stop, all data remains intact and readable, and restore/export remain available for a grace window; after the window, stored backup data is deleted per the departed-customer cleanup policy (window: **30 days**, locked by founder 2026-08-03, held as config) with warning notifications on the same email machinery as limit warnings. Re-subscribing within the window restores full service with data intact.

#### Scenario: Dunning doesn't cut service

- **WHEN** an Organization's payment fails and Stripe begins retries
- **THEN** backups and access continue on plan entitlements while the subscription is `past_due`

#### Scenario: Cancellation preserves an exit path

- **WHEN** an Organization cancels
- **THEN** scheduled backups stop, existing data stays readable and restorable through the grace window, deletion warnings are sent before the window closes, and re-subscribing inside the window resumes service with nothing lost

### Requirement: Enterprise contracts are full override sets

Enterprise Organizations SHALL sit on the single `enterprise` plan row (conservative baseline values) with their contracted terms expressed as per-account overrides on every contracted feature, entered through the admin contract surface (paired change `admin-entitlements`). Enterprise resolution SHALL use the identical resolution path as every other plan — no special-casing.

#### Scenario: Contract terms resolve like any override

- **WHEN** an Enterprise contract grants 20M records and 10-year retention
- **THEN** those resolve from override rows over the enterprise baseline, auditable per row, through the standard resolution function

### Requirement: Seat limit counts members; invites reserve capacity

The seat limit's usage state (warnings, over-limit) SHALL count accepted Organization members only. The invite action SHALL count accepted members **plus outstanding invites**: when that sum has reached the effective seat limit, sending a new invite SHALL be blocked until an outstanding invite is cancelled, a seat add-on is purchased, or the plan is upgraded.

#### Scenario: Pending invites don't trip the limit state

- **WHEN** an Organization with a 5-seat limit has 3 accepted members and 2 outstanding invites
- **THEN** its seat usage reads 3 of 5 with no warning state

#### Scenario: Invite blocked at reserved capacity

- **WHEN** that same Organization attempts a 6th invite (3 accepted + 2 outstanding = 5 = limit)
- **THEN** the invite is blocked with the cancel-an-invite / add-seats / upgrade options

#### Scenario: Cancelling an invite frees a slot

- **WHEN** the Organization cancels one outstanding invite
- **THEN** a new invite can be sent immediately
