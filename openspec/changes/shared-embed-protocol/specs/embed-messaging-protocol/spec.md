# embed-messaging-protocol

The versioned postMessage contract between a host wrapper (outer frame) and the embedded Baseout web app (inner frame): envelope, handshake with origin locking, message catalog, context shape, and origin-validation rules. Implemented once in `packages/embed-protocol` and imported by both sides.

## ADDED Requirements

### Requirement: All messages use the versioned envelope and unknown input is ignored
Every protocol message SHALL be a postMessage whose data is `{ proto: 'baseout-embed/1', type: string, id: string, payload: object }`. Receivers MUST silently ignore messages whose `proto` is not a supported version, whose `type` is unknown, or whose shape is malformed — never throw, never reply to garbage. New message types are additive within a version; breaking payload changes MUST bump the `proto` version.

#### Scenario: Unknown message type
- **WHEN** a bridge receives a well-formed envelope with `type: 'host:teleport'` (unknown)
- **THEN** it ignores the message and continues operating

#### Scenario: Foreign postMessage traffic
- **WHEN** a bridge receives postMessage data without a `proto` field (e.g., from a browser extension or analytics script)
- **THEN** it ignores the message without logging errors

### Requirement: Handshake establishes an origin-locked channel before any data flows
The child SHALL beacon `child:ready` (payload empty — no context, no session data) to `window.parent` with `targetOrigin '*'`, repeating on an interval until a valid `host:hello` arrives. The host SHALL reply `host:hello { hostKind, context }` targeted at the exact child origin it configured, retrying until it receives `child:hello-ack`. On receiving `host:hello`, the child MUST validate `event.origin` against the ancestor allowlist: on match it locks the bridge to that origin (all subsequent sends target it exactly; all receives require it) and replies `child:hello-ack { version, authenticated }`; on mismatch it drops the message and does not reply. The host MUST validate every inbound message's origin equals its configured child origin exactly. Neither side SHALL send any message other than the handshake beacons before the handshake completes.

#### Scenario: Successful handshake
- **WHEN** a host on an allowlisted origin replies `host:hello` to the child's `child:ready`
- **THEN** the child sends `child:hello-ack` targeted at that origin, and both sides deliver subsequent catalog messages

#### Scenario: Non-allowlisted parent
- **WHEN** a frame on an origin not in the allowlist sends `host:hello`
- **THEN** the child drops it, sends no ack and no further messages to that origin, and continues beaconing `child:ready`

#### Scenario: Delivery-order race
- **WHEN** the host's first `host:hello` fires before the child's listener is attached
- **THEN** the child's later `child:ready` beacon triggers a host retry of `host:hello` and the handshake still completes

### Requirement: The V1 message catalog is exactly seven fire-and-forget events
The protocol SHALL define: `child:ready {}`, `host:hello { hostKind, context }`, `child:hello-ack { version, authenticated }`, `host:context { context }`, `child:resize { height }`, `child:open-external { url }`, `child:status { authenticated }`. Messages are events (no replies); the envelope `id` is reserved for future correlation. `child:open-external` urls MUST be same-origin with the Baseout app or an allowlisted origin — hosts MUST refuse to open anything else.

#### Scenario: Context update after handshake
- **WHEN** the host user switches to another table and the host sends `host:context` with the new `tableId`
- **THEN** the child receives the updated context on its locked channel

#### Scenario: Host refuses foreign open-external
- **WHEN** the child (or something spoofing it) sends `child:open-external` with `url: 'https://evil.example'`
- **THEN** the host does not open the URL

### Requirement: EmbedContext carries host kind plus optional Airtable location IDs and nothing sensitive
`EmbedContext` SHALL be `{ host: 'airtable-data' | 'airtable-interface' | 'chrome', baseId?, tableId?, viewId?, pageId?, recordId?, url? }` with Airtable IDs verbatim. Protocol payloads MUST NOT carry auth tokens, session identifiers, emails, or record data in either direction; the only session-derived value crossing the boundary is the boolean `authenticated`.

#### Scenario: Chrome host on a non-Airtable tab
- **WHEN** a Chrome host's active tab is not an Airtable URL
- **THEN** its context is `{ host: 'chrome', url: <tab url> }` with no Airtable IDs, and the message validates

### Requirement: Ancestor allowlist entries support exact origins, wildcard subdomains, and extension schemes
The protocol package SHALL provide one allowlist parser/matcher used by both the child handshake and the web framing headers. Entries are comma-separated and support exact origins (`https://airtable.com`), single-level wildcard subdomains (`https://*.airtableblocks.com`), and extension origins (`chrome-extension://<id>`, with `chrome-extension://*` permitted for dev configs only). Matching is on origin (scheme + host + port) — never path — and a wildcard MUST NOT match the bare apex or multiple subdomain levels.

#### Scenario: Wildcard subdomain match
- **WHEN** the allowlist contains `https://*.airtableblocks.com` and a `host:hello` arrives from `https://block-123.airtableblocks.com`
- **THEN** the origin matches

#### Scenario: Wildcard does not overreach
- **WHEN** the same allowlist evaluates `https://airtableblocks.com` or `https://a.b.airtableblocks.com`
- **THEN** neither origin matches
