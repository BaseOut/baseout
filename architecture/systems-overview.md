# Baseout — Systems Overview

**Status:** draft for review, 2026-08-29. Basis for the architecture diagram.

What this covers: every external system and Cloudflare primitive Baseout runs on,
ordered from domain management at the edge down to the database. It describes how
each piece is *used*, not just that it exists.

**Status labels** used throughout — the codebase is mid-migration, so this matters:

| Label | Meaning |
|---|---|
| **Live** | Deployed and serving today |
| **Built** | Code merged, not yet deployed to a real environment |
| **Proposed** | Designed in `openspec/changes/` or `architecture/`, not implemented |

Related: [lat.md/tech-stack.md](../lat.md/tech-stack.md) (partially stale — see
*Known doc drift* at the end), [shared/internal/cloudflare-env-separation.md](../shared/internal/cloudflare-env-separation.md),
[shared/internal/oauth-setup.md](../shared/internal/oauth-setup.md),
[shared/internal/r2-setup.md](../shared/internal/r2-setup.md).

---

## 1. Domains and DNS — Cloudflare

Cloudflare is the registrar/DNS provider and the edge runtime, so domain
management and compute are the same control plane.

| Zone | Use | Status |
|---|---|---|
| `baseout.com` | Production customer-facing | Live |
| `baseout.dev` | Staging / preview hostnames, email sender domain | Live |
| `*.openside.workers.dev` | Per-Worker default hostnames, dev environment | Live |
| `baseout.local` | Local development (hosts-file entry, port 4331) | Live |

Hostname map:

| Hostname | Worker | Notes |
|---|---|---|
| `console.baseout.com` | web | Customer app |
| `admin.baseout.com` | admin | Staff console |
| `support.baseout.com` | support | Docs/help portal — `custom_domain: true` in config |
| `api.baseout.com` | api | Public REST + MCP (route declared, not yet deployed) |
| `sql.baseout.com` | sql | Direct SQL (Business+) — proposed |
| `hooks.baseout.com` | hooks | Airtable webhook receiver — proposed |
| `staging.console.baseout.dev` | web (staging) | Cloudflare Access gated |

**Domain attachment** is owned by wrangler config where possible (`routes` with
`custom_domain: true`), because a config-driven deploy restates it; dashboard-only
attachment drifts. `support` already does this deliberately.

---

## 2. Accounts and environments — Cloudflare

**Two Cloudflare accounts** (decided 2026-08-27) so production is blast-radius
isolated from everything else:

| Account | Holds | Status |
|---|---|---|
| Staging account (`f094d60e…`) | `dev` + `staging` environments of every Worker | Live (dev only) |
| Production account | `production` environment only | Proposed |

**Three named environments per Worker** — `dev`, `staging`, `production`. Script
names are *derived*, not declared: `name` lives only at the top level of
`wrangler.jsonc` and wrangler appends the environment, giving
`baseout-web-dev` / `baseout-web-staging` / `baseout-web-production`.

Consequences worth knowing:

- **Service bindings cannot cross accounts.** Every app must exist in both
  accounts; production is all-or-nothing.
- **Resource IDs are account-scoped** — Hyperdrive configs, KV namespaces, R2
  buckets, and TLS certificate UUIDs must be re-created in the production account.
- **Durable Object state does not migrate** between accounts or script names.
- Staging deploys track the `staging` git branch; production tracks `main`.

Local account switching uses a `cfuse` shell function backed by macOS Keychain
(scoped API tokens per account), not `wrangler login`.

---

## 3. Compute — Cloudflare Workers

Eight Workers. All TypeScript on workerd; the three Astro apps use the
`@astrojs/cloudflare` adapter.

| Worker | Role | Public surface | Status |
|---|---|---|---|
| **web** | Customer app: auth, OAuth Connect, dashboard, settings, billing | Full site | Live |
| **server** | Headless backup/restore engine; hosts Durable Objects; enqueues Trigger.dev tasks | `/api/health` + `/api/internal/*` only | Live |
| **admin** | Staff console (Organizations → Spaces tracker) | Staff-gated | Live (dev) |
| **api** | Public REST API **and MCP server** for customers | `api.baseout.com` | Built |
| **support** | Docs/help portal (static assets only, no `main`) | `support.baseout.com` | Live |
| **hooks** | Airtable webhook receiver | Webhook path only | Built |
| **sql** | Direct read-only SQL access (Business+) | `sql.baseout.com` | Scaffold |
| **design** | Fixtures-only design harness, 33 pages | Internal | Live locally (Node adapter — needs adapter swap to deploy) |

**Not Cloudflare-hosted:** `apps/workflows` (Trigger.dev, §7) and `apps/embed`
(Chrome extension + two Airtable extensions, distributed by Chrome Web Store and
Airtable respectively).

### Worker-to-Worker communication

Service bindings, not public HTTP — they bypass the RFC1918/loopback fetch ban and
stay on Cloudflare's internal network:

```
web   ──BACKUP_ENGINE──▶ server
admin ──BACKUP_ENGINE──▶ server
api   ──SERVER────────▶ server
```

`hooks` deliberately has **no** binding to server — the 2026-07-18 pull-based
design means the webhook receiver keeps working during an engine outage.

All internal calls carry an `x-internal-token` header matched against the server's
`INTERNAL_TOKEN`, as defence-in-depth behind the binding's network isolation.

---

## 4. Cloudflare platform primitives

Everything Baseout binds at runtime:

| Primitive | Binding | Used by | Purpose |
|---|---|---|---|
| **Hyperdrive** | `HYPERDRIVE` | web, server, admin, api, hooks, sql | Pooled Postgres access from workerd |
| **Workers KV** | `SESSION` | web, admin | Astro/better-auth session store |
| **R2** | `BACKUPS_R2` | server | Media-library download streaming (read-only by discipline) |
| **Durable Objects** | `CONNECTION_DO`, `SPACE_DO` | server | See §5 |
| **Workers AI** | `AI` | server | Schema description generation |
| **Email Service** | `EMAIL` | web, server | Magic links, join requests, report delivery |
| **Analytics Engine** | `API_USAGE` | api | Per-request usage metering, queried via AE SQL API |
| **Rate Limiting** | `RATE_LIMITER` | api | Per-token limits (shadow mode; enforcement gated by a var) |
| **Images** | `IMAGES` | web, admin | Adapter-injected |
| **Static Assets** | `ASSETS` | web, admin, support, design | Astro client output |
| **Workers VPC + Tunnel** | — | (evaluating) | Private path to Postgres — see §9 |

**Hyperdrive pooling is a shared resource, not per-app.** One config = one origin
pool capped at ~15 connections against a dev cluster with ~19 usable. `web`,
`server`, and `admin` deliberately share the *same* dev config. Creating a second
config per app caused the 2026-07-08 "backups spin forever" incident.

---

## 5. Durable Objects

Two classes, both on `server`, both SQLite-backed (`migrations` tag `v1`).

**`ConnectionDO`** — one instance per Airtable Connection.
Serialises all Airtable API traffic for that connection so the 5 req/s limit is
respected globally rather than per-Worker-isolate. Also holds OAuth token state and
performs lazy on-demand refresh when an access token has expired (self-heal, no
customer reconnect).

**`SpaceDO`** — one instance per Space.
Scheduler and backup controller. Owns the run lock, alarm-based timeout recovery,
and decides when a Space's bases are due for backup. The alarm is the safety net if
a Trigger.dev callback never arrives.

Because each Worker script owns its own DO namespaces, `baseout-server-staging` and
`baseout-server-production` start with **empty** DO state — this is a migration
consideration, not a bug.

---

## 6. Data layer

### Master database — DigitalOcean Managed PostgreSQL

The operational source of truth: Organizations, Spaces, Connections, users,
sessions, subscriptions, backup/restore run rows, entitlements.

| Aspect | Detail |
|---|---|
| Provider | DigitalOcean Managed PostgreSQL |
| Access from Workers | Cloudflare Hyperdrive (never direct — postgres-js over TLS hangs in workerd) |
| Access from Node tooling | Direct `DATABASE_URL` |
| Schema | `baseout` (plus `public`) |
| ORM / migrations | Drizzle ORM; migrations owned by `apps/web` |
| Per-request rule | `createMasterDb()` per request — workerd forbids reusing I/O objects across requests |

### Per-Space databases — Cloudflare D1

Airtable-derived data (schema snapshots, record mirrors) is **not** stored in the
master DB. Each Space gets its own database, provisioned by `server` via the
Cloudflare D1 API (`CLOUDFLARE_D1_API_TOKEN`). BYODB is the alternative for
customers who want to own the store. Isolation enforcement is behind the
`DB_ISOLATION_ENFORCEMENT` flag. Status: **Built**.

### Backup storage destinations

Written by the Trigger.dev runner, never by a Worker:

| Destination | Implementation | Notes |
|---|---|---|
| Cloudflare R2 (managed) | `storage-writers/r2.ts` | Default; S3-API creds live **only** on the Trigger.dev runner |
| Google Drive, Dropbox, Box, OneDrive | one writer each | BYOS via customer OAuth |
| Local filesystem | `local-fs.ts` | Development |

R2 credentials must never appear in any `.dev.vars` — Workers don't reach R2 for
writes.

---

## 7. Background processing — Trigger.dev

Long-running work cannot fit in a Worker's wall-clock budget, so it runs on
Trigger.dev's **Node** runner (v4 SDK, project `proj_lklmptmrmrkeaszrmhcs`).

**Flow:** `server` enqueues via `@trigger.dev/sdk` → Trigger.dev runs the task on
Node → the task POSTs progress and completion back to
`/api/internal/runs/:runId/{progress,complete}`. Transport errors are
fire-and-forget; the run-row state machine plus the `SpaceDO` alarm are the safety
nets.

Nine tasks:

| Task | Purpose |
|---|---|
| `backup-base` | Full per-base backup (tables, schema, attachments) |
| `incremental-backup` | Delta backup driven by webhook cursors |
| `restore-base` | Restore a snapshot back into Airtable |
| `health-score-base` | Schema health scoring (AI-assisted) |
| `relationship-inference` | Infer cross-table relationships |
| `render-report` | Generate and email reports |
| `chat-respond` | AI chat responses (Anthropic) |
| `cleanup-expired-snapshots` | Retention enforcement |
| `delete-run-files` | Storage cleanup |

Environments are Trigger.dev's own (`dev` / `staging` / `prod`), selected with
`--env` at deploy. Env vars are set **per environment** in the Trigger.dev
dashboard — critically, staging's `BACKUP_ENGINE_URL` + `INTERNAL_TOKEN` must point
at the staging engine, or staging tasks would call back into production.

`apps/workflows` is Node-only: it must never import `cloudflare:workers`, and the
Worker bundle imports task references as `import type` so task bodies never leak
into the Worker.

---

## 8. External services

| Service | Used for | Integration |
|---|---|---|
| **Airtable** | The product's reason to exist | OAuth (per-Org), REST API, **MCP client** (automations, interfaces, views), webhooks |
| **Stripe** | Billing | Subscriptions, add-ons, credit packs; money + identity only — entitlements resolve from the DB catalog, never Stripe metadata |
| **Anthropic API** | AI chat, health scoring | `ANTHROPIC_API_KEY` on the Trigger.dev runner |
| **Trigger.dev** | Background execution | §7 |
| **DigitalOcean** | Master Postgres | §6 |
| **Google / Dropbox / Box / Microsoft** | BYOS destinations | OAuth per destination |

**Airtable MCP is consumed two ways, which is easy to confuse:**
- **As a client** — `backup-base` calls Airtable's MCP to capture automations,
  interfaces, and views that the REST API does not expose.
- **As a server** — `apps/api` *hosts* a Baseout MCP server (`src/mcp/`) so
  customers can query their own backed-up data from an AI client.

---

## 9. Network path to the database (in flux)

Two options, and the choice is currently open:

**A. Direct (today).** Hyperdrive → public internet → DigitalOcean, with the DO
cluster's trusted-sources allowlist. Supports `sslmode=verify-full` with a custom
CA certificate uploaded via `wrangler cert upload certificate-authority`.

**B. Workers VPC + Cloudflare Tunnel (evaluating).** Private path, no public DB
exposure. **Blocker found 2026-08-29:** the VPC service exposes
`--cert-verification-mode` but has **no way to supply a custom CA**, so it can only
validate against the public trust store. DigitalOcean's per-project root is
private, so both `verify_full` and `verify_ca` fail; only `disabled` connects —
i.e. encryption without authentication on that hop.

Decision needed. See §12.

---

## 10. Auth, identity, and secrets

| Layer | Mechanism |
|---|---|
| Customer auth | better-auth, **passwordless magic link** + optional TOTP 2FA. No passwords anywhere |
| Staff auth | `users.role = 'super'`; admin reuses web's session via a 60s AES-GCM handoff token |
| Airtable Connect | OAuth 2.0 + PKCE, per-Organization |
| Service-to-service | `INTERNAL_TOKEN` / `BACKUP_ENGINE_INTERNAL_TOKEN` header gate |
| Token storage | AES-256-GCM (`BASEOUT_ENCRYPTION_KEY`) in `*_enc` columns |
| API tokens | Hashed (`api_tokens.token_hash`), never plaintext |

**Three values must be byte-identical across Workers or things break silently:**

1. `BASEOUT_ENCRYPTION_KEY` — web *writes* encrypted tokens, server *reads* them.
   Drift flips Airtable connections to `status='invalid'` and forces customer
   reconnects. This is the single most consequential config value in the system.
2. server's `INTERNAL_TOKEN` = web's + admin's + api's `BACKUP_ENGINE_INTERNAL_TOKEN`
3. `ADMIN_HANDOFF_SECRET` — web mints, admin opens

Secrets are declared per environment via `secrets.required` in `wrangler.jsonc`, so
a missing secret **fails the deploy** rather than producing a broken Worker.
`scripts/check-wrangler-secrets.mjs` enforces that the staging and production lists
stay identical.

---

## 11. Observability and logging

**All Cloudflare-native. There is no third-party APM** — no Sentry, Datadog,
PostHog, or Google Analytics anywhere in the source.

| Signal | Tool | Notes |
|---|---|---|
| Worker logs / traces | Workers Observability | Currently `enabled: false` on web/admin/design — worth revisiting for staging + production |
| Live tail | `wrangler tail` | Ad-hoc debugging |
| API usage metering | Analytics Engine (`API_USAGE` → `baseout_api_requests`) | Queried via the AE SQL API |
| Background job runs | Trigger.dev dashboard | Per-run logs, retries, durations |
| Backup/restore history | `backup_runs` / `restore_runs` tables | The product's own audit trail |
| Auth + billing changes | DB audit tables | Required by the security model |
| Logpush + alerting | **Proposed** | Named as deploy-blocking for `api` and `hooks`; a sustained 503 on hooks must page before Airtable's ~1-day retry exhaustion disables notifications |

**Gap to decide:** observability is disabled in the configs and Logpush isn't set
up, so today there is no alerting path outside the Trigger.dev dashboard and the
product's own run tables.

---

## 12. CI/CD

| What | How |
|---|---|
| Cloudflare Workers | **Workers Builds** — git-connected, per-Worker build + deploy commands. No deploys from developer machines |
| Trigger.dev tasks | **GitHub Actions** (Workers Builds can only run wrangler) |
| Branch model | `main` → dev + production Workers; `staging` → staging Workers |
| Build secrets | `FONTAWESOME_TOKEN`, `NPM_TOKEN` — build-phase only, not runtime |
| Runtime secrets | Pre-set per Worker; `secrets.required` gates the deploy |

---

## 13. Open decisions

These affect the diagram and should be settled first:

1. **Workers VPC vs direct Hyperdrive** (§9) — unresolved TLS verification blocker.
2. **`MASTER_ENCRYPTION_KEY` vs `BASEOUT_ENCRYPTION_KEY`** — `api`/`sql`/`hooks` use
   the first name, `web`/`server` the second. If these are the same key, four apps
   cannot decrypt each other's data.
3. **`SERVICE_HMAC_TO_SERVER` vs `SERVICE_HMAC_TO_BACKUP`** — `sql`'s config comment
   and its `.dev.vars.example` disagree.
4. **Observability enablement** for staging/production, plus a Logpush destination.
5. **One Trigger.dev project across both Cloudflare accounts**, or a separate
   production project to mirror the account isolation.
6. **`apps/design` adapter swap** — Node → Cloudflare, if it should deploy at all.

---

## Known doc drift

[lat.md/tech-stack.md](../lat.md/tech-stack.md) is stale on four points: it says
pnpm 9.12.0 (actually 11.1.1), Trigger.dev v3 (v4), React 18 (React 19), and lists
"email+password" auth (Baseout is passwordless — see the PRD scope lock).
