# admin-entitlements

## Why

`shared-entitlements` makes plans, features, per-plan values, overrides, and the legacy registry live data — but gives staff no way to manage any of it beyond SQL. Staff need to edit the catalog (the founder's plan-edit-propagates-everywhere model assumes edits are *possible*), grant per-account exceptions, enter Enterprise contracts as full override sets (design D10), and browse/link the legacy On2Air registry. This change adds those surfaces to the staff console.

## What Changes

- **Catalog CRUD** — admin pages to manage `plans` (status lifecycle, Stripe linkage view), `plan_prices`, `feature_groups`, `features`, and the `plan_features` matrix (edit any plan × feature value with type-aware inputs: boolean toggle, numeric limit + unit, enum select by rank). Every write audited; destructive operations (deactivate plan, remove feature) confirm with blast-radius counts (how many orgs affected).
- **Override management** — on the organization command center: view effective entitlements (plan value, override, add-ons, effective result per feature), add/edit/expire overrides with required reason, full audit trail. Follows the actions-on-detail-pages rule from `admin-crm-ux`.
- **Enterprise contract editor** — a contract view on Enterprise organizations: staff enter the contracted value for every feature in one form (writes the full override set per D10), see contract-vs-baseline diff, and amend on renegotiation. Contract reference stored in override reasons.
- **Legacy registry browser** — list/search `legacy_customers` (email, legacy plan, mapped tier, redemption state), manually link an unmatched row to an existing Organization (applies the canonical coupon + marks redeemed), and add individual rows by hand.
- **Usage view for staff** — per-organization usage-vs-limits panel (same data as the customer Usage page) on the command center, so support sees exactly what the customer sees plus enforcement/notification state.

## Capabilities

### New Capabilities

- `admin-catalog-crud`: staff management of plans, prices, groups, features, and the plan-feature matrix, with audit and blast-radius guards.
- `admin-override-management`: per-organization entitlement view + override lifecycle on the command center.
- `admin-enterprise-contracts`: the contract editor writing/amending full override sets for Enterprise organizations.
- `admin-legacy-registry`: registry browsing, manual linking/redemption, and manual row entry.

### Modified Capabilities

_None archived. Extends the `admin-crm-ux` command center (adds entitlement/usage sections + actions) in place; consistent with `admin-data-boundary` (master DB only — entitlement tables live there)._

## Impact

- **`apps/admin` only** (single-app change; depends on `shared-entitlements` schema + resolution lib and `admin-crm-ux` page structure — implement after both).
- New pages under a Billing/Catalog nav group + sections on `/organizations/[id]`; schema mirrors for the new tables (read where possible; writes go through admin's audited action routes like existing admin actions).
- **Security:** all surfaces staff-gated (`role='super'`); catalog and override writes are mutating admin actions — audit rows + confirmation flows per the existing `shared-admin-actions` machinery; no `*_enc` exposure (none of these tables carry secrets).
- **Cross-references:** `shared-entitlements` (substrate), ui-only `usage-and-billing` (customer-facing visuals — no coupling).
