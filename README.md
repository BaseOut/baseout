# Baseout

Backup, restore, and data intelligence layer for Airtable. Monorepo containing six independently-deployed Cloudflare Workers projects, one Trigger.dev task project, and three shared workspace packages.

## What is Baseout?

Baseout lets teams back up, restore, and query their Airtable data. Customers connect an Airtable workspace, configure one or more **Spaces** (each bound to a set of Bases), and access tiered capabilities: scheduled backups to cloud storage, point-in-time restore, schema visualization and diff, a programmatic inbound data API, a read-only SQL interface, and AI-assisted documentation. Billing is per-Organization with five tiers (Community → Starter → Growth → Pro → Business → Enterprise).

## Apps

### `apps/web` — Customer app (`@baseout/web`)
The main customer-facing surface. Astro SSR deployed to Cloudflare Workers. Owns: authentication (better-auth — magic link, email+password, 2FA, SAML), the onboarding wizard, the dashboard (live backup progress via WebSocket, storage usage, health scores), all feature UIs (Backup, Restore, Schema, Data, AI, Integrations), Stripe billing UX, and the `/api/*` endpoints the browser calls. Also hosts the Airtable extension embed and On2Air migration UX.

→ Specs: [`openspec/changes/web/`](openspec/changes/web/)

---

### `apps/server` — Data plane (`@baseout/server`)
The backend engine Worker. Cloudflare Worker with Durable Objects; enqueues Trigger.dev tasks via `@trigger.dev/sdk`. Owns: the per-Space state machine DO + per-Connection rate-limit DO, the restore engine (Base/table/point-in-time scope), all six BYOS storage destinations (Google Drive, Dropbox, Box, OneDrive, S3, Frame.io) plus R2 managed storage, schema diff and health score computation, background cron services (webhook renewal, OAuth token refresh, trial-expiry monitor, quota monitor, smart-cleanup scheduler), DB provisioning for Pro+ client databases, and the On2Air migration script.

→ Specs: [`openspec/changes/server/`](openspec/changes/server/)

---

### `apps/workflows` — Trigger.dev tasks (`@baseout/workflows`)
Trigger.dev v3 task project. Runs on Trigger.dev's Node runner — NOT inside a Cloudflare Worker. Hosts long-running async work that exceeds Worker wall-clock budgets: the per-base backup task, future per-base restore, attachment ingestion, retention cleanup, trial-email cron, etc. Enqueued from `apps/server` via `tasks.trigger<typeof X>(...)` with type-only references from `@baseout/workflows`.

→ Specs: [`openspec/changes/workflows/`](openspec/changes/workflows/) plus paired `workflows-<topic>` siblings for each in-flight Trigger.dev workload (attachments, cleanup, dynamic-mode provisioning, instant-webhook, etc.)

---

### `apps/admin` — Internal admin (`@baseout/admin`)
Internal operations dashboard. Astro SSR, Google SSO, Cloudflare Workers. Super-admin access to Organizations, Spaces, billing state, run history, and on-call tooling.

→ Specs: [`openspec/changes/admin/`](openspec/changes/admin/)

---

### `apps/api` — Inbound API (`@baseout/api`)
Public versioned ingestion API at `api.baseout.com`. Cloudflare Worker. Accepts token-authenticated HTTP POSTs from external scripts and AI agents, validates payloads, enforces tier-based rate limits, debits credits, and forwards validated payloads to `apps/server` via HMAC service token. Does not write to client DBs directly.

→ Specs: [`openspec/changes/api/`](openspec/changes/api/)

---

### `apps/sql` — SQL API (`@baseout/sql`)
Public read-only SQL API at `sql.baseout.com` (Pro+). Cloudflare Worker with Hyperdrive. Accepts token-authenticated SELECT queries, enforces read-only safety, executes against the Space's client DB under a read-only role, and debits credits. Structurally symmetric to `apps/api` — same `api_tokens` table, same OpenAPI publishing pattern.

→ Specs: [`openspec/changes/sql/`](openspec/changes/sql/)

---

### `apps/hooks` — Webhook receiver (`@baseout/hooks`)
Public Airtable webhook receiver at `webhooks.baseout.com`. Cloudflare Worker. Owns the public Airtable webhook callback endpoint: verifies HMAC signatures, coalesces payloads, and forwards to `apps/server`'s internal ingestion endpoint. Deployed and versioned independently so signature-scheme rotations never require a data-plane deploy.

→ Specs: [`openspec/changes/hooks/`](openspec/changes/hooks/)

---

## Packages

| Package | Description |
|---|---|
| [`packages/db-schema`](packages/db-schema/) | Drizzle schema + migrations for the master DB. The single source of truth for all table definitions. Consumed by all six apps at a pinned version. Schema changes are coordinated events. → [`openspec/changes/db-schema/`](openspec/changes/db-schema/) |
| [`packages/shared`](packages/shared/) | AES-256-GCM encryption, HMAC service-token issuer/validator, structured error types, logging helpers, common Zod helpers. Used by all six apps for cross-app auth and internal utilities. |
| [`packages/ui`](packages/ui/) | Astro/React component library shared between `web` and `admin`. |

## Cross-app communication

```
browser          → apps/web    (HTTPS, Stripe webhooks, Airtable OAuth)
apps/web         → apps/server (HTTP + WebSocket DO, HMAC service token)
apps/hooks       → apps/server (HTTP, HMAC service token — forwarded Airtable events)
apps/api         → apps/server (HTTP, HMAC service token — forwarded inbound payloads)
apps/sql         → client DBs  (read-only PG via Hyperdrive, provisioned by apps/server)
apps/admin       → apps/server (HTTP, HMAC service token — super-admin ops)
```

## Monorepo layout

```
baseout/
├─ apps/
│  ├─ web/          # Customer Astro SSR app + /api/* endpoints
│  ├─ server/       # Backup/restore engine Worker, Durable Objects, cron, migration
│  ├─ workflows/    # Trigger.dev v3 task project — long-running async work (Node runner)
│  ├─ admin/        # Internal admin Astro SSR app (Google SSO)
│  ├─ api/          # Public inbound API (api.baseout.com)
│  ├─ sql/          # Public read-only SQL API (sql.baseout.com)
│  └─ hooks/        # Airtable webhook receiver (webhooks.baseout.com)
├─ packages/
│  ├─ db-schema/    # Drizzle schema + migrations
│  ├─ ui/           # Shared Astro/React components
│  └─ shared/       # Encryption, HMAC tokens, error types, Zod helpers
├─ openspec/        # Spec-driven workflow — proposals, designs, specs, tasks
│  ├─ changes/      # One change per app/package (flat layout; query via `pnpm openspec:changes <app>`)
│  └─ specs/        # Living capability specs (merged from archived changes)
├─ shared/          # Cross-cutting product docs (Features, DB Schema, Pricing)
└─ archive/         # Original PRDs (historical reference only)
```

## Setup (new contributor)

Prerequisites: Node 20+, pnpm 9+, wrangler, OpenSpec CLI.

```bash
# 1. Clone
git clone git@github.com:baseout/baseout.git
cd baseout

# 2. Install tooling
brew install node pnpm                               # or your platform equivalent
npm install -g wrangler @fission-ai/openspec

# 3. Configure FontAwesome registry token (required for theme dependencies)
#    Get the token from a teammate and add it to .npmrc

# 4. Install workspace dependencies
pnpm install

# 5. Authenticate Cloudflare
wrangler login

# 6. Set up local secrets per app (each app has its own .dev.vars.example)
for app in web server admin api sql hooks; do
  cp apps/$app/.dev.vars.example apps/$app/.dev.vars
  # edit apps/$app/.dev.vars with your DB string, API keys, etc.
done
# workflows uses .env (Trigger.dev runner is Node, not workerd):
cp apps/workflows/.env.example apps/workflows/.env 2>/dev/null || true

# 7. Run a single app locally
pnpm dev:web          # or dev:server, dev:admin, dev:api, dev:sql, dev:hooks, dev:workflows

# 8. Run tests across the whole workspace
pnpm test

# 9. Typecheck everything
pnpm typecheck
```

### Finding OpenSpec changes

OpenSpec changes live flat under `openspec/changes/<name>/`. The prefix groups them:

- `<app>-<topic>` — single-app change (prefix matches a directory under `apps/`, e.g. `server-attachments`, `web-smooth-theme-swap`)
- `shared-<topic>` — code change that touches two or more apps as a unit (e.g. `shared-server-service-binding`, `shared-websocket-progress`)
- `system-<topic>` — structural / repo-shape / tooling change (e.g. `system-db-schema`, `system-r2-stance`)

See `CLAUDE.md` §3.6 for the full rule.

To list changes by prefix:

```bash
pnpm openspec:changes web        # web + every web-*
pnpm openspec:changes server     # server + every server-*
pnpm openspec:changes workflows  # workflows + every workflows-*
pnpm openspec:changes shared     # cross-app changes
pnpm openspec:changes system     # structural / tooling changes
```

Or use the OpenSpec CLI directly:

```bash
openspec list                    # all active changes
openspec list | grep '^server'   # filter by prefix
openspec show server             # full content of one change
openspec validate <change>       # validate a specific change
```

## Deployment

**Cloudflare Workers Builds (Deploy from GitHub)** — Cloudflare watches `main` and deploys an app automatically when files in its watch paths change. GitHub Actions only runs CI (typecheck, test, lint).

| Setting | Value |
|---|---|
| Repository | `baseout/baseout` |
| Production branch | `main` |
| Root directory | `apps/<name>` |
| Build command | `pnpm install --frozen-lockfile && pnpm --filter @baseout/<name> build` |
| Deploy command | `pnpm --filter @baseout/<name> deploy` |
| Watch paths | `apps/<name>/**`, `packages/db-schema/**`, `packages/shared/**`, `packages/ui/**` (web/admin only), `pnpm-lock.yaml` |

## OpenSpec workflow

```bash
openspec list                              # all active changes
openspec status --change web       # status of one change
openspec show web                  # full content of one change
openspec validate --all                    # validate everything
```

Claude Code skills:

- `/opsx:propose <description>` — create a new change with proposal/design/specs/tasks
- `/opsx:apply <change-name>` — implement tasks from a change
- `/opsx:archive <change-name>` — sync specs and archive a completed change

## Archive

`archive/` — original `Front_PRD.md`, `Back_PRD.md`, and implementation plans. Converted to OpenSpec and kept for historical reference only.

`openspec/changes/archive/` — superseded OpenSpec changes.
