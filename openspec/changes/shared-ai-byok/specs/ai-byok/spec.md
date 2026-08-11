# ai-byok

Customer-provided AI keys (bring-your-own-key): a Plus+ org supplies its own AI provider key, encrypted at rest, and Baseout routes AI calls through it instead of the metered credit pool — consuming zero credits — while the AI-usage policy remains the enforcing gate.

## ADDED Requirements

### Requirement: Plus+ gated per-provider key entry

The system SHALL let an Organization on a plan where `byo_ai_key` resolves true (Plus and above) add, rotate, and revoke an AI provider key **per provider** (Anthropic, OpenAI, Cloudflare, and any future supported provider). Entitlement SHALL be resolved from the DB-native catalog via `resolveEntitlements(orgId)` — never from Stripe product metadata or from request input. Every key write SHALL be validated server-side and authorized to an Org admin of the owning Organization. At most one **active** key SHALL exist per (Organization, provider).

#### Scenario: Entitled org adds a key

- **WHEN** an Org admin of a Plus org submits a valid Anthropic key
- **THEN** the key is stored active for that (org, provider) and BYOK becomes available for AI operations the org's policy permits

#### Scenario: Un-entitled org is blocked

- **WHEN** an Org admin of a Core org (where `byo_ai_key` resolves false) attempts to add a key
- **THEN** the request is rejected by the capability gate and no key is stored

#### Scenario: Non-admin is blocked

- **WHEN** a non-admin member of an entitled org attempts to add, rotate, or revoke a key
- **THEN** the request is rejected by authorization and no key state changes

### Requirement: Encryption at rest and non-disclosure of key material

Customer AI keys SHALL be encrypted at rest with AES-256-GCM using `BASEOUT_ENCRYPTION_KEY`, stored in a `key_enc` column exactly as OAuth tokens are (PRD §20.2). Plaintext key material SHALL never be returned by any read or list API, never rendered in any web or admin surface, and never written to any log, structured-log field, or Trigger.dev enqueue payload. Only a `last_four` and a non-reversible fingerprint SHALL be displayable. Decrypted plaintext SHALL exist only in memory at the moment of a provider call and SHALL never be persisted outside `key_enc`.

#### Scenario: Read API omits the secret

- **WHEN** the key-list endpoint returns an org's configured keys
- **THEN** each entry exposes provider, `last_four`, label, status, and validation timestamp only — never `key_enc` or plaintext

#### Scenario: Staff cannot see the key

- **WHEN** a staff member views the Organization in the admin console
- **THEN** any configured AI key shows only its provider and `last_four` — the plaintext is never displayed to staff

### Requirement: Routing through the customer key at every AI entry point

When an Organization has a valid active key for a supported provider and the AI call is permitted by policy, the system SHALL route that call through the customer's key instead of Baseout's credentials, at every AI entry point — Schema Chat (the Claude task), schema-description generation, and health scoring. A single routing resolution SHALL be the sole decision point, returning either the pooled path or a bring-your-own-key path, and its return value SHALL carry no secret material. The plaintext key SHALL be delivered to the Trigger.dev Node runner only via an `INTERNAL_TOKEN`-gated engine endpoint at run start, never via the enqueue payload.

#### Scenario: Chat routes through the customer key

- **WHEN** a Plus org with a valid active Anthropic key sends a Schema Chat message
- **THEN** the reply is generated using the customer's key, and Baseout's own Anthropic key is not used for that call

#### Scenario: No key falls back to the pool

- **WHEN** an entitled org has no configured key (or the key is disabled)
- **THEN** the AI call runs on Baseout's pooled credentials exactly as it does today

#### Scenario: Runner never receives the key in its payload

- **WHEN** the chat task is enqueued for a BYOK org
- **THEN** the enqueue payload contains only the org id and provider, and the plaintext key is fetched at run start over the gated internal endpoint

### Requirement: Zero-credit accounting when a customer key is active

When an AI call is routed through a customer key, the system SHALL record the usage sample as non-billable so that the AI-credit meter attributes zero credits to the Organization. Call counts SHALL still be recorded for observability; only credit consumption SHALL be zero. (The AI-credit meter is delivered by `shared-entitlements`; this capability sets the non-billable flag that meter honors.)

#### Scenario: BYOK call consumes zero credits

- **WHEN** a BYOK org performs an AI operation that would otherwise draw from its credit pool
- **THEN** the usage sample is marked non-billable and zero AI credits are deducted from the org

### Requirement: Key validation and health lifecycle

The system SHALL validate a submitted key against its provider before storing it active; a key that fails validation SHALL NOT be stored active and the caller SHALL receive a field-level error. The system SHALL periodically re-validate stored keys and SHALL mark a key `invalid` (recording the validation error and timestamp) when the provider rejects it. When a key is invalid at call time, the system SHALL by default fall back to the pooled path (if the org remains entitled) and surface a warning, EXCEPT for an Organization that has opted into strict custody, for which the call SHALL fail rather than route through Baseout's credentials.

#### Scenario: Invalid key on submit is rejected

- **WHEN** an Org admin submits a key the provider rejects
- **THEN** nothing is stored and the admin sees a validation error

#### Scenario: Lapsed key degrades gracefully

- **WHEN** a previously valid key later fails provider auth and the org is not in strict-custody mode
- **THEN** the key is marked invalid and subsequent AI calls fall back to the pool with a surfaced warning

#### Scenario: Strict-custody org fails closed

- **WHEN** a strict-custody org's key is invalid at call time
- **THEN** the AI call fails rather than routing through Baseout's pooled credentials

### Requirement: Revocation, rotation, and downgrade

The system SHALL let an entitled Organization revoke a key (reverting routing to the pool) and rotate a key in place (re-validate, then overwrite the stored material — the previous plaintext is never archived). When an Organization downgrades below the entitled tier, its key SHALL be disabled rather than purged, so a later re-upgrade restores BYOK without re-entry, and a disabled key SHALL never be routed to while the org is un-entitled.

#### Scenario: Revoke reverts to the pool

- **WHEN** an org revokes its only active key
- **THEN** subsequent permitted AI calls run on Baseout's pooled credentials

#### Scenario: Downgrade disables without purging

- **WHEN** a Plus org downgrades to Core
- **THEN** its key is disabled (not deleted) and is not used for routing, and re-upgrading to Plus restores it without re-entry

### Requirement: Composition with the AI-usage policy

BYOK SHALL compose with the `ai_usage` policy (`all | schema_only | off`, `shared-ai-controls`) and SHALL NOT bypass or widen it. The effective policy SHALL be resolved first; a call the policy forbids SHALL be rejected regardless of any configured key. A customer key SHALL determine only which credentials and provider bill an already-permitted call uses — never whether the call is allowed.

#### Scenario: BYOK does not bypass `off`

- **WHEN** an org with `ai_usage = off` has a valid active key
- **THEN** no AI call runs — the policy blocks it before any routing decision

#### Scenario: BYOK does not widen `schema_only`

- **WHEN** an org with effective `ai_usage = schema_only` has a valid active key and attempts record-data AI
- **THEN** the call is rejected by policy — the key does not grant record-data access
