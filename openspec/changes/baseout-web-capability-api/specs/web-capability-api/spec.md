## ADDED Requirements

### Requirement: GET /api/me/capabilities returns the active org's capability set

The endpoint SHALL return the resolved capabilities for the currently authenticated user's active organization, scoped to the Airtable platform. The response body MUST be JSON matching `ResolvedCapabilities` (`tier`, `hasSubscription`, `capabilities`).

#### Scenario: Authenticated user with an active subscription

- **WHEN** an authenticated user `GET`s `/api/me/capabilities` and their active organization has a subscription with `status IN ('active', 'trialing')`
- **THEN** the endpoint SHALL return `200` with body `{ tier: <Tier>, hasSubscription: true, capabilities: { basesPerSpace: <number | null> } }`
- **AND** the response SHALL carry header `Cache-Control: private, max-age=300`

#### Scenario: Authenticated user without an active subscription

- **WHEN** an authenticated user `GET`s `/api/me/capabilities` and their active organization has no `active`/`trialing` subscription
- **THEN** the endpoint SHALL return `200` with body `{ tier: null, hasSubscription: false, capabilities: { basesPerSpace: 5 } }` (starter fallback per `getTierCapabilities(null)`)

#### Scenario: Unauthenticated request

- **WHEN** a `GET /api/me/capabilities` request arrives without a valid session cookie
- **THEN** the response SHALL be `401` with body `{ error: 'Not authenticated' }`

#### Scenario: Authenticated user with no active organization

- **WHEN** an authenticated user has no resolvable active organization on `locals.account.organization`
- **THEN** the response SHALL be `403` with body `{ error: 'No active organization' }`

### Requirement: Capability resolution is cached for 5 minutes per (organizationId, platformSlug)

The capability resolver result SHALL be cached in-memory keyed by `${organizationId}:${platformSlug}` for `300_000` milliseconds. Subsequent reads within the TTL MUST NOT hit the master database.

#### Scenario: Second read inside the TTL is a cache hit

- **WHEN** the same authenticated user `GET`s `/api/me/capabilities` twice within 5 minutes
- **THEN** the second response SHALL be served from cache without a database query
- **AND** the response body SHALL be byte-identical to the first response (same point-in-time tier)

#### Scenario: Cache invalidation removes entries by org

- **WHEN** `invalidateCapabilityCache(organizationId)` is called with no `platformSlug`
- **THEN** every cache entry for that organization across all platforms SHALL be evicted
- **AND** the next read SHALL go to the master database

#### Scenario: Cache invalidation removes a single (org, platform) entry

- **WHEN** `invalidateCapabilityCache(organizationId, platformSlug)` is called with both arguments
- **THEN** only the entry for that (org, platform) pair SHALL be evicted
- **AND** entries for other platforms in the same org SHALL be retained

### Requirement: enforceCapability helper gates routes on a tier predicate

A reusable helper SHALL evaluate a `(caps: TierCapabilitySet) => boolean` predicate against the cached/resolved capabilities for a given org+platform and return either the resolved capability set or a typed `Response`.

#### Scenario: Predicate passes

- **WHEN** `enforceCapability(ctx, 'airtable', predicate)` is called and the predicate returns `true`
- **THEN** the helper SHALL return the resolved `TierCapabilitySet` (not a `Response`)
- **AND** the caller SHALL be able to continue handling the request

#### Scenario: Predicate fails

- **WHEN** the predicate returns `false`
- **THEN** the helper SHALL return a `403` `Response` with body `{ error: 'Capability denied' }`

#### Scenario: Caller is unauthenticated

- **WHEN** `ctx.locals.account` is null
- **THEN** the helper SHALL return a `401` `Response` with body `{ error: 'Not authenticated' }`

#### Scenario: Caller has no active organization

- **WHEN** `ctx.locals.account.organization` is null
- **THEN** the helper SHALL return a `403` `Response` with body `{ error: 'No active organization' }`
