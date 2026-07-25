# airtable-sso

## ADDED Requirements

### Requirement: Users can sign in with their Airtable login via a dedicated minimal-scope app

The system SHALL offer Airtable sign-in via better-auth generic OAuth against a dedicated login OAuth app, using PKCE and requesting ONLY `user.email:read` and `schema.bases:read`. Identity SHALL resolve via `whoami` (Airtable user id + verified email). The login grant SHALL never request data-record scopes, and the login token SHALL be used for identity resolution only (the schema scope is dormant at launch).

#### Scenario: Returning linked user

- **WHEN** a user with a linked Airtable identity completes the SSO flow
- **THEN** they are signed in via the account link without any email matching

#### Scenario: Minimal consent

- **WHEN** the SSO authorize request is issued
- **THEN** it carries only the two login scopes and PKCE parameters, using the login app's client id

### Requirement: First-time SSO links by verified email

On first SSO sign-in, an exact match between the Airtable-verified email and an existing user's email SHALL link the Airtable identity to that user and sign them in, writing an audit row.

#### Scenario: Email matches an existing user

- **WHEN** SSO returns an email exactly matching an existing Baseout user
- **THEN** the identity links to that user, they are signed in, and an audit row records the link

### Requirement: New SSO users route through the shared domain-association fork

When SSO yields no email match, account creation SHALL invoke the `signup-domain-association` capability with the Airtable-verified email — presenting the join-or-create fork for known non-public domains and the standard own-account path otherwise. The fork behavior, join-request lifecycle, and domain-resolution rules are owned by that capability's spec; this capability guarantees only that the SSO path invokes it with a verified email and honors its outcome.

#### Scenario: Known company domain via SSO

- **WHEN** a new user signs in from `person@acme.com` and `acme.com` resolves to an existing Organization
- **THEN** the shared fork is presented exactly as it would be for a magic-link signup

#### Scenario: Unknown domain via SSO

- **WHEN** a new user signs in from a domain resolving to no Organization
- **THEN** a new account and Organization are created with verified email and standard onboarding begins

### Requirement: SSO login is independent of Connections and honors 2FA

Signing in with Airtable SHALL create no Connection and grant no backup/data access. A user with 2FA enabled SHALL be challenged after SSO like any other method. An SSO failure (denied consent, missing email, whoami error) SHALL land on the login page with a clear error and no partial account state.

#### Scenario: No Connection side-effect

- **WHEN** a user signs in via SSO in an Organization with no Connections
- **THEN** no Connection row exists afterwards and Connect flows behave as for any signed-in user

#### Scenario: 2FA-enabled user

- **WHEN** a 2FA-enrolled user completes SSO on an untrusted device
- **THEN** the TOTP challenge is required before the session is usable

#### Scenario: Consent denied

- **WHEN** the user cancels on Airtable's consent screen
- **THEN** they return to the login page with a non-technical error and no state change
