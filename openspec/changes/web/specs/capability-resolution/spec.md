## ADDED Requirements

### Requirement: `GET /api/me/capabilities` resolver

The capability resolver SHALL return a structured response containing `organization_id`, per-platform `tier`, `trial` flag, `trial_ends_at`, `limits`, and `capabilities`. Tier SHALL be read from Stripe product metadata (`platform`, `tier`) — never parsed from the product name string. Limits SHALL be read from `plan_limits` keyed on tier.

#### Scenario: Pro user resolves

- **WHEN** a Pro user requests `/api/me/capabilities`
- **THEN** the response shows `tier='pro'`, `trial=false`, full limits, and the capability map per the tier's enabled capabilities

### Requirement: 5-minute cache

The resolver SHALL cache results per session with a 5-minute TTL. The cache SHALL be invalidated on any `subscription_items` write.

#### Scenario: Stripe upgrade then immediate read

- **WHEN** a `subscription_items` write happens (via Stripe webhook)
- **THEN** the cache for the affected Org is invalidated and the next read reflects the new tier

### Requirement: `enforceCapability` middleware

A middleware `enforceCapability(userId, capability)` SHALL wrap every endpoint that consumes credits or unlocks a tier-gated capability. On block, it SHALL return 402 with a structured upgrade hint.

#### Scenario: Trial user attempts AI Docs

- **WHEN** a Trial user calls the AI doc-generation endpoint
- **THEN** the middleware returns 402 with `{ reason: 'tier_required', required_tier: 'pro', upgrade_url }`

### Requirement: No hardcoded tier checks

`web` SHALL NOT hardcode tier strings ("if tier==='pro'") in feature flags. All tier-gating SHALL go through the capability set returned by the resolver.

#### Scenario: New page added

- **WHEN** a developer adds a new tier-gated page
- **THEN** the page reads `capabilities.<feature>` from the resolver rather than checking `tier==='X'`

### Requirement: Cap interaction during enforcement

The middleware SHALL also check overage caps and trial caps before allowing the operation. Trial cap SHALL take precedence over overage cap when both fire.

#### Scenario: Both caps would fire

- **WHEN** a Trial user with the trial cap hit also has overage triggered
- **THEN** the response surfaces "trial limit hit, upgrade to continue", not the overage hint
