## ADDED Requirements

### Requirement: Verified @openside.com sessions are granted staff access

The admin console SHALL grant staff access to a user whose session belongs to a verified `@openside.com` email, in addition to users with `role === 'super'`, applying the identical rule at both deployed gate points (the web `/api/admin/handoff` mint and the admin `decideAccess`) so the handshake cannot pass one gate and fail the other.

#### Scenario: @openside.com user without an explicit super role

- **WHEN** a user with a verified `@openside.com` email and `role !== 'super'` completes web login and is handed off to the admin console
- **THEN** the handoff token is minted and the admin gate grants access — no manual role bump is required

#### Scenario: Lookalike and external domains are denied

- **WHEN** the session email is `attacker@openside.com.evil.net`, `openside.com@gmail.com`, or any non-`openside.com` domain, and the user is not `role === 'super'`
- **THEN** access is denied at both gates — the domain match is exact on the domain part of the address, never a substring

#### Scenario: Explicit super role still works

- **WHEN** a user has `role === 'super'` regardless of email domain
- **THEN** access is granted exactly as before — the domain rule is additive, not a replacement

### Requirement: Future staff Support surfaces reuse the staff predicate

Any future in-app Support staff surface SHALL gate staff-only access with the same `isStaff({ role, email })` policy as the admin console: explicit `role === 'super'` OR a verified exact-domain `@openside.com` session. Support SHALL NOT introduce a separate email allowlist or weaker substring domain check.

#### Scenario: @openside.com support access

- **WHEN** a verified `@openside.com` user opens a future staff-only Support surface
- **THEN** access is granted by the shared staff predicate, matching admin-console behavior

#### Scenario: Support denies lookalike domains

- **WHEN** a non-super user with a lookalike or external email opens a future staff-only Support surface
- **THEN** access is denied by the same exact-domain predicate used by admin
