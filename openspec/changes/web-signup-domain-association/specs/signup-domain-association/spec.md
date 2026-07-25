# signup-domain-association

## ADDED Requirements

### Requirement: Known domains resolve from membership with an override table

An Organization's known domains SHALL derive from its members' verified email domains excluding a public-email-provider denylist, unioned with explicit `organization_domains` entries and minus suppressed entries. Public-provider domains SHALL never resolve to any Organization.

#### Scenario: Derived domain

- **WHEN** an Organization has verified members at `acme.com`
- **THEN** `acme.com` resolves to that Organization for association purposes

#### Scenario: Suppressed domain

- **WHEN** an Organization suppresses `client.com` in `organization_domains`
- **THEN** `client.com` no longer resolves to it even with matching members

### Requirement: Every signup path offers the join-or-create fork for known domains

At new-account creation with a verified email — whether via magic link or Airtable SSO — a non-public domain matching an existing Organization SHALL present the fork: request to join (admins notified) or create their own account. A pending request SHALL never block the user from proceeding independently. Unknown or public domains SHALL follow the standard own-account path with no fork.

#### Scenario: Magic-link signup from a known domain

- **WHEN** a new user completes magic-link verification with `person@acme.com` and `acme.com` resolves to an Organization
- **THEN** the fork is presented, and choosing join notifies that Organization's admins while the user proceeds in their own account

#### Scenario: SSO signup from a known domain

- **WHEN** the SSO no-match branch yields a new user on a known domain
- **THEN** the identical fork is presented

#### Scenario: Unknown domain

- **WHEN** a new user's domain resolves to no Organization
- **THEN** account creation proceeds with no fork

### Requirement: Join requests have a bounded, audited lifecycle

A join request SHALL be pending → approved, declined, or expired (bounded window); one open request per user/org pair; approval SHALL create membership via the existing team-member machinery and notify the requester; decline SHALL apply a re-request cool-down. All transitions SHALL write audit rows.

#### Scenario: Approval converts to membership

- **WHEN** an org admin approves a pending request
- **THEN** the requester becomes a member, is notified, and an audit row records the transition

#### Scenario: Expiry

- **WHEN** a request passes its expiry window unactioned
- **THEN** it transitions to expired and the user may re-request
