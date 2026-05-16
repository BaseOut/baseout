## ADDED Requirements

### Requirement: Public landing CTA

The landing page SHALL feature a primary CTA that initiates Airtable OAuth to visualize a visitor's Airtable schema without requiring sign-up.

#### Scenario: Visitor clicks CTA

- **WHEN** a visitor clicks "Visualize your Airtable schema in 30 seconds — no signup"
- **THEN** the Airtable OAuth flow starts and the access token is held in a temporary session

### Requirement: Ephemeral session storage

The pre-registration session SHALL be stored ephemerally in browser session/local storage for V1. No server-side `pre_registration_sessions` table SHALL be used.

#### Scenario: Browser closes mid-flow

- **WHEN** a visitor closes their browser before signing up
- **THEN** the OAuth token is lost; on return, the visitor must redo the OAuth flow

### Requirement: Schema metadata fetch only

The visualizer SHALL fetch only schema metadata (bases, tables, fields, views) from Airtable's REST API. Record data SHALL NOT be fetched, stored, or rendered in this flow.

#### Scenario: Visualization renders bases

- **WHEN** OAuth completes
- **THEN** the React Flow graph renders nodes for each base/table/field with no record data

### Requirement: Sign-up claim handoff

When a visitor signs up while a pre-registration session is active, the temporary session SHALL be claimed and the OAuth credentials SHALL be persisted on the new Organization as a `connections` row.

#### Scenario: Sign-up after pre-reg

- **WHEN** a visitor with an active pre-reg session completes sign-up
- **THEN** a `connections` row is created on the new Organization with the encrypted OAuth tokens, and the visitor lands in the onboarding wizard at Step 2 (Bases)
