## Overview

`apps/web` (`@baseout/web`) is the Astro 6 SSR application that runs on Cloudflare Workers, port 4331 in dev. It owns the customer-facing UI surface and the `/api/*` endpoints that power it. After the port from `baseout-starter` HEAD (`29dfb5b`), it builds, type-checks, and runs end-to-end against a real Hyperdrive-fronted Postgres for auth, Airtable connections, and Stripe trial creation. Engine-coupled UI (the "Run Backup Now" form) is removed pending the rebuild of `apps/server`.

This document describes what is **actually shipped** in the port. The original v1 design — covering Mailgun, password / 2FA / SAML, WebSocket progress, AI documentation, embedded mode, full BYOS, etc. — remains the long-term target; per-capability gaps are listed in [STATUS.md](./STATUS.md) and will be filled by future `opsx:propose` changes.

## Stack

| Layer | Choice | Note |
|---|---|---|
| Runtime | Cloudflare Workers (Node 22.12+ tooling) | three envs in `wrangler.jsonc`: `baseout-dev`, `baseout-staging`, `baseout` (prod) |
| Adapter | `@astrojs/cloudflare` 13.1.10 | platformProxy enabled; SSR output |
| Framework | Astro 6.1.2 | `.astro` SSR pages + React islands optional (none today) |
| Auth | better-auth 1.6.5 | magic-link only; sealed cookies; KV-backed session storage |
| DB | PostgreSQL via Hyperdrive | DigitalOcean shared PG; `postgres-js` client per-request |
| ORM | Drizzle ORM 0.45.2 + drizzle-kit 0.31.10 | migrations in `apps/web/drizzle/` (0001 → 0005) |
| Mail | Resend | dev mode logs to console; only the magic-link template is wired |
| Billing | Stripe 22.0.2 | trial customer + subscription creation; webhook receiver and idempotency table are deferred |
| Styling | Tailwind 4 + daisyUI 5.5.19 | per-app components in `src/components/ui/` |
| State | nanostores 1.3.0 | `src/stores/` — hydrated server state, see CLAUDE.md §4 |
| Icons | `@fortawesome/fontawesome-free` 6.7.2 (free tier) + Material Symbols | FA Pro registry referenced in root `.npmrc` for future use |
| Testing | Vitest + Playwright + msw + happy-dom | `vitest.integration.config.ts` runs against Postgres via `docker-compose.test.yml` |
| Dev port | `4331` over https (mkcert) | `wrangler dev --remote --local-protocol https` |

## Source layout (post-port)

```
apps/web/
├── src/
│   ├── pages/                Astro SSR routes + /api/* handlers (login, register, welcome,
│   │                         backups (placeholder), integrations, profile, settings, restore,
│   │                         schema, help, index, ops/*)
│   ├── views/                page-level Astro composites (DashboardView, IntegrationsView,
│   │                         ConnectAirtableModal)
│   ├── lib/                  business logic — auth-factory, airtable/, backup-config/,
│   │                         capabilities/, integrations.ts, email/, stripe.ts, dashboard.ts
│   ├── db/schema/            auth.ts + core.ts (spaces, orgs, connections, backup_runs,
│   │                         backup_configurations, billing)
│   ├── stores/               nanostores
│   ├── components/{ui,layout,docs}/
│   ├── styles/
│   └── middleware.ts         route protection
├── drizzle/                  0001 → 0005 migrations + snapshots, _journal.json
├── public/                   brand favicons + icon kits
├── scripts/                  launch.mjs (renders wrangler.jsonc), setup.mjs, seed.ts
├── tests/{integration,e2e}/  vitest + playwright
├── vendor/@opensided/        theme/ + openside-identity-schema/ (file: deps)
├── package.json              name: @baseout/web
├── wrangler.jsonc            template — rendered at build by scripts/launch.mjs
├── wrangler.test.jsonc       Miniflare-backed integration tests
├── astro.config.mjs          SSR + cloudflare adapter, port 4331, checkOrigin=false
├── drizzle.config.ts         schema filter `baseout`, reads DATABASE_URL from .env
├── docker-compose.test.yml   local Postgres for integration tests
├── playwright.config.ts      E2E
├── vitest.config.ts          unit
├── vitest.integration.config.ts  integration (CF Workers pool)
├── eslint.config.mjs
└── openspec → ../../openspec/changes/baseout-web/   (symlink, postinstall-managed)
```

## Auth (magic-link only)

- `src/pages/login.astro` posts to `/api/auth/sign-in/magic-link` (better-auth handler).
- `src/lib/auth-factory.ts` mints the magic-link URL with origin validation; trusted-domain list is in env.
- Email template at `src/lib/email/magic-link.ts`; sent via Resend (`RESEND_API_KEY`). Dev mode logs the link to the console.
- Session is sealed-cookie + KV-backed (`SESSIONS_KV` binding). `src/middleware.ts` enforces auth on protected routes.
- Password / 2FA / SAML are **not implemented**. The v1 contracts in `specs/authentication/spec.md` cover the broader vision; only the magic-link clauses are met today.

## Airtable OAuth (PKCE)

- `src/lib/airtable/oauth.ts` runs the full PKCE handshake (code-verifier, S256 challenge, state).
- Token storage: encrypted with AES-256-GCM (`BASEOUT_ENCRYPTION_KEY`) into `connections.tokens_enc`.
- Stub mode: `src/pages/api/stub/` provides mock OAuth endpoints so dev with `wrangler --remote` doesn't require a real Airtable client. Real client requires `AIRTABLE_OAUTH_CLIENT_ID` + `AIRTABLE_OAUTH_CLIENT_SECRET`.
- Connection state surfaces in `src/views/IntegrationsView.astro` (status: active / expired / disconnected; reconnect CTA).

## Capability resolver (library only)

- `src/lib/capabilities/resolve.ts` resolves the per-Org per-Platform tier from Stripe product metadata, then maps tier → capability flags via `src/lib/capabilities/tier-capabilities.ts`.
- The HTTP endpoint `GET /api/me/capabilities` from the v1 design is **not** wired; pages that need a capability check call the lib directly in their server-side code.
- 5-minute cache and `enforceCapability` middleware are deferred to a future change.

## Stripe trial (only)

- `src/lib/stripe.ts` creates a Stripe Customer linked to the Organization on sign-up + a `$0` trial subscription against `STRIPE_TRIAL_PRICE_ID`.
- `DEV_SKIP_STRIPE` env-flag short-circuits this for local dev without Stripe credentials.
- Webhook receiver, dunning, plan upgrade/downgrade, add-ons, credit packs, idempotency table — all deferred.

## Backup config (persistence; no engine)

- `src/lib/backup-config/persist.ts` and `select-bases.ts` write `backup_configurations` and `backup_configuration_bases` rows.
- The Integrations UI surfaces base inclusion state and a save path.
- The "Run backup now" button has been removed from `/backups`. The DB schema is intact so that when `apps/server` is rebuilt, the run trigger can be reintroduced without DB changes.

## /ops admin scaffold

- `src/pages/ops/index.astro` is a placeholder admin surface gated by `users.user_role = 'admin'` (column added by drizzle 0004). Empty for now; future internal-tooling routes land here.

## Vendored packages (file: deps)

- `vendor/@opensided/theme` — design tokens, button / form base styles. Not yet promoted to `packages/ui`.
- `vendor/@opensided/openside-identity-schema` — Drizzle schema slice for `@opensided` identity. Candidate for promotion to `packages/identity-schema` when a second consumer appears.

Both stay vendored for this change; promoting either is a future delta.

## Cross-app contracts

- **`apps/server`** — does not exist yet. The previous direct HTTP wire is removed. When it lands, a sibling change reintroduces a backup-trigger path; per the existing `web-client-isolation` proposal, browser → server traffic should route through `apps/web` proxies (not direct cross-origin), but that's a future-change choice.
- **`apps/{api, sql, hooks, admin}`** — stubs only; no contracts wired today.

## Deployment

- `wrangler.jsonc` is a template rendered at build by `scripts/launch.mjs` (writes `dist/server/wrangler.json`).
- Three Worker envs: `baseout-dev` (host: `localhost:4331`), `baseout-staging`, `baseout` (prod, `baseout.dev`).
- Hyperdrive ID is filled for dev (`localConnectionString` in `.dev.vars`); staging / prod need provisioning before `pnpm --filter @baseout/web run deploy:staging`.
- KV namespace (`SESSIONS_KV`) and Email binding configured per-env via wrangler secrets.

## Test profile

- Unit: `vitest.config.ts` — `src/**/*.test.ts`, msw + happy-dom.
- Integration: `vitest.integration.config.ts` — CF Workers pool, real Postgres via `docker-compose.test.yml`, `wrangler.test.jsonc` env (no `BACKUP_ENGINE_*` vars after the strip).
- E2E: `playwright.config.ts` — magic-link flow happy path, with `E2E_TEST_MODE=true` exposing the test-only `/api/internal/test/last-verification` endpoint behind HMAC.

## Out-of-scope (future changes)

Each is a candidate for `opsx:propose <name>`:

| Change | Why deferred |
|---|---|
| `baseout-web-auth-extended` | password + 2FA TOTP + SAML — needs better-auth plugins + UI work |
| `baseout-web-mailgun` | swap Resend → Mailgun + React Email templates |
| `baseout-web-websocket-progress` | depends on `apps/server` durable object existing |
| `baseout-web-capability-api` | wrap the resolver lib in `/api/me/capabilities` + 5-min cache |
| `baseout-web-stripe-full` | webhooks + idempotency + plan upgrade + add-ons + credit packs |
| `baseout-web-byos-storage` | OAuth/IAM flows for Drive / Dropbox / Box / OneDrive / S3 / Frame.io |
| `baseout-web-ai-docs` | depends on `apps/server` (write path) and Cloudflare AI |
| `baseout-web-embedded` | iframe detection + postMessage framework |
| `baseout-web-migration-ux` | re-auth flow for migrated On2Air users |
| `baseout-web-data-views` | Data / Automations / Interfaces views |
| `baseout-web-notifications-ui` | dashboard panel + per-channel preferences |
| `baseout-web-restore-full` | snapshot picker + scope picker + post-restore verification |
| `baseout-web-schema-ui` | React Flow visualizer + changelog rendering |
| `baseout-web-onboarding-wizard` | full 5-step wizard + storage-destination flow |
