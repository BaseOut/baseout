## ADDED Requirements

### Requirement: POST /api/billing/portal returns a Stripe Customer Portal URL

The endpoint SHALL create a Stripe Customer Portal session for the authenticated user's active organization and return the session's hosted URL. The caller SHALL redirect the browser to that URL.

#### Scenario: Authenticated user with a Stripe customer

- **WHEN** an authenticated user `POST`s `/api/billing/portal` and their active organization has a non-null `stripe_customer_id`
- **THEN** the endpoint SHALL call `stripe.billingPortal.sessions.create({ customer, return_url })` with `return_url = '${origin}/settings'`
- **AND** the response SHALL be `200 OK`
- **AND** the body SHALL be `{ url: '<session.url>' }`

#### Scenario: Authenticated user without a Stripe customer

- **WHEN** the active organization's `stripe_customer_id` is null
- **THEN** the response SHALL be `409 Conflict`
- **AND** the body SHALL be `{ ok: false, code: 'no_customer', error: 'No Stripe customer for this organization' }`

#### Scenario: Unauthenticated request

- **WHEN** the request lacks a valid session cookie
- **THEN** the response SHALL be `401`
- **AND** the body SHALL be `{ error: 'Not authenticated' }`

#### Scenario: Authenticated user with no active organization

- **WHEN** `locals.account.organization` is null
- **THEN** the response SHALL be `403`
- **AND** the body SHALL be `{ error: 'No active organization' }`

#### Scenario: Stripe is not configured in dev

- **WHEN** `STRIPE_SECRET_KEY` is unset and `import.meta.env.DEV` is true
- **THEN** the response SHALL be `503`
- **AND** the body SHALL be `{ ok: false, code: 'stripe_disabled', error: 'Stripe is not configured in this dev environment' }`

#### Scenario: Stripe upstream error

- **WHEN** the Stripe SDK call throws
- **THEN** the response SHALL be `502 Bad Gateway`
- **AND** the body SHALL be `{ ok: false, code: 'upstream_error', error: '<sanitized message>' }`
- **AND** the response body SHALL NOT include any Stripe API key, idempotency key, or stack trace

### Requirement: Customer creation is out of scope for this endpoint

If the active organization has no `stripe_customer_id`, the endpoint SHALL NOT create one. Customer creation is the responsibility of the onboarding flow (`ensureStripeTrialSubscription`).
