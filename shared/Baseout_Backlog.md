# Baseout Backlog

> **Status:** draft — review + iterate here, upload to GitHub later via `gh` (see Appendix B).
> **Sources of truth:** [Baseout_PRD.md](Baseout_PRD.md) · [Baseout_Features.md](Baseout_Features.md) · [Baseout_Implementation_Plan.md](Baseout_Implementation_Plan.md)

This backlog decomposes the Baseout V1 build into 7 phase-aligned Epics and ~104 child task issues, plus a set of V2 placeholders. Each child is written to be executed by a human **or** an AI coding agent with no prior project context: spec links, acceptance criteria, dependency graph, and security/testing gates are all inline.

## Legend & Conventions

- **Title format:** `[P<phase><stream>.<n>] <Short imperative>` (e.g. `[P1A.1] Integrate better-auth`). IDs match the [Implementation Plan](Baseout_Implementation_Plan.md) exactly.
- **Epic titles:** `Epic <N> — Phase <X>: <Name> [MVP|V1|Continuing]`.
- **Spec section citations:** `PRD §X`, `Features §Y`, `Plan §Z`. Do not restate spec content inline — link it.
- **Canonical terms (Features §1):** Organization · Space · Platform · Connection · Base · Table · Field · Record · Attachment · Automation · Interface · View · Schema · Backup Run · Backup Snapshot · Static Backup · Dynamic Backup · Storage Destination · Database Tier · BYOS · BYODB · Instant Backup · Capability · Changelog · Insight · Alert · Health Score · Restore · Overage · D1 · Shared PostgreSQL · Dedicated PostgreSQL · R2.  
  **Forbidden synonyms:** ❌ workspace (for Space) · ❌ tenant · ❌ account (except "account owner") · ❌ project (as product term) · ❌ login provider.
- **Symbols:** `✅` passing acceptance · `⚠️` spec conflict / open decision · `🔒` security review required.

## Milestones

| Milestone | Phases | What ships |
|---|---|---|
| **MVP** (Epics 1–3) | P0 → P2 | Core loop end-to-end: sign up → connect Airtable → configure a Space → run + monitor a backup → restore. Trial-capped (PRD §8). |
| **V1** (Epics 4–7) | P3 → P6 | Monetizable public launch: schema/health, Dynamic Backup, Stripe billing, On2Air migration, Pro+ capabilities, super-admin app, observability, hardening. |
| **Continuing** | V2+ | PRD §Appendix B deferred: MCP/RAG, Governance, Multi-Platform Spaces, third-party connectors, schema write-back, CLI. Placeholders only. |

## Default Gates (apply to every child issue)

All issues inherit these requirements unless explicitly waived:

- **Security (CLAUDE.md §2, PRD §20):** no hardcoded secrets · AES-256-GCM for OAuth/API tokens at rest · parameterized queries via Drizzle only · server-side input validation · CSRF on mutating forms · principle of least privilege on scopes.
- **Testing (PRD §14):** red-green-refactor · Vitest for unit + integration · real local Postgres + Miniflare D1 in integration tests · external APIs mocked at HTTP boundary with `msw` · coverage targets: engines 80%, API 75%, UI 60%.
- **Definition of Done (PRD §22):** tests green in CI · security review points signed off · PR description covers scope, tests, and risks · canonical terms used throughout · no `any` types · no TODOs.

---

## Epic 1 — Phase 0: Foundation [MVP]

**Milestone:** MVP · **Primary repos:** all five · **Plan ref:** Phase 0.

**Goal:** repo structure, CI/CD, environments, shared tooling, and master database schema all in place before any feature work begins.

**Entry criteria:** project greenlit. **Exit criteria:** all 5 repos initialized · CI/CD functional · master DB schema migrated · all services configurable per environment.

**Parallelization:** every P0.x can run in parallel — no intra-phase dependencies. This epic is the **hard blocker** for everything else.

### Child issues
- [ ] [P0.1] Create the 5 repos with standard structure — `infra` · ci-cd · blocks: all
- [ ] [P0.2] GitHub Actions CI pipeline — `infra` · ci-cd · blocks: all merges
- [ ] [P0.3] Docker Compose for local dev (PostgreSQL + services) — `baseout-backup-engine` `baseout-web` · ci-cd
- [ ] [P0.4] Cloudflare Pages projects for `baseout-web` + `baseout-admin` — `infra` · ci-cd
- [ ] [P0.5] Cloudflare Workers projects for `baseout-backup-engine` + `baseout-background-services` — `infra` · ci-cd
- [ ] [P0.6] Staging Cloudflare account + namespaces — `infra` · ci-cd
- [ ] [P0.7] Define and migrate master DB schema — `baseout-web` · ci-cd · blocks: P1A.*, P1B.*, P4A.*
- [ ] [P0.8] Cloudflare Secrets per environment — `infra` · 🔒 security · blocks: any feature needing a secret
- [ ] [P0.9] Scaffold `baseout-ui` package — `baseout-ui` · ux · blocks: all UI work
- [x] [P0.10] Verify `mail.baseout.com` in Cloudflare Email Service — `infra` · blocks: P1A.*, P2D.1 (DONE)
- [ ] [P0.11] Stripe account + products + webhook endpoint — `infra` · billing · blocks: P1A.3, P4A.*

---

### [P0.1] Create the 5 repos with standard structure

**Repo:** `infra` (meta) · **Milestone:** MVP · **Phase:** 0 · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `parallel-ok`

#### Context
Per Plan §Repo Map, the product spans five repos: `baseout-ui`, `baseout-web`, `baseout-backup-engine`, `baseout-background-services`, `baseout-admin`. Every other issue in the backlog cites one of them — they must exist first.

#### Spec References
- Plan §Repository Map (table of 5 repos)
- PRD §4 (tech stack: Astro, Cloudflare Workers + Pages, Durable Objects)

#### Dependencies
- **Blocked by:** none
- **Blocks:** every other issue

#### Acceptance Criteria
- [ ] All 5 GitHub repos created under the org
- [ ] Each repo has `README.md`, `.gitignore`, `LICENSE`, `.editorconfig`
- [ ] Each repo has Vitest config + a passing placeholder test
- [ ] `baseout-web` + `baseout-backup-engine` have Drizzle config and `drizzle.config.ts`
- [ ] `baseout-web` has `msw` installed with a handler scaffold
- [ ] Branch protection on `main` (require PR, require CI green) in all 5 repos

#### Testing
- Placeholder Vitest test in each repo; CI (P0.2) must pass on the scaffold.

---

### [P0.2] GitHub Actions CI pipeline

**Repo:** all (per-repo workflows) · **Milestone:** MVP · **Phase:** 0 · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `parallel-ok`

#### Context
Every PR must run unit + integration tests and block merge on failure. Integration tests need Postgres (Docker) and Miniflare D1 (PRD §14.2).

#### Spec References
- PRD §14 (testing strategy, coverage targets)
- Plan §Phase 0 item P0.2

#### Dependencies
- **Blocked by:** P0.1
- **Blocks:** all merges

#### Acceptance Criteria
- [ ] `.github/workflows/ci.yml` in each repo runs `vitest run` on push + PR
- [ ] Postgres 16 service container in CI for `baseout-web` + `baseout-backup-engine`
- [ ] Miniflare D1 set up for Worker repos
- [ ] CI fails on coverage below per-repo target (PRD §14.4)
- [ ] CI fails on `any` types introduced (tsc strict)
- [ ] Branch protection: `CI` check is required on `main`

#### Testing
- A deliberate failing test on a feature branch confirms merge is blocked.

---

### [P0.3] Docker Compose for local dev

**Repo:** `baseout-web` + `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 0 · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `parallel-ok`

#### Context
Integration tests hit a real Postgres per PRD §14 (no DB mocks). Contributors and CI both use the same Compose file.

#### Spec References
- PRD §14.2 (integration tests against real PG)

#### Dependencies
- **Blocked by:** P0.1
- **Blocks:** P0.7, all integration tests

#### Acceptance Criteria
- [ ] `docker-compose.yml` with Postgres 16 service
- [ ] `npm run db:up` / `db:down` scripts
- [ ] Seed script (`scripts/seed.ts`) inserts a minimal fixture Organization + User
- [ ] README documents the local dev loop

#### Testing
- `npm run test:integration` passes against the Compose-provisioned DB.

---

### [P0.4] Cloudflare Pages projects

**Repo:** `infra` (configuration) → `baseout-web`, `baseout-admin` · **Milestone:** MVP · **Phase:** 0 · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `parallel-ok`

#### Context
Astro apps deploy to Cloudflare Pages per PRD §4. Need production + staging on separate accounts (P0.6).

#### Spec References
- PRD §4 (infra: Cloudflare Pages)
- Plan §Phase 0 item P0.4

#### Dependencies
- **Blocked by:** P0.1, P0.6
- **Blocks:** any deploy

#### Acceptance Criteria
- [ ] Pages project for `baseout-web` (prod + staging)
- [ ] Pages project for `baseout-admin` (prod + staging)
- [ ] Branch → environment mapping: `main` → prod, `staging` → staging
- [ ] Preview deployments enabled on PR branches
- [ ] Custom domains wired (`app.baseout.com`, `admin.baseout.com`, staging equivalents)

#### Testing
- A PR produces a working preview URL.

---

### [P0.5] Cloudflare Workers projects

**Repo:** `infra` → `baseout-backup-engine`, `baseout-background-services` · **Milestone:** MVP · **Phase:** 0 · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `parallel-ok`

#### Context
Backup engine uses Durable Objects per PRD §4; background services are separate Workers. Each needs `wrangler.toml` with prod + staging environments.

#### Spec References
- PRD §4 (Durable Objects, Workers)
- Plan §Phase 0 item P0.5

#### Dependencies
- **Blocked by:** P0.1, P0.6
- **Blocks:** P1B.*, P2C.*

#### Acceptance Criteria
- [ ] `wrangler.toml` in each repo with `[env.staging]` and `[env.production]`
- [ ] D1, R2, KV bindings declared (IDs from P0.6)
- [ ] Durable Object class scaffolded for backup-engine Space controller
- [ ] `wrangler deploy --env staging` succeeds on a placeholder handler

#### Testing
- `wrangler dev` runs locally; staging deploy responds on a health endpoint.

---

### [P0.6] Staging Cloudflare account + namespaces

**Repo:** `infra` · **Milestone:** MVP · **Phase:** 0 · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `parallel-ok`, `🔒 security:new-secret`

#### Context
Staging must be isolated from production at the Cloudflare account boundary — separate API keys, D1, R2, KV. Prevents staging runs from ever touching prod data.

#### Spec References
- PRD §20 (separation of environments)
- Plan §Phase 0 item P0.6

#### Dependencies
- **Blocked by:** none
- **Blocks:** P0.4, P0.5

#### Acceptance Criteria
- [ ] Separate Cloudflare account created for staging
- [ ] D1 staging database + R2 bucket + KV namespace provisioned
- [ ] API tokens scoped to staging-only resources
- [ ] Prod account: same for prod
- [ ] Account IDs + binding IDs documented in a private ops doc

#### Security 🔒
- No cross-account token; prod tokens never used in staging workflows.

#### Testing
- Deploy to staging; verify staging D1 is unreachable from prod credentials.

---

### [P0.7] Define and migrate master DB schema

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 0 · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `🔒 security:new-sql-surface`

#### Context
The master Postgres DB holds Organizations, Users, Spaces, Connections, Backup Runs, Subscriptions, API Tokens, Notification Log (PRD §21.3). Everything downstream depends on this schema.

#### Spec References
- PRD §21.3 (complete master DB table list + column specs)
- PRD §20.2 (encrypted token columns)
- Features §1 (canonical entity names)

#### Canonical Terms
Organization, User, Space, Connection, Backup Run, Subscription, Space Type.

#### Dependencies
- **Blocked by:** P0.1, P0.3
- **Blocks:** P1A.*, P1B.*, P2C.*, P4A.*

#### Acceptance Criteria
- [ ] Drizzle schema file per entity in `src/db/schema/`
- [ ] All tables from PRD §21.3 present: `organizations`, `users`, `spaces`, `connections`, `backup_runs`, `subscriptions`, `api_tokens`, `notification_log`
- [ ] Naming per PRD §21.2: plural table / snake_case column / UUID `id` / `created_at` + `modified_at` / `is_` `has_` booleans
- [ ] Token columns named `*_enc` (e.g. `access_token_enc`, `refresh_token_enc`)
- [ ] Foreign keys enforced; cascade rules documented
- [ ] Initial migration generated with `drizzle-kit` and checked in
- [ ] Migration runs cleanly against a fresh Compose Postgres

#### Security 🔒
- `access_token_enc` / `refresh_token_enc` / `api_tokens.token_hash` — no plaintext columns.
- No connection string in code; loaded from Cloudflare Secret (P0.8).

#### Testing
- Integration test: `drizzle-kit push` → insert fixture Org + User + Space → select roundtrips.

---

### [P0.8] Cloudflare Secrets per environment

**Repo:** `infra` → all Worker / Pages projects · **Milestone:** MVP · **Phase:** 0 · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `🔒 security:new-secret`

#### Context
All runtime secrets live in Cloudflare Secrets per PRD §20 — never in repo, never in env files committed to git. This issue bootstraps the full set.

#### Spec References
- PRD §20 (secrets management)
- PRD §20.2 (AES-256-GCM master key)

#### Dependencies
- **Blocked by:** P0.6
- **Blocks:** anything that needs a secret

#### Acceptance Criteria
- [ ] Secrets set in **both** staging and prod Cloudflare environments:
  - `DATABASE_URL` (master Postgres)
  - `MASTER_ENCRYPTION_KEY` (AES-256-GCM, 32 bytes, base64)
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - `AIRTABLE_OAUTH_CLIENT_ID`, `AIRTABLE_OAUTH_CLIENT_SECRET`
  - `BETTER_AUTH_SECRET`
  - Storage OAuth clients (one pair per destination in scope)
- [ ] Rotation runbook documented (who rotates, frequency, blast radius)
- [ ] `.env.example` lists every required var — never `.env` with real values

#### Security 🔒
- Keys generated with `crypto.randomBytes`, never typed by hand.
- Audit log: record who sets/rotates each secret.

#### Testing
- Secret is readable in Worker via `env.MASTER_ENCRYPTION_KEY`; undefined locally without `.dev.vars`.

---

### [P0.9] Scaffold `baseout-ui` package

**Repo:** `baseout-ui` · **Milestone:** MVP · **Phase:** 0 · **Capability:** ux
**Labels:** `phase:0`, `milestone:mvp`, `capability:ux`, `parallel-ok`

#### Context
Shared Astro + Tailwind + DaisyUI component library consumed by `baseout-web` and `baseout-admin`. Per CLAUDE.md UI standards, theme priority is `@opensided/theme` → `daisyUI` → custom CSS.

#### Spec References
- CLAUDE.md §UI/UX (theme stack, mobile-first, a11y)
- PRD §6 (UX direction)

#### Dependencies
- **Blocked by:** P0.1
- **Blocks:** all UI work

#### Acceptance Criteria
- [ ] Package published to internal registry (or consumable via workspace)
- [ ] Components: `Button`, `Input`, `Modal`, `Table`, `Layout`, `Toast`
- [ ] Theme tokens imported from `@opensided/theme`
- [ ] Storybook or equivalent preview harness
- [ ] Components exported with TypeScript prop types (no `any`)
- [ ] Mobile-first CSS verified at <375px breakpoint
- [ ] A11y: 44×44px touch targets, semantic HTML, ARIA where needed

#### Testing
- Vitest + `@testing-library/dom` render tests for each component.

---

### [P0.10] Verify `mail.baseout.com` in Cloudflare Email Service ✅ DONE

**Repo:** `infra` · **Milestone:** MVP · **Phase:** 0 · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `parallel-ok`

#### Context
Transactional email (magic link, audit reports, alerts) sends from `mail.baseout.com` via the Cloudflare Email Service `EMAIL` Workers binding. Required before P1A.* can send login links. Marketing is deferred (V2 / TBD).

#### Spec References
- PRD §19 (email templates)

#### Dependencies
- **Blocked by:** none
- **Blocks:** P1A.2, P2D.1

#### Acceptance Criteria
- [x] `mail.baseout.com` verified in the Cloudflare Email Service dashboard
- [x] DKIM, SPF, DMARC records deployed
- [x] `send_email` binding declared in `wrangler.jsonc` (binding name: `EMAIL`)
- [ ] Account confirmed on Workers Paid plan (Cloudflare Email Service is beta + Paid-only for outbound)
- [ ] Test email delivered from staging successfully

#### Testing
- Send from staging to a dev inbox; inspect headers for DKIM pass.

---

### [P0.11] Stripe account + products + webhook endpoint

**Repo:** `infra` → Stripe dashboard + `baseout-web` webhook stub · **Milestone:** MVP · **Phase:** 0 · **Capability:** billing
**Labels:** `phase:0`, `milestone:mvp`, `capability:billing`, `🔒 security:new-secret`

#### Context
Per Features §5.5, each tier is a Stripe Product with `platform` + `tier` metadata. Capability resolution reads metadata — never product name strings. V1 scope is Airtable only, so 6 products + their monthly/annual prices are created up front.

#### Spec References
- Features §5.5 (Stripe architecture)
- PRD §8 (tier + pricing)
- PRD §8.6 (product naming convention)

#### Dependencies
- **Blocked by:** P0.8
- **Blocks:** P1A.3, P4A.*

#### Acceptance Criteria
- [ ] 6 Stripe Products created: `Baseout — Airtable — {Starter|Launch|Growth|Pro|Business|Enterprise}`
- [ ] Each Product has metadata `platform: "airtable"` and `tier: "<name>"`
- [ ] Each Product has Monthly + Annual Prices; each Price has `billing_period` metadata
- [ ] Webhook endpoint registered: `/api/stripe/webhook` (stub route for now)
- [ ] `STRIPE_WEBHOOK_SECRET` stored in Cloudflare Secrets
- [ ] Test mode seeded; live mode documented but not wired

#### Security 🔒
- Webhook signature verified on every event; unsigned events rejected.

#### Testing
- `stripe trigger customer.subscription.created` hits staging webhook and returns 200.

---

## Epic 2 — Phase 1: Core Auth + Backup Engine [MVP]

**Milestone:** MVP · **Primary repos:** `baseout-web`, `baseout-backup-engine` · **Plan ref:** Phase 1.

**Goal:** a user signs up, connects Airtable, configures a Space, runs a trial-capped backup, and sees it complete. This is the MVP slice — everything else layers on top.

**Entry criteria:** Phase 0 complete. **Exit criteria:** onboarding → first backup working end-to-end; trial caps enforced (1,000 records / 5 tables / 100 attachments); connection locks prevent concurrent backup collisions.

**Parallelization:**
- **1A (Auth)** and **1B (Engine)** proceed fully in parallel.
- **1C (Onboarding wizard)** depends on both 1A and 1B.
- **1D (Storage destinations)** is part of 1B; individual connectors parallelizable.

### Child issues (1A — Authentication)
- [ ] [P1A.1] Integrate better-auth — `baseout-web` · auth · 🔒
- [ ] [P1A.2] Magic-link sign-up + sign-in flow — `baseout-web` · auth
- [ ] [P1A.3] Create Organization + user + $0 Stripe sub on sign-up — `baseout-web` · billing · 🔒
- [ ] [P1A.4] Session management + route protection — `baseout-web` · auth · 🔒
- [ ] [P1A.5] Pre-registration schema viz session — `baseout-web` · auth
- [ ] [P1A.6] Trial state management + cap enforcement — `baseout-web` · billing

### Child issues (1B — Backup engine)
- [ ] [P1B.1] Airtable OAuth connection flow + encrypted token storage — `baseout-backup-engine` · auth · 🔒
- [ ] [P1B.2] Durable Object per Space (state + cron) — `baseout-backup-engine` · backup
- [ ] [P1B.3] DB-level connection locking — `baseout-backup-engine` · backup
- [ ] [P1B.4] Static backup: schema + records to CSV + R2 — `baseout-backup-engine` · backup
- [ ] [P1B.5] Static backup: attachments with dedup — `baseout-backup-engine` · backup
- [ ] [P1B.6] File path structure in Storage Destinations — `baseout-backup-engine` · backup
- [ ] [P1B.7] Backup Run record lifecycle — `baseout-backup-engine` · backup
- [ ] [P1B.8] Trial cap enforcement in engine — `baseout-backup-engine` · backup
- [ ] [P1B.9] Trigger.dev job integration — `baseout-backup-engine` · backup
- [ ] [P1B.10] Backup history accessible from master DB — `baseout-backup-engine` · backup

### Child issues (1C — Onboarding wizard) — depends on 1A + 1B
- [ ] [P1C.1] Step 1: Connect Airtable — `baseout-web` · ux
- [ ] [P1C.2] Step 2: Select bases — `baseout-web` · ux
- [ ] [P1C.3] Step 3: Pick backup frequency — `baseout-web` · ux
- [ ] [P1C.4] Step 4: Pick Storage Destination — `baseout-web` · ux
- [ ] [P1C.5] Step 5: Confirm + run first backup — `baseout-web` · ux
- [ ] [P1C.6] Resume incomplete wizard state — `baseout-web` · ux

### Child issues (1D — Storage Destinations)
- [ ] [P1D.1] R2 managed storage (default) — `baseout-backup-engine` · backup
- [ ] [P1D.2] Google Drive connector — `baseout-backup-engine` · backup · 🔒
- [ ] [P1D.3] Dropbox connector (proxy stream) — `baseout-backup-engine` · backup · 🔒
- [ ] [P1D.4] Box connector (proxy stream) — `baseout-backup-engine` · backup · 🔒
- [ ] [P1D.5] OneDrive connector — `baseout-backup-engine` · backup · 🔒
- [ ] [P1D.6] S3 connector (Growth+) — `baseout-backup-engine` · backup · 🔒
- [ ] [P1D.7] Frame.io connector (Growth+) — `baseout-backup-engine` · backup · 🔒

---

### [P1A.1] Integrate better-auth

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 1A · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `🔒 security:auth-path`, `tier-gate:all`

#### Context
better-auth is the single source of truth for sessions, credentials, and CSRF per PRD §13 / §20 / CLAUDE.md §2. Magic link is the Phase 1 flow; email+password and 2FA come in Phase 6. Airtable OAuth is **never** a login path — it's a data Connection only.

#### Spec References
- PRD §13 (Authentication model)
- PRD §20 (Security: password hashing, CSRF)
- PRD §21.3 (`users`, `sessions` tables)

#### Canonical Terms
Organization, User, Connection. ❌ `account`, `login provider`, `tenant`.

#### Dependencies
- **Blocked by:** P0.1, P0.7, P0.8, P0.10
- **Blocks:** P1A.2–P1A.6, P1C.*, all protected routes

#### Acceptance Criteria
- [ ] `better-auth` installed + configured in `src/lib/auth.ts`
- [ ] Cloudflare Email Service (`env.EMAIL.send()`) wired for magic link
- [ ] Session strategy chosen (JWT vs DB-backed) and rationale documented in PR
- [ ] CSRF helpers exposed for mutating forms
- [ ] Airtable OAuth path isolated from login handler (data only)
- [ ] Cookies: `HttpOnly`, `Secure`, `SameSite=Lax`

#### Security 🔒
- `BETTER_AUTH_SECRET` from Cloudflare Secrets only.
- No plaintext tokens in DB/logs. Audit log entry on every login, logout, and failed attempt.

#### Testing
- Unit: auth config + session resolver (target 75%).
- Integration: magic-link flow with the `EMAIL` binding mocked (inject a fake `SendEmail`) + real local PG.

---

### [P1A.2] Magic-link sign-up + sign-in flow

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 1A · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `🔒 security:auth-path`, `tier-gate:all`

#### Context
Magic link is the only auth method at Phase 1 (per Plan §Phase 1A.1). Email entry → link sent → link clicked → account created or session established. Link expires in 15 min (PRD §19.1).

#### Spec References
- PRD §13.1 (magic link)
- PRD §19.1 (email template)

#### Dependencies
- **Blocked by:** P1A.1, P0.10
- **Blocks:** P1A.3, P1C.1

#### Acceptance Criteria
- [ ] `/sign-in` and `/sign-up` pages built with `baseout-ui` components
- [ ] Email submission triggers magic-link send via the `EMAIL` binding
- [ ] Link URL uses single-use token, expires 15 min
- [ ] Clicking link: creates User + Organization if new; establishes session if existing
- [ ] Rate-limit: 5 magic-link requests per email per hour
- [ ] Error states: expired link, already-used link, malformed token

#### Security 🔒
- Token is opaque random 32 bytes; not a guessable email hash.
- Same response whether email exists or not (no user enumeration).

#### Testing
- Playwright E2E: submit → click link in inbox → dashboard loads.

---

### [P1A.3] Create Organization + user + $0 Stripe sub on sign-up

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 1A · **Capability:** billing
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:billing`, `🔒 security:new-secret`, `tier-gate:all`

#### Context
Per PRD §8.3 trial model, every sign-up creates an Organization, a User (role `owner`), a Stripe Customer, and a $0 Stripe Subscription with `trial_ends_at = now() + 7d`. No credit card.

#### Spec References
- PRD §8.3 (trial mechanics)
- Features §5.5.5 (trials per platform)
- PRD §21.3 (`organizations`, `users`, `subscriptions` tables)

#### Canonical Terms
Organization, User, Subscription, Trial.

#### Dependencies
- **Blocked by:** P1A.2, P0.11
- **Blocks:** P1A.6, P4A.1

#### Acceptance Criteria
- [ ] On first sign-in: insert Organization (unique UUID) + User (role `owner`)
- [ ] Create Stripe Customer via API; store `stripe_customer_id` on Organization
- [ ] Create Stripe Subscription on the Starter product at $0 with 7-day trial
- [ ] Persist `subscriptions` row with `status='trialing'`, `trial_ends_at`
- [ ] Idempotent: replaying sign-up does not double-create

#### Security 🔒
- Server-side only; no Stripe secret exposure to client.

#### Testing
- Integration: sign-up fixture → assert Org + User + Stripe Customer + Subscription rows.

---

### [P1A.4] Session management + route protection

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 1A · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `🔒 security:auth-path`, `tier-gate:all`

#### Context
All app routes (except auth + marketing) must pass through `src/middleware.ts` auth guard. No ad-hoc checks per CLAUDE.md §2.

#### Spec References
- PRD §13.5 (session persistence)
- CLAUDE.md §2 (auth enforcement in middleware)

#### Dependencies
- **Blocked by:** P1A.1
- **Blocks:** every protected page/API

#### Acceptance Criteria
- [ ] `src/middleware.ts` is the sole enforcement point for auth
- [ ] Public routes explicitly allow-listed (`/`, `/sign-in`, `/sign-up`, pricing, public schema viz)
- [ ] Session hydrates Astro locals with `user` + `organization`
- [ ] Logout clears session + every user-scoped nanostore (CLAUDE.md §4)
- [ ] Session survives browser close; revokeable from admin app (P6.1)

#### Security 🔒
- Session timeout documented (e.g. 30 days sliding).
- Rotating session secret does not invalidate all sessions catastrophically.

#### Testing
- Integration: request to protected route without session → 302 to `/sign-in`.

---

### [P1A.5] Pre-registration schema viz session

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 1A · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`

#### Context
Per PRD §6 (conversion hook), a user can OAuth into Airtable and see their Schema before creating an account. The temporary session is claimed on registration.

#### Spec References
- PRD §6.6 (pre-auth schema flow)
- Plan §Phase 1A.5

#### Dependencies
- **Blocked by:** P1A.1
- **Blocks:** P3A.3 (schema viz rendering)

#### Acceptance Criteria
- [ ] Anonymous OAuth to Airtable → server-issued temp session ID in HttpOnly cookie
- [ ] Temp session stores Airtable token + base list (memory or short-TTL KV)
- [ ] Schema viz page renders for temp session
- [ ] On sign-up: claim temp session → move Connection + discovered bases to new Organization
- [ ] Temp session discarded on tab close OR after 24h

#### Testing
- Integration: anon OAuth → schema renders → sign up → Connection persisted to Org.

---

### [P1A.6] Trial state management + cap enforcement

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 1A · **Capability:** billing
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:billing`, `tier-gate:all`

#### Context
Trial = 7 days + 1 backup run, capped at 1,000 records / 5 tables / 100 attachments (PRD §8.3). Server-side state enforces both time and usage caps; engine also enforces (P1B.8).

#### Spec References
- PRD §8.3 (trial caps)
- PRD §21.3 (`subscriptions.trial_ends_at`)

#### Dependencies
- **Blocked by:** P1A.3
- **Blocks:** P1B.8, P4A.1

#### Acceptance Criteria
- [ ] Capability resolver returns `trial_active` / `trial_expired` from Subscription state
- [ ] Backup-run preflight check refuses second run when `is_trial`
- [ ] Day 5 warning + Day 7 expiry email queued (P2D.1 owns templates)
- [ ] Trial-expired state blocks new backups; restores remain available
- [ ] Upgrade path resets trial flags (P4A.1)

#### Testing
- Unit: trial state machine.
- Integration: fixture Sub with `trial_ends_at` past → preflight denies.

---

### [P1B.1] Airtable OAuth connection flow + encrypted token storage

**Repo:** `baseout-backup-engine` (OAuth) + `baseout-web` (UI) · **Milestone:** MVP · **Phase:** 1B · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:auth`, `🔒 security:encryption`, `tier-gate:all`

#### Context
OAuth to Airtable is the Connection mechanism, never login (per P1A.1). Tokens stored AES-256-GCM at rest in `connections.access_token_enc` / `refresh_token_enc` (PRD §20.2). Standard and Enterprise scope variants.

#### Spec References
- PRD §20.2 (encryption scheme)
- PRD §21.3 (`connections` table)
- Features §1 (Connection definition)

#### Canonical Terms
Connection, Platform (value: `airtable`).

#### Dependencies
- **Blocked by:** P0.7, P0.8
- **Blocks:** P1B.2, P1B.4, P1C.1

#### Acceptance Criteria
- [ ] `/api/connections/airtable/start` initiates OAuth with state param
- [ ] Callback validates state, exchanges code, persists encrypted tokens
- [ ] Shared encryption helper `encrypt(value)` / `decrypt(value)` using `MASTER_ENCRYPTION_KEY`
- [ ] Standard + Enterprise scope variants (Enterprise: opt-in flag on Connection)
- [ ] `token_expires_at` tracked; refresh handled in P2C.2
- [ ] Rotating `MASTER_ENCRYPTION_KEY` documented (re-encrypt migration path)

#### Security 🔒
- CSRF state param bound to session; short TTL.
- Plaintext token held in memory only during exchange; never logged.

#### Testing
- Integration with Airtable OAuth sandbox; encrypted columns round-trip.

---

### [P1B.2] Durable Object per Space (state + cron)

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 1B · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`

#### Context
One Durable Object per Space acts as the Backup Run controller — holds in-flight state, emits WebSocket progress, schedules runs per frequency (PRD §4, §7.6).

#### Spec References
- PRD §4 (Durable Objects architecture)
- PRD §7.6 (WebSocket for real-time progress)
- Plan §Phase 1B.2

#### Dependencies
- **Blocked by:** P0.5
- **Blocks:** P1B.4, P1B.7, P2A.4

#### Acceptance Criteria
- [ ] DO class `SpaceController` declared in `wrangler.toml`
- [ ] DO routes triggered by Space ID
- [ ] Internal state: current run status, progress %, error
- [ ] Cron alarm scheduled per `spaces.backup_frequency` (monthly/weekly/daily)
- [ ] WebSocket endpoint emits `{progress, status, lastUpdate}` events
- [ ] Graceful restart: in-flight run marked `failed` with resume hint

#### Testing
- Miniflare: simulate DO alarm → triggers a backup start.

---

### [P1B.3] DB-level connection locking

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 1B · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`

#### Context
Airtable rate limits are Connection-scoped (5 req/s per token). Two parallel backup runs on the same Connection must not collide. PRD §2.10 mandates DB-level locks with 5s retry.

#### Spec References
- PRD §2.10 (connection locking)
- Plan §Phase 1B.3

#### Dependencies
- **Blocked by:** P0.7
- **Blocks:** P1B.4

#### Acceptance Criteria
- [ ] `connection_locks` table with `connection_id`, `acquired_at`, `owner` (run ID)
- [ ] Acquire via `INSERT ... ON CONFLICT DO NOTHING` (Postgres advisory lock acceptable)
- [ ] Stale lock timeout (e.g. 15 min); reclaimable by new run with audit log
- [ ] Retry policy: 5s backoff up to 3 attempts, then fail the run
- [ ] Released in `finally` block — never leaked on error

#### Testing
- Integration: two simultaneous runs → one holds, other waits.

---

### [P1B.4] Static backup: schema + records to CSV + R2

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 1B · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`

#### Context
Core MVP deliverable: for each Table in each Base, stream records to CSV in R2. Schema captured as JSON sidecar. Streams through memory, never disk (PRD §2.4).

#### Spec References
- PRD §2.4 (Static Backup flow)
- Features §1 (Static Backup definition)

#### Canonical Terms
Base, Table, Field, Record, Backup Snapshot, Static Backup, Storage Destination.

#### Dependencies
- **Blocked by:** P1B.1, P1B.2, P1B.3, P1D.1
- **Blocks:** P1B.5, P2B.*

#### Acceptance Criteria
- [ ] For each Base: fetch schema → write `schema.json` to R2
- [ ] For each Table: paginated record fetch → streaming CSV write to R2
- [ ] Column order = Field order from schema
- [ ] Cell encoding per Airtable Field type (rollups as formatted strings, arrays JSON-encoded)
- [ ] Handles rate limit (429) with exponential backoff
- [ ] Handles deleted record (gap in IDs) without failing the run

#### Testing
- Integration with Airtable sandbox base → verify CSV structure.
- Unit: Field-type encoding table.

---

### [P1B.5] Static backup: attachments with dedup

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 1B · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`

#### Context
Per PRD §2.5, attachments deduplicated by composite ID `{base_id}_{table_id}_{record_id}_{field_id}_{attachment_id}`. Proxy-stream for providers without direct URL write.

#### Spec References
- PRD §2.5 (attachment handling)
- PRD §2.5.2 (Airtable URL refresh on 1–2h expiry)

#### Canonical Terms
Attachment.

#### Dependencies
- **Blocked by:** P1B.4
- **Blocks:** P1B.8

#### Acceptance Criteria
- [ ] Composite ID computed and checked against prior snapshot manifest
- [ ] Unchanged attachments referenced by hash, not re-uploaded
- [ ] Airtable attachment URL refreshed when expired
- [ ] Retry on transient failure (3×, exponential)
- [ ] Manifest file written with list of attachment IDs + sizes

#### Testing
- Integration: two runs over same base → second run uploads zero new attachments.

---

### [P1B.6] File path structure in Storage Destinations

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 1B · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`

#### Context
Stable layout per PRD §2.6: `/{user-root}/{SpaceName}/{BaseName}/{DateTime}/{TableName}.csv`. Customers can browse directly in their Storage Destination.

#### Spec References
- PRD §2.6 (file path spec)

#### Dependencies
- **Blocked by:** P1B.4
- **Blocks:** P1D.*

#### Acceptance Criteria
- [ ] Path builder utility with unit tests
- [ ] Invalid characters (slashes, colons, control chars) sanitized in Space / Base / Table names
- [ ] Collision-free when two runs complete at the same second (append `-1`, `-2`)
- [ ] Documented in README of `baseout-backup-engine`

#### Testing
- Unit: 20+ path cases including unicode and edge chars.

---

### [P1B.7] Backup Run record lifecycle

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 1B · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`

#### Context
Every backup writes a row to `backup_runs` (PRD §21.3). Created `pending` on start, transitions to `running`, then `success` / `failed` / `trial_complete` (P1B.8).

#### Spec References
- PRD §21.3 (`backup_runs` schema)

#### Canonical Terms
Backup Run, Space.

#### Dependencies
- **Blocked by:** P0.7, P1B.2
- **Blocks:** P1B.10, P2A.3

#### Acceptance Criteria
- [ ] `INSERT` on run start with deterministic UUID
- [ ] Transition updates: single-path state machine (no skip from `pending` → `success`)
- [ ] Metrics persisted: `record_count`, `table_count`, `attachment_count`, duration
- [ ] `is_trial` flag set from Subscription state at start
- [ ] Failure mode captured in `error_message` column (sanitized)

#### Testing
- Integration: simulate engine crash → row ends in `failed` with error.

---

### [P1B.8] Trial cap enforcement in engine

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 1B · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`

#### Context
Engine enforces caps during the run (records 1,000 / tables 5 / attachments 100 — PRD §8.3). On cap hit: stop, mark run `trial_complete`, notify user.

#### Spec References
- PRD §8.3 (trial caps)

#### Dependencies
- **Blocked by:** P1A.6, P1B.5, P1B.7
- **Blocks:** Phase 4 upgrade flow (P4A.1 releases caps)

#### Acceptance Criteria
- [ ] Inline counters incremented per record / table / attachment
- [ ] On cap: graceful stop after current chunk; no partial corruption
- [ ] Run marked `trial_complete`; partial data retained and usable for restore
- [ ] Trial-capped email queued (P2D.1)

#### Testing
- Integration: fixture base with 2,000 records + trial sub → run stops at 1,000.

---

### [P1B.9] Trigger.dev job integration

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 1B · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`

#### Context
Per PRD §4 + Plan §Phase 1B.9, backup runs dispatch to Trigger.dev V3 for parallel base-level execution. One job per base per run.

#### Spec References
- PRD §4 (Trigger.dev V3)
- Plan §Phase 1B.9

#### Dependencies
- **Blocked by:** P1B.2, P1B.4
- **Blocks:** P1B.10

#### Acceptance Criteria
- [ ] Trigger.dev project configured with staging + prod tokens
- [ ] `backupBase` job registered with typed input
- [ ] DO enqueues one job per base; awaits fan-out completion
- [ ] Per-job progress reported back to DO via webhook / API
- [ ] Jobs idempotent on retry

#### Testing
- Integration: enqueue against Trigger.dev staging → observe completion.

---

### [P1B.10] Backup history accessible from master DB

**Repo:** `baseout-backup-engine` + `baseout-web` · **Milestone:** MVP · **Phase:** 1B · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`

#### Context
Dashboard (P2A.3) reads `backup_runs` via a web API. This issue wires the read-only endpoint and pagination.

#### Spec References
- PRD §21.3 (`backup_runs`)
- PRD §6 (dashboard)

#### Dependencies
- **Blocked by:** P1B.7
- **Blocks:** P2A.3

#### Acceptance Criteria
- [ ] `GET /api/spaces/:id/backup-runs?cursor=...&limit=...` returns paginated runs
- [ ] Authz: only Org members can read their Space's runs (middleware + row filter)
- [ ] Sort by `started_at` desc
- [ ] Includes `status`, metrics, duration

#### Testing
- Integration: fixture with multi-Org rows → cross-Org read returns 403.

---

### [P1C.1] Onboarding Step 1 — Connect Airtable

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 1C · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`

#### Context
First step of the post-sign-up wizard (PRD §6, Plan §Phase 1C). User kicks off Airtable OAuth (P1B.1), returns to wizard with Connection established and base list discovered.

#### Spec References
- PRD §6.6 (onboarding wizard)

#### Dependencies
- **Blocked by:** P1A.4, P1B.1
- **Blocks:** P1C.2

#### Acceptance Criteria
- [ ] Wizard shell component with progress indicator (`baseout-ui`)
- [ ] Step 1 view: primary CTA "Connect Airtable"
- [ ] Successful OAuth: base list shown; wizard state advances to Step 2
- [ ] Error state: OAuth denied or timeout → retry CTA

#### Testing
- Playwright: signed-in user → Step 1 → OAuth → Step 2.

---

### [P1C.2] Onboarding Step 2 — Select bases

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 1C · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`

#### Context
User picks which Bases to include. Bulk "Add all" + toggle for auto-add future bases (Plan §Phase 1C.2).

#### Spec References
- PRD §6.6 (wizard)

#### Canonical Terms
Base, Space.

#### Dependencies
- **Blocked by:** P1C.1
- **Blocks:** P1C.3

#### Acceptance Criteria
- [ ] Base list with checkboxes + "Select all" toggle
- [ ] Auto-add-future-bases boolean persisted on Space
- [ ] Selection persists to Space config on wizard advance

#### Testing
- Playwright: select 2 of 3 bases → persists → Step 3 loads with selections.

---

### [P1C.3] Onboarding Step 3 — Pick backup frequency

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 1C · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`

#### Context
Frequency options gated by tier per Features §4 — Monthly (all) / Weekly (Launch+) / Daily (Pro+) / Instant (Pro+).

#### Spec References
- Features §4 (frequency by tier)

#### Dependencies
- **Blocked by:** P1C.2
- **Blocks:** P1C.4

#### Acceptance Criteria
- [ ] Frequency options disabled if tier gate not met; "Upgrade" link
- [ ] Capability check reads from Stripe metadata (Features §5.5.4)
- [ ] Selected frequency persists to `spaces.backup_frequency`

#### Testing
- Integration: Starter tier sees only Monthly enabled.

---

### [P1C.4] Onboarding Step 4 — Pick Storage Destination

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 1C · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`

#### Context
Default: R2 managed (all tiers). BYOS options via OAuth in P1D.*. S3 / Frame.io gated to Growth+ per Features §14.

#### Spec References
- PRD §2.6 / §6.6
- Features §14 (Storage Destination tier gates)

#### Canonical Terms
Storage Destination, BYOS, R2.

#### Dependencies
- **Blocked by:** P1C.3, P1D.*
- **Blocks:** P1C.5

#### Acceptance Criteria
- [ ] Options listed with tier-appropriate enable/disable
- [ ] BYOS selections route through the corresponding OAuth (P1D.*)
- [ ] Folder picker for Google Drive / OneDrive
- [ ] Selected destination + auth record persisted to Space

#### Testing
- Playwright: Starter → choose Google Drive → OAuth → folder picker → saved.

---

### [P1C.5] Onboarding Step 5 — Confirm + run first backup

**Repo:** `baseout-web` + `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 1C · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`

#### Context
Summary screen → kicks off first backup run (P1B.*). Wizard locked until backup completes or fails; live progress via WebSocket (P2A.4).

#### Spec References
- PRD §6.6 (wizard completion)

#### Dependencies
- **Blocked by:** P1C.4, P1B.2, P1B.4
- **Blocks:** P1C.6

#### Acceptance Criteria
- [ ] Confirmation summary shows Bases + frequency + destination
- [ ] Run dispatched to Space Durable Object
- [ ] Live progress bar via WebSocket
- [ ] On success: redirect to dashboard (P2A.*)
- [ ] On trial cap: banner with partial-result CTA to upgrade

#### Testing
- Playwright E2E: Phase 1 full loop from sign-up to first backup success.

---

### [P1C.6] Resume incomplete wizard state

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 1C · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`

#### Context
If user abandons the wizard, next login resumes at the last completed step (Plan §Phase 1C.6).

#### Spec References
- PRD §6.6

#### Dependencies
- **Blocked by:** P1C.1–P1C.5
- **Blocks:** none

#### Acceptance Criteria
- [ ] `spaces.wizard_step` column (or equivalent) persisted at each step
- [ ] On login with incomplete wizard: redirect to correct step
- [ ] Dashboard inaccessible until wizard complete (redirect with banner)

#### Testing
- Integration: start wizard → log out at Step 3 → log in → lands on Step 3.

---

### [P1D.1] R2 managed storage (default)

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 1D · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`

#### Context
R2 is the default Storage Destination — no customer configuration needed. Encryption at rest via Cloudflare R2 SSE (PRD §20.2).

#### Spec References
- PRD §4 (R2 infra)
- Features §14 (R2 on all tiers)

#### Canonical Terms
R2, Storage Destination.

#### Dependencies
- **Blocked by:** P0.5
- **Blocks:** P1B.4, P1C.4

#### Acceptance Criteria
- [ ] Writer module `StorageR2` implementing a common `StorageDestination` interface
- [ ] Path structure per P1B.6
- [ ] Per-Organization R2 prefix isolates data (`/orgs/{org-id}/...`)
- [ ] SSE enabled; encryption headers set
- [ ] Quota check against tier limit (Features §4.1)

#### Testing
- Integration: write CSV + manifest; read back identical bytes.

---

### [P1D.2] Google Drive connector

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 1D · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:auth-path`, `tier-gate:all`

#### Context
OAuth to Google Drive with folder picker; tokens encrypted and stored alongside Space config.

#### Spec References
- Features §14 (Google Drive all tiers)
- PRD §2.6 (file path structure)

#### Dependencies
- **Blocked by:** P0.8, P1D.1
- **Blocks:** P1C.4

#### Acceptance Criteria
- [ ] OAuth start + callback routes; scope `drive.file`
- [ ] Folder picker (server-side search + select)
- [ ] Writer implements shared `StorageDestination` interface
- [ ] Token refresh before expiry
- [ ] Handles 401 (revoked consent) → mark Connection dead (P2C.3)

#### Security 🔒
- Narrow scope (`drive.file`, not `drive`).

#### Testing
- Integration with Google sandbox account.

---

### [P1D.3] Dropbox connector (proxy stream)

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 1D · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:auth-path`, `tier-gate:all`

#### Context
Dropbox requires proxy streaming (no disk write on Baseout servers) per PRD §2.5.1.

#### Dependencies
- **Blocked by:** P0.8, P1D.1
- **Blocks:** P1C.4

#### Acceptance Criteria
- [ ] OAuth flow; encrypted token storage
- [ ] Streaming upload (no temp disk)
- [ ] Path structure per P1B.6 under user-chosen root

#### Security 🔒
- Scope limited to app folder when possible.

#### Testing
- Integration: proxy a 50 MB file end-to-end without disk write.

---

### [P1D.4] Box connector (proxy stream)

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 1D · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:auth-path`, `tier-gate:all`

#### Context
Same shape as Dropbox (P1D.3): OAuth + proxy stream.

#### Dependencies
- **Blocked by:** P0.8, P1D.1
- **Blocks:** P1C.4

#### Acceptance Criteria
- [ ] OAuth + encrypted token
- [ ] Proxy-stream writer
- [ ] Path structure per P1B.6

#### Testing
- Integration with Box sandbox.

---

### [P1D.5] OneDrive connector

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 1D · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:auth-path`, `tier-gate:all`

#### Context
Microsoft Graph OAuth + folder picker; writer via Graph API chunked upload.

#### Dependencies
- **Blocked by:** P0.8, P1D.1
- **Blocks:** P1C.4

#### Acceptance Criteria
- [ ] OAuth flow; encrypted token
- [ ] Folder picker via Graph
- [ ] Chunked uploads for large files

#### Testing
- Integration with a personal OneDrive account.

---

### [P1D.6] S3 connector (Growth+)

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 1D · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:new-secret`, `tier-gate:growth+`

#### Context
S3 is gated to Growth+ per Features §14. Uses IAM access keys (not OAuth); bucket + path configured by user.

#### Spec References
- Features §14 (S3 Growth+)

#### Dependencies
- **Blocked by:** P0.8, P1D.1
- **Blocks:** P1C.4 (for Growth+ flow)

#### Acceptance Criteria
- [ ] Credential form (Access Key + Secret) encrypted at rest
- [ ] Bucket existence + write test on save
- [ ] Path structure per P1B.6 under user-chosen prefix
- [ ] Error on expired credentials → mark Connection dead

#### Security 🔒
- Validate that IAM policy is scoped (warn if wildcards).
- Display fingerprint of key (not full key) in UI.

#### Testing
- Integration with a MinIO or localstack fixture.

---

### [P1D.7] Frame.io connector (Growth+)

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 1D · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:auth-path`, `tier-gate:growth+`

#### Context
Frame.io is Growth+ only. OAuth + project/folder picker. Proxy requirements TBD — confirm during build (⚠️ spec note in Plan §Phase 1D.7).

#### Spec References
- Features §14 (Frame.io Growth+)

#### Dependencies
- **Blocked by:** P0.8, P1D.1
- **Blocks:** P1C.4 (Growth+)

#### Acceptance Criteria
- [ ] OAuth flow; encrypted token
- [ ] Project/folder selection
- [ ] Writer handles proxy if required (confirm in PR description)

#### Testing
- Integration with Frame.io sandbox.

---

## Epic 3 — Phase 2: Dashboard, Restore & Background Services [MVP]

**Milestone:** MVP · **Primary repos:** `baseout-web`, `baseout-backup-engine`, `baseout-background-services` · **Plan ref:** Phase 2.

**Goal:** users can see backup history, run restores, and the system self-maintains (webhook renewal, OAuth refresh, notifications, trial monitoring).

**Entry criteria:** Phase 1 complete. **Exit criteria:** Dashboard live with real-time progress; restore to new Base working for all tiers; background services deployed and covered by tests.

**Parallelization:** 2A / 2B / 2C all run in parallel. 2D (email templates) can scaffold anytime after P0.10.

### Child issues (2A — Dashboard)
- [ ] [P2A.1] Space selector sidebar nav — `baseout-web` · ux
- [ ] [P2A.2] Backup status widget — `baseout-web` · ux
- [ ] [P2A.3] Backup history list — `baseout-web` · ux
- [ ] [P2A.4] Real-time progress via WebSocket — `baseout-web` · ux
- [ ] [P2A.5] Storage usage summary — `baseout-web` · ux
- [ ] [P2A.6] Notification / action items panel — `baseout-web` · ux

### Child issues (2B — Restore)
- [ ] [P2B.1] Point-in-time snapshot selection UI — `baseout-web` · restore
- [ ] [P2B.2] Base-level restore — `baseout-web` + engine · restore
- [ ] [P2B.3] Table-level restore — `baseout-web` + engine · restore
- [ ] [P2B.4] Restore destination: existing Base — `baseout-backup-engine` · restore
- [ ] [P2B.5] Restore destination: new Base — `baseout-backup-engine` · restore
- [ ] [P2B.6] Post-restore verification (Growth+) — `baseout-backup-engine` · restore

### Child issues (2C — Background Services)
- [ ] [P2C.1] Webhook renewal service — `baseout-background-services` · backup
- [ ] [P2C.2] OAuth token refresh service — `baseout-background-services` · auth · 🔒
- [ ] [P2C.3] Dead connection detection + 4-touch notification — `baseout-background-services` · backup
- [ ] [P2C.4] Connection lock manager — `baseout-background-services` · backup
- [ ] [P2C.5] Trial expiry monitor — `baseout-background-services` · billing
- [ ] [P2C.6] Quota usage monitor — `baseout-background-services` · billing

### Child issues (2D — Email templates)
- [ ] [P2D.1] Build all V1 React Email templates + Cloudflare Email Service binding integration — `baseout-web` · ux

---

### [P2A.1] Space selector sidebar nav

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 2A · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`

#### Context
Sidebar lists Spaces within the active Organization. Defaults to last-viewed (PRD §6). Persisted per-user via nanostore (CLAUDE.md §4) + server sync.

#### Spec References
- PRD §6 (dashboard layout)
- CLAUDE.md §4 (nanostores for selected Space)

#### Canonical Terms
Organization, Space.

#### Dependencies
- **Blocked by:** P1A.4, P0.9
- **Blocks:** P2A.2–P2A.6

#### Acceptance Criteria
- [ ] Sidebar component in `baseout-ui` lists Spaces for active Org
- [ ] Selection persists to `src/stores/currentSpace.ts`
- [ ] Last-viewed restored on next login
- [ ] New-Space CTA routes to wizard (Phase 1C)

#### Testing
- Integration: two Spaces → switching updates current-Space store and URL.

---

### [P2A.2] Backup status widget

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 2A · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`

#### Context
Prominent on dashboard (PRD §6): shows last successful run or live progress. Trust-signal-first design principle.

#### Dependencies
- **Blocked by:** P2A.1, P2A.4
- **Blocks:** none

#### Acceptance Criteria
- [ ] Idle state: last run's status, timestamp, record/table/attachment counts
- [ ] Running state: live progress bar, ETA if available
- [ ] Failed state: error summary + "View details" link to run log

#### Testing
- Unit: component renders each state from fixture data.

---

### [P2A.3] Backup history list

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 2A · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`

#### Context
Paginated list of Backup Runs for the current Space (reads P1B.10 endpoint). Click-through to a run detail view.

#### Canonical Terms
Backup Run.

#### Dependencies
- **Blocked by:** P1B.10, P2A.1
- **Blocks:** none

#### Acceptance Criteria
- [ ] Table with columns: status, started, duration, records, tables, attachments
- [ ] Infinite scroll or cursor pagination
- [ ] Click row → run detail drawer with metrics + error
- [ ] Filter by status (success, failed, trial_complete)

#### Testing
- Playwright: list loads, scrolls, and opens a detail view.

---

### [P2A.4] Real-time progress via WebSocket

**Repo:** `baseout-web` + `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 2A · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`

#### Context
Per PRD §7.6 the Space Durable Object (P1B.2) emits progress over WebSocket. UI subscribes while a run is in progress.

#### Spec References
- PRD §7.6 (WebSocket)

#### Dependencies
- **Blocked by:** P1B.2, P2A.1
- **Blocks:** P2A.2

#### Acceptance Criteria
- [ ] Client connects to `/api/spaces/:id/progress` (WebSocket)
- [ ] Server authorizes connection via session middleware
- [ ] Reconnects on drop with exponential backoff
- [ ] Updates mapped to a nanostore for UI consumption

#### Security 🔒
- Close socket on logout.

#### Testing
- Integration: start a fake run → progress events arrive within 1s.

---

### [P2A.5] Storage usage summary

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 2A · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`

#### Context
Shows R2 + destination usage vs tier limit (Features §4.1). Link to upgrade when at 75/90/100%.

#### Dependencies
- **Blocked by:** P2A.1, P2C.6
- **Blocks:** none

#### Acceptance Criteria
- [ ] Usage bar vs tier cap
- [ ] Threshold color states: 75% warn, 90% critical, 100% block
- [ ] Upgrade CTA links to billing page (P4A.2)

#### Testing
- Unit: thresholds render correct color.

---

### [P2A.6] Notification / action items panel

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 2A · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`

#### Context
Collates failures, quota warnings, dead-connection prompts into one panel with action CTAs (PRD §6).

#### Dependencies
- **Blocked by:** P2A.1, P2C.*
- **Blocks:** none

#### Acceptance Criteria
- [ ] Unified feed of alerts for current Org + Space
- [ ] Each item has a primary action (reconnect, upgrade, retry run)
- [ ] Read/unread state tracked per user

#### Testing
- Integration: seed notifications → panel shows sorted by severity.

---

### [P2B.1] Point-in-time snapshot selection UI

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 2B · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:restore`, `tier-gate:all`

#### Context
Restore starts by choosing a Backup Snapshot. PRD §2.7 requires listing all snapshots for a Space with timestamp + metrics.

#### Canonical Terms
Backup Snapshot, Restore.

#### Dependencies
- **Blocked by:** P2A.3
- **Blocks:** P2B.2, P2B.3

#### Acceptance Criteria
- [ ] Snapshot list filtered to successful + trial_complete runs
- [ ] Search/filter by date range
- [ ] Selection advances to restore scope picker (base-level vs table-level)

#### Testing
- Playwright: select a snapshot → proceeds to scope picker.

---

### [P2B.2] Base-level restore

**Repo:** `baseout-web` + `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 2B · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:restore`, `tier-gate:all`

#### Context
Restore every Table from a snapshot to a destination Base. Never overwrites — always creates new data (Features §1 Restore).

#### Dependencies
- **Blocked by:** P2B.1, P2B.4, P2B.5
- **Blocks:** P2B.6

#### Acceptance Criteria
- [ ] Dispatch restore job via Trigger.dev (reuse P1B.9 pattern)
- [ ] Progress streamed over WebSocket (P2A.4 reuse)
- [ ] On completion: destination Base reachable; record counts reported

#### Testing
- E2E Playwright: backup → restore → count matches.

---

### [P2B.3] Table-level restore

**Repo:** `baseout-web` + `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 2B · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:restore`, `tier-gate:all`

#### Context
Subset restore — user picks one or more Tables from a snapshot.

#### Dependencies
- **Blocked by:** P2B.1, P2B.4, P2B.5
- **Blocks:** P2B.6

#### Acceptance Criteria
- [ ] Multi-select Tables from the snapshot
- [ ] Same dispatch path as base-level; engine respects subset

#### Testing
- Integration: 3-table base, restore 2 — only 2 exist on target.

---

### [P2B.4] Restore destination: existing Base

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 2B · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:all`

#### Context
Writes restored Tables as new tables into a user-selected existing Base — never modifies existing tables. Table names suffixed with `-restore-{timestamp}`.

#### Dependencies
- **Blocked by:** P1B.1
- **Blocks:** P2B.2, P2B.3

#### Acceptance Criteria
- [ ] Airtable API client supports `POST /meta/bases/{baseId}/tables`
- [ ] Field types mapped from snapshot schema
- [ ] Linked record fields restored in dependency order
- [ ] Attachments re-uploaded from snapshot storage

#### Testing
- Integration against Airtable sandbox.

---

### [P2B.5] Restore destination: new Base

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 2B · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:all`

#### Context
User provides a Workspace ID; engine creates a new Base via Airtable API and writes all Tables from the snapshot.

#### Dependencies
- **Blocked by:** P2B.4
- **Blocks:** P2B.2

#### Acceptance Criteria
- [ ] Workspace ID validated via Airtable API
- [ ] New Base created with snapshot's Base name + `-restore-{timestamp}` suffix
- [ ] Same Field + linked-record ordering as P2B.4

#### Testing
- Integration: restore to new Base; Airtable reports correct count.

---

### [P2B.6] Post-restore verification (Growth+)

**Repo:** `baseout-backup-engine` · **Milestone:** MVP · **Phase:** 2B · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:growth+`

#### Context
After restore: count records, compare to snapshot, write an audit log (PRD §2.8). Features §6.4 gates to Growth+.

#### Canonical Terms
Backup Snapshot, Restore, Audit Log.

#### Dependencies
- **Blocked by:** P2B.4, P2B.5
- **Blocks:** P2A.6 (shows audit in notification panel)

#### Acceptance Criteria
- [ ] Verify record count per Table vs snapshot; flag mismatches
- [ ] Write audit rows to `restore_audit` table (extend master schema)
- [ ] Tier gate via capability resolver (Features §5.5.4)

#### Testing
- Integration: tamper a Table post-restore → verification flags.

---

### [P2C.1] Webhook renewal service

**Repo:** `baseout-background-services` · **Milestone:** MVP · **Phase:** 2C · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:backup`, `tier-gate:all`

#### Context
Airtable webhooks expire in 7 days. Daily job renews any webhook at 6-day threshold (Plan §Phase 2C.1).

#### Dependencies
- **Blocked by:** P0.5, P0.7
- **Blocks:** P3B.6

#### Acceptance Criteria
- [ ] Scheduled Worker cron: daily
- [ ] Scans active webhooks; renews those > 6 days old
- [ ] Failures logged and surfaced via P2A.6

#### Testing
- Integration: seed webhook with `created_at` 6d ago → renewal issued.

---

### [P2C.2] OAuth token refresh service

**Repo:** `baseout-background-services` · **Milestone:** MVP · **Phase:** 2C · **Capability:** auth
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:auth`, `🔒 security:auth-path`, `tier-gate:all`

#### Context
Airtable + Storage Destination OAuth tokens expire. Refresh before expiry; re-encrypt with `MASTER_ENCRYPTION_KEY`.

#### Dependencies
- **Blocked by:** P1B.1, P1D.*
- **Blocks:** P2C.3

#### Acceptance Criteria
- [ ] Scheduled Worker: refresh tokens within 1h of expiry
- [ ] Refresh errors classified: transient vs revoked
- [ ] Revoked → mark Connection dead (P2C.3)

#### Security 🔒
- New tokens encrypted before write; old values never logged.

#### Testing
- Integration: token near expiry → refreshed; revoked token → Connection dead.

---

### [P2C.3] Dead connection detection + 4-touch notification

**Repo:** `baseout-background-services` · **Milestone:** MVP · **Phase:** 2C · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:backup`, `tier-gate:all`

#### Context
Per PRD §11 open-question resolution: cadence is Send → 2d → Send → 3d → Send → 5d → Final, then mark invalidated. Tracked in `notification_log` (PRD §21.3).

#### Dependencies
- **Blocked by:** P2C.2, P2D.1
- **Blocks:** P2A.6

#### Acceptance Criteria
- [ ] State machine tracks touch count per Connection
- [ ] Each stage sends the appropriate email template
- [ ] After 4th touch: mark Connection `invalidated`; block backups
- [ ] Re-auth by user resets the state

#### Testing
- Integration: simulate dead Connection; assert 4 emails over 10d + final flag.

---

### [P2C.4] Connection lock manager

**Repo:** `baseout-background-services` · **Milestone:** MVP · **Phase:** 2C · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:backup`, `tier-gate:all`

#### Context
Scheduled sweep of stale `connection_locks` (P1B.3) — reclaims locks held > 15 min. Surfaces anomalies in admin app (P6.1).

#### Dependencies
- **Blocked by:** P1B.3
- **Blocks:** none

#### Acceptance Criteria
- [ ] Cron: every 5 min
- [ ] Deletes locks with `acquired_at < now() - 15m`
- [ ] Logs reclamation with run ID + Connection ID

#### Testing
- Integration: stuck lock aged 20m → removed on next sweep.

---

### [P2C.5] Trial expiry monitor

**Repo:** `baseout-background-services` · **Milestone:** MVP · **Phase:** 2C · **Capability:** billing
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:billing`, `tier-gate:all`

#### Context
Sends Day-5 warning, expires Subscription at Day 7 (PRD §8.3).

#### Dependencies
- **Blocked by:** P1A.6, P2D.1
- **Blocks:** P4A.1

#### Acceptance Criteria
- [ ] Daily cron; queries `subscriptions` where `trial_ends_at` near
- [ ] Day-5: email warning
- [ ] Day-7: expire + email + block further backups

#### Testing
- Integration: trial age 5d → warning; 7d → expired.

---

### [P2C.6] Quota usage monitor

**Repo:** `baseout-background-services` · **Milestone:** MVP · **Phase:** 2C · **Capability:** billing
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:billing`, `tier-gate:all`

#### Context
Alerts at 75/90/100% of tier limits for records, attachments, storage, bases, etc. (Features §5.3).

#### Dependencies
- **Blocked by:** P0.7, P2D.1
- **Blocks:** P2A.5

#### Acceptance Criteria
- [ ] Daily cron; computes usage per Org against tier caps
- [ ] Email at 75/90/100%; in-app panel item (P2A.6)
- [ ] On `cap` mode at 100%: block new Backup Runs (Features §5.3)

#### Testing
- Integration: fixture Org at 92% → 90% email sent once, idempotent on re-run.

---

### [P2D.1] All V1 React Email templates + Cloudflare Email Service binding integration

**Repo:** `baseout-web` · **Milestone:** MVP · **Phase:** 2D · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`

#### Context
Per PRD §19.1, V1 templates: magic link, trial welcome, trial day-5 warning, trial expired, audit report, monthly summary, backup failure, backup warning, dead connection ×4, quota warning (75/90/100%), upgrade confirmation, migration welcome. (Password reset is obsolete — password auth removed pre-launch.)

#### Spec References
- PRD §19 (email templates)

#### Dependencies
- **Blocked by:** P0.10
- **Blocks:** P2C.3, P2C.5, P2C.6, P4A.*

#### Acceptance Criteria
- [ ] Each template under `src/emails/*.tsx` using React Email
- [ ] Shared layout component (logo, footer, unsubscribe link where applicable)
- [ ] Sent via the existing `sendEmail()` abstraction in `src/lib/email/send.ts` (which calls `env.EMAIL.send()`)
- [ ] Snapshot tests for all templates
- [ ] Sends from `mail.baseout.com` only

#### Testing
- Snapshot: each template renders deterministic HTML.
- Integration: `sendEmail({template: 'magic-link', to, vars}, env)` with an injected fake `SendEmail` binding confirms the expected shape reaches `env.EMAIL.send()`.

---

## Epic 4 — Phase 3: Schema, Health Score & Dynamic Backup [V1]

**Milestone:** V1 · **Primary repos:** `baseout-web`, `baseout-backup-engine` · **Plan ref:** Phase 3.

**Goal:** Launch+ and Growth+ premium capabilities — Schema visualization, Changelog, Health Score, and Dynamic Backup on D1 / shared PG / dedicated PG / BYODB.

**Entry criteria:** Phase 2 complete. **Exit criteria:** Launch+ users see Schema viz + Changelog + Health Score; Growth+ users get Dynamic Backup on provisioned DB; tier-migration tooling validated.

**Parallelization:** 3A (Schema) and 3B (Dynamic Backup) proceed in parallel.

### Child issues (3A — Schema capability)
- [ ] [P3A.1] Schema capture during backup — engine · schema
- [ ] [P3A.2] Schema Changelog (diff per run) — engine · schema
- [ ] [P3A.3] Schema visualization UI (React Flow) — `baseout-web` · schema
- [ ] [P3A.4] Health Score algorithm — `baseout-web` + engine · schema
- [ ] [P3A.5] Health Score display + configurable rules (Pro+) — `baseout-web` · schema
- [ ] [P3A.6] Diagram export (PNG / SVG / PDF / embed) — `baseout-web` · schema

### Child issues (3B — Dynamic Backup)
- [ ] [P3B.1] D1 provisioning on first backup run — engine · backup
- [ ] [P3B.2] D1 → Postgres migration tooling — engine · backup · 🔒
- [ ] [P3B.3] Shared Postgres provisioning (Pro+) — engine · backup
- [ ] [P3B.4] Dedicated Postgres provisioning (Business+) — engine · backup
- [ ] [P3B.5] BYODB support (Enterprise) — engine · backup · 🔒
- [ ] [P3B.6] Webhook-based incremental backup — engine · backup

---

### [P3A.1] Schema capture during backup

**Repo:** `baseout-backup-engine` · **Milestone:** V1 · **Phase:** 3A · **Capability:** schema
**Labels:** `phase:3`, `milestone:v1`, `repo:baseout-backup-engine`, `capability:schema`, `tier-gate:launch+`

#### Context
Extract Tables, Fields, Views, linked-record relationships during every Backup Run. Schema is captured on all tiers but visualization is Launch+.

#### Spec References
- PRD §3.1 (schema extraction)
- Features §15 (schema tier gates)

#### Canonical Terms
Schema, Table, Field, View.

#### Dependencies
- **Blocked by:** P1B.4
- **Blocks:** P3A.2, P3A.3, P3A.4

#### Acceptance Criteria
- [ ] Schema JSON captured per Base on every run
- [ ] Includes: tables, fields (name, type, options), views, relationships
- [ ] Stored alongside Backup Snapshot under `/schema/{run-id}.json` in R2

#### Testing
- Integration: multi-base backup → schema JSON matches Airtable API output.

---

### [P3A.2] Schema Changelog (diff per run)

**Repo:** `baseout-backup-engine` · **Milestone:** V1 · **Phase:** 3A · **Capability:** schema
**Labels:** `phase:3`, `milestone:v1`, `repo:baseout-backup-engine`, `capability:schema`, `tier-gate:launch+`

#### Context
Per PRD §3.2, every backup diffs its schema against the previous snapshot and stores a human-readable change set (e.g. "Field X was deleted on 2026-04-20").

#### Canonical Terms
Changelog.

#### Dependencies
- **Blocked by:** P3A.1
- **Blocks:** P3A.3

#### Acceptance Criteria
- [ ] Diff algorithm: added / removed / renamed / type-changed at Field + Table level
- [ ] Human-readable strings generated with timestamp
- [ ] Stored in master DB `schema_changelog` with `space_id`, `run_id`, `entries[]`
- [ ] Retention per tier (Features §4.1: 90d Starter → 24mo Business → custom Enterprise)

#### Testing
- Unit: diff algorithm across 10 scenarios.
- Integration: two runs over changed base → changelog entries match.

---

### [P3A.3] Schema visualization UI (React Flow)

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 3A · **Capability:** schema
**Labels:** `phase:3`, `milestone:v1`, `repo:baseout-web`, `capability:schema`, `tier-gate:launch+`

#### Context
Auto-generated Schema diagram + ERD hybrid (React Flow or equivalent). Pre-auth visualization available per P1A.5 for conversion hook.

#### Spec References
- PRD §3.1 (visualization)
- PRD §6.6 (pre-auth flow)

#### Dependencies
- **Blocked by:** P3A.1, P1A.5
- **Blocks:** P3A.6

#### Acceptance Criteria
- [ ] Node per Table with collapsible Field list
- [ ] Edges for linked-record relationships
- [ ] Filter by Field type / relationship
- [ ] Zoom / pan / minimap
- [ ] Read-only (write-back is V2)

#### Testing
- Playwright: render against a sample 5-table base; relationships correct.

---

### [P3A.4] Health Score algorithm

**Repo:** `baseout-backup-engine` + `baseout-web` · **Milestone:** V1 · **Phase:** 3A · **Capability:** schema
**Labels:** `phase:3`, `milestone:v1`, `repo:baseout-web`, `capability:schema`, `tier-gate:launch+`

#### Context
0–100 weighted score per Base. Green ≥ 90, Yellow 60–89, Red < 60 (PRD §3.3). Rules: orphaned tables, unused fields, circular lookups, missing descriptions, formula errors, duplicate names, unused linked fields.

#### Dependencies
- **Blocked by:** P3A.1
- **Blocks:** P3A.5

#### Acceptance Criteria
- [ ] Pluggable rule registry (one function per rule returning score + weight)
- [ ] Default weights documented
- [ ] Score persisted per run in `schema_health`
- [ ] Unit coverage ≥ 90% for rule engine

#### Testing
- Unit: fixtures for each rule hit / miss.

---

### [P3A.5] Health Score display + configurable rules (Pro+)

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 3A · **Capability:** schema
**Labels:** `phase:3`, `milestone:v1`, `repo:baseout-web`, `capability:schema`, `tier-gate:launch+`

#### Context
Score shown on dashboard per Base with drill-down into failing rules. Pro+ can customize weights / enable-disable rules (Features §15).

#### Dependencies
- **Blocked by:** P3A.4
- **Blocks:** none

#### Acceptance Criteria
- [ ] Score widget on dashboard per Base with color state
- [ ] Detail drawer lists rule results
- [ ] Pro+ settings page: rule toggles + weight sliders
- [ ] Tier gate: Launch+ read-only; Pro+ configurable

#### Testing
- Playwright: Pro tier fixture → toggle rule → score recomputes.

---

### [P3A.6] Diagram export (PNG / SVG / PDF / embed)

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 3A · **Capability:** schema
**Labels:** `phase:3`, `milestone:v1`, `repo:baseout-web`, `capability:schema`, `tier-gate:growth+`

#### Context
Per PRD §11 open-question resolution: PNG (Growth), SVG (Pro), PDF (Business), embed widget (Enterprise). Tier gate enforced server-side.

#### Dependencies
- **Blocked by:** P3A.3
- **Blocks:** none

#### Acceptance Criteria
- [ ] Export button with tier-aware options
- [ ] PNG via canvas render; SVG via React Flow export; PDF via print-to-PDF
- [ ] Embed widget served at `/embed/schema/:space-id/:snapshot-id` with signed URL
- [ ] Tier check in API route (capability resolver)

#### Testing
- Integration: per-tier fixture → allowed formats match.

---

### [P3B.1] D1 provisioning on first backup run

**Repo:** `baseout-backup-engine` · **Milestone:** V1 · **Phase:** 3B · **Capability:** backup
**Labels:** `phase:3`, `milestone:v1`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:launch+`

#### Context
Launch: D1 schema-only. Growth: D1 full data (PRD §5.2). Provisioned lazily on first run.

#### Canonical Terms
D1, Dynamic Backup, Database Tier.

#### Dependencies
- **Blocked by:** P0.5, P0.7
- **Blocks:** P3B.2, P3B.6

#### Acceptance Criteria
- [ ] First Backup Run on Launch+: creates D1 DB via Cloudflare API
- [ ] Metadata stored in master DB `space_databases` (new table)
- [ ] Schema-only mode writes schema + changelog; Growth+ also writes records
- [ ] Quota per tier enforced (D1 size limits from Features §4.1)

#### Testing
- Integration: Launch tier fixture → provisions D1, writes schema only.

---

### [P3B.2] D1 → Postgres migration tooling

**Repo:** `baseout-backup-engine` · **Milestone:** V1 · **Phase:** 3B · **Capability:** backup
**Labels:** `phase:3`, `milestone:v1`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:new-sql-surface`, `tier-gate:pro+`

#### Context
On upgrade from Growth → Pro+, data migrates from D1 to Shared Postgres. Backups paused during migration; validation before re-enable (PRD §5.3).

#### Dependencies
- **Blocked by:** P3B.1, P3B.3
- **Blocks:** P4A.2

#### Acceptance Criteria
- [ ] Migration job: dump D1 → stream to PG with type mapping
- [ ] Backup Runs blocked during migration (state machine)
- [ ] Post-migration: row-count validation per table; mismatch = abort + rollback
- [ ] Idempotent on retry

#### Security 🔒
- Neither D1 nor PG credentials logged.
- PG connection via Cloudflare Secrets.

#### Testing
- Integration: seed D1 → migrate → row counts match.

---

### [P3B.3] Shared Postgres provisioning (Pro+)

**Repo:** `baseout-backup-engine` · **Milestone:** V1 · **Phase:** 3B · **Capability:** backup
**Labels:** `phase:3`, `milestone:v1`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:pro+`

#### Context
Pro tier uses DigitalOcean Shared PG with schema-level isolation per Space (PRD §5.2 / Features §4.3).

#### Canonical Terms
Shared PostgreSQL, Database Tier.

#### Dependencies
- **Blocked by:** P3B.1
- **Blocks:** P3B.2, P3B.4

#### Acceptance Criteria
- [ ] Allocation algorithm: fit Spaces into Shared PG instances by usage
- [ ] Per-Space Postgres schema (`space_<uuid>`) with owned role
- [ ] Role permissions: write from engine; read-only for SQL REST (P5.6)
- [ ] Connection string per Space stored encrypted in `space_databases`

#### Testing
- Integration: provision 2 Spaces on same instance → isolated schemas.

---

### [P3B.4] Dedicated Postgres provisioning (Business+)

**Repo:** `baseout-backup-engine` · **Milestone:** V1 · **Phase:** 3B · **Capability:** backup
**Labels:** `phase:3`, `milestone:v1`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:business+`

#### Context
One DB per Space on Neon / Supabase / DigitalOcean (PRD §5.2 / Features §4.3).

#### Canonical Terms
Dedicated PostgreSQL.

#### Dependencies
- **Blocked by:** P3B.3
- **Blocks:** P3B.5, P5.7

#### Acceptance Criteria
- [ ] Provider-agnostic interface; default provider = Neon
- [ ] Per-Space DB with owner role; stored in `space_databases`
- [ ] Encrypted connection string (AES-256-GCM)

#### Testing
- Integration: provision on Neon sandbox.

---

### [P3B.5] BYODB support (Enterprise)

**Repo:** `baseout-backup-engine` · **Milestone:** V1 · **Phase:** 3B · **Capability:** backup
**Labels:** `phase:3`, `milestone:v1`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:new-sql-surface`, `tier-gate:enterprise`

#### Context
Customer provides a Postgres connection string. Baseout writes; customer controls hosting (PRD §5.2).

#### Canonical Terms
BYODB.

#### Dependencies
- **Blocked by:** P3B.4
- **Blocks:** P5.7

#### Acceptance Criteria
- [ ] Settings UI to paste connection string (masked); validate on save
- [ ] Pre-write checks: connectivity, write permission, schema migration tolerance
- [ ] Connection string encrypted at rest; never shown to support staff

#### Security 🔒
- SSL required; reject plaintext.
- Audit every successful + failed BYODB connect.

#### Testing
- Integration: customer-like sandbox with intentional partial permissions → clear errors.

---

### [P3B.6] Webhook-based incremental backup

**Repo:** `baseout-backup-engine` · **Milestone:** V1 · **Phase:** 3B · **Capability:** backup
**Labels:** `phase:3`, `milestone:v1`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:pro+`

#### Context
Pro+ Instant Backup (Features §4). Ingest Airtable webhooks, write to change log, fall back to full re-read if a gap is detected (PRD §2.3).

#### Canonical Terms
Instant Backup, Changelog.

#### Dependencies
- **Blocked by:** P2C.1, P3B.3
- **Blocks:** P5.1 (data capability downstream)

#### Acceptance Criteria
- [ ] Webhook ingestion endpoint with signature verification
- [ ] Change events persisted to per-Space change log
- [ ] Sync job applies change log to dynamic DB
- [ ] Gap detection: if payload IDs non-contiguous → trigger full re-read

#### Security 🔒
- Verify Airtable webhook signature on every event.
- Rate-limit per Connection.

#### Testing
- Integration: simulate webhook stream + synthetic gap → full re-read triggered.

---

## Epic 5 — Phase 4: Billing, Upgrade Flows & On2Air Migration [V1]

**Milestone:** V1 · **Primary repos:** `baseout-web` · **Plan ref:** Phase 4.

**Goal:** trial → paid, upgrade/downgrade, overages, and On2Air migration all operational. MVP public-launch-readiness per Plan.

**Entry criteria:** Phase 3 complete. **Exit criteria:** Stripe events fully round-trip; On2Air users can complete migration without manual ops intervention.

**Parallelization:** 4A (Stripe) and 4B (On2Air) proceed in parallel; both require P4A.5 capability resolver.

### Child issues (4A — Stripe billing)
- [ ] [P4A.1] Trial → paid upgrade flow — `baseout-web` · billing · 🔒
- [ ] [P4A.2] Plan upgrade / downgrade UI — `baseout-web` · billing
- [ ] [P4A.3] Overage tracking + billing — `baseout-web` · billing
- [ ] [P4A.4] Subscription webhook handler — `baseout-web` · billing · 🔒
- [ ] [P4A.5] Capability resolution from Stripe metadata — `baseout-web` · billing

### Child issues (4B — On2Air migration)
- [ ] [P4B.1] Backend migration script (tier map + Organizations) — `baseout-web` · billing · 🔒
- [ ] [P4B.2] "Complete Your Migration" screen — `baseout-web` · ux
- [ ] [P4B.3] Migration complete confirmation — `baseout-web` · ux
- [ ] [P4B.4] Legacy encryption decryption + re-encrypt — `baseout-web` · auth · 🔒

---

### [P4A.1] Trial → paid upgrade flow

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 4A · **Capability:** billing
**Labels:** `phase:4`, `milestone:v1`, `repo:baseout-web`, `capability:billing`, `🔒 security:auth-path`, `tier-gate:all`

#### Context
At trial expiry (or before), user enters card and converts the $0 Subscription item to a paid Price (Features §5.5.3). Keeps the same Subscription; only the item swaps.

#### Spec References
- Features §5.5.3 (subscription architecture)
- PRD §8.3

#### Dependencies
- **Blocked by:** P1A.3, P2C.5, P4A.5
- **Blocks:** P4A.2

#### Acceptance Criteria
- [ ] Card capture via Stripe Elements or Checkout
- [ ] Swap the Airtable subscription item to the chosen tier's Price
- [ ] Persist Subscription state transition; fire confirmation email (P2D.1)
- [ ] Unlock caps in capability resolver

#### Security 🔒
- Card PAN never touches Baseout servers.

#### Testing
- Playwright: trial account → upgrade → paid state visible → run uncapped backup.

---

### [P4A.2] Plan upgrade / downgrade UI

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 4A · **Capability:** billing
**Labels:** `phase:4`, `milestone:v1`, `repo:baseout-web`, `capability:billing`, `tier-gate:all`

#### Context
Billing page with tier matrix (Features §4). Immediate on upgrade; end-of-period on downgrade (Features §5.5.3).

#### Dependencies
- **Blocked by:** P4A.1, P3B.2
- **Blocks:** none

#### Acceptance Criteria
- [ ] Tier comparison table with current tier highlighted
- [ ] Upgrade: proration handled by Stripe; applies immediately
- [ ] Downgrade: scheduled for end-of-period; confirmation required
- [ ] DB tier migration triggered when crossing D1 ↔ PG boundary (P3B.2)

#### Testing
- Integration: upgrade + downgrade path; Stripe invoice preview matches.

---

### [P4A.3] Overage tracking + billing

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 4A · **Capability:** billing
**Labels:** `phase:4`, `milestone:v1`, `repo:baseout-web`, `capability:billing`, `tier-gate:all`

#### Context
Monitor usage vs caps; post overage via Stripe usage records when on `auto` mode (Features §5.1 / §5.3).

#### Dependencies
- **Blocked by:** P2C.6, P4A.5
- **Blocks:** none

#### Acceptance Criteria
- [ ] Usage computed daily per metric
- [ ] `cap` mode: block at limit (default)
- [ ] `auto` mode: meter excess via Stripe usage records
- [ ] Optional monthly overage cap honored

#### Testing
- Integration: `auto` mode + synthetic overage → Stripe usage record written once.

---

### [P4A.4] Subscription webhook handler

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 4A · **Capability:** billing
**Labels:** `phase:4`, `milestone:v1`, `repo:baseout-web`, `capability:billing`, `🔒 security:auth-path`, `tier-gate:all`

#### Context
Persist Stripe-authoritative state: `payment_succeeded`, `payment_failed`, `customer.subscription.updated`, `.deleted`, `.trial_will_end` (Features §5.5).

#### Dependencies
- **Blocked by:** P0.11
- **Blocks:** P4A.1, P4A.5

#### Acceptance Criteria
- [ ] `/api/stripe/webhook` verifies signature
- [ ] Events upsert `subscriptions` state (tier, status, period end)
- [ ] Failed-payment dunning: 3 retries (Stripe default), then email + pause Backup Runs
- [ ] Idempotency on replayed events

#### Security 🔒
- Signature verification mandatory; unsigned = 400 + alert.

#### Testing
- Integration: `stripe trigger` each event → DB transitions match expectations.

---

### [P4A.5] Capability resolution from Stripe metadata

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 4A · **Capability:** billing
**Labels:** `phase:4`, `milestone:v1`, `repo:baseout-web`, `capability:billing`, `tier-gate:all`

#### Context
Per Features §5.5.4 — every capability gate reads `platform` + `tier` from Stripe product metadata. **Never** parses product name strings. Must be in place before Phase 5 premium capabilities.

#### Spec References
- Features §5.5.4 (capability resolution)
- CLAUDE.md §0 (spec rule: gate from metadata)

#### Dependencies
- **Blocked by:** P0.11, P4A.4
- **Blocks:** every tier-gated feature

#### Acceptance Criteria
- [ ] `src/lib/capabilities.ts` single source of truth
- [ ] Function `resolveCapabilities(orgId, platform)` returns a typed object
- [ ] Cache with 60s TTL; invalidated on webhook receipt
- [ ] Unit tests for every tier × capability combination
- [ ] Lint rule / grep check: no references to product name strings in capability logic

#### Testing
- Unit: matrix of tier × platform × capability matches Features §4 table.

---

### [P4B.1] Backend migration script (tier map + Organizations)

**Repo:** `baseout-web` (`scripts/`) · **Milestone:** V1 · **Phase:** 4B · **Capability:** billing
**Labels:** `phase:4`, `milestone:v1`, `repo:baseout-web`, `capability:billing`, `🔒 security:new-sql-surface`, `tier-gate:all`

#### Context
Bulk-import On2Air customers: map to Baseout tiers by usage, create Organizations + Users, attach Stripe Customers, set `dynamic_locked=true` and grandfathered pricing (PRD §8.4).

#### Dependencies
- **Blocked by:** P0.7, P4A.5, P4B.4
- **Blocks:** P4B.2

#### Acceptance Criteria
- [ ] Dry-run mode: prints planned changes without writing
- [ ] Real run: idempotent by On2Air customer ID
- [ ] Sets `has_migrated=false` + `dynamic_locked=true` on migrated Orgs
- [ ] Stripe Customer created with grandfathered Price applied

#### Security 🔒
- Script runs only with a scoped DB role; cannot drop tables.

#### Testing
- Integration: fixture On2Air export → runs → assertions on created rows.

---

### [P4B.2] "Complete Your Migration" screen

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 4B · **Capability:** ux
**Labels:** `phase:4`, `milestone:v1`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`

#### Context
First-login UX for On2Air users: re-auth Airtable + Storage Destination. Backups blocked until complete (PRD §8.4).

#### Dependencies
- **Blocked by:** P4B.1, P1B.1, P1D.*
- **Blocks:** P4B.3

#### Acceptance Criteria
- [ ] Detects `has_migrated=false` on sign-in; redirects to migration flow
- [ ] Steps: verify identity → reconnect Airtable → reconnect Storage → confirm
- [ ] Backup Runs disabled until all steps green

#### Testing
- Playwright: migrated fixture user → full flow → dashboard accessible.

---

### [P4B.3] Migration complete confirmation

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 4B · **Capability:** ux
**Labels:** `phase:4`, `milestone:v1`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`

#### Context
Final screen: sets `has_migrated=true`, unlocks dashboard, sends "welcome back" email (P2D.1).

#### Dependencies
- **Blocked by:** P4B.2
- **Blocks:** none

#### Acceptance Criteria
- [ ] `has_migrated=true` persisted
- [ ] Email dispatched
- [ ] Dashboard redirect

#### Testing
- Integration: final step → DB flag flipped, email queued.

---

### [P4B.4] Legacy encryption decryption + re-encrypt

**Repo:** `baseout-web` (script) · **Milestone:** V1 · **Phase:** 4B · **Capability:** auth
**Labels:** `phase:4`, `milestone:v1`, `repo:baseout-web`, `capability:auth`, `🔒 security:encryption`, `tier-gate:all`

#### Context
On2Air stored OAuth tokens under a legacy key. During migration, decrypt and re-encrypt under `MASTER_ENCRYPTION_KEY` (AES-256-GCM) (PRD §20.2).

#### Dependencies
- **Blocked by:** P0.8
- **Blocks:** P4B.1

#### Acceptance Criteria
- [ ] Legacy key accepted via secret `LEGACY_ENCRYPTION_KEY` (time-bound, removed post-migration)
- [ ] Per-record re-encryption routine with audit log
- [ ] Failure surfaces exact record ID; never writes partial/corrupt value

#### Security 🔒
- Legacy key scoped to migration env only; not in prod runtime post-completion.
- Audit log of every decrypt/re-encrypt event.

#### Testing
- Integration: synthetic legacy fixture → re-encrypted successfully; roundtrips decrypt.

---

## Epic 6 — Phase 5: Advanced Capabilities & Pro+ Features [V1]

**Milestone:** V1 · **Primary repos:** `baseout-web`, `baseout-backup-engine` · **Plan ref:** Phase 5.

**Goal:** Data / Automations / Interfaces intake, SQL surfaces, AI-assisted documentation, Slack notifications, Airtable Enterprise variant, community restore tooling. These are the Pro+ value drivers and the last features before pre-launch hardening.

**Entry criteria:** Phase 4 complete. **Exit criteria:** every Pro+/Business+/Enterprise-gated capability deployed and covered by tests; SQL surfaces pass security review.

**Parallelization:** most items are independent — can run in parallel across 2–3 contributors.

### Child issues
- [ ] [P5.1] Data capability — record metrics, changelog, growth trends — `baseout-web` · data · `growth+`
- [ ] [P5.2] Automations backup — manual form intake UI — `baseout-web` · automations · `growth+`
- [ ] [P5.3] Interfaces backup — manual form intake UI — `baseout-web` · interfaces · `growth+`
- [ ] [P5.4] Inbound API endpoint — `baseout-web` · integrations · 🔒 · `growth+`
- [ ] [P5.5] Inbound API token management UI — `baseout-web` · integrations · 🔒 · `growth+`
- [ ] [P5.6] SQL REST API (custom Worker over Postgres) — engine · integrations · 🔒 · `pro+`
- [ ] [P5.7] Direct SQL Access — connection string UI — `baseout-web` · integrations · 🔒 · `business+`
- [ ] [P5.8] AI-Assisted Documentation (Cloudflare AI) — `baseout-web` · ai · `pro+`
- [ ] [P5.9] Slack notification integration — `baseout-web` · integrations · 🔒 · `pro+`
- [ ] [P5.10] Airtable Enterprise connection variant — engine · auth · 🔒 · `enterprise`
- [ ] [P5.11] Community Restore Tooling (AI prompts) — `baseout-web` · restore · `pro+`

---

### [P5.1] Data capability — metrics, changelog, growth trends

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 5 · **Capability:** data
**Labels:** `phase:5`, `milestone:v1`, `repo:baseout-web`, `capability:data`, `tier-gate:growth+`

#### Context
Per PRD §8 / Features §15, Growth+ users get record count trends, storage growth, table-size history, and a data changelog derived from Dynamic Backup.

#### Dependencies
- **Blocked by:** P3B.1, P3B.6
- **Blocks:** none

#### Acceptance Criteria
- [ ] Per-Base metrics: record count history, storage growth, table sizes
- [ ] Data changelog (additions, deletions, edits) with 6-month retention on Growth
- [ ] Dashboard chart widgets (`baseout-ui`)

#### Testing
- Integration: simulated multi-run data → trend chart renders correctly.

---

### [P5.2] Automations backup — manual form intake UI

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 5 · **Capability:** automations
**Labels:** `phase:5`, `milestone:v1`, `repo:baseout-web`, `capability:automations`, `tier-gate:growth+`

#### Context
Airtable REST API does not expose Automations. Growth+ users submit via Baseout-provided form per PRD §7.1 / §9.

#### Canonical Terms
Automation.

#### Dependencies
- **Blocked by:** P1A.4, P3B.3
- **Blocks:** none

#### Acceptance Criteria
- [ ] Form to declare Automations per Base: name, trigger, actions, schedule
- [ ] Stored in Dynamic DB `automations` table
- [ ] Changelog maintained on edits

#### Testing
- Integration: submit → persist → list view renders.

---

### [P5.3] Interfaces backup — manual form intake UI

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 5 · **Capability:** interfaces
**Labels:** `phase:5`, `milestone:v1`, `repo:baseout-web`, `capability:interfaces`, `tier-gate:growth+`

#### Context
Same shape as Automations but for Interfaces (PRD §10).

#### Canonical Terms
Interface.

#### Dependencies
- **Blocked by:** P1A.4, P3B.3
- **Blocks:** none

#### Acceptance Criteria
- [ ] Form to declare Interfaces: name, pages, widgets
- [ ] Stored in Dynamic DB `interfaces` table
- [ ] Changelog maintained

#### Testing
- Integration: submit → persist → list view.

---

### [P5.4] Inbound API endpoint

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 5 · **Capability:** integrations
**Labels:** `phase:5`, `milestone:v1`, `repo:baseout-web`, `capability:integrations`, `🔒 security:new-sql-surface`, `tier-gate:growth+`

#### Context
Public, documented API (PRD §7.1, §15) for Automations/Interfaces/synced-table payloads — drives data into Baseout from Airtable Scripts, Automations, and custom agents.

#### Spec References
- PRD §7.1 (Inbound API)
- Features §14.2 (rate limits: 50K/200K/∞ per tier)

#### Dependencies
- **Blocked by:** P0.7, P4A.5
- **Blocks:** P5.5

#### Acceptance Criteria
- [ ] `POST /api/v1/inbound/:spaceId/:resource` accepts typed payloads
- [ ] Bearer token auth; token hash stored (PRD §21.3 `api_tokens.token_hash`)
- [ ] Tier-enforced rate limit
- [ ] Idempotency-Key header honored
- [ ] OpenAPI spec generated at `/api/v1/openapi.json`

#### Security 🔒
- Token hash stored, never plaintext.
- Per-Space scope enforced in every handler.

#### Testing
- Integration: wrong-space token → 403; correct token → 201.

---

### [P5.5] Inbound API token management UI

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 5 · **Capability:** integrations
**Labels:** `phase:5`, `milestone:v1`, `repo:baseout-web`, `capability:integrations`, `🔒 security:new-secret`, `tier-gate:growth+`

#### Context
Users create, view (once), rotate, revoke per-Space API tokens (PRD §7.1).

#### Dependencies
- **Blocked by:** P5.4
- **Blocks:** none

#### Acceptance Criteria
- [ ] Token creation shows plaintext value exactly once, then hash only
- [ ] List view shows name, `last_used_at`, created-by, revoke button
- [ ] Revoke is immediate; all in-flight requests with that token fail

#### Security 🔒
- Copy-to-clipboard on creation; never logged.

#### Testing
- Playwright: create → use → revoke → subsequent call 401.

---

### [P5.6] SQL REST API (custom Worker over Postgres)

**Repo:** `baseout-backup-engine` · **Milestone:** V1 · **Phase:** 5 · **Capability:** integrations
**Labels:** `phase:5`, `milestone:v1`, `repo:baseout-backup-engine`, `capability:integrations`, `🔒 security:new-sql-surface`, `tier-gate:pro+`

#### Context
Pro+ SQL REST (Features §14.2): authenticated queries against the Dynamic DB. **Read-only by default** (per CLAUDE.md §2).

#### Dependencies
- **Blocked by:** P3B.3, P4A.5, P5.4
- **Blocks:** none

#### Acceptance Criteria
- [ ] Custom Worker accepts parametrized `SELECT` queries
- [ ] Bearer token authz via `api_tokens`
- [ ] Rate limit per tier: 10K / 50K / ∞ queries/mo
- [ ] Query timeout (e.g. 10s); row limit (e.g. 10K)
- [ ] Reject `INSERT`/`UPDATE`/`DELETE`/`DDL` by default — write access is an explicit opt-in at Space level

#### Security 🔒
- Parameterized queries only.
- Per-Space Postgres role with SELECT-only grants.
- Query log (sanitized) for abuse detection.

#### Testing
- Integration: SELECT works, write attempts rejected, row limit enforced.

---

### [P5.7] Direct SQL Access — connection string UI

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 5 · **Capability:** integrations
**Labels:** `phase:5`, `milestone:v1`, `repo:baseout-web`, `capability:integrations`, `🔒 security:new-sql-surface`, `tier-gate:business+`

#### Context
Business+ direct-SQL connection strings (Features §14.2). Read-only default; write opt-in per Space (Enterprise).

#### Canonical Terms
Dedicated PostgreSQL, BYODB.

#### Dependencies
- **Blocked by:** P3B.4, P3B.5
- **Blocks:** none

#### Acceptance Criteria
- [ ] Settings page generates a scoped connection string per Space
- [ ] Read-only role used by default; write role gated by Enterprise + opt-in toggle
- [ ] Rotation + revoke
- [ ] IP allowlist field

#### Security 🔒
- Credentials shown once; reminder displayed.
- Audit every rotation and opt-in toggle.

#### Testing
- Integration: connection accepted by `psql` with read role; writes denied.

---

### [P5.8] AI-Assisted Documentation (Cloudflare AI)

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 5 · **Capability:** ai
**Labels:** `phase:5`, `milestone:v1`, `repo:baseout-web`, `capability:ai`, `tier-gate:pro+`

#### Context
Per PRD §3.5 / Features §16, Pro+ users generate schema/field descriptions via an open-source model on Cloudflare AI.

#### Dependencies
- **Blocked by:** P3A.1, P4A.5
- **Blocks:** none

#### Acceptance Criteria
- [ ] Per-Base "Generate documentation" action
- [ ] Prompt feeds schema JSON; output saved alongside schema
- [ ] User can edit AI output before saving
- [ ] No PII / record data in prompt payload

#### Testing
- Integration: fixture schema → output persists and renders.

---

### [P5.9] Slack notification integration

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 5 · **Capability:** integrations
**Labels:** `phase:5`, `milestone:v1`, `repo:baseout-web`, `capability:integrations`, `🔒 security:auth-path`, `tier-gate:pro+`

#### Context
Pro+ users receive notifications (backup failures, quota, dead connection) in Slack (Features §16.1).

#### Dependencies
- **Blocked by:** P2C.*, P4A.5
- **Blocks:** none

#### Acceptance Criteria
- [ ] Slack OAuth install flow; encrypted webhook URL stored
- [ ] Per-Org channel selection
- [ ] Notification types toggleable

#### Security 🔒
- Webhook URL encrypted.
- Revocation on Slack-side handled gracefully.

#### Testing
- Integration: triggered alert reaches test Slack workspace.

---

### [P5.10] Airtable Enterprise connection variant

**Repo:** `baseout-backup-engine` · **Milestone:** V1 · **Phase:** 5 · **Capability:** auth
**Labels:** `phase:5`, `milestone:v1`, `repo:baseout-backup-engine`, `capability:auth`, `🔒 security:auth-path`, `tier-gate:enterprise`

#### Context
Enterprise tier uses Airtable Enterprise API for org-level metadata + user management (Features §15).

#### Dependencies
- **Blocked by:** P1B.1
- **Blocks:** none

#### Acceptance Criteria
- [ ] Enterprise scope selectable at OAuth time
- [ ] Enterprise-only endpoints used where available (users, workspaces)
- [ ] Gracefully downgrades if scope not granted

#### Testing
- Integration with an Enterprise Airtable sandbox.

---

### [P5.11] Community Restore Tooling (AI prompts)

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 5 · **Capability:** restore
**Labels:** `phase:5`, `milestone:v1`, `repo:baseout-web`, `capability:restore`, `tier-gate:pro+`

#### Context
Per PRD §2.8, Pro+ users get AI-generated prompts to rebuild Automations/Interfaces manually (since Airtable has no API for them).

#### Dependencies
- **Blocked by:** P5.2, P5.3, P5.8
- **Blocks:** none

#### Acceptance Criteria
- [ ] Export AI prompt from a snapshot's Automations/Interfaces manifest
- [ ] Copy-to-clipboard + download as `.md`
- [ ] Version controlled (updatable as prompt library improves)

#### Testing
- Unit: prompt generator fixture test.

---

## Epic 7 — Phase 6: Admin App, Observability & Pre-Launch Hardening [V1]

**Milestone:** V1 · **Primary repos:** `baseout-admin`, `baseout-web`, `infra` · **Plan ref:** Phase 6.

**Goal:** ship production-readiness — super-admin app, email+password + 2FA + SSO, observability stack, load testing, security review, marketplace listing.

**Entry criteria:** Phase 5 complete. **Exit criteria:** every item in PRD §22 Definition of Done is green.

**Parallelization:** P6.1 / P6.2–P6.4 / P6.5 / P6.6 / P6.10 / P6.11 / P6.12 can proceed in parallel. P6.7 + P6.8 + P6.13 are the final go/no-go gate.

### Child issues
- [ ] [P6.1] Super-admin app — `baseout-admin` · admin
- [ ] [P6.2] Email + password auth — `baseout-web` · auth · 🔒
- [ ] [P6.3] 2FA (TOTP) — `baseout-web` · auth · 🔒
- [ ] [P6.4] SSO (SAML, Enterprise) — `baseout-web` · auth · 🔒
- [ ] [P6.5] Cloudflare observability setup — `infra` · observability
- [ ] [P6.6] E2E Playwright test suite — `baseout-web` · ci-cd
- [ ] [P6.7] Load / stress testing — engine · observability
- [ ] [P6.8] Security review — all · 🔒
- [ ] [P6.9] dub.co referral tracking setup — `infra` · integrations
- [ ] [P6.10] PostHog setup (EU cloud) — `baseout-web` · observability
- [ ] [P6.11] Guided tours (Shepherd.js) — `baseout-web` · ux
- [ ] [P6.12] Tooltips (Floating UI) — `baseout-web` · ux
- [ ] [P6.13] Airtable Marketplace listing submission — external · admin

---

### [P6.1] Super-admin app

**Repo:** `baseout-admin` · **Milestone:** V1 · **Phase:** 6 · **Capability:** admin
**Labels:** `phase:6`, `milestone:v1`, `repo:baseout-admin`, `capability:admin`, `🔒 security:auth-path`, `tier-gate:all`

#### Context
Separate Astro app (PRD §16.1): tracks Organizations, Spaces, Subscriptions, Backup Runs, database provisioning, connection health, migrations, errors. Super-admin role only.

#### Spec References
- PRD §16.1 (super-admin capabilities)

#### Dependencies
- **Blocked by:** P0.4, P0.9, P1A.4
- **Blocks:** P6.13

#### Acceptance Criteria
- [ ] Deployed to Cloudflare Pages at `admin.baseout.com`
- [ ] Super-admin role enforced in middleware + at UI routes
- [ ] Views: Organizations, Spaces, Subscriptions, DB provisioning tracker, connection health, background service monitor, On2Air migration status, audit log search
- [ ] Manual actions: force backup, invalidate connection, reset trial, adjust plan
- [ ] Every admin action writes an audit log row

#### Security 🔒
- Access restricted to allow-listed emails; MFA mandatory.

#### Testing
- Playwright: non-admin → 403; admin → all views.

---

### [P6.2] Email + password auth

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 6 · **Capability:** auth
**Labels:** `phase:6`, `milestone:v1`, `repo:baseout-web`, `capability:auth`, `🔒 security:auth-path`, `tier-gate:all`

#### Context
Added before public launch (PRD §13.2). better-auth password provider; bcrypt via library defaults.

#### Dependencies
- **Blocked by:** P1A.1
- **Blocks:** P6.3

#### Acceptance Criteria
- [ ] Sign-up + sign-in with email/password
- [ ] Password reset flow via email (P2D.1 template exists)
- [ ] Strength requirements (min 12 chars; common-password deny list)
- [ ] Works alongside magic link (users can have either)

#### Security 🔒
- Rate-limit failed attempts.
- Audit log on every sign-in attempt.

#### Testing
- Playwright: sign up, sign in, reset.

---

### [P6.3] 2FA (TOTP)

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 6 · **Capability:** auth
**Labels:** `phase:6`, `milestone:v1`, `repo:baseout-web`, `capability:auth`, `🔒 security:auth-path`, `tier-gate:all`

#### Context
TOTP (authenticator apps) per PRD §13.4. Optional for Starter; required for Enterprise (per policy).

#### Dependencies
- **Blocked by:** P6.2
- **Blocks:** none

#### Acceptance Criteria
- [ ] Enrollment flow with QR + backup codes
- [ ] Enforcement at sign-in
- [ ] Recovery via backup codes or admin reset (P6.1)

#### Security 🔒
- Backup codes hashed at rest.

#### Testing
- Playwright: enroll → sign-out → sign-in requires TOTP.

---

### [P6.4] SSO (SAML, Enterprise)

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 6 · **Capability:** auth
**Labels:** `phase:6`, `milestone:v1`, `repo:baseout-web`, `capability:auth`, `🔒 security:auth-path`, `tier-gate:enterprise`

#### Context
Enterprise tier SAML SSO per PRD §13.3. better-auth SSO plugin or equivalent.

#### Dependencies
- **Blocked by:** P6.2
- **Blocks:** none

#### Acceptance Criteria
- [ ] IdP-agnostic SAML config per Organization
- [ ] Metadata URL + certificate upload
- [ ] JIT user provisioning (role from IdP attribute)
- [ ] Tier-gated to Enterprise in capability resolver

#### Security 🔒
- Certificates validated; SAML assertions signed.

#### Testing
- Integration with a mock IdP (e.g. samltest.id).

---

### [P6.5] Cloudflare observability setup

**Repo:** `infra` · **Milestone:** V1 · **Phase:** 6 · **Capability:** observability
**Labels:** `phase:6`, `milestone:v1`, `repo:infra`, `capability:observability`, `tier-gate:all`

#### Context
PRD §16.2: Tail Workers, Logpush to R2 (or external), Health Checks. Error budgets documented.

#### Dependencies
- **Blocked by:** P0.6
- **Blocks:** P6.8, P6.13

#### Acceptance Criteria
- [ ] Tail Worker captures errors from all prod Workers → structured log pipeline
- [ ] Logpush stream to R2 bucket (90d retention)
- [ ] Health Checks for each Worker + Pages site with PagerDuty integration
- [ ] Dashboard URL documented in admin app

#### Testing
- Trigger a synthetic error → shows up in pipeline within 60s.

---

### [P6.6] E2E Playwright test suite

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 6 · **Capability:** ci-cd
**Labels:** `phase:6`, `milestone:v1`, `repo:baseout-web`, `capability:ci-cd`, `testing:needs-e2e`, `tier-gate:all`

#### Context
Per PRD §14.3, critical flows must be covered by Playwright against staging.

#### Dependencies
- **Blocked by:** everything Phase 1–5
- **Blocks:** P6.13

#### Acceptance Criteria
- [ ] Signup → magic link → onboarding → first backup (trial-capped)
- [ ] Trial cap hit → upgrade → credit card → full backups
- [ ] Backup → restore to new Base
- [ ] On2Air migration → Complete Migration → re-auth → backup resumes
- [ ] Dead connection → notification → re-auth → restored
- [ ] Schema visualization loads for multi-base Space
- [ ] Playwright integrated into CI; staging deploy triggers the suite

#### Testing
- The suite itself **is** the verification — must be green on staging before any prod deploy.

---

### [P6.7] Load / stress testing

**Repo:** `baseout-backup-engine` · **Milestone:** V1 · **Phase:** 6 · **Capability:** observability
**Labels:** `phase:6`, `milestone:v1`, `repo:baseout-backup-engine`, `capability:observability`, `tier-gate:all`

#### Context
Simulate concurrent Backup Runs to validate Durable Object behavior, connection locks (P1B.3), and rate-limit handling.

#### Dependencies
- **Blocked by:** P1B.*, P3B.*
- **Blocks:** P6.13

#### Acceptance Criteria
- [ ] Load harness: N concurrent Spaces × M bases with realistic Airtable API latency
- [ ] Targets: handle ≥ 500 concurrent runs without lost state
- [ ] Report: p95 / p99 of run duration, failure rate, DO CPU and memory
- [ ] Findings fed back as issues (not part of this ticket)

#### Testing
- The harness runs against staging; results attached to PR.

---

### [P6.8] Security review

**Repo:** all (meta) · **Milestone:** V1 · **Phase:** 6 · **Capability:** admin
**Labels:** `phase:6`, `milestone:v1`, `capability:admin`, `🔒 security:review-required`, `tier-gate:all`

#### Context
PRD §22 Definition of Done gate. Checks secrets, encryption, auth paths, SQL surfaces, OWASP top 10.

#### Dependencies
- **Blocked by:** P6.2–P6.5, P5.6, P5.7
- **Blocks:** P6.13

#### Acceptance Criteria
- [ ] Static analysis pass (Semgrep / equivalent) — zero highs
- [ ] Secrets audit — nothing in source tree, everything in Cloudflare Secrets
- [ ] Encryption audit — every token column has `_enc` suffix + ciphertext
- [ ] Auth audit — every protected route passes through `src/middleware.ts`
- [ ] SQL audit — every user-data query parameterized via Drizzle
- [ ] External pentest scoped and booked (report attached before launch)

#### Security 🔒
- Findings tracked as dedicated issues; criticals block launch.

---

### [P6.9] dub.co referral tracking setup

**Repo:** `infra` + `baseout-web` · **Milestone:** V1 · **Phase:** 6 · **Capability:** integrations
**Labels:** `phase:6`, `milestone:v1`, `capability:integrations`, `tier-gate:all`

#### Context
Replacement for Rewardful (PRD §17). Referral links plumbed through sign-up flow; attribution persisted on Organization.

#### Dependencies
- **Blocked by:** P1A.3
- **Blocks:** none

#### Acceptance Criteria
- [ ] dub.co workspace + API key configured
- [ ] Referral cookie captured pre-auth
- [ ] Attribution written on Org creation
- [ ] Admin panel (P6.1) surfaces referrer per Org

#### Testing
- Integration: click referral link → sign up → Org attribution correct.

---

### [P6.10] PostHog setup (EU cloud)

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 6 · **Capability:** observability
**Labels:** `phase:6`, `milestone:v1`, `repo:baseout-web`, `capability:observability`, `🔒 security:new-secret`, `tier-gate:all`

#### Context
Single PostHog SDK: analytics, product analytics, session replay, feature flags (PRD §17). EU cloud for GDPR.

#### Dependencies
- **Blocked by:** P0.8
- **Blocks:** P2A.*

#### Acceptance Criteria
- [ ] PostHog SDK installed, EU host configured
- [ ] Session replay + feature flags enabled
- [ ] User identity tied to User ID (not email) post-login
- [ ] Events documented: signup, connect-airtable, first-backup, upgrade, etc.

#### Security 🔒
- PII masked in session replay (email, names, token fields).

#### Testing
- Integration: event fires; verified in PostHog staging project.

---

### [P6.11] Guided tours (Shepherd.js)

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 6 · **Capability:** ux
**Labels:** `phase:6`, `milestone:v1`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`

#### Context
Onboarding, Schema viz, Restore, Space settings tours (PRD §18).

#### Dependencies
- **Blocked by:** P2A.*, P2B.*, P3A.3
- **Blocks:** none

#### Acceptance Criteria
- [ ] Shepherd.js integrated
- [ ] Tours defined: onboarding wizard, dashboard overview, schema viz, restore flow, settings
- [ ] Per-user dismissal persisted

#### Testing
- Playwright: first visit → tour starts; dismissal persists.

---

### [P6.12] Tooltips (Floating UI)

**Repo:** `baseout-web` · **Milestone:** V1 · **Phase:** 6 · **Capability:** ux
**Labels:** `phase:6`, `milestone:v1`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`

#### Context
Contextual tooltips on all major UI elements (PRD §18). Floating UI per CLAUDE.md UI standards.

#### Dependencies
- **Blocked by:** P0.9
- **Blocks:** none

#### Acceptance Criteria
- [ ] `Tooltip` component in `baseout-ui`
- [ ] Applied to: tier gates, health score thresholds, backup status badges, storage destination rows, restore action buttons
- [ ] Keyboard + screen-reader accessible

#### Testing
- Unit: component render + a11y assertions.

---

### [P6.13] Airtable Marketplace listing submission

**Repo:** external (Airtable portal) · **Milestone:** V1 · **Phase:** 6 · **Capability:** admin
**Labels:** `phase:6`, `milestone:v1`, `capability:admin`, `tier-gate:all`

#### Context
PRD §22 launch criterion. Submission form, screenshots, privacy policy, terms.

#### Dependencies
- **Blocked by:** P6.6, P6.7, P6.8
- **Blocks:** public launch

#### Acceptance Criteria
- [ ] Listing copy + screenshots finalized
- [ ] Privacy policy + TOS URLs live
- [ ] Submission sent; receipt stored in ops doc
- [ ] Follow-up dates tracked until approval

#### Testing
- External review process; no internal test.

---

## Continuing (V2) — Deferred Capabilities

**Milestone:** Continuing · **Primary repos:** TBD · **Source:** PRD §Appendix B, Features §7/§11/§13/§14/§17.

These are **placeholders** — tracked so they aren't forgotten, but not under active work. Each becomes a full epic when V2 planning begins. Do not implement against these without promoting them to a proper issue with PRD + Features sign-off.

**Rule per CLAUDE.md §0:** V2 capabilities are out of scope for the V1 build. Flag conflicts if a V1 ticket starts pulling in V2 scope.

### V2.1 — AI MCP Server
- Tier: Business+ · Per PRD §11.1 / Features §16
- Notes: Model Context Protocol server exposing Baseout data to AI assistants. Vector DB provisioning implied (V2.4).

### V2.2 — RAG Service + Hosted Chatbot
- Tier: Business+ · Per PRD §11.1 / Features §16
- Notes: RAG pipeline, hosted chatbot, chatbot embed widget, chatbot filters. Depends on Vector DB (V2.4).

### V2.3 — Custom AI Skills / Bring-Your-Own Model
- Tier: Enterprise · Per PRD §11.1 / Features §16
- Notes: Custom AI routines and fine-tuned model support.

### V2.4 — Vector Database Provisioning
- Tier: Business+ · Per PRD §11.1 / Features §16
- Notes: Prerequisite for V2.1 / V2.2.

### V2.5 — Governance Capability (entire)
- Tier: Business+ · Per PRD §13 / Features §17
- Notes: Data quality rules, classification, lineage, retention policies, access controls, compliance reporting, PII scanning, audit trail.

### V2.6 — Third-Party Connectors (Zapier / Make / HyperDB)
- Tier: Business+ · Per PRD §14.1 / Features §14
- Notes: Outbound integrations, not V1 Inbound API.

### V2.7 — Airtable Writeback
- Tier: Enterprise · Per PRD §14.1 / Features §14
- Notes: Write-back of metadata/descriptions into Airtable.

### V2.8 — Multi-Platform Spaces
- Tier: Enterprise · Per PRD §2 / Features §1
- Notes: Cross-platform Spaces that aggregate Airtable + Notion + Coda + HubSpot + Salesforce. Requires additional Platforms first.

### V2.9 — Multi-Platform Integrations (Notion / Coda / HubSpot / Salesforce)
- Tier: varies · Per PRD §Appendix B
- Notes: Each new Platform is its own multi-phase project.

### V2.10 — Schema Management Write-Back Actions
- Tier: Pro+ · Per PRD §7.3
- Notes: Rename Tables/Fields, add descriptions — writes back to Airtable. Deferred due to risk.

### V2.11 — Automations / Interfaces Visualization
- Tier: Business+ · Per PRD §9.1 / §10.1
- Notes: Visual flow / layout renderers.

### V2.12 — Data Alerts + PII Detection
- Tier: Business+ · Per PRD §8 / Features §17
- Notes: Complex alerting and PII scanning.

### V2.13 — Analytics Custom Dashboards / Reports
- Tier: Business+ · Per PRD §12.1
- Notes: User-defined dashboards and scheduled reports.

### V2.14 — Outbound Webhook / Event System
- Tier: Business+ · Per PRD §Appendix B

### V2.15 — Record-Level Restore
- Tier: TBD · Per PRD §Appendix B
- Notes: Build only if user demand warrants.

### V2.16 — CLI Tool
- Per PRD §Appendix B

### V2.17 — White-Label
- Per PRD §Appendix B

### V2.18 — Cross-Space Migration & Cloning
- Per PRD §Appendix B

---

## Appendix A — Label Taxonomy

Create these labels on each repo before the first upload. Colors are suggestions — align to the org's existing scheme.

| Family | Label | Color | Purpose |
|---|---|---|---|
| phase | `phase:0` | #B60205 | Foundation |
| phase | `phase:1` | #D93F0B | Core auth + backup |
| phase | `phase:2` | #FBCA04 | Dashboard + restore + bg |
| phase | `phase:3` | #0E8A16 | Schema + Dynamic Backup |
| phase | `phase:4` | #1D76DB | Billing + On2Air |
| phase | `phase:5` | #5319E7 | Advanced / Pro+ |
| phase | `phase:6` | #6F42C1 | Admin + hardening |
| phase | `phase:v2` | #CFD3D7 | Deferred |
| milestone | `milestone:mvp` | #A371F7 | MVP scope |
| milestone | `milestone:v1` | #8250DF | V1 scope |
| milestone | `milestone:continuing` | #ADBAC7 | V2+ |
| repo | `repo:baseout-web` | #006B75 | — |
| repo | `repo:baseout-backup-engine` | #006B75 | — |
| repo | `repo:baseout-background-services` | #006B75 | — |
| repo | `repo:baseout-admin` | #006B75 | — |
| repo | `repo:baseout-ui` | #006B75 | — |
| repo | `repo:infra` | #006B75 | — |
| capability | `capability:auth` | #0075CA | — |
| capability | `capability:backup` | #0075CA | — |
| capability | `capability:restore` | #0075CA | — |
| capability | `capability:schema` | #0075CA | — |
| capability | `capability:data` | #0075CA | — |
| capability | `capability:automations` | #0075CA | — |
| capability | `capability:interfaces` | #0075CA | — |
| capability | `capability:ai` | #0075CA | — |
| capability | `capability:analytics` | #0075CA | — |
| capability | `capability:governance` | #0075CA | — |
| capability | `capability:integrations` | #0075CA | — |
| capability | `capability:billing` | #0075CA | — |
| capability | `capability:admin` | #0075CA | — |
| capability | `capability:observability` | #0075CA | — |
| capability | `capability:ux` | #0075CA | — |
| capability | `capability:ci-cd` | #0075CA | — |
| tier-gate | `tier-gate:all` | #EDEDED | — |
| tier-gate | `tier-gate:launch+` | #C5DEF5 | — |
| tier-gate | `tier-gate:growth+` | #BFD4F2 | — |
| tier-gate | `tier-gate:pro+` | #B3C7E8 | — |
| tier-gate | `tier-gate:business+` | #A7BADD | — |
| tier-gate | `tier-gate:enterprise` | #9BA9D3 | — |
| security | `security:review-required` | #EE0701 | — |
| security | `security:encryption` | #EE0701 | — |
| security | `security:auth-path` | #EE0701 | — |
| security | `security:new-secret` | #EE0701 | — |
| security | `security:new-sql-surface` | #EE0701 | — |
| testing | `testing:needs-e2e` | #FEF2C0 | — |
| testing | `testing:needs-integration` | #FEF2C0 | — |
| testing | `testing:needs-unit` | #FEF2C0 | — |
| state | `blocked` | #B60205 | — |
| state | `parallel-ok` | #0E8A16 | — |
| state | `epic` | #3E4B9E | — |

---

## Appendix B — Upload Runbook (gh CLI)

**Pre-reqs:**
- All 5 repos created (P0.1).
- Labels from Appendix A created in each target repo (script below).
- `gh` authenticated with scopes `repo`, `workflow`.

### Step 1 — Create labels per repo

```bash
# Save as scripts/create-labels.sh in your ops repo
REPOS=(baseout-web baseout-backup-engine baseout-background-services baseout-admin baseout-ui)
for repo in "${REPOS[@]}"; do
  gh label create "phase:0" --repo "openside/$repo" --color B60205 --force
  gh label create "phase:1" --repo "openside/$repo" --color D93F0B --force
  # ... (one line per label from Appendix A)
done
```

### Step 2 — Create milestones per repo

```bash
for repo in "${REPOS[@]}"; do
  gh api repos/openside/$repo/milestones -f title='MVP' \
     -f description='Phases 0-2: core loop shippable' -f state=open
  gh api repos/openside/$repo/milestones -f title='V1' \
     -f description='Phases 3-6: public launch ready' -f state=open
  gh api repos/openside/$repo/milestones -f title='Continuing' \
     -f description='V2+ deferred capabilities' -f state=open
done
```

### Step 3 — Upload epics

```bash
# Epic 1 → baseout-web (or whichever repo owns most Phase 0 items)
gh issue create --repo openside/baseout-web \
  --title "Epic 1 — Phase 0: Foundation [MVP]" \
  --label "phase:0,milestone:mvp,epic" \
  --milestone "MVP" \
  --body-file <(awk '/^## Epic 1 —/,/^## Epic 2 —/' docs/Baseout_Backlog.md | sed '$d')
```

Repeat for Epics 2–7, adjusting `--repo` to the epic's primary repo (see epic header) and the `awk` range.

### Step 4 — Upload child issues

A small TS script parses `docs/Baseout_Backlog.md`, splits on `^### \[P`, and uploads each to the `repo:*` label's repo:

```typescript
// scripts/upload-backlog.ts — sketch; to be written in P0.1 / ops follow-up.
// 1. Read Baseout_Backlog.md
// 2. Split into records on /^### \[P/
// 3. For each record: extract repo from `**Repo:** <repo>`, labels from `Labels:` line
// 4. `gh issue create --repo openside/<repo> --title <H3> --label <joined> --body <rest>`
// 5. After all created: post-process Blocked-by/Blocks into issue comments with GitHub issue numbers
```

### Step 5 — Link epics to children

Once all issues exist, edit each epic body to replace `[ ] [P_.x] ...` bullets with `[ ] #<issue-number> ...` so GitHub renders a real task list with progress.

### Step 6 — Verify

- Epic progress bars reflect child completion.
- `gh issue list --label "phase:0"` returns exactly 11 items.
- `gh issue list --label "milestone:mvp"` returns items from Epics 1–3 only.

---

## Appendix C — Author's Notes & Open Items

- **Spec §11 open questions** are **resolved** in the PRD as of 2026-04-20. Every child issue uses the resolved values (cadence, tier names, formats, trial mechanics).
- ⚠️ **Frame.io proxy requirement** (P1D.7) — confirm during build; update issue if proxy needed.
- ⚠️ **Session strategy** (P1A.1) — decide JWT vs DB-backed during implementation spike; document choice in the PR.
- **File-count sanity** (run before upload):
  ```bash
  # Expected ~104 children + 7 epics + 18 V2 placeholders
  grep -c '^### \[P' docs/Baseout_Backlog.md   # → 104
  grep -c '^### V2\.' docs/Baseout_Backlog.md  # → 18
  grep -c '^## Epic ' docs/Baseout_Backlog.md  # → 7
  ```
- **Canonical-term grep** before upload:
  ```bash
  grep -nE '\b(workspace|tenant|login provider)\b' docs/Baseout_Backlog.md || echo "clean"
  ```
  (The word "workspace" appears in a sanctioned Airtable-external context in P2B.5 — "Workspace ID" — confirm only those instances remain.)

---
