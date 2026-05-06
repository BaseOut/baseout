# Tech Stack

The runtime, language, and tool choices for Baseout. Source: [openspec/config.yaml](../openspec/config.yaml) ("Tech Stack" section) and [CLAUDE.md](../CLAUDE.md). This file is the searchable summary; the YAML is authoritative for openspec context strings.

## Languages and Runtime

TypeScript everywhere, strict mode. All backend apps run on Cloudflare Workers; tooling and scripts run on Node. Worker code uses workerd, not Node — `cloudflare:workers` imports are workerd-only.

| Layer | Choice |
|---|---|
| Source language | TypeScript (strict, ESNext, verbatimModuleSyntax) |
| Worker runtime | Cloudflare Workers (workerd) |
| Tooling runtime | Node ≥20 (lat.md needs ≥22) |
| Package manager | pnpm 9.12.0 |

## Frontend

Astro Server-Side Rendering with React islands. Heavy lifting stays on the server; client JS is the exception. Theme primary is `@opensided/theme`, secondary is daisyUI — see [[engineering-principles]].

| Concern | Choice |
|---|---|
| Framework | Astro SSR (Cloudflare adapter) |
| Islands | React 18 |
| Schema viz | React Flow |
| Tours | Shepherd.js |
| State | nanostores ([[engineering-principles]] §state-management) |
| Theme | `@opensided/theme` (primary), daisyUI (secondary), custom CSS (fallback) |

## Backend

Headless Cloudflare Workers behind a small public surface. Long-running work goes through Trigger.dev v3; per-Connection rate limiting and per-Space scheduling go through Durable Objects.

| Concern | Choice |
|---|---|
| Backup engine | Cloudflare Workers + Durable Objects |
| Background jobs | Trigger.dev v3 (one job per base backup, unlimited concurrency) |
| State machines | Durable Objects (per-Connection, per-Space) |
| Object storage | Cloudflare R2 (managed); BYOS: Google Drive, Dropbox, Box, OneDrive, S3, Frame.io |

## Data

Postgres is the source of truth for application data. Customer Dynamic Backups can land in D1, shared PG, dedicated PG, or BYODB depending on tier — see [[pricing-tiers]].

| Concern | Choice |
|---|---|
| Master DB | PostgreSQL — DigitalOcean shared PG (Trial/Launch/Growth/Pro), Neon/Supabase dedicated (Business+) |
| ORM | Drizzle ORM (TypeScript schema as source of truth) |
| Pooling | Cloudflare Hyperdrive in deployed envs; direct DATABASE_URL in local `wrangler dev` |
| Validation | Zod |

## Auth and Billing

Customer auth is passwordless magic-link via better-auth. Service-to-service auth uses HMAC tokens minted from `@baseout/shared`. Billing is Stripe with idempotency tables — see [[security-model]] and [[cross-app-comm]].

| Concern | Choice |
|---|---|
| Customer auth | better-auth (magic link, email+password, 2FA TOTP, Enterprise SAML) |
| Connection auth | Airtable OAuth (per-Organization) |
| Service-to-service | HMAC tokens (`@baseout/shared`) + INTERNAL_TOKEN gate on `apps/server` |
| Billing | Stripe (subscriptions, add-ons, one-time credit packs); webhook idempotency table |

## Email and Testing

Mailgun for transactional email and Vitest as the unit/integration runner.

| Concern | Choice |
|---|---|
| Transactional email | Mailgun + React Email templates |
| Unit / integration | Vitest |
| Worker integration | `@cloudflare/vitest-pool-workers` |
| HTTP mocking | msw |
| End-to-end | Playwright (web only) |
| Local PG | Docker (real PG, not mocked — see [[engineering-principles]]) |

## Deployment

Each Worker app deploys via Wrangler with per-environment configs. Frontend (`apps/web`) deploys to Cloudflare Pages + Workers; backend apps deploy as Workers.

- Wrangler config: per-app `wrangler.jsonc`
- Environments: `production`, `staging`
- CI: GitHub Actions; lat-check runs alongside lint and typecheck (see [[engineering-principles]])

## Where to Look

The authoritative declarations of these choices.

- [openspec/config.yaml](../openspec/config.yaml) — context strings used by openspec tooling
- [CLAUDE.md](../CLAUDE.md) §3 — engineering principles around the stack
- [shared/Baseout_PRD.md](../shared/Baseout_PRD.md) §4 — confirmed technology stack with rationale
- [shared/Baseout_Implementation_Plan.md](../shared/Baseout_Implementation_Plan.md) — phased build order across the stack
