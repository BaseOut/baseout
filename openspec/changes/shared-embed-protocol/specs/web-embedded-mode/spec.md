# web-embedded-mode

The web app's child-side embedded behavior: the `/embed` entry, framing headers, context-driven navigation, embedded layout state, and the unauthenticated-in-iframe fallback.

## ADDED Requirements

### Requirement: The embed entry boots the child bridge and applies context
The web app SHALL serve `/embed?host=<kind>` as the embedding entry point. It boots the protocol child bridge, and on handshake completion stores the received context in the `$embedContext` nanostore and navigates to the route resolved from it. Context→route resolution SHALL be a pure function: a `baseId` covered by one of the user's Spaces' backup configurations resolves to that Space's base surface; a `baseId` not covered resolves to the Space list with a not-backed-up affordance; no `baseId` resolves to the dashboard. `host:context` updates after handshake SHALL update the store and re-resolve.

#### Scenario: Known base context
- **WHEN** the handshake delivers context with a `baseId` that one of the user's Spaces backs up
- **THEN** the app navigates to that Space's surface for the base

#### Scenario: Unknown base context
- **WHEN** the context `baseId` matches no Space's backup configuration
- **THEN** the app shows the Space list with an indication that the current base is not backed up

### Requirement: Framing is restricted to configured ancestors on every HTML response
The web app SHALL send `Content-Security-Policy: frame-ancestors 'self' <allowlist>` on every HTML response, with the allowlist sourced from `PUBLIC_EMBED_ALLOWED_ANCESTORS` via the protocol package's parser (same source of truth as the handshake validation). The app MUST NOT send `X-Frame-Options`. With the variable unset, the directive is `frame-ancestors 'self'` (framing effectively disabled for third parties).

#### Scenario: Allowlisted ancestor configured
- **WHEN** `PUBLIC_EMBED_ALLOWED_ANCESTORS` includes `https://*.airtableblocks.com` and any app page is requested
- **THEN** the response carries `frame-ancestors 'self' https://*.airtableblocks.com` (plus other configured entries) and no `X-Frame-Options` header

#### Scenario: No configuration
- **WHEN** the variable is unset
- **THEN** HTML responses carry `frame-ancestors 'self'`

### Requirement: Embedded layout adapts without affecting standalone mode
When embed mode is active (entered via `/embed`; persisted in the `$embedContext` store across client navigation), the app SHALL hide marketing chrome (top marketing header/footer) and keep the app navigation. Standalone requests (no embed entry) MUST render exactly as today.

#### Scenario: Standalone unaffected
- **WHEN** a user browses the app normally (never via `/embed`)
- **THEN** no embedded-mode layout changes apply

### Requirement: Unauthenticated embeds fall back to top-level sign-in via the host
When the embed entry finds no session, it SHALL render a minimal sign-in prompt (no full marketing page) whose action sends `child:open-external` with the standalone sign-in URL — sign-in MUST always happen top-level, never inside the iframe. After handshake, auth-state changes SHALL be reported to the host via `child:status`.

#### Scenario: No session in iframe
- **WHEN** `/embed` loads without a valid session
- **THEN** the child completes the handshake reporting `authenticated: false`, renders the sign-in prompt, and clicking it sends `child:open-external` with the sign-in URL

### Requirement: Session cookies flow in embedded Chromium contexts
The better-auth session cookies SHALL be issued with `SameSite=None; Secure` so embedded iframes on Chromium browsers receive the session. The change MUST be accompanied by a CSRF regression test proving a forged cross-site POST to a mutating route is rejected, and MUST NOT alter any OAuth redirect URI (sign-in remains top-level).

#### Scenario: Embedded session on Chromium
- **WHEN** a user with an existing Baseout session loads `/embed` inside an allowlisted iframe on a Chromium browser
- **THEN** the request carries the session cookie and the embed renders authenticated

#### Scenario: CSRF still rejected
- **WHEN** a cross-site form POST targets a mutating app route with the `SameSite=None` session cookie attached
- **THEN** the request is rejected by CSRF protection
