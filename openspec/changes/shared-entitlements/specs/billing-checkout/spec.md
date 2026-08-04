# billing-checkout

In-app purchase, plan changes with proration, and add-on management.

## ADDED Requirements

### Requirement: In-app plan purchase

The system SHALL let an authenticated Organization owner purchase any active public plan (monthly or annual price) in-app, using Stripe Elements for payment capture (raw card data never touches Baseout servers). A successful purchase creates/updates the Stripe subscription, and entitlements resolve from the new plan once the confirming webhook lands.

#### Scenario: Trial converts to paid

- **WHEN** a trialing Organization completes checkout for Core annual
- **THEN** the subscription moves to the Core annual price, entitlements resolve Core values, and the trial deletion clock is cancelled

### Requirement: Plan changes prorate via Stripe

Upgrades and downgrades SHALL be performed as Stripe subscription updates with standard proration; the UI SHALL show the proration preview (from Stripe's upcoming-invoice API) before confirmation. Downgrades that would put current usage above the target plan's limits SHALL warn the user with the specific over-limit meters before allowing confirmation.

#### Scenario: Upgrade previews the charge

- **WHEN** a Core monthly Organization upgrades to Plus
- **THEN** the confirmation shows Stripe's prorated amount before any charge is made

#### Scenario: Downgrade warns on over-limit usage

- **WHEN** a Plus Organization using 1.2M records attempts a downgrade to Core (750K)
- **THEN** the flow lists records as over the target limit and explains the enforcement consequence before confirmation

### Requirement: Add-on purchase and cancellation

The system SHALL let the Organization owner buy recurring add-ons (quantity-adjustable Stripe subscription items) and one-time packs (one-off invoice items with period-end expiry), and cancel recurring add-ons, per the locked add-on library. Enforcement state SHALL re-evaluate on confirmed purchase so a limit-blocked Organization resumes without manual action.

#### Scenario: Buying the offered add-on unblocks

- **WHEN** an Organization enforced on API calls buys the +50K one-time pack from the enforcement notice's link
- **THEN** on webhook confirmation the effective limit rises, enforcement clears, and calls are served again
