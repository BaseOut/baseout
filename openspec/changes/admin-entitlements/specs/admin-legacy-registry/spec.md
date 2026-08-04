# admin-legacy-registry

Staff surface for the On2Air migration registry.

## ADDED Requirements

### Requirement: Registry browser

The staff console SHALL list and search `legacy_customers` (email, legacy plan, mapped Baseout tier, redemption state, redeeming org/user/date where redeemed) using the standard listing infrastructure (search, filters, pagination per admin-crm-ux).

#### Scenario: Checking a migration status

- **WHEN** staff search the registry for a customer email
- **THEN** they see the row's legacy plan, mapped tier, and whether/when/by-whom it was redeemed

### Requirement: Manual linking and manual rows

Staff SHALL be able to (a) manually link an unredeemed registry row to an existing Organization — explicit org selection + confirmation, applying the canonical 20%-forever coupon through the same code path as self-serve redemption and marking the row redeemed — and (b) add a registry row by hand (email + legacy plan; mapped tier derives from the locked mapping). Redeemed rows SHALL be immutable except through audit-visible staff correction.

#### Scenario: Rescuing a mismatched email

- **WHEN** a legacy customer signed up with a different email and staff link their registry row to the Organization
- **THEN** the coupon applies to that Organization's subscription, the row is marked redeemed with the staff actor recorded, and no second redemption is possible

#### Scenario: Hand-adding a missed export row

- **WHEN** staff add a row for a customer missing from the export with legacy plan `professional`
- **THEN** the row exists with mapped tier `plus` and behaves like any exported row at signup
