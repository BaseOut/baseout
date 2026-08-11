## ADDED Requirements

### Requirement: Read-only role provisioning

On client DB provisioning for Business+ Spaces, a dedicated read-only PostgreSQL role SHALL be created with SELECT-only privileges scoped to the Space's data.

#### Scenario: Business Space provisioned

- **WHEN** a Business Space's client DB is provisioned
- **THEN** a `space_{id}_ro` role is created with SELECT on the Space's tables only and no other privileges

### Requirement: Connection-string surfacing

The connection string SHALL be available via a `server` read endpoint that decrypts on-demand, never logs the plaintext value, and is accessed only by an authenticated front session for the Org's owner/admin role.

#### Scenario: Owner views connection string

- **WHEN** an Org owner opens the Direct SQL panel and `web` requests the read endpoint
- **THEN** the back decrypts and returns the connection string in the response body only, no log line includes the plaintext

### Requirement: Periodic credential rotation

Direct SQL credentials SHALL rotate on a configurable schedule (default 90 days). On rotation both old and new credentials SHALL be valid for 7 days, then the old SHALL be revoked.

#### Scenario: 90-day rotation

- **WHEN** 90 days have elapsed since the last rotation
- **THEN** a new password is generated, the new connection string is surfaced, the old credential continues to work for 7 days, then the old credential is revoked

### Requirement: Not credit-metered

Direct SQL SHALL NOT consume credits per query (the connection bypasses Baseout once open). DB-level connection limits and slow-query timeouts SHALL be enforced server-side.

#### Scenario: Heavy direct query

- **WHEN** a customer issues a long-running SELECT
- **THEN** no `credit_transactions` row is written; the DB enforces its slow-query timeout

### Requirement: BYODB exclusion

For Enterprise BYODB Spaces, Direct SQL SHALL be a no-op — the customer already owns the DB and the feature is not exposed.

#### Scenario: BYODB customer opens Direct SQL panel

- **WHEN** a BYODB Space accesses the Direct SQL UI
- **THEN** the panel renders a "Not applicable for BYODB" notice instead of a connection string
