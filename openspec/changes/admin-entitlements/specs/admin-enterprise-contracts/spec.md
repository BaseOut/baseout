# admin-enterprise-contracts

Enterprise contract entry as full override sets.

## ADDED Requirements

### Requirement: Contract editor writes the override set

For Organizations on the `enterprise` plan, the staff console SHALL provide a contract editor listing every feature with the enterprise-baseline value prefilled, where staff enter the contracted values in one form. Submission SHALL diff against existing overrides and write only the changes (create/update/expire), stamping each override's reason with the contract reference. There is no separate contracts table — the override set is the contract record and the audit trail its history.

#### Scenario: Entering a new contract

- **WHEN** staff fill the contract editor for a new Enterprise org (20M records, 5-year retention, 50 seats, BYODB, …) and submit with contract reference "MSA-2026-014"
- **THEN** override rows exist for exactly the contracted features, each reason carrying the contract reference, and the org resolves the contracted values through the standard resolution path

#### Scenario: Amendment writes only the delta

- **WHEN** a renegotiation raises seats from 50 to 75 and everything else is unchanged
- **THEN** submitting the amended form updates only the seats override, audited, with all other overrides untouched

### Requirement: Contract-vs-baseline visibility

The contract editor SHALL display, per feature, the enterprise baseline and the current contracted (override) value, clearly distinguishing contracted from baseline-inherited features.

#### Scenario: Reading a contract at a glance

- **WHEN** staff open an Enterprise org's contract editor
- **THEN** contracted features are visually distinct from features still riding the baseline
