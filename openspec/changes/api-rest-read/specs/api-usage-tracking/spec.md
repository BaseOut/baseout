## ADDED Requirements

### Requirement: Per-request usage metering via Workers Analytics Engine
Every authenticated request to any public API surface on `apps/api` (REST read, inbound, MCP) SHALL write one data point to a Workers Analytics Engine dataset (`baseout_api_requests`) recording: token id, organization id, space id (when path-scoped), platform code, route template (not the concrete URL), method, HTTP status, surface (`rest | inbound | mcp`), and duration in milliseconds. The write SHALL be fire-and-forget (`ctx.waitUntil`) and MUST NOT block or fail the response. Unauthenticated (401) requests SHALL be recorded without a token/org attribution.

#### Scenario: Successful request is metered
- **WHEN** an authenticated request to `GET /v1/orgs/{orgId}/spaces` completes
- **THEN** one data point is written with the token id, org id, route template `/v1/orgs/{orgId}/spaces`, status 200, and duration

#### Scenario: Metering failure is invisible to the caller
- **WHEN** the Analytics Engine write throws
- **THEN** the API response is unaffected and the error is logged

### Requirement: Shadow-mode rate limiting via the Cloudflare Rate Limiting binding
`apps/api` SHALL evaluate the Workers Rate Limiting binding on every authenticated request, keyed by token id, with a provisional configured rate (initial placeholder 100 requests / 60 seconds — subject to product-owner confirmation). While `RATE_LIMIT_ENFORCE` is false (the launch state), an over-limit outcome SHALL be logged and reflected in response headers but SHALL NOT block the request. No monthly tier quotas SHALL be enforced until pricing tiers are finalized.

#### Scenario: Over the shadow limit
- **WHEN** a token exceeds the configured rate and `RATE_LIMIT_ENFORCE` is false
- **THEN** the request succeeds normally, the outcome is logged, and `X-RateLimit-Remaining: 0` is returned

#### Scenario: Enforcement is a configuration flip
- **WHEN** `RATE_LIMIT_ENFORCE` is set true
- **THEN** over-limit requests receive 429 with `error.type = "rate_limited"` and a `Retry-After` header, with no code change

### Requirement: Rate-limit visibility headers
Every authenticated response SHALL include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and (when the window is known) `X-RateLimit-Reset` headers reflecting the evaluated shadow limit, so clients can self-pace before enforcement is enabled.

#### Scenario: Headers present on a normal response
- **WHEN** an authenticated request completes under the limit
- **THEN** the response carries `X-RateLimit-Limit` and a decremented `X-RateLimit-Remaining`
