# plan-catalog

Plans as data: the sellable catalog and its Stripe mapping.

## ADDED Requirements

### Requirement: Plans are catalog rows with a status lifecycle

The system SHALL store plans in a `plans` table with a stable slug, display name, kind (`public | trial | custom | legacy`), status (`active | inactive`), and a Stripe product ID where one exists (trial/custom plans MAY have none). Deactivating a plan SHALL make it unsellable while keeping it fully resolvable for existing subscribers; plans SHALL never be deleted while any subscription references them.

#### Scenario: Deactivated plan keeps serving existing subscribers

- **WHEN** a plan is set to `status='inactive'` while an Organization subscribes to it
- **THEN** new checkouts cannot select the plan, and the existing Organization's entitlements continue to resolve from it unchanged

#### Scenario: Plan slugs are stable identity

- **WHEN** a plan's display name changes (e.g. a tier rename)
- **THEN** its slug, Stripe linkage, and every entitlement resolution are unaffected

### Requirement: Plan prices map to Stripe prices per billing period

Each plan SHALL have `plan_prices` rows mapping it to Stripe price IDs with billing period (`monthly | annual`), cached amount, and currency. A plan MAY have multiple active prices (one per billing period); the annual price reflects the locked ~2-months-free pricing.

#### Scenario: Price lookup by plan and period

- **WHEN** checkout needs the annual price for the Core plan
- **THEN** a single `plan_prices` lookup returns the Stripe price ID and cached amount ($999/yr)

### Requirement: Stripe carries identity, the catalog carries values

Stripe product metadata SHALL contain the plan slug (for webhook reconciliation) and SHALL NOT be used to resolve capabilities, limits, or feature values. This supersedes the Features §5.5 metadata-gating rule.

#### Scenario: Limit change without touching Stripe

- **WHEN** a staff member updates a plan's included records from 750K to 1M in the catalog
- **THEN** every non-overridden subscriber resolves the new value with no Stripe product change

### Requirement: The locked pricing model is seeded

A seed migration SHALL insert the four public plans (Lite, Core, Plus, Max), the trial plan, the **enterprise baseline plan** (kind `custom`, no public price — the base for contract overrides per the Enterprise model), and their prices exactly per `research/pricing/pricing-guide.md`, citing the guide version.

#### Scenario: Fresh environment matches the pricing guide

- **WHEN** migrations run on a clean database
- **THEN** the plan catalog contains Lite $49/$499, Core $99/$999, Plus $199/$1,999, Max $399/$3,999, the trial plan, and the enterprise baseline
