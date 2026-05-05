## ADDED Requirements

### Requirement: better-auth as the auth provider

All user authentication flows SHALL use better-auth. Auth concerns SHALL live exclusively in front; back services SHALL NOT log a user in directly — they validate session tokens or service tokens minted by front.

#### Scenario: Back receives a request

- **WHEN** back's `baseout-backup-engine` receives a request from front
- **THEN** the request carries a service token (HMAC) or a session-derived short-lived token; back never runs a user-login flow

### Requirement: V1 authentication methods

Front SHALL support: Magic Link (V1 launch), Email + Password (pre-launch V1), 2FA TOTP (pre-launch V1), SSO SAML for Enterprise (pre-launch V1). Google OAuth MAY be evaluated pre-launch. Airtable OAuth SHALL NEVER be a login method — it is exclusively a Connection auth flow.

#### Scenario: Magic link login

- **WHEN** a user submits their email on the login page
- **THEN** a magic link email is sent and clicking it creates a better-auth session

#### Scenario: Airtable OAuth refused as login

- **WHEN** any path attempts to use Airtable OAuth as a sign-in method
- **THEN** the path is rejected; Airtable OAuth is permitted only when associating a Connection to an existing Space

### Requirement: 2FA TOTP

The 2FA TOTP flow SHALL use better-auth's 2FA plugin. Users with 2FA enabled SHALL be prompted for the TOTP code on every login (or per better-auth's session policy).

#### Scenario: 2FA prompt

- **WHEN** a 2FA-enabled user logs in via magic link or password
- **THEN** the TOTP prompt is shown before the session is fully established

### Requirement: Enterprise SSO (SAML)

For Enterprise tier customers, SSO via SAML SHALL be available using better-auth's SSO plugin.

#### Scenario: Enterprise login via SAML

- **WHEN** an Enterprise org's user lands on `/sign-in` and selects SSO
- **THEN** the SAML round-trip with the Org's IdP completes and the user is signed in

### Requirement: Session management

Sessions SHALL be managed by better-auth (JWT or DB-backed; final choice during integration spike). All app routes SHALL be protected; pre-registration uses a separate temporary client-side session ID (per the pre-registration-schema-viz spec).

#### Scenario: Unauthenticated dashboard request

- **WHEN** an unauthenticated request reaches `/dashboard`
- **THEN** the user is redirected to `/sign-in` with `redirect_to` preserved

### Requirement: Cross-service authentication

Service-to-service traffic SHALL use a shared HMAC `Authorization: Bearer {SERVICE_TOKEN}` header. Front SHALL NOT call back. Back MAY call front internal API endpoints with the service token; front validates on every internal call.

#### Scenario: Back-to-front internal call

- **WHEN** back POSTs to a front internal endpoint
- **THEN** front verifies the HMAC service token before processing
