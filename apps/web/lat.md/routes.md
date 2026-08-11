# Routes

Astro file-based routing under [src/pages/](../src/pages/). Pages are `.astro`; API routes are `.ts` files exporting an HTTP handler. Public path policy lives in [[auth#Auth#Route Protection]].

The map below is the live shape — any addition to this surface should update this file.

## Customer Pages

Top-level customer-facing pages. Auth-gated unless explicitly listed in the public set.

| Path | File | Auth | Purpose |
|---|---|---|---|
| `/` | [src/pages/index.astro](../src/pages/index.astro) | gated | Dashboard / home |
| `/login` | [src/pages/login.astro](../src/pages/login.astro) | public | Magic-link entry |
| `/register` | [src/pages/register.astro](../src/pages/register.astro) | public | Sign-up |
| `/welcome` | [src/pages/welcome.astro](../src/pages/welcome.astro) | gated | Post-onboarding landing |
| `/integrations` | [src/pages/integrations.astro](../src/pages/integrations.astro) | gated | OAuth Connect dashboard |
| `/profile` | [src/pages/profile.astro](../src/pages/profile.astro) | gated | User settings |
| `/settings` | [src/pages/settings.astro](../src/pages/settings.astro) | gated | Org/Space settings |
| `/backups` | [src/pages/backups.astro](../src/pages/backups.astro) | gated | Backup history |
| `/restore` | [src/pages/restore.astro](../src/pages/restore.astro) | gated | Restore flow |
| `/schema` | [src/pages/schema.astro](../src/pages/schema.astro) | gated | Schema viz |
| `/reports` | [src/pages/reports.astro](../src/pages/reports.astro) | gated | Analytics surface |
| `/help` | [src/pages/help.astro](../src/pages/help.astro) | gated | In-app help |
| `/404` | [src/pages/404.astro](../src/pages/404.astro) | public | Not-found page |
| `/[…slug]` | [src/pages/[...slug].astro](../src/pages/[...slug].astro) | public | Catch-all (marketing pages) |
| `/ops/*` | [src/pages/ops/](../src/pages/ops/) | staff-gated | Internal staff console |

## API Routes

Grouped by purpose. The `/api/internal/*` namespace inside `apps/web` is **distinct from** `apps/server`'s `/api/internal/*` — both exist; both are gated. Don't conflate them.

| Namespace | Source | Purpose |
|---|---|---|
| `/api/auth/*` | [src/pages/api/auth/](../src/pages/api/auth/) | better-auth callbacks (public per [[auth]]) |
| `/api/me`, `/api/dashboard` | [src/pages/api/me.ts](../src/pages/api/me.ts), [src/pages/api/dashboard.ts](../src/pages/api/dashboard.ts) | Viewer state for the dashboard |
| `/api/billing/*` | [src/pages/api/billing/](../src/pages/api/billing/) | Stripe webhooks + customer portal |
| `/api/connections/*` | [src/pages/api/connections/](../src/pages/api/connections/) | OAuth Connect (Airtable + storage providers) |
| `/api/onboarding/*` | [src/pages/api/onboarding/](../src/pages/api/onboarding/) | First-run setup |
| `/api/spaces/*` | [src/pages/api/spaces/](../src/pages/api/spaces/) | Space CRUD + base attachment |
| `/api/me/*` | [src/pages/api/me/](../src/pages/api/me/) | User-scoped self-service endpoints |
| `/api/stub/*` | [src/pages/api/stub/](../src/pages/api/stub/) | **Dev-only** Airtable OAuth impersonation; gated by `AIRTABLE_STUBS_ENABLED` |
| `/api/internal/*` | [src/pages/api/internal/](../src/pages/api/internal/) | E2E test helpers (`E2E_TEST_MODE === 'true'` only) |

## What Is Not Here

These belong in `apps/server` (or another backend app); ending up in `apps/web` is the wrong split per [root monorepo-layout](../../../lat.md/monorepo-layout.md).

- Backup execution — `apps/server` Trigger.dev tasks.
- Durable Objects — `apps/server`.
- R2 binding writes — `apps/server`.
- Webhook ingest from Airtable — `apps/hooks`.
- Public versioned API for customers — `apps/api`.
- Read-only SQL API — `apps/sql`.

## Where to Look

Pointers to per-app rules and the cross-app comms map.

- Per-app rules: [.claude/CLAUDE.md](../.claude/CLAUDE.md) §0.5 (repo split)
- Middleware: [src/middleware.ts](../src/middleware.ts)
- Page directory: [src/pages/](../src/pages/)
- Cross-app token map: [root cross-app-comm](../../../lat.md/cross-app-comm.md)
