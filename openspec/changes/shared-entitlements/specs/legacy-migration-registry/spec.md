# legacy-migration-registry

Who is coming over from On2Air, what they had, and the automatic 20% lifetime discount.

## ADDED Requirements

### Requirement: The legacy_customers table

The master DB SHALL have a `legacy_customers` table: case-insensitively unique email, legacy plan slug (`starter | essentials | professional | premium`), mapped Baseout plan slug per the locked mapping (starter→lite, essentials→core, professional→plus, premium→max), export metadata (exported-at, source row reference), and redemption state (`unredeemed | redeemed` with redeeming organization, user, and timestamp). Populating the table from the On2Air export is explicitly out of scope — the schema and its consumers are specced against it.

#### Scenario: Registry answers "who's coming over"

- **WHEN** staff query the registry
- **THEN** each row shows the legacy customer's email, their On2Air plan, their mapped Baseout tier, and whether they've redeemed

### Requirement: Signup and checkout match against the registry

When a user signs up (or an existing never-redeemed account reaches checkout) with a verified email matching an unredeemed registry row, the system SHALL surface the legacy status to the UI (mapped tier + "20% for life" messaging) and SHALL apply the discount automatically at checkout.

#### Scenario: Legacy customer sees the offer

- **WHEN** a user whose verified email matches an unredeemed row reaches the plan-selection step
- **THEN** the UI shows the migration offer with their mapped tier highlighted and 20%-off pricing

#### Scenario: Non-matching emails see nothing

- **WHEN** a user with no registry match signs up
- **THEN** no legacy messaging or discount appears anywhere

### Requirement: The discount is the 20% lifetime floating coupon

Redemption SHALL apply the single canonical Stripe coupon (20% off, duration forever) to the subscription — never a bespoke price ID — so the discount floats against list-price changes per the pricing lock. Redemption SHALL mark the registry row redeemed (one redemption per row) and be auditable. The coupon applies to any tier at or above the mapped tier; the checkout UI SHALL enforce the at-or-above rule.

#### Scenario: Discount floats with list price

- **WHEN** a redeemed legacy customer is subscribed and the plan's list price later changes
- **THEN** their charge remains 20% off the new list price with no per-customer intervention

#### Scenario: One redemption per row

- **WHEN** a registry row has been redeemed by one Organization
- **THEN** subsequent signups matching the same email receive no offer
