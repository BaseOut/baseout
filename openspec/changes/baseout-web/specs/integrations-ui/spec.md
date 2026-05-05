## ADDED Requirements

### Requirement: Inbound API token CRUD

The Integrations page SHALL provide create / list / revoke for `api_tokens`. Plaintext SHALL be shown only once at creation (then a SHA-256 hash is stored).

#### Scenario: Token created

- **WHEN** a user creates a new Inbound API token
- **THEN** the plaintext token is displayed once with a copy button; only the hash is persisted

#### Scenario: Lost token

- **WHEN** a user re-opens the page after the creation modal is dismissed
- **THEN** the plaintext is no longer retrievable; the user must create a new token

### Requirement: SQL REST API endpoint display

The Integrations page SHALL display the Space's SQL REST endpoint URL and a token reference, so the user can copy and paste into their tooling. Pro+ only.

#### Scenario: Pro user views

- **WHEN** a Pro user opens Integrations
- **THEN** the SQL REST URL `https://sql.baseout.com/v1/spaces/{space_id}/query` and a token-management UI render

### Requirement: Direct SQL connection string display (Business+)

The Integrations page SHALL render a Direct SQL section (Business+) that shows the read-only connection string. The string SHALL be fetched via `baseout-backup`'s read endpoint on user-initiated reveal — never logged.

#### Scenario: Business user reveals string

- **WHEN** a Business user clicks "Show connection string"
- **THEN** `baseout-web` calls `baseout-backup`'s read endpoint, displays the string in the response, and no log line includes the plaintext

### Requirement: BYODB exclusion notice

For Enterprise BYODB Spaces, the Direct SQL section SHALL render an "Not applicable for BYODB" notice in place of a connection string.

#### Scenario: BYODB tenant

- **WHEN** a BYODB tenant opens Integrations
- **THEN** the Direct SQL section shows the BYODB notice

### Requirement: V2 placeholders

Zapier / Make.com / HyperDB / Airtable Writeback integrations SHALL be V2 — the page SHALL NOT render UI for them in V1.

#### Scenario: V1 user views Integrations

- **WHEN** a V1 user opens the Integrations page
- **THEN** Zapier / Make.com / HyperDB / Airtable Writeback are absent (no nav slots, no placeholders)
