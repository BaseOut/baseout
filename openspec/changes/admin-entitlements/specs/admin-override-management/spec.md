# admin-override-management

Per-organization entitlement transparency and override lifecycle.

## ADDED Requirements

### Requirement: Resolution-transparent entitlement view

The organization command center SHALL show, per feature: the plan value, any active override (value, reason, granting staff user, expiry), add-on contributions, the **effective value**, current usage, and notification/enforcement state — so staff can answer "why is this number what it is" without reading tables.

#### Scenario: Explaining an effective limit

- **WHEN** staff open the entitlements section for an Organization with a records override and one add-on
- **THEN** the records row shows plan value, override (with reason and grantor), add-on quantity, and the composed effective value

### Requirement: Override lifecycle on the command center

Staff SHALL create, edit, and expire overrides from the organization command center (actions-on-detail-pages rule): typed value validation, required reason, optional expiry, audit row per write. Removing an override SHALL restore plan-value resolution immediately.

#### Scenario: One-off grant

- **WHEN** staff add a Spaces override of 20 with reason "conference promo, expires Sep 30"
- **THEN** the Organization resolves 20 Spaces until the expiry passes, and the audit trail shows the grant

#### Scenario: Expiring an override restores the plan

- **WHEN** staff expire an override
- **THEN** the next resolution returns the plan value and the expiry is audited
