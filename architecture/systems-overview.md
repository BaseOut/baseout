# Baseout — Systems Overview

**Status:** revised 2026-09-03. Basis for the architecture diagram
([`architecture/diagram/`](diagram/) — interactive ReactFlow view, `arch.baseout.dev`).

**What changed on 2026-09-03:** environment separation now spans three providers,
not just Cloudflare (§2); the master database has no public ingress at all and is
reachable only through a Cloudflare Tunnel (§9, which closes the TLS blocker that
section previously recorded as open); Trigger.dev deploys through Workers Builds
rather than GitHub Actions (§7, §12).

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
| `console.baseout.dev` | web (staging) | Staging customer app |
| `admin|api|support.baseout.dev` | staging peers | One per Worker, mirroring the `.com` map |
| `hooks|sql.baseout.dev/<path>/*` | hooks, sql (staging) | **Path-scoped routes**, not whole-host — deliberately narrows attack surface |
| `arch.baseout.dev` | diagram | Interactive architecture diagram (`architecture/diagram/`) |
| `build-db.baseout.dev` | — (Tunnel) | Access-protected TCP hostname for the master DB — §9. Not a Worker |

**Domain attachment** is owned by wrangler config where possible (`routes` with
`custom_domain: true`), because a config-driven deploy restates it; dashboard-only
attachment drifts. `support` already does this deliberately.

---

## 2. Accounts and environments — separation across three providers

Production is blast-radius isolated at the **account** level in every provider that
holds state, not just Cloudflare. **Dev shares staging's resources; production
shares nothing with anything.**

| Provider | Staging estate (also serves `dev`) | Production estate |
|---|---|---|
| **Cloudflare** | Staging account `33857e35…` — `dev` + `staging` environments of every Worker | Separate account — `production` only |
| **Trigger.dev** | Staging org/project | Separate account |
| **DigitalOcean** | Staging org — master Postgres, tunnel droplet | Separate org — its own cluster + droplet |

The asymmetry is deliberate: dev is a *developer convenience* sharing staging's
database and Hyperdrive pool, so a dev mistake can dirty staging data but can never
touch production. Production has no shared credential, no shared pool, and no
shared network path.

**Three named environments per Worker** — `dev`, `staging`, `production`.

- `name` lives at the top level of `wrangler.jsonc`, so `dev` **derives**
  `baseout-web-dev` from wrangler's env-name suffixing.
- `staging` and `production` **pin the bare name explicitly**
  (`"name": "baseout-web"` inside the env block). Workers Builds forces the script
  onto whichever Worker the build is connected to via `WRANGLER_CI_OVERRIDE_NAME`,
  and the connected Workers are unsuffixed — a derived `-staging` name would be
  silently overridden and deploy somewhere the config does not describe. Because
  production is a *different account*, the two bare names cannot collide.
  `scripts/check-wrangler-secrets.mjs` enforces exactly this asymmetry.

Consequences worth knowing:

- **Service bindings cannot cross accounts.** Every app must exist in both
  accounts; production is all-or-nothing.
- **Resource IDs are account-scoped** — Hyperdrive configs, KV namespaces, R2
  buckets, mTLS CA certificates, and VPC service IDs must be re-created in the
  production account.
- **Durable Object state does not migrate** between accounts or script names.
- **Environments are not a naming convention, they are an account boundary.** A
  staging secret cannot reach production even by mistake, because the API token
  that would write it has no permission in that account.
- Staging deploys track the `staging` git branch; production tracks `main`.

Local account switching uses a `cfuse` shell function backed by macOS Keychain
(scoped API tokens per account), not `wrangler login`. It exports
`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` rather than only setting a
selector, so tools that spawn wrangler as a child process (`pnpm dev`, the
migration runner) inherit the right account.

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
| **diagram** | This document, drawn — interactive ReactFlow view | `arch.baseout.dev` | Built |

`diagram` lives at `architecture/diagram/`, not `apps/`: it ships no product
surface and depends on no `@baseout/*` package. Static assets only, no `main`, no
bindings, no secrets.

**Has a `wrangler.jsonc` but is NOT deployed by wrangler:**

- `apps/workflows` — an **anchor** config (§7). It exists only so a Cloudflare
  Worker record exists for Workers Builds to attach to; the deploy command is
  `trigger.dev deploy`. Deliberately has no envs, no bindings, no vars.
- `apps/design` — a *proposed* config documenting the Node→Cloudflare adapter
  swap it is blocked on.

`scripts/check-wrangler-secrets.mjs` skips both, keyed on whether
`deploy:staging` actually invokes `wrangler deploy`.

**Not Cloudflare-hosted at all:** `apps/embed` (Chrome extension + two Airtable
extensions, distributed by Chrome Web Store and Airtable respectively).

### Worker-to-Worker communication

Service bindings, not public HTTP — they bypass the RFC1918/loopback fetch ban and
stay on Cloudflare's internal network:

```
web   ──SERVER──▶ server
admin ──SERVER──▶ server
api   ──SERVER────────▶ server
```

`hooks` deliberately has **no** binding to server — the 2026-07-18 pull-based
design means the webhook receiver keeps working during an engine outage.

All internal calls carry an `x-internal-token` header matched against the server's
`SERVER_INTERNAL_TOKEN`, as defence-in-depth behind the binding's network isolation.

---

## 4. Cloudflare platform primitives

Everything Baseout binds at runtime:

| Primitive | Binding | Used by | Purpose |
|---|---|---|---|
| **Hyperdrive** | `HYPERDRIVE` | web, server, admin, api, hooks, sql | Pooled Postgres access from workerd |
| **Workers KV** | `SESSION` | web, admin | Astro/better-auth session store |
| **R2** | `BACKUPS_R2` | server | **Report documents — `putDocument` *and* `getDocument`.** Not read-only: `server` writes here. Distinct from the runner's S3-API path for snapshots (§6) — same bucket, unrelated credential models |
| **Durable Objects** | `CONNECTION_DO`, `SPACE_DO` | server | See §5 |
| **Workers AI** | `AI` | server | Schema description generation |
| **Email Service** | `EMAIL` | web, server | Magic links, join requests, report delivery |
| **Analytics Engine** | `API_USAGE` | api | Per-request usage metering, queried via AE SQL API |
| **Rate Limiting** | `RATE_LIMITER` | api | Per-token limits (shadow mode; enforcement gated by a var) |
| **Images** | `IMAGES` | web, admin | Adapter-injected |
| **Static Assets** | `ASSETS` | web, admin, support, design | Astro client output |
| **Workers VPC service** | — | Hyperdrive origin | Private path to Postgres — **Live**, see §9 |
| **Cloudflare Tunnel** | — | VPC service, `cloudflared` CLI | `os-db-tunnel` — the only route to the DB, §9 |
| **Cloudflare Access** | — | Tunnel hostname | Service-token gate on `build-db.baseout.dev`, §9 |

**Hyperdrive pooling is a shared resource, not per-app.** One config = one origin
pool (`origin_connection_limit: 20` on staging) against a cluster with ~19–25
usable. `web`, `server`, and `admin` deliberately share the *same* config —
`bo-db-staging` (`ec6bd358…`) serves both `dev` and `staging`. Creating a second
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

Because each Worker script owns its own DO namespaces, staging's `baseout-server` and
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
| Network exposure | **None.** No public ingress; no trusted-sources allowlist to maintain — see §9 |
| Access from Workers | Hyperdrive → VPC service → Tunnel (never direct — postgres-js over TLS hangs in workerd) |
| Access from Node tooling | `cloudflared access tcp` → loopback port → Tunnel. A bare `DATABASE_URL` to the cluster host resolves to nothing |
| Schema | `baseout` (plus `public`) |
| ORM / migrations | Drizzle ORM; one lineage in **`db/migrations/`** — root `CLAUDE.md` §3.9, not `apps/web` |
| Migration runner | `pnpm db:migrate` (direct) / `pnpm db:migrate:tunnel` (CI) — both wrap `drizzle-kit migrate` in a `pg_advisory_lock` so parallel Workers Builds pipelines serialise |
| Per-request rule | `createMasterDb()` per request — workerd forbids reusing I/O objects across requests |

### Per-Space databases — Cloudflare D1

Airtable-derived data (schema snapshots, record mirrors) is **not** stored in the
master DB. Each Space gets its own database, provisioned by `server` via the
Cloudflare D1 API (`CLOUDFLARE_D1_API_TOKEN`). BYODB is the alternative for
customers who want to own the store. Isolation enforcement is behind the
`DB_ISOLATION_ENFORCEMENT` flag. Status: **Built**.

### Backup storage destinations

Written by the Trigger.dev runner, never by a Worker. `backup_configurations.storage_type`
accepts **eight** values; only five resolve to a real writer.

| `storage_type` | Writer | Credentials | Status |
|---|---|---|---|
| `r2_managed` | `r2.ts` | App-level `R2_*` env on the runner (S3 API) | **Live — the default** |
| `google_drive` | `google-drive.ts` | Per-Space customer OAuth | Live |
| `box` | `box.ts` | Per-Space customer OAuth | Live |
| `dropbox` | `dropbox.ts` | Per-Space customer OAuth | Live |
| `onedrive` | `onedrive.ts` | Per-Space customer OAuth | Live |
| `s3` | — | — | **Accepted, no writer** |
| `frame_io` | — | — | **Accepted, no writer** |
| `byos` | — | — | **Accepted, no writer** |
| `local_fs` | `local-fs.ts` | none | Dev + every fallback |

**The fallback is silent, and deliberately so.** `resolveStorageWriter()` returns
`LocalFsWriter` for an unknown type *or* for a known type with missing/mismatched
creds — the run **succeeds** and writes to local disk rather than failing. That is
good for dev iteration without BYOS provisioning, and it is also how a
misconfigured customer destination can look like a healthy backup that went
nowhere the customer can reach. `s3`, `frame_io`, and `byos` hit this path today.

OAuth tokens for BYOS live in `storage_destinations.oauth_{access,refresh}_token_enc`,
AES-256-GCM, per Space.

**Constraint mismatch worth knowing:** `storage_destinations.type`'s CHECK still
allows only `('local_fs', 'google_drive')`, while the schema comment and the
writer set have moved on to Box/Dropbox/OneDrive. Widen it additively before a
non-Drive destination is persisted.

R2 credentials must never appear in any `.dev.vars` — Workers don't reach R2 for
snapshot writes, so a key there is a false signal that can never fire. Canonical
location + rotation: [shared/internal/r2-setup.md](../shared/internal/r2-setup.md).

---

## 7. Background processing — Trigger.dev

Long-running work cannot fit in a Worker's wall-clock budget, so it runs on
Trigger.dev's **Node** runner (v4 SDK). The project ref is **not hardcoded** —
`trigger.config.ts` reads `TRIGGER_PROJECT_REF` and throws without it, because
staging and production are separate accounts with different refs (§2). Staging's
is `proj_lklmptmrmrkeaszrmhcs`. Locally it comes from `apps/workflows/.dev.vars`
(the `dev` script passes `--env-file`); in CI it is a Workers Builds build
variable, and the deploy scripts pass no `--env-file` because the CLI hard-fails
on a missing path.

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

**Account separation mirrors Cloudflare's (§2):** a staging Trigger.dev account
serving `dev` + `staging`, and a **separate production account**. Within each,
Trigger.dev's own environments (`dev` / `staging` / `prod`) are selected with
`--env` at deploy. Env vars are set **per environment** in the Trigger.dev
dashboard — staging's `SERVER_URL` + `SERVER_INTERNAL_TOKEN` must point at the
staging engine. The account split means a misconfigured staging variable can no
longer reach production at all, which is what the single-project setup risked.

**Deploy: Cloudflare Workers Builds, not GitHub Actions** (changed 2026-09-03).
Build command resolves workspace dependencies then typechecks; deploy command is
`trigger.dev deploy --env {staging,prod}`. Build variables: `TRIGGER_ACCESS_TOKEN`
(secret), `PNPM_VERSION=11.1.1`, `NODE_VERSION=22.23.2`.

**The anchor Worker is not a runtime.** Workers Builds attaches per *Cloudflare
Worker*, and `apps/workflows` is not one — so its `wrangler.jsonc` +
`ci/worker-stub.ts` exist only to create a `baseout-workflows` Worker record for
the build trigger to hang off. It is deployed by hand once per account and stays a
404 stub forever; CI never runs wrangler there. Never give it a binding, a var, or
a route, and never move task code into it. Details: `apps/workflows/README.md` and
`shared/internal/cloudflare-env-separation.md` §8.

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

## 9. Network path to the database — RESOLVED (2026-09-03)

**Decision: Cloudflare Tunnel via a DigitalOcean droplet. The database has no
public ingress.** This supersedes both options previously recorded here, and the
TLS blocker that kept the choice open is solved — DigitalOcean's private project
root is uploaded as a Cloudflare **mTLS CA certificate** and referenced by the
Hyperdrive origin, so the hop runs at `sslmode: verify-full` rather than the
`disabled` that the VPC service alone was limited to.

```
Workers ──▶ Hyperdrive (bo-db-staging)
                 │  origin has NO host/port — only service_id
                 ▼
         Workers VPC service  01a04fc4…
                 │  mTLS: CA openside-db-ca, sslmode verify-full
                 ▼
         Cloudflare Tunnel  os-db-tunnel  (healthy, 4 edge connections)
                 │
                 ▼
         cloudflared  on a DigitalOcean droplet
                 │  private VPC address only
                 ▼
         DigitalOcean Managed PostgreSQL
```

Why this is stronger than an allowlist:

- **The droplet's firewall has zero inbound rules.** `cloudflared` dials *out* to
  Cloudflare's edge and the tunnel rides those outbound connections, so there is no
  listening port to scan, no IP range to allowlist, and nothing to update when
  Cloudflare's egress addresses change.
- **The droplet sits behind the DigitalOcean VPC**, reaching Postgres on a private
  address. The cluster itself is not addressable from the internet.
- **The tunnel is the single door**, so both consumers use it and there is one place
  to revoke: Workers arrive via the VPC service; humans and CI arrive via
  `cloudflared access tcp` against `build-db.baseout.dev`, gated by **Cloudflare
  Access service tokens** (`CF_CLIENT_ID` / `CF_CLIENT_SECRET`).

**Operational consequences:**

- The tunnel and its droplet are a **hard dependency of every deploy**, because
  `pnpm db:migrate:tunnel` runs inside `apps/web`'s build command. If the droplet
  is down, web does not deploy — which is the intended failure direction (never
  deploy schema-coupled code against an unmigrated database), but it does mean the
  droplet needs the same uptime attention as a Worker.
- `cloudflared` is fetched by the `cloudflared` npm package's postinstall, which
  pnpm only runs for packages listed under `allowBuilds` in `pnpm-workspace.yaml`.
- The 4 edge connections are `cloudflared`'s own HA fan-out, not a capacity knob.
- **Production needs all of it re-created**: its own droplet, tunnel, Access
  service token, VPC service, mTLS CA upload, and Hyperdrive config, in the
  production account and DigitalOcean org.

---

## 10. Authentication — five mechanisms, one per caller class

Baseout has **five distinct authentication paths**, and they share almost nothing.
Which one applies is decided by *who is calling*, not by which route is hit.

| Caller | Worker | Mechanism | Credential lives in |
|---|---|---|---|
| Human customer | web | better-auth session (magic link) | `sessions` table + `SESSION` KV |
| Staff | admin | web's session, re-verified + `role='super'` | `baseout_admin_session` cookie |
| Machine / AI client | api | `Bearer bo_live_…` API token | `api_tokens.token_hash` |
| Sibling Worker | server | `x-internal-token` header | `SERVER_INTERNAL_TOKEN` secret |
| Airtable | hooks | `X-Airtable-Content-MAC` signature | `mac_secret_base64_enc` |

### 10.1 Customer auth — better-auth, passwordless

**No passwords exist anywhere in the system.** There is no password column, no
hashing, no reset flow; a requirement implying passwords is a scope conflict
(PRD scope lock).

- **Magic link** is the primary factor. Links expire in **60 seconds**.
- **Optional TOTP 2FA**, with backup codes. TOTP secrets are encrypted at rest by
  a transparent adapter wrapper (`two-factor/encryption.ts`) — the same wrapper
  pattern §10.6 uses for env scoping.
- **Airtable SSO** ("Continue with Airtable") via better-auth `genericOAuth` — a
  **separate, minimal-scope OAuth app**, not the Connect integration. Registration
  is still pending, and while both client vars are blank the button stays hidden
  with zero behaviour change.
- Sessions last **30 days** with a cookie cache in front of the DB lookup.

**Users are per-environment.** `users` is unique on `(email, runtime_env)`, so the
same address is a *separate row* per environment. `auth-env-scope.ts` wraps the
adapter and appends `runtimeEnv = <worker env>` to every **email-addressed** user
query; id-addressed lookups (session → user) pass through untouched, since ids are
globally unique. An unknown worker env scopes to a match-nothing sentinel — fail
closed. This is why login gating needs no explicit refusal gate: request a link on
dev and you either get *your* dev user or a fresh one.

### 10.2 Staff auth — admin has no login of its own

Admin runs **no better-auth instance** and never issues or mutates a session. It
only *reads*:

1. Locally, `baseout.local` cookies are shared, so admin reads
   `better-auth.session_token`, looks it up in the `sessions` table, and requires
   `users.role === 'super'`.
2. Deployed, web's cookie can never reach admin (host-only, and `workers.dev` is
   on the Public Suffix List). So sign-in rides a **60-second AES-GCM handoff
   token**: web's `/api/admin/handoff` mints it (gated on `role='super'`), admin's
   `/auth/handoff` opens it and sets its own `baseout_admin_session` cookie.

Staff role is `users.role` with values `customer | super` — **not** a
`user_role = 'admin'` column, which does not exist. Google Workspace SSO is
deferred to the `admin` umbrella change.

### 10.3 Programmatic auth — API tokens and MCP

`api` serves both the REST API and the **Baseout MCP server**, and *both use the
same bearer path* — the MCP dispatcher takes the same `TokenGrant`, so a token's
scopes constrain its MCP tools identically.

- Format `bo_live_<base64url entropy>`; `parseBearerToken` rejects anything
  without that prefix before a DB round-trip happens.
- **Stored as SHA-256 hex, never plaintext** (`api_tokens.token_hash`). A display
  prefix is kept for the UI; the secret itself is unrecoverable after issue.
- **Ten scopes**, and write scopes do **not** imply their read scope — tokens
  compose scopes explicitly (`documents:read` + `documents:write` are separate).
- Tokens are **org-owned** and optionally Space-scoped.
- **Tenant-safe by design:** an org/Space mismatch returns **404, never 403**, so
  the existence of another tenant's ids is never confirmed. A missing *scope*
  returns 403 — the distinction is deliberate.
- Usability is re-checked per request (`is_active`, `expires_at`), with a
  write-behind `last_used_at`.
- Every request passes the `RATE_LIMITER` binding (per-token, currently shadow
  mode) and meters into Analytics Engine via `API_USAGE`.

### 10.4 Service-to-service — the internal gate

Worker-to-Worker calls ride **service bindings**, so they never touch the public
internet. On top of that network isolation, `server` gates every
`/api/internal/*` request on an `x-internal-token` header compared against
`SERVER_INTERNAL_TOKEN` **in constant time**. Defence in depth: the binding is the
network control, the token is the authorization.

`web`, `admin`, and `api` each hold that value as
`SERVER_INTERNAL_TOKEN`. `/api/health` is the only ungated public route.

### 10.5 Inbound webhooks — Airtable signs, hooks verifies

`hooks` verifies the `X-Airtable-Content-MAC` signature against the
per-Connection `mac_secret_base64_enc` (decrypted with `BASEOUT_ENCRYPTION_KEY`).
`hooks` deliberately holds **no service binding to server**, so the receiver keeps
verifying and dirty-marking through an engine outage.

### 10.6 Encryption at rest, and the three values that must match

| What | Mechanism |
|---|---|
| Airtable Connect | OAuth 2.0 + PKCE, per-Organization |
| Token storage | AES-256-GCM (`BASEOUT_ENCRYPTION_KEY`) in `*_enc` columns |
| API tokens | Hashed (`api_tokens.token_hash`), never plaintext |

**Three values must be byte-identical across Workers or things break silently:**

1. `BASEOUT_ENCRYPTION_KEY` — web *writes* encrypted tokens, server *reads* them.
   Drift flips Airtable connections to `status='invalid'` and forces customer
   reconnects. This is the single most consequential config value in the system.
2. server's `SERVER_INTERNAL_TOKEN` = web's + admin's + api's `SERVER_INTERNAL_TOKEN`
3. `ADMIN_HANDOFF_SECRET` — web mints, admin opens

Secrets are declared per environment via `secrets.required` in `wrangler.jsonc`, so
a missing secret **fails the deploy** rather than producing a broken Worker.
`scripts/check-wrangler-secrets.mjs` enforces that the staging and production lists
stay identical, with one allowlisted exception: `web`'s `E2E_TEST_TOKEN` is
staging-only, because it gates the Playwright bypass at `/api/internal/test/*` and
that surface must never exist in production.

### 10.7 `sql` declares auth secrets it does not yet use

`apps/sql`'s source is a **single `index.ts` with no authentication code at all**
— no bearer parse, no HMAC verify, no internal-token gate. It is a scaffold whose
route (`sql.baseout.dev/v1/*`) is path-scoped precisely to limit what an
unfinished Worker exposes. It now requires only `BASEOUT_ENCRYPTION_KEY`.

Direct SQL is Business+ and **read-only by default** (PRD §10 / Features §14.2);
write access is an explicit opt-in. Neither is enforced by code yet, so the app
stays undeployed.

**HMAC service tokens (resolved 2026-09-04).** `SERVICE_HMAC_TO_BACKUP` /
`SERVICE_HMAC_TO_SERVER` were the same intended secret under two spellings. It is
now one name — **`SERVICE_HMAC_TO_SERVER`**, after the destination, matching the
`SERVER` binding standardization — and it is **out of `secrets.required` in both
`api` and `sql`**. Nothing signs or verifies with it: it appeared in no source
file, only in config, `.dev.vars.example`, and these docs. A deploy gate on a
value no code reads only fails builds and dilutes what the gate means.

It stays documented as reserved in both `.dev.vars.example` files. HMAC signing
with replay protection is the planned successor to the bearer
`SERVER_INTERNAL_TOKEN` (`apps/server/docs/.../2026-05-05-server-phase-1-roadmap.md`
§6); re-add the secret **on both sides in the same change** that lands the signing
and verifying code, or a producer signs with a key no consumer checks.

---

## 11. Observability and logging

**All Cloudflare-native. There is no third-party APM** — no Sentry, Datadog,
PostHog, or Google Analytics anywhere in the source.

| Signal | Tool | Notes |
|---|---|---|
| Worker logs / traces | Workers Observability | **Full on `env.staging` AND `env.production` for all 8 Workers** (2026-09-04): `enabled`, logs *and* traces, `persist: true`, `invocation_logs: true`, `head_sampling_rate: 1` — nothing sampled away. `observability` is inheritable, so these blocks override the top level; that override is what stops web/admin's top-level `enabled: false` from leaving **production** silent. `dev` still inherits it and stays quiet. `head_sampling_rate` is the cost lever — dial production down if ingest volume becomes a bill, staging stays at 1. Fields validated against wrangler 4.124's `config-schema.json` (`additionalProperties: false`); `redact_query_string` is **not** valid and was removed |
| Live tail | `wrangler tail` | Ad-hoc debugging |
| API usage metering | Analytics Engine (`API_USAGE` → `baseout_api_requests`) | Queried via the AE SQL API |
| Background job runs | Trigger.dev dashboard | Per-run logs, retries, durations |
| Backup/restore history | `backup_runs` / `restore_runs` tables | The product's own audit trail |
| Auth + billing changes | DB audit tables | Required by the security model |
| Logpush + alerting | **Proposed** | Named as deploy-blocking for `api` and `hooks`; a sustained 503 on hooks must page before Airtable's ~1-day retry exhaustion disables notifications |

**Gap to decide:** staging now emits full logs and traces to the Cloudflare
observability platform, queryable in the dashboard — but **Logpush is still not set
up**, so there is no *alerting* path, only a place to look after the fact. That
matters most for `hooks`: a sustained 503 must page before Airtable's ~1-day retry
window exhausts and notifications are disabled.

---

## 12. CI/CD

| What | How |
|---|---|
| Cloudflare Workers | **Workers Builds** — git-connected, per-Worker build + deploy commands. No deploys from developer machines |
| Trigger.dev tasks | **Workers Builds** too (changed 2026-09-03) — via the `baseout-workflows` anchor Worker; deploy command is `trigger.dev deploy`, not wrangler. GitHub Actions no longer deploys anything |
| Database migrations | Chained into **web's build command**: `pnpm db:migrate:tunnel && <astro build>`. A failed migration fails the build, so the app most coupled to the schema cannot deploy ahead of it |
| Branch model | `main` → dev + production; `staging` → staging |
| Build secrets | `TRIGGER_ACCESS_TOKEN` (workflows); `DB_TUNNEL_HOSTNAME`, `CF_CLIENT_ID`, `CF_CLIENT_SECRET`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (web, for the migration tunnel) |
| Version pins | `PNPM_VERSION=11.1.1`, `NODE_VERSION=22.23.2` — the build image ships pnpm 10 and ignores `packageManager`, while `pnpm-workspace.yaml` uses pnpm-11-only keys |
| Runtime secrets | Pre-set per Worker; `secrets.required` gates the deploy |
| Workspace deps | Each app's `build:<env>` runs `build:deps` first — `@baseout/shared` and `@baseout/embed-protocol` resolve to gitignored `dist/`, so CI must build them or resolution fails |

**Watch paths matter.** Web's build must watch `db/migrations/**`, `db/**`, and
`pnpm-lock.yaml`, or a migration-only push applies nothing and deploys nothing —
silently.

---

## 13. Open decisions

### Closed since 2026-08-29

| Was | Outcome |
|---|---|
| Workers VPC vs direct Hyperdrive | **Tunnel via DO droplet**, `verify-full` through an uploaded mTLS CA — §9 |
| `MASTER_ENCRYPTION_KEY` vs `BASEOUT_ENCRYPTION_KEY` | Renamed to **`BASEOUT_ENCRYPTION_KEY`** everywhere in runtime config. They were provably the same key (hooks decrypts what server encrypts). Stale mentions survive in 10 docs/openspec files only |
| One Trigger.dev project, or one per account | **Separate accounts**, mirroring Cloudflare — §7 |
| `SERVICE_HMAC_TO_BACKUP` vs `SERVICE_HMAC_TO_SERVER` | One name, **`SERVICE_HMAC_TO_SERVER`**, and **out of `secrets.required`** — no code signs or verifies with it. Reserved in `.dev.vars.example` — §10.7 |

### Still open

1. **Logpush destination + alerting.** Staging now captures full logs and traces
   (§11), but capture is not alerting — there is still no path that pages anyone.
   Named as deploy-blocking for `api` and `hooks`.
2. **`apps/design` adapter swap** — Node → Cloudflare, if it should deploy at all.
   Its `new.wrangler.jsonc` is a placeholder that documents the blocker.
3. **Tunnel droplet uptime.** It is now a deploy dependency (§9) with no monitoring
   and no second instance. A single droplet reboot blocks every web deploy.
4. **Customer app subdomain.** `console.baseout.com` collides with the codebase's
   own use of "console" for the *staff* tool (76 references). Evaluated 2026-09-03;
   `app.baseout.com` recommended, not yet decided.

---

## Known doc drift

[lat.md/tech-stack.md](../lat.md/tech-stack.md) is stale on four points: it says
pnpm 9.12.0 (actually 11.1.1), Trigger.dev v3 (v4), React 18 (React 19), and lists
"email+password" auth (Baseout is passwordless — see the PRD scope lock).
