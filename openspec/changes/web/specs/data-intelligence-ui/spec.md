## ADDED Requirements

### Requirement: Data view (Growth+)

The Data page SHALL render record metrics per table and per base, fed from the Space's client DB through `server`'s read endpoints or the SQL REST API. Available on Growth+.

#### Scenario: Growth user opens Data

- **WHEN** a Growth user opens /data
- **THEN** record-count metrics render per table with a growth-trend chart

### Requirement: Automations view (Growth+)

The Automations page SHALL render the list of Automations captured for the Space and SHALL provide a manual-entry form for Automations Airtable's API does not expose. Submission SHALL go through the Inbound API path (`web`-side) which forwards to `server`.

#### Scenario: Manual entry of an Automation

- **WHEN** a Growth+ user submits an Automation via the manual-entry form
- **THEN** the `web` repo Inbound API endpoint forwards to `server`'s `/inbound/automations` and the entry is persisted in the client DB

### Requirement: Interfaces view (Growth+)

The Interfaces page SHALL behave the same way for Interfaces metadata (list, manual entry forwarded to `server`'s `/inbound/interfaces`).

#### Scenario: Manual Interface entry

- **WHEN** a Growth+ user submits an Interface
- **THEN** the entry is forwarded to `server`'s `/inbound/interfaces` and persisted

### Requirement: Changelog views

Each of Data, Automations, and Interfaces SHALL render a changelog tab fed from `server`-computed diffs.

#### Scenario: Automation changelog

- **WHEN** a user opens the Automations changelog
- **THEN** added/modified/removed Automation entries render with timestamps

### Requirement: AI-Assisted Documentation (Pro+)

The Schema page SHALL include a "Generate description" button on each field/table for Pro+ users. The button SHALL invoke a synchronous Cloudflare AI call from a `web` endpoint. The resulting text SHALL be persisted to the schema's description column via `server`'s write path. Each generation SHALL debit credits per the credit system spec.

#### Scenario: Generate description

- **WHEN** a Pro+ user clicks "Generate description" on a field
- **THEN** the `web` repo endpoint calls Cloudflare AI, persists the result via back, debits 10 credits via `credit_transactions`, and renders the new description
