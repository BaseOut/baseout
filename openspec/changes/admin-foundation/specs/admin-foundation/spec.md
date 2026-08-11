## ADDED Requirements

### Requirement: Runnable Astro SSR admin app

`apps/admin` SHALL be a real Astro SSR application on the `@astrojs/cloudflare` adapter, replacing the placeholder Worker. It SHALL run locally via `pnpm --filter @baseout/admin dev` on the `baseout.local` host, reusing the existing dev certificate, and SHALL read the master DB through a per-request postgres-js client (mirroring `apps/web/src/db/worker.ts`). It SHALL NOT run a `better-auth` runtime of its own.

#### Scenario: Local dev serves the app

- **WHEN** a developer runs `pnpm --filter @baseout/admin dev`
- **THEN** the Astro SSR app is served on `https://baseout.local:4332` and the placeholder `200 "baseout-admin placeholder"` response is no longer returned

#### Scenario: Per-request DB client

- **WHEN** an admin page handler queries the master DB
- **THEN** it creates a postgres-js client for that request and releases the socket via `ctx.waitUntil(sql.end())` on response

### Requirement: Staff-session auth gate

The admin app SHALL gate all pages by validating the existing `better-auth.session_token` cookie against the master DB `sessions` table and requiring the linked `users.role` to equal `'super'`. Validation SHALL be read-only: the admin app SHALL NOT create, mutate, or delete sessions. A request with no session, an expired session, or a non-`super` role SHALL receive a 403 and SHALL NOT render any data surface.

#### Scenario: Super user is allowed

- **WHEN** a user with `users.role = 'super'` and an unexpired session opens an admin page
- **THEN** the gate resolves the user onto `context.locals` and the page renders

#### Scenario: Customer is rejected

- **WHEN** a user with `users.role = 'customer'` (or any non-`super` role) requests an admin page
- **THEN** the app returns 403 and renders no operational data

#### Scenario: No or expired session is rejected

- **WHEN** a request has no `better-auth.session_token` cookie, or the looked-up session's `expires_at <= now()`
- **THEN** the app returns 403

### Requirement: Organizations → Spaces tracker

The admin app SHALL expose one read-only surface that lists every Organization with its Spaces — per [PRD §5.4](../../../shared/Baseout_PRD.md) (Database Admin Area) and [§16.1](../../../shared/Baseout_PRD.md) — showing each Space's name, status, platform, and the Organization's tier (from `subscription_items`). In the V1 tier model each Space corresponds to one provisioned database, satisfying the PRD's "identify which databases belong to which Organizations." The surface SHALL be rendered with the shared `@baseout/ui` component library and SHALL issue no mutating queries.

#### Scenario: Tracker lists Orgs and their Spaces

- **WHEN** a `super` user opens the tracker
- **THEN** every Organization is listed with its Spaces (name, status, platform) and tier, read from the master DB

#### Scenario: Organization with no Spaces

- **WHEN** an Organization has zero Spaces
- **THEN** that Organization still renders (with an empty Spaces list) and the page does not error

### Requirement: Mirrored schema with canonical source

The tables this surface reads SHALL be mirrored into `apps/admin/src/db/schema/` for only `organizations`, `spaces`, `space_platforms`, and `subscription_items`, with `sessions` and `users` re-used from `@baseout/db-schema`. Each mirrored table file SHALL carry a header comment naming `apps/web/src/db/schema/core.ts` as the canonical migration source. The admin app SHALL NOT own or run master-DB migrations.

#### Scenario: Mirror names its source

- **WHEN** a mirrored table file is opened
- **THEN** its header comment identifies `apps/web/src/db/schema/core.ts` as canonical and instructs keeping it in sync
