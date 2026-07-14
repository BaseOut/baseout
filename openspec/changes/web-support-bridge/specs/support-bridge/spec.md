# support-bridge

Cross-domain session verification for the support portal plus canonical ticket
storage and API in apps/web. Blocked on production auth being live.

## ADDED Requirements

### Requirement: One-time-code session handoff

Web SHALL provide a handoff route that, given an authenticated session and a
validated support-origin `returnTo`, issues a single-use code (hashed at rest,
short TTL, audience-bound) and redirects to the support portal's callback.
Without a session it SHALL route through the existing validated-returnTo login
flow. The app session cookie SHALL never be readable by, or transmitted to, the
support domain.

#### Scenario: Signed-in handoff
- **WHEN** a signed-in customer clicks Sign in on the support portal
- **THEN** they return to the portal authenticated without re-entering credentials

### Requirement: Server-to-server code exchange

Web SHALL expose an exchange endpoint gated by a shared bridge secret that
consumes a valid code and returns only the minimal identity (user id, email,
display name) — never an app session token. Codes SHALL be single-use and
expire within one minute; replayed, expired, or wrong-audience codes SHALL be
rejected.

#### Scenario: Replayed code
- **WHEN** the support Worker presents an already-consumed code
- **THEN** the exchange is rejected and no identity is returned

### Requirement: Canonical ticket storage and scoped API

Web SHALL own `support_tickets` and `support_ticket_messages` migrations
(Organization-scoped) and expose bridge-gated routes to list/create tickets and
read/append thread messages. Every call SHALL re-validate the acting user and
scope access to their Organization membership, with server-side validation on
all mutations.

#### Scenario: Cross-Organization access
- **WHEN** a verified user requests a ticket belonging to another Organization
- **THEN** the API refuses it

### Requirement: Staff ticket visibility

Staff (`users.role = 'super'`) SHALL see tickets in the `/ops` console — list,
thread, and reply as staff — with customer notification of staff replies via the
existing transactional email rail.

#### Scenario: Staff reply
- **WHEN** staff replies to an open ticket from `/ops/tickets`
- **THEN** the message lands on the thread and the customer is notified by email
