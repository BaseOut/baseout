# shared-embed-protocol — Proposal

## Why

PRD §6.7 (scope-locked ✅) requires Baseout to run embedded inside Airtable extensions and similar hosts: the web app must detect embedded context, speak a **window messaging framework** with a thin outer wrapper, receive location context (base/table/view), and adapt what it displays. Nothing in the codebase supports this today — no message protocol, no embedded-mode detection, no `frame-ancestors` policy (the app currently sends no framing headers at all), and the `SameSite=Lax` session cookie will never be sent inside a cross-site iframe. This change builds the shared foundation; the host wrappers themselves land in the paired [`embed`](../embed/) change.

## What Changes

- **New workspace package `packages/embed-protocol` (`@baseout/embed-protocol`)** — the single source of truth both frames import:
  - Versioned message envelope, the full message catalog (host→child: `hello`, `context`; child→host: `ready`, `hello-ack`, `resize`, `open-external`, `status`), and the `EmbedContext` shape (`host` kind + Airtable `baseId`/`tableId`/`viewId`/`pageId`/`recordId`).
  - Handshake state machine: child beacons `ready` (no data), host replies `hello` with context, child origin-locks and acks; host retries until acked.
  - Origin validation helpers (exact origins + `chrome-extension://*` / wildcard-subdomain patterns), pure and unit-tested.
- **`apps/web` embedded mode (child side):**
  - `/embed` entry route: initializes the child bridge, applies received context (maps `baseId` → the Space whose backup configuration covers it, navigates to the relevant surface), stores context in a `$embedContext` nanostore.
  - Middleware sends `Content-Security-Policy: frame-ancestors 'self' <allowlist>` on HTML responses (allowlist from config; hardening over today's no-header default).
  - Embedded layout: compact chrome (marketing header/footer hidden) driven by the embed store.
  - Unauthenticated-in-iframe fallback: embed entry renders a minimal sign-in prompt that asks the host (via `open-external`) to open standalone Baseout sign-in in a top-level tab.
- **BREAKING (auth cookie): better-auth session cookie moves `SameSite=Lax` → `SameSite=None; Secure`** so the session flows in embedded iframes on Chromium. Safari/Firefox still block third-party cookies — the sign-in fallback above is the supported path there. Security review points called out in design.

## Capabilities

### New Capabilities

- `embed-messaging-protocol`: the versioned postMessage contract between a host wrapper (outer frame) and the embedded Baseout app (inner frame) — envelope, handshake with origin locking, message catalog, context shape, and origin-validation rules.
- `web-embedded-mode`: the web app's child-side behavior — embed entry + detection, framing headers, context-driven navigation, embedded layout, and the unauthenticated fallback.

### Modified Capabilities

<!-- none — no existing spec in openspec/specs/ covers framing, messaging, or session cookie attributes -->

## Impact

- `packages/embed-protocol/` — new package (pure TS, zero runtime deps); consumed by `apps/web` now and `apps/embed` (paired change).
- `apps/web/src/middleware.ts` — frame-ancestors header; `src/lib/auth-factory.ts` — cookie attribute change (security review: CSRF posture with `SameSite=None` relies on better-auth CSRF checks — called out per CLAUDE.md §3.3).
- `apps/web/src/pages/embed.astro` + `src/lib/embed/` (bootstrap, context→route mapping) + `src/stores/embed.ts`.
- Config: `PUBLIC_EMBED_ALLOWED_ANCESTORS` (web) — documented in `.dev.vars`/wrangler examples.
- Pairs with [`embed`](../embed/) (the three host wrappers). Cross-referenced per the §3.6 two-change convention.
- OAuth runbook: no redirect-URI changes (sign-in always happens top-level, never in-iframe) — noted to satisfy the §3.7 read-before-touching-auth rule.
