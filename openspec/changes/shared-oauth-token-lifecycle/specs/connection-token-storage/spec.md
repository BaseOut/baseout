## MODIFIED Requirements

### Requirement: Token refresh updates the Connection in place

A token refresh SHALL update the existing `Connection` row — persisting both the new `access_token_enc` and the rotated `refresh_token_enc` when Airtable returns one — and SHALL NOT insert a duplicate Connection or force a full re-authentication flow. A user is never pushed through a manual reconnect for a Connection whose refresh token is still valid.

#### Scenario: Airtable rotates the refresh token on refresh

- **WHEN** a refresh succeeds and Airtable returns a newly rotated refresh token
- **THEN** the existing Connection row's `refresh_token_enc` is overwritten with the rotated value in the same update
- **AND** a subsequent refresh using the stored token succeeds without an `invalid_grant`, so no forced re-authentication occurs

#### Scenario: Reconnect does not spawn duplicates

- **WHEN** a Connection's token is refreshed or the user re-connects the same platform for the same Organization
- **THEN** the newest existing Connection row is updated in place — no additional `Connection` row is created for the same `(organization, platform)`
