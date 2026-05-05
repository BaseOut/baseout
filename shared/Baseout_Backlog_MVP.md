# Baseout MVP Backlog — Parent + Sub-issues

> **Scope:** Epics 1–3 (Phases 0–2) of [Baseout_Backlog.md](Baseout_Backlog.md), decomposed to agent-executable sub-issues.
> **Companion to:** [Baseout_PRD.md](Baseout_PRD.md) · [Baseout_Features.md](Baseout_Features.md) · [Baseout_Implementation_Plan.md](Baseout_Implementation_Plan.md) · [Baseout_Backlog.md](Baseout_Backlog.md)
> **Not a replacement for:** [Baseout_Backlog.md](Baseout_Backlog.md) — parents here link back to their canonical entries there.

---

## 0. Purpose + How to Read

This document exists because the ~104 child issues in [Baseout_Backlog.md](Baseout_Backlog.md) are sized for a human engineer holding full project context. An AI coding agent picking up a blank conversation needs smaller, self-contained work units with explicit test scaffolds, files-to-touch, dependencies, and security gates inline.

This file decomposes the **MVP portion** (Epics 1–3 / Phases 0–2 / 45 original child issues → **60 parents** after the P2D.1 split) into **~280 agent-executable sub-issues**.

**Reading order for execution:**
1. Start with the [MVP Work Queue](#2-mvp-work-queue) — flat topological list of what to pick up next.
2. Click through to the parent section to find the sub-issue.
3. Follow the sub-issue's `Blocked by` / `Blocks` graph.

**Reading order for review:**
1. Skim [§1 Conventions](#1-conventions) to know the contract.
2. Skim each Epic heading to confirm parent coverage.
3. Dive into sub-issues as needed.

---

## 1. Conventions

### Hierarchy

```
Epic (from Baseout_Backlog.md — unchanged)
└── Parent issue (existing P0.x / P1A.x / ... — unchanged shape)
    └── Sub-issue (NEW — agent-executable)
```

Parents in this file **link back** to their canonical entry in [Baseout_Backlog.md](Baseout_Backlog.md). They are not restated in full — only the sub-issue breakdown is added.

### ID format

`P{phase}{stream}.{parent-n}.{sub-n}` — e.g., `P0.7.3`, `P1A.1.2`, `P2C.3.4`.

- Parent IDs are unchanged from [Baseout_Backlog.md](Baseout_Backlog.md).
- Sub-issue numbering starts at `.1` per parent and increments.
- Exception: `P2D.1` in [Baseout_Backlog.md](Baseout_Backlog.md) is split here into `P2D.1a` (render harness + magic-link template) and `P2D.1b` (remaining V1 templates). Sub-issues under them: `P2D.1a.N` and `P2D.1b.N`.

### Canonical terms (Features §1 — reuse in every sub-issue)

Organization · Space · Platform · Connection · Base · Table · Field · Record · Attachment · Automation · Interface · View · Schema · Backup Run · Backup Snapshot · Static Backup · Dynamic Backup · Storage Destination · Database Tier · BYOS · BYODB · Instant Backup · Capability · Changelog · Insight · Alert · Health Score · Restore · Overage · D1 · Shared PostgreSQL · Dedicated PostgreSQL · R2.

**Forbidden synonyms** (zero hits allowed): ❌ *workspace* (for Space) · ❌ *tenant* · ❌ *account* (except *account owner*) · ❌ *project* (as product term) · ❌ *login provider*.

### Symbols

- `✅` passing acceptance
- `⚠️` spec conflict / open decision
- `🔒` security review required
- `║` can run parallel with the row immediately above
- `⚡` critical path (any delay slips MVP exit)

### Labels

All sub-issues inherit:
- `milestone:mvp`
- `agentic-ready` (asserts body template is filled)

Plus applicable subset of:
- `phase:0` | `phase:1` | `phase:2`
- `repo:baseout-ui` | `repo:baseout-web` | `repo:baseout-backup-engine` | `repo:baseout-background-services` | `repo:baseout-admin` | `repo:infra`
- `capability:ci-cd` | `capability:auth` | `capability:backup` | `capability:billing` | `capability:ux` | `capability:restore` | `capability:schema`
- `tier-gate:all` | `tier-gate:starter` | `tier-gate:launch+` | `tier-gate:growth+` | `tier-gate:pro+` | `tier-gate:business+` | `tier-gate:enterprise`
- `🔒 security:auth-path` | `🔒 security:new-secret` | `🔒 security:encryption` | `🔒 security:new-sql-surface`
- `granularity:tdd` (Option 1 parents) | `granularity:chunk` (Option 3 parents)
- `parallel-ok` | `critical-path`

### Default gates (inherited from [Baseout_Backlog.md §Default Gates](Baseout_Backlog.md))

Every sub-issue inherits these without restating:
- No hardcoded secrets; AES-256-GCM for tokens at rest; parameterized Drizzle queries; server-side input validation; CSRF on mutating forms; principle of least privilege on scopes.
- Vitest unit + integration; real local Postgres (Docker) + Miniflare D1; external APIs mocked with `msw` at HTTP boundary; coverage engines 80% / API 75% / UI 60%.
- DoD: CI green; security review points signed off; PR description covers scope/tests/risks; canonical terms only; no `any` types; no TODOs.

### Sub-issue body template

Every sub-issue uses this shape — missing fields become `N/A` (never omitted). See also [Appendix B](#appendix-b--sub-issue-body-template).

```markdown
### [ID] <Short imperative title>

**Parent:** [ID](link) · **Repo:** <repo> · **Capability:** <capability>
**Labels:** <label list>
**Estimate:** <S ≤ 2h | M ≤ 4h | L ≤ 1d>

#### Context
#### Spec references
#### Canonical terms
#### Files to touch
#### Failing test to write first
#### Implementation notes
#### Acceptance criteria
#### Dependencies
#### Security 🔒  (when applicable)
#### Out of scope
```

---

## 2. MVP Work Queue

> Flat topological order. Read top-to-bottom; pick the first row whose `Blocked by` is fully ✅.
> Phase boundaries noted. `║` = can run concurrent with the row above.
> Built from all sub-issue `Blocked by` edges via tie-break: phase asc → security-first → largest `Blocks` fan-out.

**Ordering algorithm:** topological sort of `Blocked by` edges with tie-breakers (phase asc → security-first → largest `Blocks` fan-out → ID asc). External parent refs (e.g. `P0.1`, `P4A.1`) are treated as satisfied (outside this DAG).

**Legend:** `Fan-out` = count of other MVP sub-issues blocked by this one. `Security` 🔒 = must pass security review before merge. `Parallel hint` ║ = can run concurrently with the row above (same phase, no direct dep).

Total sub-issues in queue: 264 / 264

| # | ID | Title | Phase | Fan-out | Security | Parallel hint |
|---|---|---|---|---|---|---|
| 1 | [P0.6.1](#p061) | Create staging Cloudflare account + IAM tokens scoped to staging | P0 | 9 | 🔒 |  |
| 2 | [P0.8.3](#p083) | Set Stripe secrets: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | P0 | 3 | 🔒 |  |
| 3 | [P0.8.1](#p081) | Generate + set `MASTER_ENCRYPTION_KEY` in staging + prod | P0 | 2 | 🔒 | ║ |
| 4 | [P0.8.2](#p082) | Set `DATABASE_URL` + `BETTER_AUTH_SECRET` in staging + prod | P0 | 2 | 🔒 | ║ |
| 5 | [P0.6.2](#p062) | Provision staging D1 + R2 bucket + KV namespace | P0 | 1 | 🔒 | ║ |
| 6 | [P0.6.3](#p063) | Mirror prod Cloudflare namespaces + document parity | P0 | 0 | 🔒 |  |
| 7 | [P0.1.1](#p011) | Adopt baseout-starter as `baseout-web`; scaffold `baseout-ui` + `baseout-admin` shells | P0 | 6 |  | ║ |
| 8 | [P0.1.2](#p012) | Wire Vitest + Drizzle + msw into `baseout-web` + `baseout-backup-engine` | P0 | 7 |  |  |
| 9 | [P0.7.3](#p073) | AES-256-GCM encrypt/decrypt helper + test vectors | P0 | 16 | 🔒 |  |
| 10 | [P0.1.3](#p013) | Scaffold `baseout-background-services` repo + shared scripts directory | P0 | 5 |  | ║ |
| 11 | [P0.5.1](#p051) | `wrangler.toml` for `baseout-backup-engine` with DO scaffolding | P0 | 5 |  |  |
| 12 | [P0.9.1](#p091) | Package scaffold + `@opensided/theme` + daisyUI config + `@nanostores/astro` | P0 | 5 |  | ║ |
| 13 | [P0.9.2](#p092) | `Button` component + variants + a11y + tests | P0 | 4 |  |  |
| 14 | [P0.9.6](#p096) | `Layout` + `Toast` + `src/stores/` bootstrap | P0 | 4 |  | ║ |
| 15 | [P0.3.1](#p031) | `docker-compose.yml` with Postgres 16 + `db:up` / `db:down` scripts | P0 | 2 |  | ║ |
| 16 | [P0.7.1](#p071) | Drizzle schema: `organizations` table | P0 | 6 | 🔒 |  |
| 17 | [P0.7.4](#p074) | Drizzle schema: `connections` table with `*_enc` columns | P0 | 15 | 🔒 |  |
| 18 | [P0.7.2](#p072) | Drizzle schema: `users` + `sessions` tables (extend better-auth) | P0 | 6 | 🔒 | ║ |
| 19 | [P0.7.5](#p075) | Drizzle schemas: `spaces`, `backup_runs`, `subscriptions`, `api_tokens`, `notification_log` | P0 | 21 | 🔒 |  |
| 20 | [P0.3.2](#p032) | Extend `scripts/seed.ts` to insert a minimal fixture Organization + User | P0 | 2 |  | ║ |
| 21 | [P0.5.2](#p052) | `wrangler.toml` for `baseout-background-services` (cron Worker) | P0 | 2 |  | ║ |
| 22 | [P0.10.1](#p0101) | ✅ Verify `mail.baseout.com` in Cloudflare Email Service | P0 | 1 |  | ║ |
| 23 | [P0.10.2](#p0102) | ✅ DKIM / SPF / DMARC DNS records + verification | P0 | 2 |  |  |
| 24 | [P0.8.4](#p084) | Set Airtable OAuth + Storage OAuth secrets | P0 | 9 | 🔒 |  |
| 25 | [P0.8.5](#p085) | `.env.example` completeness + rotation runbook + audit log | P0 | 0 | 🔒 |  |
| 26 | [P0.10.3](#p0103) | Test send from staging + verify DKIM pass headers + suppressions | P0 | 2 |  | ║ |
| 27 | [P0.11.1](#p0111) | Create 6 Airtable-tier Stripe Products with `platform` + `tier` metadata | P0 | 1 |  | ║ |
| 28 | [P0.11.2](#p0112) | Create Monthly + Annual Prices per Product with `billing_period` metadata | P0 | 1 |  |  |
| 29 | [P0.11.3](#p0113) | Register `/api/stripe/webhook` stub + signature verification | P0 | 0 | 🔒 |  |
| 30 | [P0.2.1](#p021) | Base CI workflow (lint, typecheck, Vitest) in every repo | P0 | 1 |  | ║ |
| 31 | [P0.2.2](#p022) | Add Postgres 16 service container for `baseout-web` + `baseout-backup-engine` CI | P0 | 2 |  |  |
| 32 | [P0.7.6](#p076) | Initial Drizzle migration + roundtrip integration test | P0 | 3 | 🔒 |  |
| 33 | [P0.4.1](#p041) | Pages project for `baseout-web` (prod + staging + branch mapping) | P0 | 1 |  | ║ |
| 34 | [P0.4.2](#p042) | Pages project for `baseout-admin` (prod + staging) | P0 | 1 |  | ║ |
| 35 | [P0.2.3](#p023) | Add Miniflare D1 + branch protection + required checks | P0 | 0 |  | ║ |
| 36 | [P0.3.3](#p033) | README: local dev loop documentation | P0 | 0 |  | ║ |
| 37 | [P0.4.3](#p043) | Verify custom-domain + preview deployment end-to-end | P0 | 0 |  | ║ |
| 38 | [P0.5.3](#p053) | Health endpoint + dev-loop + staging deploy smoke | P0 | 0 |  | ║ |
| 39 | [P0.9.3](#p093) | `Input` component + form semantics + tests | P0 | 0 |  | ║ |
| 40 | [P0.9.4](#p094) | `Modal` component + focus trap + tests | P0 | 0 |  | ║ |
| 41 | [P0.9.5](#p095) | `Table` component + pagination props + tests | P0 | 0 |  | ║ |
| 42 | [P1A.1.2](#p1a12) | Harden cookie + CSRF config in `auth-factory` | P1 | 3 | 🔒 |  |
| 43 | [P1A.1.6](#p1a16) | Audit log writer for auth state changes | P1 | 3 | 🔒 | ║ |
| 44 | [P1A.1.4](#p1a14) | ✅ Wire Cloudflare Email Service binding behind `sendMagicLink` | P1 | 2 | 🔒 | ║ |
| 45 | [P1C.2.1](#p1c21) | Add `selected_bases` + `auto_add_future_bases` persistence on `spaces` | P1 | 2 | 🔒 | ║ |
| 46 | [P1A.1.5](#p1a15) | Isolate Airtable OAuth from the login handler | P1 | 1 | 🔒 | ║ |
| 47 | [P1A.2.2](#p1a22) | Single-use token generator + hashing helper | P1 | 1 | 🔒 | ║ |
| 48 | [P1B.3.1](#p1b31) | `connection_locks` table schema + migration | P1 | 1 | 🔒 | ║ |
| 49 | [P1B.9.1](#p1b91) | Trigger.dev project wiring + secrets for staging/prod | P1 | 1 | 🔒 | ║ |
| 50 | [P1C.1.3](#p1c13) | Persist Airtable Connection + discover Bases on return | P1 | 1 | 🔒 | ║ |
| 51 | [P1D.1.1](#p1d11) | Define `StorageDestination` interface + types | P1 | 19 |  | ║ |
| 52 | [P1D.2.1](#p1d21) | OAuth start + callback with `drive.file` scope + encrypted token storage | P1 | 2 | 🔒 |  |
| 53 | [P1D.3.1](#p1d31) | OAuth + app-folder scope + encrypted token storage | P1 | 2 | 🔒 | ║ |
| 54 | [P1D.5.1](#p1d51) | OAuth + `Files.ReadWrite` + encrypted token storage | P1 | 2 | 🔒 | ║ |
| 55 | [P1D.2.2](#p1d22) | Server-side folder search + selection endpoint | P1 | 1 | 🔒 | ║ |
| 56 | [P1D.4.1](#p1d41) | OAuth + `root_readwrite` scope (app folder) + encrypted token storage | P1 | 1 | 🔒 | ║ |
| 57 | [P1D.5.2](#p1d52) | Graph folder picker endpoint | P1 | 1 | 🔒 | ║ |
| 58 | [P1D.1.2](#p1d12) | Path helper: `/orgs/{org-id}/spaces/{space-id}/runs/{run-id}/...` | P1 | 9 |  | ║ |
| 59 | [P1D.1.3](#p1d13) | `StorageR2` writer implementing the interface | P1 | 3 | 🔒 |  |
| 60 | [P1D.2.3](#p1d23) | `StorageGoogleDrive` writer implementing the interface + token refresh | P1 | 0 | 🔒 | ║ |
| 61 | [P1D.5.3](#p1d53) | `StorageOneDrive` writer — Graph chunked upload session | P1 | 0 | 🔒 | ║ |
| 62 | [P1C.3.1](#p1c31) | Define `Capability` type + `capabilityMatrix` constant | P1 | 5 |  | ║ |
| 63 | [P1C.3.2](#p1c32) | `resolveCapability(subscription, capabilityName)` helper | P1 | 5 | 🔒 |  |
| 64 | [P1D.6.1](#p1d61) | Credential form + AES-256-GCM-encrypted key storage + tier gate | P1 | 1 | 🔒 |  |
| 65 | [P1A.1.1](#p1a11) | Define `AuthContext` + `SessionPayload` shared types | P1 | 4 |  | ║ |
| 66 | [P1A.1.3](#p1a13) | Zod schemas for auth request/response payloads | P1 | 1 | 🔒 |  |
| 67 | [P1B.7.1](#p1b71) | `createBackupRun(spaceId)` — INSERT `pending` with deterministic UUID + `is_trial` | P1 | 4 |  | ║ |
| 68 | [P1B.10.1](#p1b101) | `GET /api/spaces/:id/backup-runs` route + auth gate | P1 | 1 | 🔒 |  |
| 69 | [P1B.7.2](#p1b72) | `transitionBackupRun(id, toStatus)` — single-path state machine | P1 | 4 |  | ║ |
| 70 | [P1B.7.4](#p1b74) | `markBackupRunFailed(id, err)` — sanitized `error_message` | P1 | 2 | 🔒 |  |
| 71 | [P1B.1.1](#p1b11) | Define `AirtableOAuthConfig` + `AirtableTokenResponse` types | P1 | 3 |  | ║ |
| 72 | [P1B.1.2](#p1b12) | `/api/connections/airtable/start` — signed state + redirect | P1 | 2 | 🔒 |  |
| 73 | [P1B.1.3](#p1b13) | `/api/connections/airtable/callback` — exchange code, persist encrypted Connection | P1 | 6 | 🔒 |  |
| 74 | [P1B.4.1](#p1b41) | Typed Airtable REST client (fetch + decrypt-on-use) | P1 | 5 | 🔒 |  |
| 75 | [P1B.1.4](#p1b14) | Airtable user metadata fetch + `Connection.external_user_id` | P1 | 1 | 🔒 | ║ |
| 76 | [P1B.3.2](#p1b32) | `acquireLock(connectionId, runId)` via `INSERT ... ON CONFLICT DO NOTHING` | P1 | 3 |  | ║ |
| 77 | [P1D.3.2](#p1d32) | Reusable `ProxyStreamUploader` abstraction | P1 | 3 |  | ║ |
| 78 | [P1D.3.3](#p1d33) | `StorageDropbox` writer using `ProxyStreamUploader` | P1 | 1 | 🔒 |  |
| 79 | [P1D.3.4](#p1d34) | Airtable attachment URL refresh on proxy-stream start | P1 | 3 |  | ║ |
| 80 | [P1D.4.2](#p1d42) | `StorageBox` writer reusing `ProxyStreamUploader` | P1 | 1 | 🔒 |  |
| 81 | [P1A.2.1](#p1a21) | `/sign-in` + `/sign-up` Astro routes shell | P1 | 2 |  | ║ |
| 82 | [P1A.2.3](#p1a23) | POST `/api/auth/magic-link` handler | P1 | 2 | 🔒 |  |
| 83 | [P1A.4.1](#p1a41) | Public-route allowlist + migrate `/login`→`/sign-in` | P1 | 2 | 🔒 | ║ |
| 84 | [P1A.2.4](#p1a24) | Rate-limit magic-link requests (5/email/hour) | P1 | 1 | 🔒 | ║ |
| 85 | [P1A.2.5](#p1a25) | GET `/auth/callback` — verify + resume/provision | P1 | 2 | 🔒 |  |
| 86 | [P1A.3.1](#p1a31) | `provisionNewAccount()` contract + result type | P1 | 2 |  | ║ |
| 87 | [P1A.3.3](#p1a33) | Stripe Customer + $0 Subscription creator | P1 | 2 | 🔒 |  |
| 88 | [P1A.3.2](#p1a32) | Organization slug generator + uniqueness check | P1 | 1 | 🔒 | ║ |
| 89 | [P1A.3.4](#p1a34) | Atomic DB writer: Organization + User + subscriptions row | P1 | 1 | 🔒 |  |
| 90 | [P1A.4.2](#p1a42) | Hydrate `Astro.locals` with `organization` + typed session | P1 | 2 |  | ║ |
| 91 | [P1A.4.3](#p1a43) | Logout handler: kill Session + clear nanostores | P1 | 1 | 🔒 |  |
| 92 | [P1A.4.4](#p1a44) | Client-side session hydration via nanostore | P1 | 2 |  | ║ |
| 93 | [P1A.5.1](#p1a51) | `TempSession` type + KV codec contract | P1 | 2 |  | ║ |
| 94 | [P1A.5.2](#p1a52) | Workers KV-backed temp session store | P1 | 2 | 🔒 |  |
| 95 | [P1A.5.3](#p1a53) | Anonymous Airtable OAuth handler + HttpOnly cookie mint | P1 | 2 | 🔒 |  |
| 96 | [P1B.2.1](#p1b21) | `SpaceController` Durable Object class scaffold + routing | P1 | 2 |  | ║ |
| 97 | [P1B.2.2](#p1b22) | DO internal state model: `{ status, progress, currentRunId, error, lastUpdate }` | P1 | 3 |  |  |
| 98 | [P1B.2.4](#p1b24) | WebSocket endpoint: `/spaces/:id/ws` emits `{progress, status, lastUpdate}` | P1 | 1 | 🔒 |  |
| 99 | [P1B.2.5](#p1b25) | Graceful restart: mark in-flight run `failed` on DO hibernation wake | P1 | 2 |  | ║ |
| 100 | [P1B.4.3](#p1b43) | Base Schema fetch → write `schema.json` to R2 | P1 | 2 |  | ║ |
| 101 | [P1B.4.5](#p1b45) | Field-type → CSV cell encoder | P1 | 2 |  | ║ |
| 102 | [P1B.5.1](#p1b51) | Composite attachment ID generator | P1 | 2 |  | ║ |
| 103 | [P1B.5.2](#p1b52) | Attachment manifest: read prior snapshot, append new entries | P1 | 2 |  |  |
| 104 | [P1B.5.3](#p1b53) | Dedup check: reference existing storage path, skip re-upload | P1 | 2 |  |  |
| 105 | [P1B.6.1](#p1b61) | `buildBackupPath` utility — canonical layout builder | P1 | 2 |  | ║ |
| 106 | [P1B.8.1](#p1b81) | `TrialCapCounters` types + factory | P1 | 2 |  | ║ |
| 107 | [P1C.3.3](#p1c33) | Map frequencies to tier via `resolveCapability('backup.frequency')` | P1 | 2 |  | ║ |
| 108 | [P1C.4.1](#p1c41) | Step 4 view: destination list gated by `resolveCapability('storage.destinations')` | P1 | 2 |  | ║ |
| 109 | [P1D.7.1](#p1d71) | Capture open questions + confirm API shape before build | P1 | 2 |  | ║ |
| 110 | [P1D.7.2](#p1d72) | OAuth + narrow scope + encrypted token storage | P1 | 2 | 🔒 |  |
| 111 | [P1D.7.3](#p1d73) | Project/folder picker endpoint | P1 | 1 | 🔒 |  |
| 112 | [P1D.7.4](#p1d74) | `StorageFrameio` writer — conditional proxy-stream vs direct upload | P1 | 1 | 🔒 |  |
| 113 | [P1A.3.5](#p1a35) | Idempotency: replay-safe `provisionNewAccount` | P1 | 1 |  | ║ |
| 114 | [P1A.3.6](#p1a36) | Integrate provisioning into `/auth/callback` + fire welcome email | P1 | 2 | 🔒 |  |
| 115 | [P1A.5.5](#p1a55) | Claim temp session on sign-up (attach Connection + Bases) | P1 | 0 | 🔒 |  |
| 116 | [P1A.6.1](#p1a61) | `TrialState` enum + state-machine pure function | P1 | 1 |  | ║ |
| 117 | [P1A.6.2](#p1a62) | `getTrialStateForOrganization` — DB-backed resolver | P1 | 2 |  |  |
| 118 | [P1A.6.3](#p1a63) | Backup-run preflight: refuse 2nd Run while `is_trial` | P1 | 1 | 🔒 |  |
| 119 | [P1B.1.5](#p1b15) | Standard vs Enterprise scope variant selection | P1 | 1 |  | ║ |
| 120 | [P1B.1.6](#p1b16) | End-to-end Airtable OAuth sandbox integration test | P1 | 0 | 🔒 |  |
| 121 | [P1B.10.2](#p1b102) | Cursor pagination + `started_at` desc ordering | P1 | 1 |  | ║ |
| 122 | [P1B.10.3](#p1b103) | Response shape + cross-Org 403 integration | P1 | 0 | 🔒 |  |
| 123 | [P1B.2.3](#p1b23) | Cron alarm scheduling per `spaces.backup_frequency` | P1 | 1 |  | ║ |
| 124 | [P1B.2.6](#p1b26) | Alarm → start Backup Run glue (end-to-end fire) | P1 | 1 |  |  |
| 125 | [P1B.3.3](#p1b33) | `releaseLock(connectionId, runId)` in `finally` semantics | P1 | 1 |  | ║ |
| 126 | [P1B.3.4](#p1b34) | Stale lock reclaim (expires_at + audit) | P1 | 1 |  | ║ |
| 127 | [P1B.3.5](#p1b35) | Retry wrapper: 5s backoff × 3 attempts, then fail | P1 | 1 |  |  |
| 128 | [P1B.4.2](#p1b42) | Paginated record iterator with deleted-record tolerance | P1 | 1 |  | ║ |
| 129 | [P1B.4.4](#p1b44) | Streaming CSV writer (schema-driven column order) | P1 | 1 |  |  |
| 130 | [P1B.4.6](#p1b46) | Rate-limit (429) handling with exponential backoff | P1 | 1 |  | ║ |
| 131 | [P1B.4.7](#p1b47) | Per-Base orchestrator: schema + all tables → R2 | P1 | 2 | 🔒 |  |
| 132 | [P1B.9.2](#p1b92) | `backupBase` job definition (typed input + task) | P1 | 2 |  |  |
| 133 | [P1B.5.4](#p1b54) | Airtable attachment URL refresh on expiry | P1 | 1 |  | ║ |
| 134 | [P1B.5.5](#p1b55) | Streaming attachment download → R2 upload (with 3× retry) | P1 | 1 |  |  |
| 135 | [P1B.6.2](#p1b62) | Path component sanitizer (slashes, colons, control chars, zero-width) | P1 | 1 |  | ║ |
| 136 | [P1B.8.2](#p1b82) | Per-Table cap gate (stop after 5 Tables in trial) | P1 | 1 |  | ║ |
| 137 | [P1B.8.3](#p1b83) | Per-Record + per-Attachment cap gates (mid-chunk stop) | P1 | 1 |  | ║ |
| 138 | [P1B.8.4](#p1b84) | `trial_complete` transition + partial-data retention | P1 | 1 |  |  |
| 139 | [P1B.9.3](#p1b93) | DO enqueues one `backupBase` job per Base + awaits fan-out | P1 | 1 |  | ║ |
| 140 | [P1B.9.4](#p1b94) | Per-job progress webhook back to DO | P1 | 1 | 🔒 |  |
| 141 | [P1C.1.1](#p1c11) | Wizard shell + progress indicator + Step 1 route | P1 | 1 |  | ║ |
| 142 | [P1C.1.2](#p1c12) | Wire "Connect Airtable" CTA to OAuth starter endpoint | P1 | 0 | 🔒 |  |
| 143 | [P1C.2.2](#p1c22) | Step 2 view: Base list + "Select all" + auto-add toggle | P1 | 1 |  | ║ |
| 144 | [P1C.3.4](#p1c34) | Step 3 view: frequency radio + disabled/upgrade copy | P1 | 1 |  | ║ |
| 145 | [P1C.4.2](#p1c42) | Folder picker for Google Drive + OneDrive | P1 | 1 |  | ║ |
| 146 | [P1C.4.3](#p1c43) | Persist `storage_destination_id` on Space + advance `wizard_step` to 5 | P1 | 1 |  |  |
| 147 | [P1C.5.1](#p1c51) | `POST /api/wizard/step-5/run-first-backup` dispatch endpoint | P1 | 1 | 🔒 |  |
| 148 | [P1C.5.2](#p1c52) | Step 5 confirm view: summary + "Run first backup" CTA | P1 | 1 |  |  |
| 149 | [P1C.5.3](#p1c53) | Live progress bar via WebSocket from Space Durable Object | P1 | 2 |  |  |
| 150 | [P1C.5.4](#p1c54) | Trial-cap banner with "partial result" + upgrade CTA | P1 | 1 |  |  |
| 151 | [P1C.5.5](#p1c55) | On success: mark wizard complete + redirect to dashboard | P1 | 2 |  |  |
| 152 | [P1C.6.1](#p1c61) | Middleware: redirect to `/wizard/step-N` while `wizard_step != 'complete'` | P1 | 2 | 🔒 |  |
| 153 | [P1C.6.2](#p1c62) | Dashboard banner when wizard incomplete (deep-link fallback) | P1 | 1 |  |  |
| 154 | [P1D.1.4](#p1d14) | Manifest writer: `manifest.json` per Backup Run | P1 | 1 |  | ║ |
| 155 | [P1D.1.5](#p1d15) | Tier quota check before write (R2 bytes used vs limit) | P1 | 1 |  | ║ |
| 156 | [P1D.3.5](#p1d35) | Integration test: proxy 50 MB file end-to-end, no disk write | P1 | 1 |  | ║ |
| 157 | [P1D.6.2](#p1d62) | Bucket existence + write test on save + IAM scope warning | P1 | 1 |  | ║ |
| 158 | [P1D.6.3](#p1d63) | `StorageS3` writer + expired-credentials handling | P1 | 0 | 🔒 |  |
| 159 | [P1A.2.6](#p1a26) | Error-state UIs (expired / used / malformed) + success redirect | P1 | 0 |  | ║ |
| 160 | [P1A.4.5](#p1a45) | End-to-end auth smoke: protect a sample dashboard route | P1 | 0 |  | ║ |
| 161 | [P1A.5.4](#p1a54) | Public schema-viz route reads temp session | P1 | 0 |  | ║ |
| 162 | [P1A.6.4](#p1a64) | Cron-scheduled Day-5 warning + Day-7 expiry email trigger | P1 | 0 |  | ║ |
| 163 | [P1A.6.5](#p1a65) | UI gate: block "New Backup" CTA when trial consumed/expired | P1 | 0 |  | ║ |
| 164 | [P1B.5.6](#p1b56) | Per-Run integration: dedup across two consecutive runs uploads zero new attachments | P1 | 0 |  | ║ |
| 165 | [P1B.6.3](#p1b63) | Collision suffix (`-1`, `-2`) for same-second runs + README | P1 | 0 |  | ║ |
| 166 | [P1B.7.3](#p1b73) | `updateBackupRunMetrics` — record / table / attachment counters + duration | P1 | 0 |  | ║ |
| 167 | [P1B.7.5](#p1b75) | Crash-simulation integration: killed Worker → row ends `failed` | P1 | 0 |  | ║ |
| 168 | [P1B.8.5](#p1b85) | Trial-capped event emission + end-to-end integration | P1 | 0 |  | ║ |
| 169 | [P1B.9.5](#p1b95) | Idempotent job retry + end-to-end staging integration | P1 | 0 |  | ║ |
| 170 | [P1C.2.3](#p1c23) | Persist selections + advance `wizard_step` to 3 | P1 | 0 |  | ║ |
| 171 | [P1C.3.5](#p1c35) | Persist frequency + advance `wizard_step` to 4 | P1 | 0 |  | ║ |
| 172 | [P1C.6.3](#p1c63) | Integration test: log out at Step 3 → log in → lands on Step 3 | P1 | 0 |  | ║ |
| 173 | [P1D.1.6](#p1d16) | Integration test: write CSV + manifest, read back identical bytes | P1 | 0 |  | ║ |
| 174 | [P1D.4.3](#p1d43) | Integration test against Box sandbox-style `msw` harness | P1 | 0 |  | ║ |
| 175 | [P1D.7.5](#p1d75) | Integration smoke: 50 MB asset via chosen Frame.io path | P1 | 0 |  | ║ |
| 176 | [P2B.4.1](#p2b41) | Airtable meta API client: create table + field mapper | P2 | 2 | 🔒 |  |
| 177 | [P2C.2.1](#p2c21) | Refresh-eligible query + error classification types | P2 | 2 | 🔒 | ║ |
| 178 | [P2B.4.3](#p2b43) | Record writer with rate-limit awareness | P2 | 1 | 🔒 | ║ |
| 179 | [P2B.6.1](#p2b61) | `restore_audit` schema migration | P2 | 1 | 🔒 | ║ |
| 180 | [P2C.2.2](#p2c22) | Airtable token refresh client + re-encryption | P2 | 1 | 🔒 | ║ |
| 181 | [P2C.2.3](#p2c23) | Storage-destination token refresh (Google Drive, Dropbox, Box, OneDrive) | P2 | 1 | 🔒 | ║ |
| 182 | [P2C.2.4](#p2c24) | Refresh handler orchestration + dead-connection flagging | P2 | 2 | 🔒 |  |
| 183 | [P2C.2.5](#p2c25) | Wrangler cron trigger for token refresh | P2 | 1 | 🔒 |  |
| 184 | [P2C.2.6](#p2c26) | Integration test — token-near-expiry → refreshed end-to-end | P2 | 0 | 🔒 |  |
| 185 | [P2C.3.1](#p2c31) | Notification event type catalog + `notification_log` writer helper | P2 | 4 |  | ║ |
| 186 | [P2A.3.1](#p2a31) | History list API with cursor pagination | P2 | 2 |  | ║ |
| 187 | [P2A.6.1](#p2a61) | Notification feed API with severity sort | P2 | 2 |  | ║ |
| 188 | [P2B.1.1](#p2b11) | Snapshot list API (successful + trial_complete runs) | P2 | 2 |  | ║ |
| 189 | [P2B.1.2](#p2b12) | Snapshot picker component with date filter | P2 | 2 |  |  |
| 190 | [P2D.1a.1](#p2d1a1) | Install React Email + set up render harness | P2 | 2 |  | ║ |
| 191 | [P2D.1a.2](#p2d1a2) | Shared `_layout.tsx` — logo, footer, unsubscribe | P2 | 2 |  |  |
| 192 | [P2D.1a.3](#p2d1a3) | Wire React Email templates into the existing `sendEmail()` abstraction | P2 | 5 | 🔒 |  |
| 193 | [P2D.1a.4](#p2d1a4) | `magic-link.tsx` template + snapshot test + vars contract | P2 | 1 | 🔒 |  |
| 194 | [P2D.1b.4](#p2d1b4) | Connection + account templates (dead-connection ×4 · migration welcome · password reset) | P2 | 0 | 🔒 | ║ |
| 195 | [P2A.1.1](#p2a11) | Space list API endpoint + server types | P2 | 1 |  | ║ |
| 196 | [P2A.1.2](#p2a12) | Sidebar component + currentSpace nanostore wiring | P2 | 1 |  |  |
| 197 | [P2A.2.1](#p2a21) | BackupStatus view-model types + state reducer | P2 | 1 |  | ║ |
| 198 | [P2A.2.2](#p2a22) | `/api/spaces/:id/status` endpoint | P2 | 1 |  |  |
| 199 | [P2A.2.3](#p2a23) | nanostore for live widget state | P2 | 1 |  |  |
| 200 | [P2A.2.4](#p2a24) | BackupStatusWidget Astro island + three-state render | P2 | 1 |  |  |
| 201 | [P2A.3.2](#p2a32) | History list component + detail drawer | P2 | 1 |  | ║ |
| 202 | [P2A.4.1](#p2a41) | Progress event contract + shared types | P2 | 1 |  | ║ |
| 203 | [P2A.4.2](#p2a42) | WebSocket route `/api/spaces/:id/progress` with session auth | P2 | 1 | 🔒 |  |
| 204 | [P2A.4.3](#p2a43) | Browser client with exponential backoff reconnect | P2 | 1 |  |  |
| 205 | [P2A.4.4](#p2a44) | nanostore bridge + logout teardown | P2 | 1 | 🔒 |  |
| 206 | [P2A.5.1](#p2a51) | Usage snapshot API + tier cap resolver | P2 | 1 |  | ║ |
| 207 | [P2A.5.2](#p2a52) | StorageUsageSummary component with threshold colors | P2 | 1 |  |  |
| 208 | [P2A.6.2](#p2a62) | Notification panel component | P2 | 1 |  | ║ |
| 209 | [P2B.2.1](#p2b21) | Restore job contract types + payload validator | P2 | 1 |  | ║ |
| 210 | [P2B.2.2](#p2b22) | Capability check + dispatch endpoint | P2 | 2 |  |  |
| 211 | [P2B.2.3](#p2b23) | Restore scope picker UI (base vs table) | P2 | 2 |  |  |
| 212 | [P2B.2.4](#p2b24) | Engine: base-level restore orchestration | P2 | 2 |  | ║ |
| 213 | [P2B.3.3](#p2b33) | Engine: subset Table restore | P2 | 2 |  |  |
| 214 | [P2B.2.5](#p2b25) | Destination chooser + review page | P2 | 1 |  | ║ |
| 215 | [P2B.3.1](#p2b31) | Snapshot → Table inventory endpoint | P2 | 1 |  | ║ |
| 216 | [P2B.3.4](#p2b34) | Dispatch wiring — table-level path | P2 | 1 |  | ║ |
| 217 | [P2B.4.4](#p2b44) | Linked-record dependency order resolver | P2 | 1 |  | ║ |
| 218 | [P2B.4.5](#p2b45) | Attachment re-upload via Storage Destination | P2 | 2 | 🔒 |  |
| 219 | [P2B.5.1](#p2b51) | Workspace ID validator (client + server) | P2 | 1 |  | ║ |
| 220 | [P2B.5.2](#p2b52) | Create-Base API client | P2 | 1 | 🔒 |  |
| 221 | [P2B.5.3](#p2b53) | New-Base orchestrator | P2 | 2 |  |  |
| 222 | [P2B.5.4](#p2b54) | Dispatch wiring — new-Base branch | P2 | 1 |  |  |
| 223 | [P2B.6.2](#p2b62) | Capability gate — Growth+ check | P2 | 1 |  | ║ |
| 224 | [P2B.6.3](#p2b63) | Audit writer: compare counts + persist rows | P2 | 1 |  |  |
| 225 | [P2B.6.4](#p2b64) | Notification hook — mismatches surface in panel | P2 | 1 |  |  |
| 226 | [P2C.1.1](#p2c11) | Webhook registry query + types | P2 | 1 |  | ║ |
| 227 | [P2C.1.2](#p2c12) | Airtable webhook renewal client | P2 | 1 |  | ║ |
| 228 | [P2C.1.3](#p2c13) | Renewal handler — orchestrate query + renew + log | P2 | 1 |  |  |
| 229 | [P2C.1.4](#p2c14) | Wrangler cron trigger + `scheduled` entry wiring | P2 | 1 |  |  |
| 230 | [P2C.3.2](#p2c32) | 4-touch state machine — types + transitions | P2 | 1 |  | ║ |
| 231 | [P2C.3.3](#p2c33) | Dead-connection handler: detect + advance + dispatch email | P2 | 2 |  |  |
| 232 | [P2C.3.5](#p2c35) | Re-auth reset flow — user reconnects Connection, cadence resets | P2 | 1 | 🔒 |  |
| 233 | [P2C.3.4](#p2c34) | Wrangler cron trigger — dead-connection daily | P2 | 1 |  | ║ |
| 234 | [P2C.4.1](#p2c41) | Stale-lock query + reclaim helper | P2 | 1 |  | ║ |
| 235 | [P2C.4.2](#p2c42) | Lock-sweep handler + audit log entry | P2 | 1 |  |  |
| 236 | [P2C.4.3](#p2c43) | Wrangler cron — every 5 minutes | P2 | 1 |  |  |
| 237 | [P2C.4.4](#p2c44) | Integration — stuck lock aged 20m → removed on next sweep | P2 | 1 |  |  |
| 238 | [P2C.5.1](#p2c51) | Expiring-trial query + handler | P2 | 1 |  | ║ |
| 239 | [P2C.5.2](#p2c52) | Wrangler cron — daily trial sweep | P2 | 1 |  |  |
| 240 | [P2C.6.1](#p2c61) | Usage aggregator + tier-cap comparator | P2 | 1 |  | ║ |
| 241 | [P2C.6.2](#p2c62) | Wrangler cron — daily quota sweep | P2 | 1 |  |  |
| 242 | [P2A.1.3](#p2a13) | Last-viewed Space persistence + restore on login | P2 | 0 |  | ║ |
| 243 | [P2A.2.5](#p2a25) | Playwright E2E — widget reflects a real run | P2 | 0 |  | ║ |
| 244 | [P2A.3.3](#p2a33) | Infinite scroll + filter persistence + Playwright check | P2 | 0 |  | ║ |
| 245 | [P2A.4.5](#p2a45) | Integration test — fake run emits events within 1s | P2 | 0 |  | ║ |
| 246 | [P2A.5.3](#p2a53) | Upgrade CTA routing + stub billing target | P2 | 0 |  | ║ |
| 247 | [P2A.6.3](#p2a63) | Mark-read + dismiss flow + Playwright smoke | P2 | 0 |  | ║ |
| 248 | [P2B.1.3](#p2b13) | Playwright — pick snapshot → proceed to scope | P2 | 0 |  | ║ |
| 249 | [P2B.2.6](#p2b26) | E2E — backup → restore → counts match | P2 | 0 |  | ║ |
| 250 | [P2B.3.2](#p2b32) | Multi-select Table picker | P2 | 0 |  | ║ |
| 251 | [P2B.3.5](#p2b35) | Integration — 3-table base, 2 restored | P2 | 0 |  | ║ |
| 252 | [P2B.4.2](#p2b42) | Table name suffixing + collision handling | P2 | 0 |  | ║ |
| 253 | [P2B.4.6](#p2b46) | Airtable sandbox integration test | P2 | 0 |  | ║ |
| 254 | [P2B.5.5](#p2b55) | Integration — new-Base count parity | P2 | 0 |  | ║ |
| 255 | [P2B.6.5](#p2b65) | Integration — tampered post-restore → flagged | P2 | 0 |  | ║ |
| 256 | [P2C.1.5](#p2c15) | Integration test — fixture ages webhook + renewal sweeps | P2 | 0 |  | ║ |
| 257 | [P2C.3.6](#p2c36) | Integration test — 4-touch cadence over 10 simulated days | P2 | 0 |  | ║ |
| 258 | [P2C.4.5](#p2c45) | Admin surface — expose lock reclamation events in admin app stub | P2 | 0 |  | ║ |
| 259 | [P2C.5.3](#p2c53) | Integration test — trial age 5d → warning; 7d → expired | P2 | 0 |  | ║ |
| 260 | [P2C.6.3](#p2c63) | Integration — Org at 92% sees 90% email exactly once | P2 | 0 |  | ║ |
| 261 | [P2D.1a.5](#p2d1a5) | Integration test — magic-link end-to-end via the `EMAIL` binding | P2 | 0 |  | ║ |
| 262 | [P2D.1b.1](#p2d1b1) | Trial-lifecycle templates (welcome · day-5 · expired) | P2 | 0 |  | ║ |
| 263 | [P2D.1b.2](#p2d1b2) | Operational templates (backup failure · backup warning · audit report · monthly summary) | P2 | 0 |  | ║ |
| 264 | [P2D.1b.3](#p2d1b3) | Quota + billing templates (quota 75/90/100% · upgrade confirm · overage notice) | P2 | 0 |  | ║ |

---

## 3. Epic 1 — Phase 0: Foundation

**Milestone:** MVP · **Plan ref:** Phase 0 · **Epic doc:** [Baseout_Backlog.md §Epic 1](Baseout_Backlog.md)

**Parents in this epic (11):**

| Parent | Title | Granularity | Sub-issue count |
|---|---|---|---|
| [P0.1](#p01) | Create 5 repos | chunk | 3 |
| [P0.2](#p02) | GitHub Actions CI pipeline | chunk | 3 |
| [P0.3](#p03) | Docker Compose for local dev | chunk | 3 |
| [P0.4](#p04) | Cloudflare Pages projects | chunk | 3 |
| [P0.5](#p05) | Cloudflare Workers projects | chunk | 3 |
| [P0.6](#p06) | Staging Cloudflare account + namespaces | chunk | 3 |
| [P0.7](#p07) | Define and migrate master DB schema | tdd | 6 |
| [P0.8](#p08) | Cloudflare Secrets per environment | tdd | 5 |
| [P0.9](#p09) | Scaffold baseout-ui package | tdd | 6 |
| [P0.10](#p010) | Verify `mail.baseout.com` in Cloudflare Email Service | chunk | 3 |
| [P0.11](#p011) | Stripe account + products + webhook endpoint | chunk | 3 |

---

### P0.1

**Parent:** [P0.1 Create the 5 repos with standard structure](Baseout_Backlog.md) · granularity: `chunk` · Blocks: every other MVP parent.

The existing [baseout-starter](../) repo is the seed of `baseout-web` — sub-issues reuse it rather than scaffold from empty. Other repos are greenfield.

---

#### [P0.1.1] Adopt baseout-starter as `baseout-web`; scaffold `baseout-ui` + `baseout-admin` shells

**Parent:** [P0.1](Baseout_Backlog.md) · **Repo:** `baseout-web`, `baseout-ui`, `baseout-admin` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `parallel-ok`, `granularity:chunk`, `agentic-ready`
**Estimate:** L

##### Context
Rename / designate this existing baseout-starter repo as `baseout-web`. Create empty-shell repos for `baseout-ui` (shared Astro component library) and `baseout-admin` (super-admin app). Every later repo-scoped issue cites one of these.

##### Spec references
- [Baseout_Implementation_Plan.md §Repository Map](Baseout_Implementation_Plan.md) — five repos, purpose per repo.
- [Baseout_PRD.md §4](Baseout_PRD.md) — Astro + Pages tech stack.

##### Canonical terms
Organization, Space — terms must appear in any copy written into READMEs.

##### Files to touch
- `README.md` in each new repo (new) — one-paragraph purpose + pointer to [Baseout_PRD.md](Baseout_PRD.md) and [Baseout_Features.md](Baseout_Features.md).
- `.gitignore` (new) — Node defaults, `.env`, `.wrangler`, `node_modules`, `.astro`.
- `.editorconfig` (new) — repo-wide.
- `LICENSE` (new) — match org standard (UNLICENSED placeholder acceptable).
- `package.json` (new in baseout-ui, baseout-admin) — `"type": "module"`, Node ≥ 22.12 engine pin.

##### Failing test to write first
- **File:** `<repo>/tests/smoke.test.ts` (new in each repo)
- **Cases:**
  - `expect(true).toBe(true)` — placeholder that CI (P0.2) will gate on.
- Command: `npm test` — fails until vitest is wired in P0.2.

##### Implementation notes
- For `baseout-web`: no rename required if team convention is to keep `baseout-starter` as the canonical slug; document the alias in the README.
- Reuse existing [package.json](../package.json) dependencies for `baseout-web`; do NOT copy them into `baseout-ui` / `baseout-admin`.
- `baseout-admin` scaffold = empty Astro app shell only; features ship in Phase 6 — do not stub features here.

##### Acceptance criteria
- [ ] Three repos exist with README, LICENSE, .gitignore, .editorconfig.
- [ ] `baseout-web` README notes it supersedes `baseout-starter`.
- [ ] Each repo has a `package.json` with engine `>=22.12.0`.
- [ ] Smoke test file exists in each repo, importable by Vitest once wired.
- [ ] No `any` types introduced.

##### Dependencies
- **Blocked by:** none
- **Blocks:** P0.1.2, P0.2.1, P0.9.1
- **Can run in parallel with:** P0.1.3, P0.6.*, P0.10.*, P0.11.1

##### Out of scope
- Adding Vitest, Drizzle, or Wrangler config (that's P0.1.2 / P0.1.3).
- Creating branch-protection rules (P0.2.3).
- Any feature code.

---

#### [P0.1.2] Wire Vitest + Drizzle + msw into `baseout-web` + `baseout-backup-engine`

**Parent:** [P0.1](Baseout_Backlog.md) · **Repo:** `baseout-web`, `baseout-backup-engine` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `parallel-ok`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
`baseout-web` inherits [package.json](../package.json) deps but is missing Vitest + msw. `baseout-backup-engine` is a new Worker repo that needs Drizzle + Vitest + Miniflare. Both are prerequisites for any TDD work downstream.

##### Spec references
- [Baseout_PRD.md §14](Baseout_PRD.md) — testing strategy, coverage targets, msw for HTTP boundary mocks.
- [CLAUDE.md §3](../.claude/CLAUDE.md) — TDD policy.

##### Canonical terms
N/A (tooling-only sub-issue).

##### Files to touch
- `baseout-web/package.json` (modified) — add `vitest`, `@vitest/coverage-v8`, `msw`, `@testing-library/astro`.
- `baseout-web/vitest.config.ts` (new) — node environment + coverage thresholds (PRD §14.4).
- `baseout-web/tests/setup.ts` (new) — msw server bootstrap, global teardown.
- `baseout-web/tests/handlers.ts` (new) — empty msw handler array scaffold.
- `baseout-backup-engine/package.json` (new) — `vitest`, `miniflare`, `drizzle-orm`, `drizzle-kit`, `@cloudflare/workers-types`.
- `baseout-backup-engine/vitest.config.ts` (new) — Miniflare test environment.
- `baseout-backup-engine/drizzle.config.ts` (new) — schema pointer, migration dir.

##### Failing test to write first
- **File:** `baseout-web/tests/msw.test.ts` (new)
- **Cases:**
  - `msw` intercepts a `fetch('https://api.example.com/')` in test; returns a stubbed body.
- **File:** `baseout-backup-engine/tests/drizzle.test.ts` (new)
- **Cases:**
  - importing the drizzle kit config does not throw; migration dir exists.
- Command: `npm test` in each repo → red, then green after wiring.

##### Implementation notes
- msw version ≥ 2.x; use `setupServer()` not the older `rest` API.
- Drizzle schema lives in existing [src/db/schema/](../src/db/schema/) for baseout-web; create `src/db/schema/` in baseout-backup-engine.
- Reuse existing [src/db/index.ts](../src/db/index.ts) export shape in baseout-backup-engine.
- Coverage thresholds per PRD §14.4: engines 80 / API 75 / UI 60 — set in `vitest.config.ts`.

##### Acceptance criteria
- [ ] Vitest + msw installed and configured in `baseout-web`.
- [ ] Vitest + Drizzle + Miniflare configured in `baseout-backup-engine`.
- [ ] Smoke + msw test pass in both repos.
- [ ] Coverage thresholds enforced.
- [ ] No `any` types in configs or scaffolds.

##### Dependencies
- **Blocked by:** P0.1.1
- **Blocks:** P0.2.1, P0.2.2, P0.7.*, all TDD-mode sub-issues
- **Can run in parallel with:** P0.1.3, P0.3.*

##### Out of scope
- Writing real HTTP handlers (per-feature issues own those).
- Creating Drizzle schemas (that's P0.7).

---

#### [P0.1.3] Scaffold `baseout-background-services` repo + shared scripts directory

**Parent:** [P0.1](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `parallel-ok`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
`baseout-background-services` hosts cron Workers for webhook renewal, token refresh, dead-connection notification, trial + quota monitors (all of Phase 2C). Scaffold its repo shell, Vitest, Drizzle, and Wrangler config now so Phase 2 has zero setup overhead.

##### Spec references
- [Baseout_PRD.md §2.9](Baseout_PRD.md) — background services purpose.
- [Baseout_Implementation_Plan.md §Phase 2C](Baseout_Implementation_Plan.md).

##### Canonical terms
Connection, Backup Run, Subscription.

##### Files to touch
- `baseout-background-services/package.json` (new)
- `baseout-background-services/vitest.config.ts` (new) — Miniflare env
- `baseout-background-services/wrangler.toml` (new, placeholder env blocks) — bindings filled in P0.5
- `baseout-background-services/tests/smoke.test.ts` (new)
- `baseout-background-services/README.md` (new)

##### Failing test to write first
- **File:** `baseout-background-services/tests/smoke.test.ts` (new)
- **Cases:**
  - Cron handler module exports a `scheduled` entry point.
- Command: `npm test`.

##### Implementation notes
- Wrangler workflow for scheduled Workers (`triggers.crons`); keep the trigger list empty until P2C.x populates it.
- Point `drizzle.config.ts` at the same master-DB schema that `baseout-web` uses (shared master DB, not a separate one).

##### Acceptance criteria
- [ ] Repo builds empty Worker via `wrangler deploy --dry-run`.
- [ ] Smoke test passes.
- [ ] README cites PRD §2.9 + Plan §Phase 2C.

##### Dependencies
- **Blocked by:** P0.1.1
- **Blocks:** P0.2.3, P0.5.2, P2C.*
- **Can run in parallel with:** P0.1.2, P0.3.*

##### Out of scope
- Any feature implementation.
- Actual cron handler logic.

---

### P0.2

**Parent:** [P0.2 GitHub Actions CI pipeline](Baseout_Backlog.md) · granularity: `chunk` · Blocks: all merges.

---

#### [P0.2.1] Base CI workflow (lint, typecheck, Vitest) in every repo

**Parent:** [P0.2](Baseout_Backlog.md) · **Repo:** all · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Every PR in every repo must run `tsc --noEmit`, `vitest run`, and coverage gates, and block merge on failure. Shared workflow shape first; service containers + Miniflare come in P0.2.2 / P0.2.3.

##### Spec references
- [Baseout_PRD.md §14](Baseout_PRD.md) — testing + coverage.
- [Baseout_PRD.md §18](Baseout_PRD.md) — CI/CD.

##### Canonical terms
N/A.

##### Files to touch
- `.github/workflows/ci.yml` in all 5 repos (new) — identical shape, per-repo node version from `package.json` engines.

##### Failing test to write first
- **File:** intentionally-failing `tests/force-fail.test.ts` on a throwaway branch
- **Cases:**
  - `expect(true).toBe(false)` — confirms CI blocks merge.
- Command: push branch → open PR → required `CI` check fails.

##### Implementation notes
- Use `actions/setup-node@v4` pinned to major, `npm ci`, `npm test`.
- Workflow must run on `push` (main only) and `pull_request` (all branches).
- Matrix not needed at Phase 0 — single Node 22.12 job.

##### Acceptance criteria
- [ ] `ci.yml` committed in every repo.
- [ ] PR cannot be merged when tests fail.
- [ ] Coverage below per-repo threshold (PRD §14.4) fails CI.
- [ ] `tsc --noEmit` with `strict: true` fails CI on `any`.

##### Dependencies
- **Blocked by:** P0.1.1, P0.1.2, P0.1.3
- **Blocks:** P0.2.2, every merge
- **Can run in parallel with:** P0.3.*, P0.4.*

##### Security 🔒
- No secrets in `ci.yml`; all secrets flow through `secrets.*` context only.

##### Out of scope
- Postgres service container, Miniflare — see P0.2.2 / P0.2.3.

---

#### [P0.2.2] Add Postgres 16 service container for `baseout-web` + `baseout-backup-engine` CI

**Parent:** [P0.2](Baseout_Backlog.md) · **Repo:** `baseout-web`, `baseout-backup-engine` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Integration tests per [PRD §14.2](Baseout_PRD.md) hit a real Postgres — no DB mocks allowed. Add Postgres 16 as a GitHub Actions service container in both backend repos.

##### Spec references
- [Baseout_PRD.md §14.2](Baseout_PRD.md) — integration tests vs real PG.

##### Canonical terms
N/A.

##### Files to touch
- `baseout-web/.github/workflows/ci.yml` (modified) — add `services: postgres:16`.
- `baseout-backup-engine/.github/workflows/ci.yml` (modified) — same.
- `baseout-web/tests/integration/db-reachable.test.ts` (new) — connectivity smoke.

##### Failing test to write first
- **File:** `baseout-web/tests/integration/db-reachable.test.ts`
- **Cases:**
  - `new Pool({ connectionString: env.DATABASE_URL_TEST }).query('SELECT 1')` resolves.
- Command: `npm run test:integration`.

##### Implementation notes
- Expose `DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/postgres` to the test step.
- Use `pg_isready`-style readiness via `services.postgres.options`.
- Shared helper path: `src/db/index.ts` already exports the client — reuse for the connectivity test.

##### Acceptance criteria
- [ ] Both repos' CI boots Postgres and runs an integration test against it.
- [ ] Unit tests remain split from integration via a separate `vitest.integration.config.ts` or `describe.skip.if` gate.

##### Dependencies
- **Blocked by:** P0.2.1
- **Blocks:** P0.2.3, P0.7.6
- **Can run in parallel with:** P0.3.1

##### Out of scope
- Miniflare D1 (P0.2.3).

---

#### [P0.2.3] Add Miniflare D1 + branch protection + required checks

**Parent:** [P0.2](Baseout_Backlog.md) · **Repo:** Worker repos, all · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Worker-repo tests need an in-process D1 for queue + state tests per [PRD §4](Baseout_PRD.md). Finally, `main` branch protection must require the CI check green and at least one approval.

##### Spec references
- [Baseout_PRD.md §14.2](Baseout_PRD.md) — Miniflare for Workers.
- [Baseout_PRD.md §18](Baseout_PRD.md) — branch protection.

##### Canonical terms
N/A.

##### Files to touch
- `baseout-backup-engine/vitest.config.ts` (modified) — `environment: 'miniflare'`.
- `baseout-background-services/vitest.config.ts` (modified) — same.
- `.github/branch-protection.md` (new, doc) — documents the protections to apply via `gh api` or UI.

##### Failing test to write first
- **File:** `baseout-backup-engine/tests/integration/d1-smoke.test.ts` (new)
- **Cases:**
  - Miniflare `env.D1` binding accepts a `CREATE TABLE` + `INSERT` + `SELECT` round-trip.
- Command: `npm run test:integration`.

##### Implementation notes
- Miniflare version must match Wrangler major (P0.5).
- Branch-protection applies to `main` in all 5 repos: required checks (`CI`), required reviews (1), no direct push.

##### Acceptance criteria
- [ ] D1 test round-trips in Miniflare environment.
- [ ] `main` in all 5 repos rejects direct pushes.
- [ ] CI check marked required via `gh api repos/<org>/<repo>/branches/main/protection`.

##### Dependencies
- **Blocked by:** P0.2.2, P0.1.3
- **Blocks:** P1B.2, any DO test
- **Can run in parallel with:** P0.5.*

##### Out of scope
- CD (deploy workflows) — handled inside Pages / Workers setup (P0.4 / P0.5).

---

### P0.3

**Parent:** [P0.3 Docker Compose for local dev](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P0.7, integration tests.

---

#### [P0.3.1] `docker-compose.yml` with Postgres 16 + `db:up` / `db:down` scripts

**Parent:** [P0.3](Baseout_Backlog.md) · **Repo:** `baseout-web`, `baseout-backup-engine` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `parallel-ok`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Contributors run integration tests locally against the same Postgres 16 image CI uses.

##### Spec references
- [Baseout_PRD.md §14.2](Baseout_PRD.md).

##### Canonical terms
N/A.

##### Files to touch
- `docker-compose.yml` (new at repo root of `baseout-web` and mirrored or shared in `baseout-backup-engine`) — postgres:16 service with named volume.
- `package.json` (modified) — add scripts `db:up` / `db:down` / `db:logs`.

##### Failing test to write first
- **File:** `tests/integration/compose-db.test.ts` (new)
- **Cases:**
  - After `npm run db:up`, connection to `DATABASE_URL` succeeds.
- Command: `npm run db:up && npm run test:integration`.

##### Implementation notes
- Use env file `.env.test` with `DATABASE_URL=postgres://postgres:postgres@localhost:5432/baseout_test`.
- Volume named `baseout_pg_data` — persists across `db:down` unless user runs `docker compose down -v`.
- Existing [scripts/launch.mjs](../scripts/launch.mjs) pattern can wrap the compose commands for consistency.

##### Acceptance criteria
- [ ] `npm run db:up` boots Postgres; `npm run db:down` stops it.
- [ ] Integration smoke test passes against compose DB.

##### Dependencies
- **Blocked by:** P0.1.2
- **Blocks:** P0.3.2, P0.7.6
- **Can run in parallel with:** P0.2.*

##### Out of scope
- Seeding (P0.3.2).
- Schema migration (P0.7).

---

#### [P0.3.2] Extend `scripts/seed.ts` to insert a minimal fixture Organization + User

**Parent:** [P0.3](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Existing [scripts/seed.ts](../scripts/seed.ts) is the canonical seed harness. Extend it to insert one Organization + one User so `baseout-web` has a known starting fixture for integration tests and manual dev.

##### Spec references
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `organizations`, `users` columns.
- [Baseout_Features.md §1](Baseout_Features.md) — canonical entity names.

##### Canonical terms
Organization, User.

##### Files to touch
- `scripts/seed.ts` (modified) — extend existing default export.
- `scripts/seed.test.ts` (new) — integration test.

##### Failing test to write first
- **File:** `scripts/seed.test.ts`
- **Cases:**
  - After `seed()`: one `organizations` row with `name='Dev Org'`; one `users` row with `organization_id` matching; user role = `owner`.
  - Re-running seed is idempotent (no duplicate inserts).
- Command: `npm run db:up && npm run seed && vitest run scripts/seed.test.ts`.

##### Implementation notes
- Reuse existing Drizzle client from [src/db/index.ts](../src/db/index.ts).
- Guard with `if (!existing) insert(...)` to stay idempotent.
- Do NOT seed Subscription, Connection, or Space — this is the baseline only.

##### Acceptance criteria
- [ ] `npm run seed` idempotent on repeat runs.
- [ ] Integration test verifies Org + User presence.
- [ ] Canonical terms only (no `workspace`, `tenant`).

##### Dependencies
- **Blocked by:** P0.3.1, P0.7.1, P0.7.2
- **Blocks:** P0.3.3, integration tests
- **Can run in parallel with:** P0.4.*

##### Out of scope
- Seeding trial / subscription / connection fixtures — those belong with their respective sub-issues.

---

#### [P0.3.3] README: local dev loop documentation

**Parent:** [P0.3](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `parallel-ok`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Document the full local dev loop: clone → install → compose up → migrate → seed → test → dev. Prevents every new contributor (human or agent) from reverse-engineering the commands.

##### Spec references
- [CLAUDE.md §0](../.claude/CLAUDE.md) — docs are source of truth.

##### Canonical terms
N/A.

##### Files to touch
- `README.md` (modified) — new "Local Development" section.

##### Failing test to write first
- **File:** N/A (documentation-only sub-issue).

##### Implementation notes
- Include: prereqs (Node ≥ 22.12, Docker), exact command sequence, common failure modes (port 5432 in use, `.env.test` missing).
- Link to [Baseout_PRD.md §14](Baseout_PRD.md) for the testing rationale.

##### Acceptance criteria
- [ ] A new contributor following the README verbatim can run `npm test:integration` green.
- [ ] Every command in the README is runnable verbatim.

##### Dependencies
- **Blocked by:** P0.3.2
- **Blocks:** onboarding clarity
- **Can run in parallel with:** everything

##### Out of scope
- Staging / prod deploy docs — that's P0.4 / P0.5 / P0.6.

---

### P0.4

**Parent:** [P0.4 Cloudflare Pages projects](Baseout_Backlog.md) · granularity: `chunk` · Blocks: any deploy.

---

#### [P0.4.1] Pages project for `baseout-web` (prod + staging + branch mapping)

**Parent:** [P0.4](Baseout_Backlog.md) · **Repo:** `infra` + `baseout-web` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Ship `baseout-web` to Cloudflare Pages on two accounts (prod from P0.6 / staging from P0.6). `main` → prod, `staging` → staging, PR branches → preview.

##### Spec references
- [Baseout_PRD.md §4](Baseout_PRD.md) — Pages.
- [Baseout_Implementation_Plan.md §Phase 0 P0.4](Baseout_Implementation_Plan.md).

##### Canonical terms
N/A.

##### Files to touch
- `baseout-web/wrangler.jsonc` (modified — [wrangler.jsonc](../wrangler.jsonc) exists) — Pages project name + environment blocks.
- `infra/docs/cloudflare-pages.md` (new, ops doc) — binding IDs per environment.

##### Failing test to write first
- **File:** `baseout-web/tests/deploy/pages-preview.md` (runbook-style assertion file, not a Vitest test)
- **Cases:**
  - Pushing a PR branch produces a preview URL.
  - `main` push produces a prod deploy.
- Verified by CI workflow output (P0.2.1) + one manual smoke per environment.

##### Implementation notes
- Custom domains: `app.baseout.com` (prod) and `staging.baseout.com` (staging).
- Preview deploys require Pages project setting enabled in dashboard.

##### Acceptance criteria
- [ ] `main` deploys to prod on every push.
- [ ] `staging` deploys to staging.
- [ ] PR preview URL posted as GitHub Actions comment.

##### Dependencies
- **Blocked by:** P0.1.2, P0.6.1
- **Blocks:** any deploy
- **Can run in parallel with:** P0.4.2, P0.5.*

##### Out of scope
- `baseout-admin` Pages setup (P0.4.2).

---

#### [P0.4.2] Pages project for `baseout-admin` (prod + staging)

**Parent:** [P0.4](Baseout_Backlog.md) · **Repo:** `infra` + `baseout-admin` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Super-admin app needs its own Pages projects; domain `admin.baseout.com` (prod) and `admin-staging.baseout.com` (staging).

##### Spec references
- [Baseout_PRD.md §16.1](Baseout_PRD.md) — admin app scope.

##### Canonical terms
N/A.

##### Files to touch
- `baseout-admin/wrangler.jsonc` (new) — mirrors P0.4.1 shape.
- `infra/docs/cloudflare-pages.md` (modified) — add baseout-admin bindings.

##### Failing test to write first
- **File:** `baseout-admin/tests/deploy/pages-preview.md` (runbook-style).
- Command: mirror P0.4.1.

##### Implementation notes
- Admin app stays minimal until Phase 6 — Pages project just needs to boot the empty shell.

##### Acceptance criteria
- [ ] Empty shell deploys to prod + staging custom domains.
- [ ] Preview URLs post on PR.

##### Dependencies
- **Blocked by:** P0.1.1, P0.6.1
- **Blocks:** P6.1
- **Can run in parallel with:** P0.4.1

##### Out of scope
- Admin features.

---

#### [P0.4.3] Verify custom-domain + preview deployment end-to-end

**Parent:** [P0.4](Baseout_Backlog.md) · **Repo:** `infra` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
One explicit verification sub-issue catches DNS/cert mistakes before Phase 1 features land on top.

##### Spec references
- [Baseout_PRD.md §4](Baseout_PRD.md).

##### Canonical terms
N/A.

##### Files to touch
- `infra/docs/cloudflare-pages.md` (modified) — append "Verification" checklist.

##### Failing test to write first
- **File:** N/A (manual verification).
- **Cases:**
  - `curl -I https://app.baseout.com` → 200 with TLS.
  - `curl -I https://staging.baseout.com` → 200.
  - PR → preview URL → 200.

##### Implementation notes
- DNS may take up to 24h to propagate — schedule accordingly.

##### Acceptance criteria
- [ ] All four URLs return 200 with valid TLS.
- [ ] Verification runbook checked into `infra/docs/`.

##### Dependencies
- **Blocked by:** P0.4.1, P0.4.2
- **Blocks:** none (unblocks confidence)
- **Can run in parallel with:** P0.5.3

##### Out of scope
- Load / perf testing.

---

### P0.5

**Parent:** [P0.5 Cloudflare Workers projects](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P1B.*, P2C.*.

---

#### [P0.5.1] `wrangler.toml` for `baseout-backup-engine` with DO scaffolding

**Parent:** [P0.5](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Phase 1 needs a Durable Object class `SpaceController` (P1B.2). Declare the DO binding + migration here so P1B.2 can focus on behavior.

##### Spec references
- [Baseout_PRD.md §4](Baseout_PRD.md) — DO + Trigger.dev.
- [Baseout_Implementation_Plan.md §Phase 1B.2](Baseout_Implementation_Plan.md).

##### Canonical terms
Space.

##### Files to touch
- `baseout-backup-engine/wrangler.toml` (new) — `[[durable_objects.bindings]]`, `[[migrations]]`, env blocks.
- `baseout-backup-engine/src/space-controller.ts` (new) — empty class export.

##### Failing test to write first
- **File:** `baseout-backup-engine/tests/integration/wrangler-deploy.test.ts`
- **Cases:**
  - `wrangler deploy --dry-run --env staging` exits 0.
  - DO class name declared matches the exported symbol.
- Command: `npm run deploy:dry`.

##### Implementation notes
- Mirror the jsonc style from [baseout-web/wrangler.jsonc](../wrangler.jsonc) where possible.
- Declare R2 + KV bindings as placeholders; IDs land in P0.6.

##### Acceptance criteria
- [ ] `wrangler deploy --dry-run` exits 0.
- [ ] DO class exported and registered.

##### Dependencies
- **Blocked by:** P0.1.3, P0.6.1
- **Blocks:** P1B.2
- **Can run in parallel with:** P0.5.2

##### Out of scope
- DO behavior.

---

#### [P0.5.2] `wrangler.toml` for `baseout-background-services` (cron Worker)

**Parent:** [P0.5](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Background services Worker needs scheduled Worker config (no DOs required for Phase 2C).

##### Spec references
- [Baseout_Implementation_Plan.md §Phase 2C](Baseout_Implementation_Plan.md).

##### Canonical terms
N/A.

##### Files to touch
- `baseout-background-services/wrangler.toml` (modified — scaffolded in P0.1.3) — add `[triggers]` block (empty crons list for now), env blocks.

##### Failing test to write first
- **File:** `baseout-background-services/tests/integration/wrangler-deploy.test.ts`
- **Cases:**
  - Dry-run deploy exits 0.

##### Implementation notes
- Keep `triggers.crons = []` — P2C sub-issues populate it.

##### Acceptance criteria
- [ ] Dry-run deploy passes.
- [ ] Env blocks (`staging`, `production`) declared.

##### Dependencies
- **Blocked by:** P0.1.3, P0.6.1
- **Blocks:** P2C.*
- **Can run in parallel with:** P0.5.1

##### Out of scope
- Cron handler behavior.

---

#### [P0.5.3] Health endpoint + dev-loop + staging deploy smoke

**Parent:** [P0.5](Baseout_Backlog.md) · **Repo:** both Worker repos · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
One health endpoint per Worker lets ops confirm a deploy is live without running behaviors.

##### Spec references
- [Baseout_PRD.md §16.2](Baseout_PRD.md) — observability.

##### Canonical terms
N/A.

##### Files to touch
- `baseout-backup-engine/src/index.ts` (new) — minimal fetch handler returning 200 for `/health`.
- `baseout-background-services/src/index.ts` (new) — same.

##### Failing test to write first
- **File:** `baseout-backup-engine/tests/unit/health.test.ts`, `baseout-background-services/tests/unit/health.test.ts`
- **Cases:**
  - `GET /health` returns 200 JSON `{status:"ok", commit:<sha>}`.

##### Implementation notes
- Include Git SHA via `wrangler` build-time env var for traceability.
- After deploy: `curl https://<workers-host>/health` in CI smoke step.

##### Acceptance criteria
- [ ] `/health` returns 200 on both Workers in staging.
- [ ] Staging deploy added as a CI job that runs after tests.

##### Dependencies
- **Blocked by:** P0.5.1, P0.5.2
- **Blocks:** Phase 1 engine work
- **Can run in parallel with:** P0.4.3

##### Out of scope
- Auth on health endpoint (not needed for MVP ops).

---

### P0.6

**Parent:** [P0.6 Staging Cloudflare account + namespaces](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P0.4, P0.5.

---

#### [P0.6.1] Create staging Cloudflare account + IAM tokens scoped to staging

**Parent:** [P0.6](Baseout_Backlog.md) · **Repo:** `infra` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `🔒 security:new-secret`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Per [PRD §20](Baseout_PRD.md), staging lives on a separate Cloudflare account from prod so a bug in staging can never touch production data.

##### Spec references
- [Baseout_PRD.md §20](Baseout_PRD.md) — environment separation.

##### Canonical terms
N/A.

##### Files to touch
- `infra/docs/cloudflare-accounts.md` (new, private ops doc) — account IDs, token scopes, owner.

##### Failing test to write first
- **File:** N/A (infra provisioning).
- Verification via `wrangler whoami --env staging` returns the staging account ID.

##### Implementation notes
- Account email must be separate from prod owner to prevent credential reuse.
- API tokens scoped to staging-only resources (no wildcard account-level tokens).

##### Acceptance criteria
- [ ] Staging Cloudflare account exists.
- [ ] Two API tokens (admin + CI deploy) scoped to staging only.
- [ ] Ops doc lists IDs + rotation cadence.

##### Security 🔒
- No prod token ever used in staging workflows.
- API tokens stored only in Cloudflare Secrets (per-repo) + 1Password org vault.

##### Dependencies
- **Blocked by:** none
- **Blocks:** P0.6.2, P0.4.*, P0.5.*, P0.8.*
- **Can run in parallel with:** P0.1.*, P0.10.*, P0.11.*

##### Out of scope
- Prod account setup (P0.6.3 mirrors the process).

---

#### [P0.6.2] Provision staging D1 + R2 bucket + KV namespace

**Parent:** [P0.6](Baseout_Backlog.md) · **Repo:** `infra` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `🔒 security:new-secret`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Phase 1 backup engine writes to R2 (P1D.1) and may use KV/D1 for state. Provision namespaces now; record IDs for P0.5 to bind.

##### Spec references
- [Baseout_PRD.md §4](Baseout_PRD.md).

##### Canonical terms
R2.

##### Files to touch
- `infra/docs/cloudflare-accounts.md` (modified) — append staging R2/KV/D1 IDs.

##### Failing test to write first
- **File:** N/A (provisioning).
- Verification via `wrangler r2 bucket list --env staging`.

##### Implementation notes
- R2 bucket naming: `baseout-staging-backups`.
- KV namespace: `baseout-staging-kv` (for pre-reg schema session storage in P1A.5).
- D1 DB: `baseout-staging-d1` (used by P3B, not MVP — but provision now so IDs are stable).

##### Acceptance criteria
- [ ] All three namespaces exist in staging.
- [ ] IDs recorded in ops doc.

##### Security 🔒
- R2 bucket SSE enabled by default.

##### Dependencies
- **Blocked by:** P0.6.1
- **Blocks:** P0.4.1, P0.5.1, P1A.5, P1D.1
- **Can run in parallel with:** P0.6.3

##### Out of scope
- Per-Organization prefixing (handled at writer level — P1D.1).

---

#### [P0.6.3] Mirror prod Cloudflare namespaces + document parity

**Parent:** [P0.6](Baseout_Backlog.md) · **Repo:** `infra` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `🔒 security:new-secret`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Mirror the same provisioning on prod account. Document parity so drift between environments is obvious in review.

##### Spec references
- [Baseout_PRD.md §20](Baseout_PRD.md).

##### Canonical terms
N/A.

##### Files to touch
- `infra/docs/cloudflare-accounts.md` (modified) — prod section mirrors staging.

##### Failing test to write first
- **File:** `infra/scripts/env-parity.mjs` (new, optional helper)
- **Cases:**
  - Script compares staging + prod bindings listed in ops doc → prints differences.

##### Implementation notes
- Prod R2 bucket: `baseout-prod-backups`. Prod KV: `baseout-prod-kv`. Prod D1: `baseout-prod-d1`.

##### Acceptance criteria
- [ ] Prod namespaces exist.
- [ ] Parity script reports zero drift on binding categories.
- [ ] Prod tokens stored only in prod Cloudflare Secrets + ops vault.

##### Security 🔒
- Prod-to-staging firewalling: verify prod tokens cannot read staging and vice versa.

##### Dependencies
- **Blocked by:** P0.6.2
- **Blocks:** production deploys
- **Can run in parallel with:** none (ops sequencing)

##### Out of scope
- Full DR / backup-of-backups strategy.

---

### P0.7

**Parent:** [P0.7 Define and migrate master DB schema](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P1A.*, P1B.*, P2C.*, P4A.*.

Schema modules live in existing [src/db/schema/](../src/db/schema/). Extend — don't replace. Sub-issues are ordered: crypto helper first (used by connections), then tables in dependency order, then migration + roundtrip.

---

#### [P0.7.1] Drizzle schema: `organizations` table

**Parent:** [P0.7](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `🔒 security:new-sql-surface`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
`organizations` is the root entity of the canonical hierarchy — every other row is scoped to one. Columns per [PRD §21.3](Baseout_PRD.md). Naming per [PRD §21.2](Baseout_PRD.md): plural table, snake_case, UUID `id`, `created_at`/`modified_at`, `is_` booleans.

##### Spec references
- [Baseout_PRD.md §21.2](Baseout_PRD.md) — naming conventions.
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `organizations` columns.
- [Baseout_Features.md §1](Baseout_Features.md) — Organization canonical term.

##### Canonical terms
Organization. **Forbidden:** `tenant`, `workspace`, `account` (except `account_owner_user_id`).

##### Files to touch
- `src/db/schema/organizations.ts` (new)
- `src/db/schema/index.ts` (modified) — re-export.
- `src/db/schema/organizations.test.ts` (new)

##### Failing test to write first
- **File:** `src/db/schema/organizations.test.ts`
- **Cases:**
  - Column set matches PRD §21.3 (`id`, `name`, `slug`, `stripe_customer_id`, `account_owner_user_id` (nullable until P0.7.2), `created_at`, `modified_at`).
  - `id` defaults to `gen_random_uuid()`.
  - `slug` is unique.
- Command: `npm run test:integration`.

##### Implementation notes
- Use `pgTable('organizations', ...)` via existing Drizzle setup in [src/db/index.ts](../src/db/index.ts).
- `stripe_customer_id` is text + nullable (filled by P1A.3).
- Indexes: unique(`slug`), index(`stripe_customer_id`).

##### Acceptance criteria
- [ ] Schema compiles with `drizzle-kit check`.
- [ ] Integration test inserts + reads an Organization.
- [ ] No forbidden synonyms in source or test.

##### Security 🔒
- `slug` must not allow path traversal — alphanumeric + `-`.

##### Dependencies
- **Blocked by:** P0.1.2, P0.3.1
- **Blocks:** P0.7.2, P0.7.4, P0.7.5
- **Can run in parallel with:** P0.7.3

##### Out of scope
- Billing state (`subscriptions` table — P0.7.5).
- RLS policies (not used; all access is app-layer — CLAUDE.md §2).

---

#### [P0.7.2] Drizzle schema: `users` + `sessions` tables (extend better-auth)

**Parent:** [P0.7](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `🔒 security:new-sql-surface`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
better-auth creates its own `users` / `sessions` tables. Extend them with `organization_id` FK and Baseout-specific columns (per [PRD §21.3](Baseout_PRD.md)).

##### Spec references
- [Baseout_PRD.md §13](Baseout_PRD.md) — auth model.
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `users`, `sessions` columns.

##### Canonical terms
User, Organization, Session.

##### Files to touch
- `src/db/schema/users.ts` (new) — extends the better-auth-generated columns.
- `src/db/schema/sessions.ts` (new)
- `src/db/schema/index.ts` (modified)
- `src/db/schema/users.test.ts` (new)

##### Failing test to write first
- **File:** `src/db/schema/users.test.ts`
- **Cases:**
  - Insert User with valid `organization_id` succeeds.
  - Insert User with missing `organization_id` fails (NOT NULL).
  - `users.role` enum accepts `owner`, `admin`, `member`.
- Command: `npm run test:integration`.

##### Implementation notes
- Reuse existing better-auth `users` table — don't re-create. Add columns via a follow-on Drizzle migration.
- FK `organization_id` → `organizations.id` ON DELETE RESTRICT (never cascade-drop an Org with users; Org deletion is an admin ritual).
- Reuse existing [src/lib/auth.ts](../src/lib/auth.ts) + [src/lib/auth-factory.ts](../src/lib/auth-factory.ts) wiring; no changes there in this sub-issue.

##### Acceptance criteria
- [ ] Users + sessions schemas compile + migrate cleanly.
- [ ] Integration test covers FK enforcement.
- [ ] better-auth continues to pass its own test (smoke).

##### Security 🔒
- `password_hash` column lives under better-auth control — do not add a parallel one.
- `sessions.token` is a hash, not plaintext ([CLAUDE.md §2](../.claude/CLAUDE.md)).

##### Dependencies
- **Blocked by:** P0.7.1
- **Blocks:** P0.7.4, P1A.1
- **Can run in parallel with:** P0.7.3

##### Out of scope
- 2FA / SSO columns (Phase 6).

---

#### [P0.7.3] AES-256-GCM encrypt/decrypt helper + test vectors

**Parent:** [P0.7](Baseout_Backlog.md) · **Repo:** `baseout-web` + `baseout-backup-engine` · **Capability:** auth
**Labels:** `phase:0`, `milestone:mvp`, `capability:auth`, `🔒 security:encryption`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Every `*_enc` column ([PRD §20.2](Baseout_PRD.md)) uses this helper. Must ship before any table that stores encrypted data (P0.7.4 `connections`, P0.7.5 `api_tokens`).

##### Spec references
- [Baseout_PRD.md §20.2](Baseout_PRD.md) — AES-256-GCM, master key, per-row IV.
- [CLAUDE.md §2](../.claude/CLAUDE.md) — never plaintext tokens.

##### Canonical terms
Connection, Master Encryption Key.

##### Files to touch
- `src/lib/crypto.ts` (new) — `encrypt(plaintext: string) => EncryptedBlob` + `decrypt(EncryptedBlob) => string`.
- `src/lib/crypto.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/crypto.test.ts`
- **Cases:**
  - `decrypt(encrypt('hello')) === 'hello'` (roundtrip).
  - Each `encrypt` call produces a different ciphertext for the same plaintext (fresh IV).
  - `decrypt` on a blob with tampered auth tag throws `DecryptError`.
  - `decrypt` with wrong key throws `DecryptError` (does not silently return garbage).
  - Known-answer test: hardcoded key + hardcoded IV + "hello" → hardcoded ciphertext (regression lock).
- Command: `npm test src/lib/crypto.test.ts`.

##### Implementation notes
- Use WebCrypto `SubtleCrypto` (works in both Cloudflare Workers and Node via undici).
- 96-bit IV (12 bytes), auth tag verified (GCM default).
- Key sourced from `env.MASTER_ENCRYPTION_KEY` (base64 32 bytes).
- Return shape: `{ ciphertext: string /* base64 */, iv: string /* base64 */ }`; auth tag appended to ciphertext.
- Export a `rotateKey(blob, oldKey, newKey)` helper signature for future key rotation (can throw "not implemented" — door opener, not impl).

##### Acceptance criteria
- [ ] All five test cases green.
- [ ] No `any` types; `EncryptedBlob` has a typed interface.
- [ ] Helper is a pure function — no global state, no logging of plaintext/keys.
- [ ] File exports a named `DecryptError` class.

##### Security 🔒
- Never log plaintext or key bytes. Tests assert no `console.log` touching secrets.
- Rotation runbook cited in file JSDoc ([PRD §20.2](Baseout_PRD.md)).

##### Dependencies
- **Blocked by:** P0.1.2, P0.8.1 (for `MASTER_ENCRYPTION_KEY` in Secrets)
- **Blocks:** P0.7.4, P0.7.5, P1B.1, P1D.2–P1D.7, P2C.2
- **Can run in parallel with:** P0.7.1, P0.7.2

##### Out of scope
- Key rotation implementation (follow-on work, not MVP).
- Hashed-vs-encrypted decision for API tokens (see P0.7.5).

---

#### [P0.7.4] Drizzle schema: `connections` table with `*_enc` columns

**Parent:** [P0.7](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `🔒 security:new-sql-surface`, `🔒 security:encryption`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
`connections` stores OAuth tokens to Airtable + Storage Destinations. Columns end in `_enc` to signal AES-256-GCM storage ([PRD §20.2](Baseout_PRD.md)).

##### Spec references
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `connections` columns.
- [Baseout_Features.md §1](Baseout_Features.md) — Connection, Platform.

##### Canonical terms
Connection, Platform (values: `airtable`, `google_drive`, `dropbox`, `box`, `onedrive`, `s3`, `frameio`).

##### Files to touch
- `src/db/schema/connections.ts` (new)
- `src/db/schema/index.ts` (modified)
- `src/db/schema/connections.test.ts` (new)

##### Failing test to write first
- **File:** `src/db/schema/connections.test.ts`
- **Cases:**
  - Insert Connection with `access_token_enc` (JSON blob from crypto helper) succeeds.
  - `platform` column enforces enum.
  - `organization_id` FK enforced.
  - `token_expires_at` nullable.
- Command: `npm run test:integration`.

##### Implementation notes
- Columns: `id`, `organization_id` FK, `platform`, `scope` (standard/enterprise variant marker), `access_token_enc`, `refresh_token_enc`, `token_expires_at`, `is_dead`, `created_at`, `modified_at`.
- Store encrypted blobs as `jsonb` holding `{ciphertext, iv}` from P0.7.3.

##### Acceptance criteria
- [ ] Schema migrates cleanly.
- [ ] No plain `access_token` or `refresh_token` columns exist.
- [ ] Integration test round-trips an encrypted token through insert + select.

##### Security 🔒
- Linter rule (or test grep) asserts schema has no column named `*_token` without `_enc`.

##### Dependencies
- **Blocked by:** P0.7.1, P0.7.3
- **Blocks:** P1B.1, P1D.*, P2C.2
- **Can run in parallel with:** P0.7.5

##### Out of scope
- OAuth flow (P1B.1).

---

#### [P0.7.5] Drizzle schemas: `spaces`, `backup_runs`, `subscriptions`, `api_tokens`, `notification_log`

**Parent:** [P0.7](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `🔒 security:new-sql-surface`, `granularity:tdd`, `agentic-ready`
**Estimate:** L

##### Context
Remaining MVP tables per [PRD §21.3](Baseout_PRD.md). Grouped because they're independent of each other and share the same naming/constraints pattern.

##### Spec references
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — column specs per table.
- [Baseout_Features.md §1](Baseout_Features.md) — Space, Backup Run, Subscription.

##### Canonical terms
Space, Backup Run, Subscription, API Token, Notification.

##### Files to touch
- `src/db/schema/spaces.ts` (new)
- `src/db/schema/backup_runs.ts` (new)
- `src/db/schema/subscriptions.ts` (new)
- `src/db/schema/api_tokens.ts` (new)
- `src/db/schema/notification_log.ts` (new)
- `src/db/schema/index.ts` (modified)
- One test file per table (new, five total).

##### Failing test to write first
Per table:
- Insert succeeds with valid FKs.
- Insert fails on missing required cols.
- Enum columns (`backup_runs.status`, `subscriptions.status`) enforce values.
- `api_tokens.token_hash` column exists; `token` (plaintext) column does NOT.

##### Implementation notes
- `spaces`: `id`, `organization_id` FK, `name`, `platform`, `connection_id` FK, `backup_frequency`, `storage_destination_id`, `wizard_step`, `auto_add_future_bases`, `is_trial_locked`, timestamps.
- `backup_runs`: `id`, `space_id` FK, `status` enum (`pending`, `running`, `success`, `failed`, `trial_complete`), `started_at`, `completed_at`, `record_count`, `table_count`, `attachment_count`, `is_trial`, `error_message`, `created_at`.
- `subscriptions`: `id`, `organization_id` FK, `stripe_subscription_id`, `status` (`trialing`, `active`, `past_due`, `canceled`), `trial_ends_at`, `platform`, `tier`, `created_at`, `modified_at`.
- `api_tokens`: `id`, `organization_id` FK, `token_hash`, `label`, `scopes` (jsonb), `created_at`, `last_used_at`.
- `notification_log`: `id`, `organization_id` FK, `user_id` FK, `event_type`, `email_template_id`, `sent_at`, `status`, `metadata` jsonb.

##### Acceptance criteria
- [ ] All five schemas compile + migrate.
- [ ] Each has integration test(s) covering insert + constraint.
- [ ] `api_tokens` has hashed column only.

##### Security 🔒
- Never store plaintext tokens anywhere ([CLAUDE.md §2](../.claude/CLAUDE.md)).
- Grep rule in CI: reject `*_token` columns without `_hash` or `_enc` suffix (test-level assertion acceptable if no CI rule).

##### Dependencies
- **Blocked by:** P0.7.1, P0.7.2
- **Blocks:** P0.7.6, P1A.3, P1A.6, P1B.7, P2C.*
- **Can run in parallel with:** P0.7.4

##### Out of scope
- Schema for Phase 3+ tables (`schema_changelog`, `schema_health`, `space_databases`) — V1 only, not MVP.

---

#### [P0.7.6] Initial Drizzle migration + roundtrip integration test

**Parent:** [P0.7](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `🔒 security:new-sql-surface`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Glue sub-issue: generate the initial migration from combined schema (P0.7.1–5), verify it runs cleanly on a fresh Compose Postgres, and seeds fixture.

##### Spec references
- [Baseout_PRD.md §21.3](Baseout_PRD.md).

##### Canonical terms
Organization, User, Space, Connection, Backup Run, Subscription.

##### Files to touch
- `drizzle/migrations/0001_initial.sql` (new, generated)
- `scripts/migrate.ts` (new or extend [scripts/launch.mjs](../scripts/launch.mjs)) — runs `drizzle-kit migrate`.
- `tests/integration/full-schema.test.ts` (new)

##### Failing test to write first
- **File:** `tests/integration/full-schema.test.ts`
- **Cases:**
  - Fresh Postgres (`npm run db:up`) + migrate + seed → `SELECT`s on every table succeed.
  - Insert Org → User → Space → Connection → Backup Run → Subscription sequence succeeds with FK integrity.
- Command: `npm run db:up && npm run migrate && npm run seed && vitest run tests/integration/full-schema.test.ts`.

##### Implementation notes
- Generated migration file checked into repo (never auto-applied in prod without review).
- Reuse P0.3.2 seed; extend with Connection fixture.

##### Acceptance criteria
- [ ] Migration runs on fresh DB without error.
- [ ] Integration test green in CI (P0.2.2 Postgres service container).
- [ ] `drizzle-kit push` is a no-op after migration applied.

##### Security 🔒
- Migration reviewed for plaintext token columns (should be zero).

##### Dependencies
- **Blocked by:** P0.7.1, P0.7.2, P0.7.3, P0.7.4, P0.7.5, P0.2.2
- **Blocks:** every feature sub-issue that touches the master DB
- **Can run in parallel with:** none (gate)

##### Out of scope
- Rolling migration strategy for prod (handled in P6 / ops runbooks).

---

### P0.8

**Parent:** [P0.8 Cloudflare Secrets per environment](Baseout_Backlog.md) · granularity: `tdd` · Blocks: everything that needs a secret.

Sub-issues ordered by fan-out: `MASTER_ENCRYPTION_KEY` first (used by P0.7.3 + P1B.1 + every connector).

---

#### [P0.8.1] Generate + set `MASTER_ENCRYPTION_KEY` in staging + prod

**Parent:** [P0.8](Baseout_Backlog.md) · **Repo:** `infra` + Worker/Pages projects · **Capability:** auth
**Labels:** `phase:0`, `milestone:mvp`, `capability:auth`, `🔒 security:new-secret`, `🔒 security:encryption`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
32-byte AES-256 key used by every `*_enc` column. Highest-blast-radius secret in the system — must be generated correctly and rotated on a clear runbook.

##### Spec references
- [Baseout_PRD.md §20.2](Baseout_PRD.md).

##### Canonical terms
Master Encryption Key.

##### Files to touch
- `infra/scripts/generate-master-key.mjs` (new) — `node` script wrapping `crypto.randomBytes(32).toString('base64')`.
- `infra/docs/secret-rotation.md` (new) — per-secret rotation runbook.
- `.env.example` (modified — [.env.example](../.env.example) exists) — add `MASTER_ENCRYPTION_KEY=` placeholder.

##### Failing test to write first
- **File:** `infra/scripts/generate-master-key.test.mjs`
- **Cases:**
  - Output is 32 bytes when base64-decoded.
  - Two calls return different values.

##### Implementation notes
- Keys generated by `crypto.randomBytes` — never typed by hand.
- Set via `wrangler secret put MASTER_ENCRYPTION_KEY --env staging` and same for prod (different keys per env).
- Audit log entry (manual for now): date, setter, env.

##### Acceptance criteria
- [ ] Staging secret present; prod secret present; values differ.
- [ ] Rotation runbook documents revocation path.
- [ ] `.env.example` lists the variable with empty value.

##### Security 🔒
- Keys never committed.
- Keys never appear in PR or terminal scrollback (use `--stdin` + secrets-manager paste).

##### Dependencies
- **Blocked by:** P0.6.1
- **Blocks:** P0.7.3, P1B.1, P1D.*
- **Can run in parallel with:** P0.8.2, P0.8.3, P0.8.4

##### Out of scope
- Automatic rotation (future work).

---

#### [P0.8.2] Set `DATABASE_URL` + `BETTER_AUTH_SECRET` in staging + prod

**Parent:** [P0.8](Baseout_Backlog.md) · **Repo:** `infra` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `🔒 security:new-secret`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Master Postgres connection string + better-auth signing secret. No app code can run without both.

##### Spec references
- [Baseout_PRD.md §20](Baseout_PRD.md).
- [Baseout_PRD.md §13](Baseout_PRD.md) — better-auth.

##### Canonical terms
N/A.

##### Files to touch
- `.env.example` (modified)
- `infra/docs/secret-rotation.md` (modified)

##### Failing test to write first
- **File:** `tests/integration/env-guard.test.ts`
- **Cases:**
  - Missing `DATABASE_URL` → startup fails fast with a clear error.
  - Missing `BETTER_AUTH_SECRET` → better-auth init throws.

##### Implementation notes
- Postgres: staging = DigitalOcean staging cluster; prod = DO prod cluster.
- `BETTER_AUTH_SECRET`: 32-byte random via same generator pattern.
- Validate env presence in existing [src/env.d.ts](../src/env.d.ts) types + runtime check.

##### Acceptance criteria
- [ ] Both secrets set in both envs.
- [ ] Env guard test green.
- [ ] No default/fallback values in code.

##### Security 🔒
- No PR ever logs either value.

##### Dependencies
- **Blocked by:** P0.6.1
- **Blocks:** P1A.1, P1A.3
- **Can run in parallel with:** P0.8.1, P0.8.3, P0.8.4

##### Out of scope
- Read replicas.

---

#### [P0.8.3] Set Stripe secrets: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`

**Parent:** [P0.8](Baseout_Backlog.md) · **Repo:** `infra` · **Capability:** billing
**Labels:** `phase:0`, `milestone:mvp`, `capability:billing`, `🔒 security:new-secret`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Required before any Stripe API call or webhook verification (P1A.3, P0.11.3, P4A.*).

##### Spec references
- [Baseout_Features.md §5.5](Baseout_Features.md).

##### Canonical terms
Subscription.

##### Files to touch
- `.env.example` (modified)
- `infra/docs/secret-rotation.md` (modified)

##### Failing test to write first
- **File:** `tests/integration/stripe-env.test.ts`
- **Cases:**
  - `stripe.customers.list()` with test key succeeds.
  - Missing env var → boot fails.

##### Implementation notes
- Test mode key in staging; live key in prod — never crossed.
- Webhook secret rotated separately (stripe dashboard ritual).

##### Acceptance criteria
- [ ] Both secrets set per env.
- [ ] Smoke test hits Stripe test API successfully.

##### Security 🔒
- Live key stored only in prod; CI never touches live.

##### Dependencies
- **Blocked by:** P0.6.1
- **Blocks:** P0.11.1, P1A.3, P4A.*
- **Can run in parallel with:** P0.8.1, P0.8.2, P0.8.4

##### Out of scope
- Stripe product creation (P0.11).

---

#### [P0.8.4] Set Airtable OAuth + Storage OAuth secrets

**Parent:** [P0.8](Baseout_Backlog.md) · **Repo:** `infra` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `🔒 security:new-secret`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Remaining MVP secrets: `AIRTABLE_OAUTH_CLIENT_ID`, `AIRTABLE_OAUTH_CLIENT_SECRET`, plus Storage Destination OAuth client pairs (Google Drive, Dropbox, Box, OneDrive in MVP — S3/Frame.io Growth+). No runtime secret for email — Cloudflare Email Service uses binding-auth, not an API key.

##### Spec references
- [Baseout_PRD.md §2.1](Baseout_PRD.md) — Airtable OAuth.
- [Baseout_Features.md §14](Baseout_Features.md) — Storage Destinations.

##### Canonical terms
Connection, Storage Destination.

##### Files to touch
- `.env.example` (modified) — list every secret with empty value.
- `infra/docs/secret-rotation.md` (modified).

##### Failing test to write first
- **File:** `tests/integration/oauth-env.test.ts`
- **Cases:**
  - Env guard: each of the MVP secrets is present and non-empty.

##### Implementation notes
- Each OAuth client pair is registered per env (staging OAuth apps separate from prod).
- S3 credentials not required for MVP (Growth+ gated); still stub the env var names for forward-compat.

##### Acceptance criteria
- [ ] All MVP secrets set in staging + prod.
- [ ] Env guard test enumerates and checks every var.

##### Security 🔒
- Narrow OAuth scopes documented per provider (see `P1D.*` for scope specifics).

##### Dependencies
- **Blocked by:** P0.6.1, P0.10.2
- **Blocks:** P1B.1, P1D.*, P2D.1a
- **Can run in parallel with:** P0.8.1, P0.8.2, P0.8.3

##### Out of scope
- Secret rotation automation.

---

#### [P0.8.5] `.env.example` completeness + rotation runbook + audit log

**Parent:** [P0.8](Baseout_Backlog.md) · **Repo:** `infra` + `baseout-web` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `🔒 security:new-secret`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Closing sub-issue: every secret from P0.8.1–4 listed in [.env.example](../.env.example), audit log of initial sets recorded, rotation runbook reviewed.

##### Spec references
- [Baseout_PRD.md §20](Baseout_PRD.md).

##### Canonical terms
N/A.

##### Files to touch
- `.env.example` (modified)
- `infra/docs/secret-rotation.md` (modified) — final review pass.
- `infra/docs/secret-audit-log.md` (new) — initial-set entry.

##### Failing test to write first
- **File:** `tests/integration/env-example-completeness.test.ts`
- **Cases:**
  - Every `env.X` read in [src/](../src/) appears in `.env.example`.

##### Implementation notes
- Use a simple AST scan or grep to enumerate `env.*` reads.
- Audit log entries: date, env, secret name, setter, rotation-due-by.

##### Acceptance criteria
- [ ] No missing entries.
- [ ] Rotation runbook cites blast radius per secret.
- [ ] Audit log entry for every MVP secret exists.

##### Security 🔒
- The audit log never stores values — only metadata.

##### Dependencies
- **Blocked by:** P0.8.1, P0.8.2, P0.8.3, P0.8.4
- **Blocks:** Phase 1 starts
- **Can run in parallel with:** none (synthesis)

##### Out of scope
- Automatic rotation.

---

### P0.9

**Parent:** [P0.9 Scaffold baseout-ui package](Baseout_Backlog.md) · granularity: `tdd` · Blocks: all UI work.

Per [CLAUDE.md §UI/UX](../.claude/CLAUDE.md), theme priority is `@opensided/theme` → `daisyUI` → custom CSS. Components use Astro + TypeScript, mobile-first.

---

#### [P0.9.1] Package scaffold + `@opensided/theme` + daisyUI config + `@nanostores/astro`

**Parent:** [P0.9](Baseout_Backlog.md) · **Repo:** `baseout-ui` · **Capability:** ux
**Labels:** `phase:0`, `milestone:mvp`, `capability:ux`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Bootstrap the shared library: Astro integration, Tailwind + `@opensided/theme`, daisyUI, `nanostores` + `@nanostores/astro` for state. Sets the foundation every component + page builds on.

##### Spec references
- [CLAUDE.md §UI/UX](../.claude/CLAUDE.md) — theme stack.
- [CLAUDE.md §4](../.claude/CLAUDE.md) — state management policy.

##### Canonical terms
N/A.

##### Files to touch
- `baseout-ui/package.json` (modified) — add `@opensided/theme`, `daisyui`, `tailwindcss`, `nanostores`, `@nanostores/astro`, `@testing-library/astro`.
- `baseout-ui/astro.config.mjs` (new)
- `baseout-ui/tailwind.config.ts` (new) — import `@opensided/theme` tokens.
- `baseout-ui/src/index.ts` (new) — package export root.
- `baseout-ui/src/theme.ts` (new) — re-export tokens from `@opensided/theme`.
- `baseout-ui/tests/theme.test.ts` (new)

##### Failing test to write first
- **File:** `baseout-ui/tests/theme.test.ts`
- **Cases:**
  - Imported token names match the `@opensided/theme` export surface (snapshot).
  - daisyUI plugin loaded in Tailwind config.

##### Implementation notes
- Tailwind CSS v4 (matches [package.json](../package.json) version pin in `baseout-web`).
- Publish config: `workspaces` consumption preferred over registry for Phase 0.

##### Acceptance criteria
- [ ] Package builds via `npm run build`.
- [ ] Theme re-export works.
- [ ] `@nanostores/astro` integration imports cleanly.

##### Dependencies
- **Blocked by:** P0.1.1
- **Blocks:** P0.9.2–6, all UI sub-issues
- **Can run in parallel with:** P0.7.*

##### Out of scope
- Individual components (P0.9.2–6).

---

#### [P0.9.2] `Button` component + variants + a11y + tests

**Parent:** [P0.9](Baseout_Backlog.md) · **Repo:** `baseout-ui` · **Capability:** ux
**Labels:** `phase:0`, `milestone:mvp`, `capability:ux`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
First component — sets the pattern for the rest. Astro component with typed props; variants map to daisyUI + `@opensided/theme` tokens.

##### Spec references
- [CLAUDE.md §UI/UX](../.claude/CLAUDE.md) — 44×44px touch targets, semantic HTML.

##### Canonical terms
N/A.

##### Files to touch
- `baseout-ui/src/components/Button.astro` (new)
- `baseout-ui/src/components/Button.types.ts` (new)
- `baseout-ui/tests/Button.test.ts` (new)

##### Failing test to write first
- **File:** `baseout-ui/tests/Button.test.ts`
- **Cases:**
  - Renders `<button type="button">` by default.
  - Supports variants: `primary`, `secondary`, `danger`, `ghost`.
  - Disabled prop renders `aria-disabled="true"` + `disabled`.
  - Touch target ≥ 44×44px at default size.

##### Implementation notes
- No `any` types; prop interface in `.types.ts`.
- Variant class maps use theme tokens; no raw hex.

##### Acceptance criteria
- [ ] All test cases green.
- [ ] Storybook entry or preview page renders all variants.
- [ ] Keyboard focus visible (`focus-visible` styles).

##### Dependencies
- **Blocked by:** P0.9.1
- **Blocks:** every UI sub-issue in Phase 1+
- **Can run in parallel with:** P0.9.3, P0.9.4, P0.9.5

##### Out of scope
- Loading spinner animation (nice-to-have, later).

---

#### [P0.9.3] `Input` component + form semantics + tests

**Parent:** [P0.9](Baseout_Backlog.md) · **Repo:** `baseout-ui` · **Capability:** ux
**Labels:** `phase:0`, `milestone:mvp`, `capability:ux`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Text input for all forms (sign-up email, OAuth callback display, wizard fields).

##### Spec references
- [CLAUDE.md §UI/UX](../.claude/CLAUDE.md).

##### Canonical terms
N/A.

##### Files to touch
- `baseout-ui/src/components/Input.astro` (new)
- `baseout-ui/src/components/Input.types.ts` (new)
- `baseout-ui/tests/Input.test.ts` (new)

##### Failing test to write first
- Cases:
  - Renders `<input>` with matching `<label>` (via `for`/`id`).
  - Types: `text`, `email`, `password`, `number`.
  - Error state renders `aria-invalid="true"` + error message.
  - `required` propagates.

##### Implementation notes
- Prop `label` required — enforces a11y (no bare inputs).

##### Acceptance criteria
- [ ] All cases green.
- [ ] No bare `<input>` without label.

##### Dependencies
- **Blocked by:** P0.9.1
- **Blocks:** P1A.2 sign-in form
- **Can run in parallel with:** P0.9.2, P0.9.4, P0.9.5

##### Out of scope
- Async validation.

---

#### [P0.9.4] `Modal` component + focus trap + tests

**Parent:** [P0.9](Baseout_Backlog.md) · **Repo:** `baseout-ui` · **Capability:** ux
**Labels:** `phase:0`, `milestone:mvp`, `capability:ux`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Used by Restore confirmation (P2B.*) + upgrade prompts (P4A.*). Must trap focus + close on Escape.

##### Spec references
- [CLAUDE.md §UI/UX](../.claude/CLAUDE.md) — a11y.

##### Canonical terms
N/A.

##### Files to touch
- `baseout-ui/src/components/Modal.astro` (new, with island script)
- `baseout-ui/tests/Modal.test.ts` (new)

##### Failing test to write first
- Cases:
  - `<dialog>` element used.
  - Focus moves into dialog on open.
  - Escape closes.
  - Tab cycle trapped inside modal.

##### Implementation notes
- Prefer native `<dialog>` + `showModal()`; polyfill unnecessary for modern targets.

##### Acceptance criteria
- [ ] All cases green.
- [ ] Works on touch + keyboard.

##### Dependencies
- **Blocked by:** P0.9.1
- **Blocks:** P2B.*, P4A.*
- **Can run in parallel with:** P0.9.2, P0.9.3, P0.9.5

##### Out of scope
- Fancy animations.

---

#### [P0.9.5] `Table` component + pagination props + tests

**Parent:** [P0.9](Baseout_Backlog.md) · **Repo:** `baseout-ui` · **Capability:** ux
**Labels:** `phase:0`, `milestone:mvp`, `capability:ux`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Used by Backup history list (P2A.3), admin tooling (P6.1).

##### Spec references
- [CLAUDE.md §UI/UX](../.claude/CLAUDE.md).

##### Canonical terms
N/A.

##### Files to touch
- `baseout-ui/src/components/Table.astro` (new)
- `baseout-ui/src/components/Table.types.ts` (new)
- `baseout-ui/tests/Table.test.ts` (new)

##### Failing test to write first
- Cases:
  - Renders `<table>` with thead/tbody.
  - Column spec via props; no untyped rows.
  - Empty state renders empty message, not empty `<tbody>`.
  - Pagination prop emits `load-more` event.

##### Implementation notes
- Generic over row shape (`<T>` prop type).

##### Acceptance criteria
- [ ] All cases green.
- [ ] No `any` types.

##### Dependencies
- **Blocked by:** P0.9.1
- **Blocks:** P2A.3, P6.1
- **Can run in parallel with:** P0.9.2, P0.9.3, P0.9.4

##### Out of scope
- Client-side sort / filter (later).

---

#### [P0.9.6] `Layout` + `Toast` + `src/stores/` bootstrap

**Parent:** [P0.9](Baseout_Backlog.md) · **Repo:** `baseout-ui` + `baseout-web` · **Capability:** ux
**Labels:** `phase:0`, `milestone:mvp`, `capability:ux`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Layout = app shell (nav + main). Toast queue = notification UX. Stores bootstrap = `src/stores/` directory in `baseout-web` with one atom per cross-component concern (per [CLAUDE.md §4](../.claude/CLAUDE.md)).

##### Spec references
- [CLAUDE.md §4](../.claude/CLAUDE.md) — nanostores policy.

##### Canonical terms
Organization, Space.

##### Files to touch
- `baseout-ui/src/components/Layout.astro` (new)
- `baseout-ui/src/components/Toast.astro` + island script (new)
- `baseout-web/src/stores/currentOrganization.ts` (new) — atom `Organization | null`.
- `baseout-web/src/stores/currentSpace.ts` (new) — atom `Space | null`.
- `baseout-web/src/stores/toasts.ts` (new) — array atom.
- `baseout-ui/tests/Layout.test.ts`, `baseout-ui/tests/Toast.test.ts` (new)

##### Failing test to write first
- Cases:
  - Layout renders slot + nav.
  - Toast auto-dismisses after `duration` prop.
  - Stores initialize to `null` / `[]`.
  - `resetAllStores()` helper clears every store (needed by P1A.4 logout).

##### Implementation notes
- Use `@nanostores/astro` `<StoreProvider>` pattern.
- Expose `resetAllStores()` from `src/stores/index.ts`; asserts every user-scoped store is cleared (enforced by a test that imports the module and asserts no forgotten stores via an exported manifest).

##### Acceptance criteria
- [ ] All cases green.
- [ ] `resetAllStores()` manifest includes every store file.

##### Security 🔒
- Stores must not hold secrets / tokens — enforced by lint rule or review checklist.

##### Dependencies
- **Blocked by:** P0.9.1
- **Blocks:** P1A.4, P2A.1
- **Can run in parallel with:** P0.9.2–5 (after P0.9.1)

##### Out of scope
- Per-page layouts (each page handles its own slots).

---

### P0.10

**Parent:** [P0.10 Verify `mail.baseout.com` in Cloudflare Email Service](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P1A.2, P2D.1a.

---

#### [P0.10.1] Verify `mail.baseout.com` in Cloudflare Email Service ✅ DONE

**Parent:** [P0.10](Baseout_Backlog.md) · **Repo:** `infra` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `parallel-ok`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Transactional sending domain for magic links, audit reports, alerts. Separate from any future marketing subdomain (V2/TBD). Workers Paid plan required.

##### Spec references
- [Baseout_PRD.md §19](Baseout_PRD.md).

##### Canonical terms
N/A.

##### Files to touch
- `wrangler.jsonc.example` (modified) — `send_email` binding declaration (binding name: `EMAIL`).

##### Failing test to write first
- **File:** N/A (provisioning).
- Verified by the Cloudflare dashboard showing the domain registered and the `EMAIL` binding active on the Worker.

##### Implementation notes
- No runtime API key — auth is handled by the `EMAIL` Workers binding. `EMAIL_FROM` stays as a wrangler var.

##### Acceptance criteria
- [x] Domain verified in Cloudflare Email Service dashboard.
- [x] `send_email` binding present in `wrangler.jsonc` / `wrangler.jsonc.example`.

##### Dependencies
- **Blocked by:** none
- **Blocks:** P0.10.2, P0.8.4
- **Can run in parallel with:** P0.1.*, P0.6.*, P0.11.*

##### Out of scope
- Mail templates (P2D.1a).

---

#### [P0.10.2] DKIM / SPF / DMARC DNS records + verification ✅ DONE

**Parent:** [P0.10](Baseout_Backlog.md) · **Repo:** `infra` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Without DKIM + SPF + DMARC, magic links land in spam. Required for trust + deliverability.

##### Spec references
- [Baseout_PRD.md §19](Baseout_PRD.md).

##### Canonical terms
N/A.

##### Files to touch
- DNS records only — managed via the Cloudflare dashboard (Email Service → Send Domains).

##### Failing test to write first
- **File:** N/A (DNS).
- Verified by `dig TXT mail.baseout.com` returning DKIM + SPF records.

##### Implementation notes
- DMARC policy: start at `p=none` with reports to `dmarc@baseout.com`; tighten to `p=quarantine` post-launch.

##### Acceptance criteria
- [x] DKIM, SPF, DMARC records present.
- [x] Cloudflare Email Service dashboard shows domain "verified."

##### Dependencies
- **Blocked by:** P0.10.1
- **Blocks:** P0.10.3
- **Can run in parallel with:** P0.11.*

##### Out of scope
- ARC headers (advanced).

---

#### [P0.10.3] Staging smoke send + verify DKIM pass headers

**Parent:** [P0.10](Baseout_Backlog.md) · **Repo:** `infra` + `baseout-web` · **Capability:** ci-cd
**Labels:** `phase:0`, `milestone:mvp`, `capability:ci-cd`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Confirms end-to-end deliverability before Phase 1 ships magic links to real humans.

##### Spec references
- [Baseout_PRD.md §19](Baseout_PRD.md).

##### Canonical terms
N/A.

##### Files to touch
- Runs through the existing `sendEmail()` path (`src/lib/email/send.ts`) — no new files.

##### Failing test to write first
- **File:** `tests/integration/email-smoke.test.ts` (staging-only, skipped locally).
- **Cases:**
  - Successful `env.EMAIL.send({ ... })` returns a `messageId`.
  - Test inbox receives email with DKIM=pass header (manual header inspection, asserted once).

##### Implementation notes
- Smoke script runs against a staging Worker with a bound `EMAIL`. No API key needed.
- Do not send from staging to production recipients; restrict `to` to internal test inboxes.

##### Acceptance criteria
- [ ] Smoke send succeeds from staging.
- [ ] DKIM=pass confirmed in received headers.
- [ ] Staging recipient restrictions documented.

##### Dependencies
- **Blocked by:** P0.10.2, P0.8.4
- **Blocks:** P1A.2, P2D.1a
- **Can run in parallel with:** P0.11.3

##### Out of scope
- Template rendering (P2D.1a).

---

### P0.11

**Parent:** [P0.11 Stripe account + products + webhook endpoint](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P1A.3, P4A.*.

Per [Features §5.5](Baseout_Features.md), tiers are Stripe Products with `platform` + `tier` metadata — capability resolution reads metadata, never product name strings.

---

#### [P0.11.1] Create 6 Airtable-tier Stripe Products with `platform` + `tier` metadata

**Parent:** [P0.11](Baseout_Backlog.md) · **Repo:** `infra` · **Capability:** billing
**Labels:** `phase:0`, `milestone:mvp`, `capability:billing`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
6 Products: `Baseout — Airtable — {Starter, Launch, Growth, Pro, Business, Enterprise}`. Metadata drives capability resolution.

##### Spec references
- [Baseout_Features.md §5.5](Baseout_Features.md) — Stripe architecture.
- [Baseout_PRD.md §8.6](Baseout_PRD.md) — naming convention.

##### Canonical terms
Tier, Platform.

##### Files to touch
- `infra/scripts/stripe-bootstrap.mjs` (new) — idempotent script that creates/updates products.
- `infra/docs/stripe.md` (new) — product + metadata catalog.

##### Failing test to write first
- **File:** `infra/scripts/stripe-bootstrap.test.mjs`
- **Cases:**
  - Running the script against a clean test-mode account creates 6 products.
  - Re-running updates (no duplicates).
  - Every product has `metadata.platform == 'airtable'` and `metadata.tier` in the canonical set.

##### Implementation notes
- Run against test mode first, then live — never auto-against live.

##### Acceptance criteria
- [ ] Test mode populated.
- [ ] Metadata verified via `stripe products list --metadata[platform]=airtable`.

##### Dependencies
- **Blocked by:** P0.8.3
- **Blocks:** P0.11.2, P1A.3, P4A.5
- **Can run in parallel with:** P0.10.*

##### Out of scope
- V2 platforms.

---

#### [P0.11.2] Create Monthly + Annual Prices per Product with `billing_period` metadata

**Parent:** [P0.11](Baseout_Backlog.md) · **Repo:** `infra` · **Capability:** billing
**Labels:** `phase:0`, `milestone:mvp`, `capability:billing`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Each product needs a Monthly + Annual Price (12 Prices total). Capability resolver reads `billing_period` metadata, not Price amount, for display.

##### Spec references
- [Baseout_Features.md §5.5](Baseout_Features.md).

##### Canonical terms
Tier.

##### Files to touch
- `infra/scripts/stripe-bootstrap.mjs` (modified) — add Prices.
- `infra/docs/stripe.md` (modified) — price catalog.

##### Failing test to write first
- **File:** `infra/scripts/stripe-bootstrap.test.mjs`
- **Cases:**
  - Each of 6 products has exactly one `monthly` and one `annual` Price active.
  - `metadata.billing_period` in `{monthly, annual}`.

##### Implementation notes
- Pricing values per [Features §3](Baseout_Features.md).

##### Acceptance criteria
- [ ] 12 prices total in test mode.
- [ ] All `billing_period` metadata set.

##### Dependencies
- **Blocked by:** P0.11.1
- **Blocks:** P1A.3, P4A.1
- **Can run in parallel with:** P0.11.3

##### Out of scope
- Trial prices (trial is a Subscription flag, not a Price — P1A.3).

---

#### [P0.11.3] Register `/api/stripe/webhook` stub + signature verification

**Parent:** [P0.11](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** billing
**Labels:** `phase:0`, `milestone:mvp`, `capability:billing`, `🔒 security:new-secret`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Stub route now, real handling in P4A.4. Stub MUST verify signature + return 200 — dropping unsigned events in Phase 0 prevents drift.

##### Spec references
- [Baseout_Features.md §5.5](Baseout_Features.md).

##### Canonical terms
N/A.

##### Files to touch
- `src/pages/api/stripe/webhook.ts` (new)
- `src/pages/api/stripe/webhook.test.ts` (new)

##### Failing test to write first
- **File:** `src/pages/api/stripe/webhook.test.ts`
- **Cases:**
  - Missing signature header → 400.
  - Invalid signature → 400.
  - Valid signature but unknown event type → 200 (stub logs + ignores).
  - Valid signature `customer.subscription.created` → 200 (no-op for now; P4A.4 fills behavior).

##### Implementation notes
- Use Stripe's `constructEvent` from SDK with `STRIPE_WEBHOOK_SECRET`.
- Route body is raw — bypass default JSON parse.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] `stripe trigger customer.subscription.created` against staging returns 200.

##### Security 🔒
- No event handled without signature verification.

##### Dependencies
- **Blocked by:** P0.8.3, P0.11.2
- **Blocks:** P4A.4
- **Can run in parallel with:** P0.11.2

##### Out of scope
- Handler behavior (P4A.4).

---

---

## 4. Epic 2 — Phase 1: Core Auth + Backup Engine

**Milestone:** MVP · **Plan ref:** Phase 1 · **Epic doc:** [Baseout_Backlog.md §Epic 2](Baseout_Backlog.md)

**Parents in this epic (29):**

| Parent | Title | Granularity | Sub-issue count |
|---|---|---|---|
| [P1A.1](#p1a1) | Integrate better-auth | tdd | 6 |
| [P1A.2](#p1a2) | Magic-link sign-up + sign-in flow | tdd | 6 |
| [P1A.3](#p1a3) | Org + User + $0 Stripe sub on sign-up | tdd | 6 |
| [P1A.4](#p1a4) | Session management + route protection | tdd | 5 |
| [P1A.5](#p1a5) | Pre-registration schema viz session | tdd | 5 |
| [P1A.6](#p1a6) | Trial state management + cap enforcement | tdd | 5 |
| [P1B.1](#p1b1) | Airtable OAuth + encrypted token storage | tdd | 6 |
| [P1B.2](#p1b2) | Durable Object per Space | tdd | 6 |
| [P1B.3](#p1b3) | DB-level connection locking | tdd | 5 |
| [P1B.4](#p1b4) | Static backup: schema + records → CSV + R2 | tdd | 7 |
| [P1B.5](#p1b5) | Static backup: attachments with dedup | tdd | 6 |
| [P1B.6](#p1b6) | File path structure | chunk | 3 |
| [P1B.7](#p1b7) | Backup Run record lifecycle | tdd | 5 |
| [P1B.8](#p1b8) | Trial cap enforcement in engine | tdd | 5 |
| [P1B.9](#p1b9) | Trigger.dev job integration | tdd | 5 |
| [P1B.10](#p1b10) | Backup history endpoint | chunk | 3 |
| [P1C.1](#p1c1) | Onboarding Step 1 — Connect Airtable | chunk | 3 |
| [P1C.2](#p1c2) | Onboarding Step 2 — Select bases | chunk | 3 |
| [P1C.3](#p1c3) | Onboarding Step 3 — Pick backup frequency (capability resolver) | tdd | 5 |
| [P1C.4](#p1c4) | Onboarding Step 4 — Pick Storage Destination | chunk | 3 |
| [P1C.5](#p1c5) | Onboarding Step 5 — Confirm + run first backup | tdd | 5 |
| [P1C.6](#p1c6) | Resume incomplete wizard state | chunk | 3 |
| [P1D.1](#p1d1) | R2 managed storage (StorageDestination interface) | tdd | 6 |
| [P1D.2](#p1d2) | Google Drive connector | chunk | 3 |
| [P1D.3](#p1d3) | Dropbox connector (first proxy stream) | tdd | 5 |
| [P1D.4](#p1d4) | Box connector (proxy stream repeat) | chunk | 3 |
| [P1D.5](#p1d5) | OneDrive connector | chunk | 3 |
| [P1D.6](#p1d6) | S3 connector (Growth+) | chunk | 3 |
| [P1D.7](#p1d7) | Frame.io connector (Growth+, unknowns) | tdd | 5 |

---

### P1A.1

**Parent:** [P1A.1 Integrate better-auth](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P1A.2–P1A.6, P1C.*, every protected route.

Wires better-auth into the Astro app as the single source of truth for Sessions, CSRF, and Magic Link issuance. Picks session strategy, isolates Airtable OAuth from the auth handler, and locks cookie hardening. Extends the existing [src/lib/auth.ts](../src/lib/auth.ts) + [src/lib/auth-factory.ts](../src/lib/auth-factory.ts) wiring — does not replace it.

---

#### [P1A.1.1] Define `AuthContext` + `SessionPayload` shared types

**Parent:** [P1A.1](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Every downstream sub-issue in P1A needs typed `user`, `organization`, and `session` shapes on `Astro.locals`. Lock the contract first so middleware, route handlers, and islands share one vocabulary.

##### Spec references
- [Baseout_PRD.md §13](Baseout_PRD.md) — auth model.
- [Baseout_PRD.md §13.2](Baseout_PRD.md) — Session management.
- [CLAUDE.md §1](../.claude/CLAUDE.md) — canonical naming.

##### Canonical terms
User, Organization, Session. Forbidden: `account` (except in existing `account_owner_user_id`), `tenant`, `workspace`.

##### Files to touch
- `src/lib/types.ts` (new) — exports `AuthContext`, `SessionPayload`, `OrganizationContext`.
- `src/env.d.ts` (modified) — widen `Astro.locals` types.
- `src/lib/types.test.ts` (new) — compile-time type assertions.

##### Failing test to write first
- **File:** `src/lib/types.test.ts`
- **Cases:**
  - `AuthContext` requires `user.id`, `user.email`, `organization.id`, `session.id` — missing fields fail `tsc`.
  - `AuthContext.user` is `null` when unauthenticated (discriminated union).
  - `SessionPayload.expiresAt` is a `Date`.
- Command: `npm run typecheck && npm test src/lib/types.test.ts`.

##### Implementation notes
- Re-use the existing `AccountContext` shape from [src/lib/account.ts](../src/lib/account.ts); rename/extend to add `organization`.
- No runtime Zod yet — this issue is about TS contracts. Zod schemas arrive in P1A.1.3.

##### Acceptance criteria
- [ ] `AuthContext` exported from `src/lib/types.ts`.
- [ ] `Astro.locals.user` / `.organization` / `.session` typed via `env.d.ts`.
- [ ] `tsc --noEmit` passes.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P0.7.2
- **Blocks:** P1A.1.2, P1A.4.1, P1A.4.2
- **Can run in parallel with:** P1A.1.3

##### Security 🔒
- N/A (type-only; no runtime surface).

##### Out of scope
- Runtime validation (P1A.1.3).
- Nanostore hydration of session on client (P1A.4.4).

---

#### [P1A.1.2] Harden cookie + CSRF config in `auth-factory`

**Parent:** [P1A.1](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
better-auth defaults are good but not MVP-grade. Set `HttpOnly`, `Secure`, `SameSite=Lax`, rotate the signing secret off env, and expose the CSRF helper that mutating forms will import.

##### Spec references
- [Baseout_PRD.md §20](Baseout_PRD.md) — cookie hardening.
- [Baseout_PRD.md §13](Baseout_PRD.md) — better-auth as source of truth.
- [CLAUDE.md §2](../.claude/CLAUDE.md) — CSRF on mutating forms.

##### Canonical terms
Session, Magic Link.

##### Files to touch
- `src/lib/auth-factory.ts` (modified) — cookie config + CSRF helper export.
- `src/lib/auth-factory.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/auth-factory.test.ts`
- **Cases:**
  - Built auth config emits cookies with `httpOnly: true`, `secure: true`, `sameSite: 'lax'`.
  - Auth throws on startup if `BETTER_AUTH_SECRET` is unset or under 32 bytes.
  - `generateCsrfToken()` returns a cryptographically random token (two calls differ).
- Command: `npm test src/lib/auth-factory.test.ts`.

##### Implementation notes
- Pull `BETTER_AUTH_SECRET` via the env accessor — never a literal `process.env.*` read (see P0.8.2 contract).
- Reuse existing factory pattern in [src/lib/auth-factory.ts](../src/lib/auth-factory.ts); do NOT create a second factory.
- CSRF helper wraps better-auth's native helper — do not roll our own token store.

##### Acceptance criteria
- [ ] Cookies hardened per PRD §13 / §20.
- [ ] Missing `BETTER_AUTH_SECRET` fails fast with a readable error.
- [ ] CSRF helper exported + typed.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P0.8.2, P0.7.2
- **Blocks:** P1A.1.4, P1A.2.3
- **Can run in parallel with:** P1A.1.1, P1A.1.3

##### Security 🔒
- `BETTER_AUTH_SECRET` from Cloudflare Secrets only (PRD §20.1).
- CSRF helper required on every mutating form handler from P1A.2 onward.

##### Out of scope
- CSRF enforcement on form routes (integrated in P1A.2.5).

---

#### [P1A.1.3] Zod schemas for auth request/response payloads

**Parent:** [P1A.1](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `🔒 security:input-validation`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Server-side input validation gate per [CLAUDE.md §2](../.claude/CLAUDE.md). Every auth POST (magic-link request, callback verify, logout) validates through these schemas before touching better-auth.

##### Spec references
- [CLAUDE.md §2](../.claude/CLAUDE.md) — input validation on every API route.
- [Baseout_PRD.md §13.1](Baseout_PRD.md) — magic link payload.

##### Canonical terms
Magic Link, Session, User.

##### Files to touch
- `src/lib/auth-schemas.ts` (new) — `MagicLinkRequestSchema`, `MagicLinkVerifySchema`, `LogoutRequestSchema`.
- `src/lib/auth-schemas.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/auth-schemas.test.ts`
- **Cases:**
  - `MagicLinkRequestSchema` rejects non-email strings.
  - `MagicLinkRequestSchema` normalises email to lowercase + trims whitespace.
  - `MagicLinkVerifySchema` requires exactly 64 hex chars for `token`.
  - Schema parse errors return a safe, non-leaking message (no stack traces).
- Command: `npm test src/lib/auth-schemas.test.ts`.

##### Implementation notes
- Use `zod` (already present via better-auth dep tree — verify, otherwise add).
- Keep transforms pure; no side effects inside `refine`.

##### Acceptance criteria
- [ ] All three schemas exported + typed.
- [ ] Invalid inputs fail with deterministic error shapes.
- [ ] Email normalised identically across schema and better-auth's internal lookup.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.1.1
- **Blocks:** P1A.2.3, P1A.2.5
- **Can run in parallel with:** P1A.1.2, P1A.1.4

##### Security 🔒
- User enumeration: identical response shape for valid vs invalid email (enforced in P1A.2.3).

##### Out of scope
- Registration-specific payloads for email+password (post-MVP).

---

#### [P1A.1.4] Wire Cloudflare Email Service binding behind `sendMagicLink` ✅ DONE

**Parent:** [P1A.1](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
better-auth's magic-link plugin needs a transport. `sendEmail()` in `src/lib/email/send.ts` is the provider-agnostic seam; `auth-factory.ts` closes over the request-scoped env and calls it from inside the `magicLink` plugin. Template is currently inline HTML + text (see `src/lib/email/templates/magic-link.ts`); React Email can be swapped in by P2D.1a without touching the transport.

##### Spec references
- [Baseout_PRD.md §19.1](Baseout_PRD.md) — Magic Link template.
- [Baseout_PRD.md §19.2](Baseout_PRD.md) — Cloudflare Email Service sending infrastructure.
- [CLAUDE.md §2](../.claude/CLAUDE.md) — security defaults.

##### Canonical terms
Magic Link, User.

##### Files to touch
- `src/lib/email/send.ts` (implemented)
- `src/lib/email/send.test.ts` (implemented)
- `src/lib/auth-factory.ts` (magic-link plugin closure calls `sendEmail`)

##### Failing test to write first
- **File:** `src/lib/email/send.test.ts`
- **Cases:**
  - Calls `env.EMAIL.send` with `{ from, to, subject, html, text }` and the correct payload (injected fake binding).
  - Fails fast if the `EMAIL` binding is missing in prod.
  - Fails fast if `EMAIL_FROM` is missing in prod.
  - Dev mode logs the magic-link payload to the configured logger and never touches the binding.
  - Errors from `env.EMAIL.send` (e.g. `E_SENDER_NOT_VERIFIED`) propagate.
- Command: `npm test src/lib/email`.

##### Implementation notes
- No HTTP mocking — the binding is a host object, not an HTTP call. Inject a fake `SendEmail` with a mocked `.send()` in unit tests.
- Inline HTML + text for MVP; React Email template lands in P2D.1a.

##### Acceptance criteria
- [x] `sendEmail()` callable from auth-factory as the magic-link transport.
- [x] All test cases green with an injected fake `SendEmail` binding.
- [x] Zero `any` introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.
- [ ] Follow-up: structured logging on binding errors (observability — see plan open follow-ups).

##### Dependencies
- **Blocked by:** P0.10.1 (domain verified), P1A.1.2
- **Blocks:** P1A.1.5, P1A.2.3
- **Can run in parallel with:** P1A.1.3

##### Security 🔒
- No runtime API key — auth is handled by the `EMAIL` binding itself.
- Audit log entry on every magic-link send (PRD §13 audit requirement) — still outstanding.

##### Out of scope
- React Email HTML template (P2D.1a).
- Rate-limiting (P1A.2.4).

---

#### [P1A.1.5] Isolate Airtable OAuth from the login handler

**Parent:** [P1A.1](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Per [PRD §13.1](Baseout_PRD.md) Airtable OAuth is a data Connection, never a login path. Lock this architecturally so nobody can accidentally register a Baseout User via Airtable OAuth.

##### Spec references
- [Baseout_PRD.md §13.1](Baseout_PRD.md) — Airtable OAuth is never login.
- [Baseout_Features.md §1](Baseout_Features.md) — Connection definition.

##### Canonical terms
Connection, Platform, User. Forbidden: `login provider`.

##### Files to touch
- `src/lib/auth-factory.ts` (modified) — assert no OAuth providers wired into better-auth's login list.
- `src/lib/auth-factory.test.ts` (modified)

##### Failing test to write first
- **File:** `src/lib/auth-factory.test.ts`
- **Cases:**
  - better-auth config's provider list contains only `magic-link` (and `email-password` if present); does NOT contain `airtable` or any OAuth entry on the auth surface.
  - Static assertion: Airtable client ID envs are only read under `src/lib/connectors/**`, never under `src/lib/auth*`.
- Command: `npm test src/lib/auth-factory.test.ts`.

##### Implementation notes
- The Airtable OAuth flow lives under `src/lib/connectors/airtable/` (created in P1B.1); this sub-issue just enforces the boundary.
- Use a filesystem-grep test to assert no `AIRTABLE_` env read inside `src/lib/auth*`.

##### Acceptance criteria
- [ ] better-auth config provider list is asserted in test.
- [ ] Boundary grep test green.
- [ ] PR description cites the architectural reason.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.1.2
- **Blocks:** P1B.1
- **Can run in parallel with:** P1A.1.4

##### Security 🔒
- Airtable tokens are a data surface only — they never mint a Session (PRD §13.1).

##### Out of scope
- Airtable OAuth implementation itself (P1B.1).

---

#### [P1A.1.6] Audit log writer for auth state changes

**Parent:** [P1A.1](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
[CLAUDE.md §2](../.claude/CLAUDE.md) mandates an audit record on every auth state change. Ship the writer now so P1A.2/P1A.4 can call it from day one rather than bolting it on.

##### Spec references
- [CLAUDE.md §2](../.claude/CLAUDE.md) — audit every auth and billing state change.
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `notification_log` pattern (reused as audit surface in MVP).

##### Canonical terms
User, Session, Magic Link.

##### Files to touch
- `src/lib/auth-audit.ts` (new) — `logAuthEvent({ userId, eventType, metadata })`.
- `src/lib/auth-audit.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/auth-audit.test.ts`
- **Cases:**
  - Writes a row to `notification_log` with `event_type` in {`magic_link_sent`, `session_created`, `session_ended`, `magic_link_failed`}.
  - Rejects unknown event types (typed union).
  - Never persists the magic-link token or raw email header.
- Command: `npm run test:integration src/lib/auth-audit.test.ts`.

##### Implementation notes
- Reuse existing Drizzle client from [src/db/index.ts](../src/db/index.ts).
- If `notification_log` is unsuitable long-term, this writer's single call site makes the later migration cheap.

##### Acceptance criteria
- [ ] Audit writer callable from both Worker and Node runtimes.
- [ ] Event type is a closed TS union.
- [ ] Integration test round-trips a row.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P0.7.5
- **Blocks:** P1A.2.3, P1A.4.3
- **Can run in parallel with:** P1A.1.5

##### Security 🔒
- No token material or email body content in the log; metadata is structured + bounded.

##### Out of scope
- Dedicated `auth_audit` table (may split out in Phase 6 compliance work).

---

### P1A.2

**Parent:** [P1A.2 Magic-link sign-up + sign-in flow](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P1A.3, P1C.1.

Builds the single V1 auth method: user enters email → receives a 15-minute single-use link → click provisions or resumes a Session. New-email path creates User + Organization + $0 Subscription (via P1A.3); known-email path just resumes.

---

#### [P1A.2.1] `/sign-in` + `/sign-up` Astro routes shell

**Parent:** [P1A.2](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Public routes that render the email-entry form. Structural only — submission and token verification land in P1A.2.3 and P1A.2.5. Re-use `AuthLayout` per project UI standards.

##### Spec references
- [Baseout_PRD.md §13.1](Baseout_PRD.md) — magic-link launch auth.
- [CLAUDE.md §7](../.claude/CLAUDE.md) — UI/UX standards.
- [Baseout_PRD.md §6.0](Baseout_PRD.md) — design direction.

##### Canonical terms
Magic Link, User, Organization.

##### Files to touch
- `src/pages/sign-in.astro` (new)
- `src/pages/sign-up.astro` (new)
- `tests/e2e/auth-shell.spec.ts` (new) — Playwright page render.

##### Failing test to write first
- **File:** `tests/e2e/auth-shell.spec.ts`
- **Cases:**
  - `/sign-in` renders an `<input type="email">` and `<button type="submit">`.
  - `/sign-up` renders the same.
  - Both pages include a `<meta name="csrf-token">` tag.
- Command: `npm run test:e2e -- auth-shell.spec.ts`.

##### Implementation notes
- Use `@opensided/theme` primitives first; fall back to daisyUI per project standards.
- Currently `src/middleware.ts` whitelists `/login` + `/register` — we migrate to `/sign-in` + `/sign-up` in P1A.4.1.

##### Acceptance criteria
- [ ] Both pages render without JavaScript islands (SSR only).
- [ ] Mobile breakpoint < 375px renders cleanly (CLAUDE.md §3).
- [ ] a11y: single `<h1>`, labelled input, 44×44 button.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.1.2
- **Blocks:** P1A.2.3, P1A.4.1
- **Can run in parallel with:** P1A.2.2

##### Security 🔒
- N/A at this shell layer (no form handler yet).

##### Out of scope
- Form POST handler (P1A.2.3).
- Error-state UIs (P1A.2.6).

---

#### [P1A.2.2] Single-use token generator + hashing helper

**Parent:** [P1A.2](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `🔒 security:encryption`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Magic-link tokens must be 32 bytes of CSPRNG output, stored hashed (never plaintext), one-time-use, and expire at 15 minutes. Isolate this primitive before wiring routes.

##### Spec references
- [Baseout_PRD.md §13.1](Baseout_PRD.md) — 15-min expiry.
- [Baseout_PRD.md §20](Baseout_PRD.md) — hash, not plaintext.
- [CLAUDE.md §2](../.claude/CLAUDE.md) — principle of least privilege.

##### Canonical terms
Magic Link, User.

##### Files to touch
- `src/lib/magic-link-token.ts` (new) — `generateToken()`, `hashToken(raw)`, `isExpired(createdAt)`.
- `src/lib/magic-link-token.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/magic-link-token.test.ts`
- **Cases:**
  - `generateToken()` returns 64 hex chars and two calls differ.
  - `hashToken('x')` is deterministic and uses SHA-256 (known-answer test).
  - `isExpired(now - 16min)` is `true`; `isExpired(now - 10min)` is `false`.
  - Token + hash compare uses constant-time comparison.
- Command: `npm test src/lib/magic-link-token.test.ts`.

##### Implementation notes
- Use WebCrypto `getRandomValues` + `subtle.digest('SHA-256', ...)` (works in Workers + Node, per P0.7.3 pattern).
- This helper is distinct from `src/lib/crypto.ts` (symmetric AES-256-GCM); keep concerns separated.

##### Acceptance criteria
- [ ] Four cases green.
- [ ] Constant-time compare used.
- [ ] No global state.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** none
- **Blocks:** P1A.2.3, P1A.2.5
- **Can run in parallel with:** P1A.2.1

##### Security 🔒
- Token hash column in storage; raw token never persisted.
- No `console.log` of raw token (asserted in test).

##### Out of scope
- Token storage schema (better-auth owns the table; see P0.7.2).

---

#### [P1A.2.3] POST `/api/auth/magic-link` handler

**Parent:** [P1A.2](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `🔒 security:auth-path`, `🔒 security:input-validation`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Accepts email from the sign-in/sign-up form, validates via the P1A.1.3 schema, issues a token, persists its hash, and dispatches via `sendMagicLink`. Responds identically whether the email exists or not (no enumeration).

##### Spec references
- [Baseout_PRD.md §13.1](Baseout_PRD.md) — flow mechanics.
- [Baseout_PRD.md §19.1](Baseout_PRD.md) — email template.
- [CLAUDE.md §2](../.claude/CLAUDE.md) — input validation, CSRF.

##### Canonical terms
Magic Link, User, Session.

##### Files to touch
- `src/pages/api/auth/magic-link.ts` (new)
- `src/pages/api/auth/magic-link.test.ts` (new)

##### Failing test to write first
- **File:** `src/pages/api/auth/magic-link.test.ts`
- **Cases:**
  - Valid email → 200 with generic `{ ok: true }` body.
  - Invalid email → 400, no DB write.
  - Missing CSRF token → 403.
  - Response body is identical for existing vs non-existing User.
  - Audit log row written with `event_type = 'magic_link_sent'`.
- Command: `npm run test:integration src/pages/api/auth/magic-link.test.ts`.

##### Implementation notes
- Use better-auth's magic-link plugin where possible; this handler is the thin Astro adapter.
- Invoke `logAuthEvent` from P1A.1.6.

##### Acceptance criteria
- [ ] All five cases green.
- [ ] No user enumeration (same latency within 50ms for known vs unknown email).
- [ ] CSRF enforced.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.1.3, P1A.1.4, P1A.1.6, P1A.2.1, P1A.2.2
- **Blocks:** P1A.2.4, P1A.2.5
- **Can run in parallel with:** none

##### Security 🔒
- Uniform response. Constant-time comparison on email lookup paths where possible.
- No plaintext token in logs (asserted).

##### Out of scope
- Rate-limiting (P1A.2.4).
- Callback/verify route (P1A.2.5).

---

#### [P1A.2.4] Rate-limit magic-link requests (5/email/hour)

**Parent:** [P1A.2](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Prevents mailbombing and credential-stuffing. Per-email + per-IP sliding windows. Lives as a middleware wrapper around the P1A.2.3 handler.

##### Spec references
- [Baseout_PRD.md §13.1](Baseout_PRD.md) — implicit quota in auth section.
- [Baseout_Backlog.md §P1A.2](Baseout_Backlog.md) — 5 requests per email per hour.

##### Canonical terms
Magic Link, User.

##### Files to touch
- `src/lib/rate-limit.ts` (new) — sliding-window counter abstraction.
- `src/pages/api/auth/magic-link.ts` (modified) — apply limiter.
- `src/lib/rate-limit.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/rate-limit.test.ts`
- **Cases:**
  - 5 requests same email + hour → allowed; 6th → 429.
  - Window rolls forward: request at t=61min from the first succeeds.
  - IP limiter is independent of email limiter.
- Command: `npm test src/lib/rate-limit.test.ts`.

##### Implementation notes
- KV-backed counter in Workers; in-memory fallback for Node tests.
- Key: `sha256(email)` — do not key by plaintext email.

##### Acceptance criteria
- [ ] Three cases green.
- [ ] 429 response body is generic — no hint at which limit was hit.
- [ ] Metrics counter increments on limit hit (per Admin §16).
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.2.3
- **Blocks:** P1A.2.5 (integration test parity)
- **Can run in parallel with:** P1A.2.6

##### Security 🔒
- Keyed by hashed email — never plaintext PII in KV.
- No leak of remaining quota in response headers.

##### Out of scope
- Organization-wide rate limits (Phase 3+).

---

#### [P1A.2.5] GET `/auth/callback` — verify + resume/provision

**Parent:** [P1A.2](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
When the user clicks the emailed link, this endpoint verifies the hashed token, marks it used, and either creates Session for an existing User or hands off to the provisioning flow (P1A.3) for new emails.

##### Spec references
- [Baseout_PRD.md §13.1](Baseout_PRD.md) — magic-link mechanics.
- [Baseout_PRD.md §13.2](Baseout_PRD.md) — Session management.

##### Canonical terms
Magic Link, Session, User, Organization.

##### Files to touch
- `src/pages/auth/callback.ts` (new)
- `src/pages/auth/callback.test.ts` (new)

##### Failing test to write first
- **File:** `src/pages/auth/callback.test.ts`
- **Cases:**
  - Valid unused token for existing User → 302 to `/`, Session cookie set.
  - Valid unused token for new email → hands off to provisioning (asserted via call to `provisionNewAccount` mock).
  - Expired token → 400 with `error=link_expired` query hint.
  - Already-used token → 400 with `error=link_used`.
  - Malformed token → 400.
- Command: `npm run test:integration src/pages/auth/callback.test.ts`.

##### Implementation notes
- Token compared via constant-time hash compare (P1A.2.2).
- Call `logAuthEvent` on success + failure.
- `provisionNewAccount` is the P1A.3 entry point — stub it in tests here.

##### Acceptance criteria
- [ ] Five cases green.
- [ ] Session cookie is `HttpOnly; Secure; SameSite=Lax`.
- [ ] Used-token invariant: single token cannot mint two Sessions.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.2.3, P1A.2.4, P1A.1.6
- **Blocks:** P1A.2.6, P1A.3.1, P1A.4.*
- **Can run in parallel with:** none

##### Security 🔒
- Constant-time token comparison.
- Token row marked `used_at` atomically with Session creation (single transaction).

##### Out of scope
- UI for error states (P1A.2.6).
- Organization creation (P1A.3).

---

#### [P1A.2.6] Error-state UIs (expired / used / malformed) + success redirect

**Parent:** [P1A.2](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
User-facing copy for the three failure modes + the happy-path redirect target. Low-risk sub-issue but closes the loop on the flow.

##### Spec references
- [Baseout_PRD.md §13.1](Baseout_PRD.md) — magic-link flow.
- [CLAUDE.md §11](../.claude/CLAUDE.md) — accessibility.

##### Canonical terms
Magic Link.

##### Files to touch
- `src/pages/sign-in.astro` (modified) — render `?error=` banner.
- `src/pages/sign-up.astro` (modified) — same.
- `tests/e2e/magic-link-errors.spec.ts` (new)

##### Failing test to write first
- **File:** `tests/e2e/magic-link-errors.spec.ts`
- **Cases:**
  - Navigate to `/sign-in?error=link_expired` → visible banner with retry CTA.
  - `link_used` → distinct copy, same CTA.
  - `link_malformed` → generic copy (no leak).
  - Screen reader announces banner (`role="alert"`).
- Command: `npm run test:e2e -- magic-link-errors.spec.ts`.

##### Implementation notes
- All error strings live in `src/lib/i18n.ts` (or inline — confirm existing project convention).
- Use `@opensided/theme` alert component.

##### Acceptance criteria
- [ ] Four cases green.
- [ ] No stack traces or internal codes in copy.
- [ ] `aria-live="polite"` on the banner.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.2.5
- **Blocks:** none
- **Can run in parallel with:** P1A.2.4

##### Security 🔒
- Malformed-token copy must not hint at backend details (uniform generic).

##### Out of scope
- Retry-with-throttle UX (covered by P1A.2.4's 429 response already).

---

### P1A.3

**Parent:** [P1A.3 Create Organization + User + $0 Stripe sub on sign-up](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P1A.6, P4A.1.

On first successful magic-link verification for a new email, atomically create the Organization, the owner User, a Stripe Customer, and a $0 Starter Subscription with `trial_ends_at = now() + 7d`. Idempotent under retries.

---

#### [P1A.3.1] `provisionNewAccount()` contract + result type

**Parent:** [P1A.3](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** billing
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:billing`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Single entry point for all sub-issues in P1A.3 to hang off of. Returns `{ organization, user, subscription }` or a typed error. Lets P1A.2.5 call a stable API before the Stripe bits land.

##### Spec references
- [Baseout_PRD.md §8.3](Baseout_PRD.md) — trial mechanics.
- [Baseout_Features.md §5.5.4](Baseout_Features.md) — per-platform trial scope.
- [Baseout_Features.md §1](Baseout_Features.md) — Organization, User, Subscription.

##### Canonical terms
Organization, User, Subscription, Trial, Platform.

##### Files to touch
- `src/lib/provisioning/provision-account.ts` (new) — exports `provisionNewAccount(input)`.
- `src/lib/provisioning/types.ts` (new) — `ProvisionResult`, `ProvisionError` discriminated union.
- `src/lib/provisioning/provision-account.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/provisioning/provision-account.test.ts`
- **Cases:**
  - Returns `ProvisionResult` with `organization.id`, `user.id`, `subscription.id` — all UUIDs.
  - `ProvisionError` variants: `already_provisioned`, `stripe_failure`, `db_failure`.
  - Input requires `email`, `platform` (defaults to `airtable`).
- Command: `npm test src/lib/provisioning/provision-account.test.ts`.

##### Implementation notes
- Stub the Stripe + DB dependencies; real wiring in P1A.3.3–P1A.3.5.
- Use a Drizzle transaction wrapper — never commit Organization without its User.

##### Acceptance criteria
- [ ] Exported function + types.
- [ ] Error type is a closed union (exhaustive switch test).
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.1.1, P0.7.5
- **Blocks:** P1A.3.2, P1A.3.3, P1A.3.4, P1A.3.5, P1A.3.6
- **Can run in parallel with:** none

##### Security 🔒
- N/A (contract only).

##### Out of scope
- Actual DB/Stripe side effects.

---

#### [P1A.3.2] Organization slug generator + uniqueness check

**Parent:** [P1A.3](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** billing
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:billing`, `tier-gate:all`, `🔒 security:input-validation`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Each Organization needs a URL-safe unique slug. Default derivation: the email local-part, sanitised; collisions append `-2`, `-3`, etc. Pre-exists via P0.7.1 unique constraint — this helper produces a valid candidate.

##### Spec references
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `organizations` columns.
- [Baseout_Features.md §1](Baseout_Features.md) — Organization.

##### Canonical terms
Organization.

##### Files to touch
- `src/lib/provisioning/slug.ts` (new)
- `src/lib/provisioning/slug.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/provisioning/slug.test.ts`
- **Cases:**
  - `slugify('Autumn Shakespeare')` → `autumn-shakespeare`.
  - Allowed chars: `[a-z0-9-]`; others dropped.
  - `nextAvailable('foo', exists)` returns `foo-2` when `foo` exists.
  - Path-traversal inputs (`../etc`) are sanitised to `etc`.
- Command: `npm test src/lib/provisioning/slug.test.ts`.

##### Implementation notes
- Uniqueness check queries `organizations.slug` in Postgres via Drizzle.
- Maximum length 63 (DNS-ish cap).

##### Acceptance criteria
- [ ] Four cases green.
- [ ] No path-traversal inputs survive.
- [ ] Slug matches P0.7.1 unique-index constraint.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P0.7.1, P1A.3.1
- **Blocks:** P1A.3.4
- **Can run in parallel with:** P1A.3.3

##### Security 🔒
- Sanitise aggressively — slug appears in URLs (future route scoping).

##### Out of scope
- User-chosen slug during onboarding wizard (Phase 3).

---

#### [P1A.3.3] Stripe Customer + $0 Subscription creator

**Parent:** [P1A.3](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** billing
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:billing`, `tier-gate:all`, `🔒 security:new-secret`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Calls the Stripe API to create a Customer and an initial Subscription on the `Baseout — Airtable — Starter` product at $0 with a 7-day trial. Stripe product metadata `platform=airtable, tier=starter` is validated, not trusted.

##### Spec references
- [Baseout_PRD.md §8.6](Baseout_PRD.md) — $0 sub at sign-up, no CC.
- [Baseout_Features.md §5.5.1](Baseout_Features.md) — Stripe product naming.
- [Baseout_Features.md §5.5.2](Baseout_Features.md) — required metadata.
- [Baseout_Features.md §5.5.4](Baseout_Features.md) — per-platform trial.

##### Canonical terms
Subscription, Trial, Platform, Organization.

##### Files to touch
- `src/lib/billing/stripe-client.ts` (new) — singleton Stripe SDK wrapper.
- `src/lib/billing/create-trial-subscription.ts` (new)
- `src/lib/billing/create-trial-subscription.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/billing/create-trial-subscription.test.ts`
- **Cases:**
  - Calls `customers.create` with `{ email, metadata.organization_id }` (msw assert).
  - Calls `subscriptions.create` with `trial_period_days: 7` and the Starter price ID.
  - Rejects if resolved product metadata lacks `platform` or `tier`.
  - Returns `{ customerId, subscriptionId, trialEndsAt }` typed result.
- Command: `npm run test:integration src/lib/billing/create-trial-subscription.test.ts`.

##### Implementation notes
- Stripe key via `STRIPE_SECRET_KEY` (Cloudflare Secret from P0.8.*).
- Resolve price ID by looking up product metadata at runtime — never hardcode.
- Use `platform + tier` keys to resolve Capability per [Baseout_Features.md §5.5.6](Baseout_Features.md).

##### Acceptance criteria
- [ ] Four cases green.
- [ ] Server-only module (grep test: never imported by `src/components/**`).
- [ ] 7-day trial confirmed in returned `trialEndsAt`.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.3.1, P0.8.* (Stripe secret)
- **Blocks:** P1A.3.4, P1A.3.5
- **Can run in parallel with:** P1A.3.2

##### Security 🔒
- `STRIPE_SECRET_KEY` from Cloudflare Secrets only.
- Never sent to client — enforce via grep test on `src/components/**` import graph.

##### Out of scope
- Payment Method attach (happens at upgrade, P4A.1).
- Webhook handling (P4A.2).

---

#### [P1A.3.4] Atomic DB writer: Organization + User + subscriptions row

**Parent:** [P1A.3](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** billing
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:billing`, `tier-gate:all`, `🔒 security:new-sql-surface`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Single Drizzle transaction inserts rows into `organizations`, `users` (role `owner`, `organization_id` FK), and `subscriptions` (`status='trialing'`, `trial_ends_at`, `platform='airtable'`, `tier='starter'`).

##### Spec references
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — table columns.
- [Baseout_Features.md §5.5.3](Baseout_Features.md) — one subscription per Organization.
- [CLAUDE.md §2](../.claude/CLAUDE.md) — parameterised queries via Drizzle only.

##### Canonical terms
Organization, User, Subscription, Trial.

##### Files to touch
- `src/lib/provisioning/persist-account.ts` (new)
- `src/lib/provisioning/persist-account.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/provisioning/persist-account.test.ts`
- **Cases:**
  - Happy path: three rows inserted in one transaction.
  - Transaction rolls back if Stripe IDs are missing.
  - `users.role` is `owner`; `organizations.account_owner_user_id` FK points at that User.
  - `subscriptions.trial_ends_at` is 7 days from insert time (±5s tolerance).
- Command: `npm run test:integration src/lib/provisioning/persist-account.test.ts`.

##### Implementation notes
- Two-step FK dance: insert Organization with null `account_owner_user_id`, insert User, UPDATE Organization to set FK — all inside the same transaction.
- Reuse Drizzle client from [src/db/index.ts](../src/db/index.ts).

##### Acceptance criteria
- [ ] Four cases green.
- [ ] Transaction rollback covered by a deliberate failure injection test.
- [ ] Uses parameterised Drizzle queries only.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.3.2, P1A.3.3, P0.7.5, P0.7.6
- **Blocks:** P1A.3.5, P1A.3.6
- **Can run in parallel with:** none

##### Security 🔒
- All SQL via Drizzle (no string concat).
- FK `account_owner_user_id` set to prevent orphan Organizations.

##### Out of scope
- Post-provisioning events (welcome email handoff — P1A.3.6).

---

#### [P1A.3.5] Idempotency: replay-safe `provisionNewAccount`

**Parent:** [P1A.3](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** billing
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:billing`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Retries from `/auth/callback` (network blip, double-click) must never double-create Stripe Customers or rows. Keyed by `email` + best-effort `idempotency_key` on the Stripe call.

##### Spec references
- [Baseout_Backlog.md §P1A.3](Baseout_Backlog.md) — idempotent acceptance criterion.
- [Baseout_Features.md §5.5.3](Baseout_Features.md) — one sub per Organization, never replaced.

##### Canonical terms
Organization, User, Subscription.

##### Files to touch
- `src/lib/provisioning/provision-account.ts` (modified)
- `src/lib/provisioning/provision-account.test.ts` (modified)

##### Failing test to write first
- **File:** `src/lib/provisioning/provision-account.test.ts`
- **Cases:**
  - Two concurrent calls for the same email → same Organization ID.
  - Second call after success returns `already_provisioned` without a second Stripe call.
  - Partial failure mid-flight (Stripe succeeded, DB failed) → next call detects Stripe customer, does not re-create.
- Command: `npm run test:integration src/lib/provisioning/provision-account.test.ts`.

##### Implementation notes
- Stripe `Idempotency-Key: signup:<sha256(email)>`.
- DB-side: unique constraint on `users.email` (from better-auth) is the primary guard.

##### Acceptance criteria
- [ ] Three cases green.
- [ ] No duplicate Stripe Customer created under concurrency.
- [ ] Recoverable from mid-flight partial failure.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.3.3, P1A.3.4
- **Blocks:** P1A.3.6
- **Can run in parallel with:** none

##### Security 🔒
- Idempotency key derived from hashed email, not raw email.

##### Out of scope
- Stripe webhook reconciliation (P4A.2).

---

#### [P1A.3.6] Integrate provisioning into `/auth/callback` + fire welcome email

**Parent:** [P1A.3](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** billing
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:billing`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Wire P1A.3's `provisionNewAccount` into the new-email branch of the P1A.2.5 callback and enqueue the Trial Welcome email (template owned by P2D.1).

##### Spec references
- [Baseout_PRD.md §19.1](Baseout_PRD.md) — Trial Welcome template.
- [Baseout_PRD.md §6.6](Baseout_PRD.md) — onboarding start.

##### Canonical terms
Organization, User, Trial, Magic Link.

##### Files to touch
- `src/pages/auth/callback.ts` (modified) — invoke `provisionNewAccount` on new email.
- `src/lib/email/send-trial-welcome.ts` (new)
- `src/pages/auth/callback.test.ts` (modified)

##### Failing test to write first
- **File:** `src/pages/auth/callback.test.ts`
- **Cases:**
  - New email path → `provisionNewAccount` called once; Session cookie set; Trial Welcome enqueued (msw assert).
  - Existing User path → provisioning NOT called.
  - Provisioning failure → 500 with generic error; no partial Session minted.
- Command: `npm run test:integration src/pages/auth/callback.test.ts`.

##### Implementation notes
- Welcome email uses the same `src/lib/email/send.ts` abstraction from P1A.1.4 (calls `env.EMAIL.send()` under the hood).
- Template HTML stub for now; React Email template lands in P2D.1b.

##### Acceptance criteria
- [ ] Three cases green.
- [ ] No partial Session on provisioning failure.
- [ ] Audit log entries for provisioning start + success/failure.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.2.5, P1A.3.5
- **Blocks:** P1A.6.*
- **Can run in parallel with:** none

##### Security 🔒
- Session only issued after successful commit of Organization + User + Subscription.

##### Out of scope
- Onboarding wizard first step (Phase 1C).

---

### P1A.4

**Parent:** [P1A.4 Session management + route protection](Baseout_Backlog.md) · granularity: `tdd` · Blocks: every protected page/API.

Makes [src/middleware.ts](../src/middleware.ts) the sole auth gate. Hydrates `Astro.locals` with `user` + `organization` + `session`, allowlists public routes, and wires nanostore reset on logout per [CLAUDE.md §4](../.claude/CLAUDE.md).

---

#### [P1A.4.1] Public-route allowlist + migrate `/login`→`/sign-in`

**Parent:** [P1A.4](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Existing [src/middleware.ts](../src/middleware.ts) uses `/login` and `/register`. Migrate to P1A.2's `/sign-in` and `/sign-up` routes and widen the allowlist to the MVP-public set: `/`, `/sign-in`, `/sign-up`, `/auth/callback`, `/pricing`, `/schema/public/*`.

##### Spec references
- [Baseout_PRD.md §13](Baseout_PRD.md) — auth model.
- [CLAUDE.md §2](../.claude/CLAUDE.md) — auth enforcement in middleware.

##### Canonical terms
Session, User.

##### Files to touch
- `src/middleware.ts` (modified)
- `src/middleware.test.ts` (new)

##### Failing test to write first
- **File:** `src/middleware.test.ts`
- **Cases:**
  - Request to `/sign-in` without Session → passes through (200 path).
  - Request to `/dashboard` without Session → 302 to `/sign-in`.
  - Request to `/api/protected` without Session → 401 JSON.
  - Request to `/pricing` without Session → 200.
- Command: `npm run test:integration src/middleware.test.ts`.

##### Implementation notes
- Reuse the existing `PUBLIC_PATHS` pattern in [src/middleware.ts](../src/middleware.ts); widen, don't replace.
- Retain backward-compat alias: `/login` 301 → `/sign-in` (separate redirect rule, not in allowlist).

##### Acceptance criteria
- [ ] Four cases green.
- [ ] No new ad-hoc auth check outside middleware (grep test: no `auth.api.getSession` outside `src/middleware.ts` and `src/lib/auth*`).
- [ ] `/schema/public/*` allowed unauthenticated (for P1A.5).
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.2.1
- **Blocks:** P1A.4.2, P1A.4.3
- **Can run in parallel with:** P1A.4.4

##### Security 🔒
- Middleware is the ONLY enforcement point (CLAUDE.md §2).
- Grep test fails PR if a new page adds its own getSession call.

##### Out of scope
- Per-capability gating inside middleware (P4.* / Phase 3).

---

#### [P1A.4.2] Hydrate `Astro.locals` with `organization` + typed session

**Parent:** [P1A.4](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Existing middleware sets `user` + `account`. Add `organization` from the User's FK so every page has a single `Astro.locals.organization` without an extra query.

##### Spec references
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `users.organization_id`.
- [Baseout_Features.md §1](Baseout_Features.md) — Organization.

##### Canonical terms
Organization, User, Session.

##### Files to touch
- `src/middleware.ts` (modified)
- `src/lib/account.ts` (modified) — add Organization fetch.
- `src/middleware.test.ts` (modified)

##### Failing test to write first
- **File:** `src/middleware.test.ts`
- **Cases:**
  - Authenticated request → `locals.organization.id` populated.
  - Authenticated request → `locals.user.id`, `locals.session.id` populated.
  - Orphan User (organization_id null) → 500 with audit log entry (should never happen; defence-in-depth).
- Command: `npm run test:integration src/middleware.test.ts`.

##### Implementation notes
- Single join query: `users → organizations` via Drizzle.
- Extend existing `getAccountContext` helper in [src/lib/account.ts](../src/lib/account.ts); don't fork.

##### Acceptance criteria
- [ ] Three cases green.
- [ ] `Astro.locals` typed via `env.d.ts` (from P1A.1.1).
- [ ] Query count per request: 1 join, not 2 round-trips.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.1.1, P1A.4.1, P0.7.5
- **Blocks:** P1A.4.3, P1A.4.4
- **Can run in parallel with:** none

##### Security 🔒
- Audit log a defence-in-depth entry if a Session references a non-existent Organization.

##### Out of scope
- Multi-Organization switcher (V2 — User currently belongs to one Org).

---

#### [P1A.4.3] Logout handler: kill Session + clear nanostores

**Parent:** [P1A.4](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Logout ends the server Session AND clears every user-scoped nanostore via `resetAllStores()` from `src/stores/`. [CLAUDE.md §4](../.claude/CLAUDE.md) requires both.

##### Spec references
- [Baseout_PRD.md §13.2](Baseout_PRD.md) — Session management.
- [CLAUDE.md §4](../.claude/CLAUDE.md) — reset stores on logout.

##### Canonical terms
Session, User.

##### Files to touch
- `src/pages/api/auth/logout.ts` (new)
- `src/components/auth/LogoutButton.astro` (new) — calls API + invokes `resetAllStores()`.
- `src/pages/api/auth/logout.test.ts` (new)

##### Failing test to write first
- **File:** `src/pages/api/auth/logout.test.ts`
- **Cases:**
  - POST `/api/auth/logout` → Session row deleted, cookie cleared.
  - Missing CSRF token → 403.
  - Audit log entry `event_type='session_ended'`.
  - E2E: click logout → dashboard redirects to `/sign-in` and `currentOrganization` store is empty.
- Command: `npm run test:integration src/pages/api/auth/logout.test.ts && npm run test:e2e -- logout.spec.ts`.

##### Implementation notes
- Use better-auth's `signOut` helper.
- `resetAllStores()` helper is provided by P0.9.6 — import and call on client side.

##### Acceptance criteria
- [ ] All cases green.
- [ ] Cookie `Max-Age=0` on logout response.
- [ ] Every user-scoped store reset (grep test: all stores in `src/stores/` appear in `resetAllStores`).
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.4.2, P1A.1.6, P0.9.6
- **Blocks:** none
- **Can run in parallel with:** P1A.4.4

##### Security 🔒
- CSRF required.
- Session row deletion is DB-backed (not just cookie clear), so stolen cookies can't resurface.

##### Out of scope
- Global session revocation from admin app (Phase 6).

---

#### [P1A.4.4] Client-side session hydration via nanostore

**Parent:** [P1A.4](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Astro islands need reactive access to the current User + Organization. Hydrate a `currentUser` + `currentOrganization` nanostore on page load so components don't prop-drill.

##### Spec references
- [CLAUDE.md §4](../.claude/CLAUDE.md) — state management rules.
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — User + Organization shape.

##### Canonical terms
User, Organization, Session.

##### Files to touch
- `src/stores/currentUser.ts` (new)
- `src/stores/currentOrganization.ts` (modified — created in P0.9.6)
- `src/layouts/AppLayout.astro` (modified) — inject hydration script.
- `src/stores/currentUser.test.ts` (new)

##### Failing test to write first
- **File:** `src/stores/currentUser.test.ts`
- **Cases:**
  - Store initialises to `null`.
  - `hydrate({ id, email })` sets value; subscribers fire once.
  - `resetAllStores()` clears the store (integration with P0.9.6).
- Command: `npm test src/stores/currentUser.test.ts`.

##### Implementation notes
- Use `atom` from `nanostores`.
- Never include tokens, `stripe_customer_id`, or any server-only secrets in the client store (CLAUDE.md §4).

##### Acceptance criteria
- [ ] Three cases green.
- [ ] Hydration script in `AppLayout.astro` runs before islands mount.
- [ ] Store values contain only `id`, `email`, `name` (no sensitive fields).
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.4.2, P0.9.6
- **Blocks:** P1A.4.5
- **Can run in parallel with:** P1A.4.3

##### Security 🔒
- No server-only fields cross the client boundary.
- Reset on logout (P1A.4.3) wipes store.

##### Out of scope
- Current-Space store (Phase 2 / P1C.*).

---

#### [P1A.4.5] End-to-end auth smoke: protect a sample dashboard route

**Parent:** [P1A.4](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Gate sub-issue to prove the whole chain works before P1A.5/P1A.6 depend on it. Playwright flow: sign up → land on `/dashboard` → see hydrated User + Organization → log out → redirected to `/sign-in`.

##### Spec references
- [Baseout_PRD.md §14.5](Baseout_PRD.md) — E2E scenarios.
- [Baseout_PRD.md §13.2](Baseout_PRD.md) — Session persistence.

##### Canonical terms
User, Organization, Session, Magic Link.

##### Files to touch
- `tests/e2e/auth-smoke.spec.ts` (new)
- `src/pages/dashboard.astro` (new stub) — renders `Astro.locals.organization.name`.

##### Failing test to write first
- **File:** `tests/e2e/auth-smoke.spec.ts`
- **Cases:**
  - Unauthenticated GET `/dashboard` → lands on `/sign-in`.
  - Sign-up with magic-link dev-mode (terminal-logged link) or staging `EMAIL` binding → dashboard renders Organization name.
  - Close tab, reopen → Session persists; dashboard still renders.
  - Logout → redirected to `/sign-in`; revisit `/dashboard` → 302.
- Command: `npm run test:e2e -- auth-smoke.spec.ts`.

##### Implementation notes
- In local/CI: rely on the dev-mode console-log branch of `sendEmail()` (PRD §19.2); capture the link from logs. In staging E2E: use Playwright's inbox fetcher against a real `EMAIL` binding send. Do not hit prod.
- Keep the dashboard stub intentionally minimal — owned by P1C onward.

##### Acceptance criteria
- [ ] Four cases green.
- [ ] Session persists across browser close (PRD §13.2).
- [ ] Test runs in CI against ephemeral Compose Postgres (P0.2.2).
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.4.3, P1A.4.4, P1A.3.6
- **Blocks:** P1A.5.*, P1A.6.*
- **Can run in parallel with:** none

##### Security 🔒
- Test asserts `Set-Cookie` contains `HttpOnly; Secure; SameSite=Lax`.

##### Out of scope
- Dashboard content (Phase 1C).

---

### P1A.5

**Parent:** [P1A.5 Pre-registration schema viz session](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P3A.3.

Conversion hook per [PRD §6.6](Baseout_PRD.md): anonymous visitor OAuths into Airtable, sees Schema, then converts. Backed by a short-lived temporary session ID in an HttpOnly cookie, stored in Workers KV with 24h TTL, and claimed onto the new Organization's Connection on sign-up.

---

#### [P1A.5.1] `TempSession` type + KV codec contract

**Parent:** [P1A.5](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Contract for the pre-registration blob: `{ tempSessionId, encryptedAirtableToken, baseList[], createdAt, expiresAt }`. Locks the wire format so the OAuth handler (P1A.5.3) and the claim handler (P1A.5.5) agree.

##### Spec references
- [Baseout_PRD.md §6.6](Baseout_PRD.md) — pre-auth schema flow.
- [Baseout_PRD.md §13.2](Baseout_PRD.md) — temporary session concept.
- [Baseout_PRD.md §20.2](Baseout_PRD.md) — tokens encrypted at rest.

##### Canonical terms
Connection, Base, Platform, Schema.

##### Files to touch
- `src/lib/temp-session/types.ts` (new)
- `src/lib/temp-session/codec.ts` (new) — serialise/deserialise + Zod validator.
- `src/lib/temp-session/codec.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/temp-session/codec.test.ts`
- **Cases:**
  - Roundtrip: `decode(encode(t)) === t`.
  - `decode` rejects payloads with missing `expiresAt`.
  - `encode` refuses to include any field not in the schema (explicit allowlist).
- Command: `npm test src/lib/temp-session/codec.test.ts`.

##### Implementation notes
- `encryptedAirtableToken` is already an AES-256-GCM blob from `src/lib/crypto.ts` (P0.7.3 encrypts; KV stores only ciphertext).
- Base list is `Array<{ baseId: string; name: string }>` — no record data.

##### Acceptance criteria
- [ ] Three cases green.
- [ ] Explicit allowlist enforced.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P0.7.3, P1A.1.1
- **Blocks:** P1A.5.2, P1A.5.3, P1A.5.5
- **Can run in parallel with:** none

##### Security 🔒
- Zod schema drops unknown fields (`strict`) to prevent extension attacks.

##### Out of scope
- OAuth scope negotiation (P1B.1).

---

#### [P1A.5.2] Workers KV-backed temp session store

**Parent:** [P1A.5](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `🔒 security:encryption`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
`createTempSession`, `getTempSession`, `deleteTempSession`. KV with 24h TTL. Anonymous visitor only — never returns a blob without a matching HttpOnly cookie ID.

##### Spec references
- [Baseout_PRD.md §13.2](Baseout_PRD.md) — temporary session, discarded on tab close.
- [Baseout_PRD.md §20.2](Baseout_PRD.md) — encryption at rest.

##### Canonical terms
Connection, Session (temporary).

##### Files to touch
- `src/lib/temp-session/store.ts` (new)
- `src/lib/temp-session/store.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/temp-session/store.test.ts`
- **Cases:**
  - `create` returns an ID; `get(id)` roundtrips.
  - `get` with wrong ID returns `null` (constant-time).
  - TTL set to 24h on KV write (asserted via Miniflare).
  - `delete` removes the entry.
- Command: `npm run test:integration src/lib/temp-session/store.test.ts`.

##### Implementation notes
- Run under Miniflare for KV simulation (per PRD §14.1).
- Encrypt the blob before write via `src/lib/crypto.ts` — KV is not a secrets store.

##### Acceptance criteria
- [ ] Four cases green.
- [ ] KV key namespace isolated: `temp_session:<id>`.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.5.1, P0.7.3
- **Blocks:** P1A.5.3, P1A.5.4, P1A.5.5
- **Can run in parallel with:** none

##### Security 🔒
- KV blobs are encrypted (defence-in-depth; KV is not an exposed surface but PRD §20 applies).
- Short TTL caps blast radius.

##### Out of scope
- Cross-region KV replication (Cloudflare managed).

---

#### [P1A.5.3] Anonymous Airtable OAuth handler + HttpOnly cookie mint

**Parent:** [P1A.5](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Kicks off Airtable OAuth for a visitor without a Baseout User. On callback, exchanges the code for a token, lists Bases, stores the temp session, and sets `baseout_temp_session` cookie (`HttpOnly; Secure; SameSite=Lax; Max-Age=86400`).

##### Spec references
- [Baseout_PRD.md §6.6](Baseout_PRD.md) — OAuth before register.
- [Baseout_PRD.md §13.1](Baseout_PRD.md) — Airtable OAuth is data-only.
- [Baseout_Features.md §1](Baseout_Features.md) — Connection.

##### Canonical terms
Connection, Platform, Base, Schema.

##### Files to touch
- `src/pages/auth/pre-register/airtable.ts` (new) — OAuth start.
- `src/pages/auth/pre-register/callback.ts` (new) — OAuth finish.
- `src/pages/auth/pre-register/callback.test.ts` (new)

##### Failing test to write first
- **File:** `src/pages/auth/pre-register/callback.test.ts`
- **Cases:**
  - Valid OAuth code → token stored encrypted, Bases listed, cookie set, 302 to `/schema/public/<tempSessionId>`.
  - Invalid `state` param → 400, no KV write.
  - Token exchange 5xx → graceful error page, no half-written KV entry.
- Command: `npm run test:integration src/pages/auth/pre-register/callback.test.ts`.

##### Implementation notes
- Reuse OAuth state helper from `src/lib/connectors/airtable/oauth.ts` (lands in P1B.1; stub for this ticket if needed).
- Keep this path ISOLATED from better-auth per P1A.1.5.

##### Acceptance criteria
- [ ] Three cases green.
- [ ] Cookie attrs: `HttpOnly; Secure; SameSite=Lax; Max-Age=86400`.
- [ ] Airtable token never appears in response body or logs.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.5.1, P1A.5.2, P1A.1.5
- **Blocks:** P1A.5.4, P1A.5.5
- **Can run in parallel with:** none

##### Security 🔒
- Airtable OAuth never mints a better-auth Session (enforced in P1A.1.5).
- State param CSRF check.
- No enumeration of temp session IDs (constant-time lookup).

##### Out of scope
- Schema viz rendering (P3A.3).

---

#### [P1A.5.4] Public schema-viz route reads temp session

**Parent:** [P1A.5](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
`/schema/public/<tempSessionId>` is an allowlisted route (from P1A.4.1) that reads the temp session and passes the Base list to the schema-viz island. P3A.3 owns the actual render; this sub-issue is the server data load + auth gate.

##### Spec references
- [Baseout_PRD.md §6.6](Baseout_PRD.md) — pre-auth schema flow.
- [Baseout_PRD.md §3.1](Baseout_PRD.md) — Schema visualization.

##### Canonical terms
Schema, Base, Connection.

##### Files to touch
- `src/pages/schema/public/[id].astro` (new)
- `src/pages/schema/public/[id].test.ts` (new)

##### Failing test to write first
- **File:** `src/pages/schema/public/[id].test.ts`
- **Cases:**
  - Valid cookie matches URL ID → page renders with Base list.
  - Cookie missing → redirect to `/sign-up`.
  - Cookie mismatch with URL ID → 404 (no enumeration).
  - Expired temp session → redirect to `/sign-up` with `?error=session_expired`.
- Command: `npm run test:integration src/pages/schema/public/[id].test.ts`.

##### Implementation notes
- URL-scoped for shareable link (with cookie check — defence-in-depth).
- Island for actual viz (P3A.3) imports the Base list as props.

##### Acceptance criteria
- [ ] Four cases green.
- [ ] No plaintext Airtable token reaches the client.
- [ ] Response is not cacheable (`Cache-Control: no-store`).
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.5.3, P1A.4.1
- **Blocks:** P3A.3
- **Can run in parallel with:** P1A.5.5

##### Security 🔒
- Cookie + URL ID double-check prevents drive-by sharing.
- `Cache-Control: no-store` to prevent browser/proxy caching of visitor data.

##### Out of scope
- Schema-viz component (P3A.3).

---

#### [P1A.5.5] Claim temp session on sign-up (attach Connection + Bases)

**Parent:** [P1A.5](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `tier-gate:all`, `🔒 security:encryption`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
On successful sign-up, if `baseout_temp_session` cookie exists + resolves, migrate the Airtable Connection and discovered Bases to the new Organization, then delete the KV entry. Runs inside the P1A.3 provisioning transaction.

##### Spec references
- [Baseout_PRD.md §6.6](Baseout_PRD.md) — temp session claimed on registration.
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `connections` table.
- [Baseout_Features.md §1](Baseout_Features.md) — Connection.

##### Canonical terms
Organization, Connection, Base, Platform.

##### Files to touch
- `src/lib/provisioning/claim-temp-session.ts` (new)
- `src/lib/provisioning/provision-account.ts` (modified) — call claim after persist.
- `src/lib/provisioning/claim-temp-session.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/provisioning/claim-temp-session.test.ts`
- **Cases:**
  - Cookie present + valid → row inserted in `connections` with encrypted token, KV entry deleted.
  - Cookie absent → provisioning proceeds without claim; no error.
  - Cookie present but expired → provisioning proceeds without claim; cookie cleared on response.
  - Claim failure does NOT roll back Organization/User (non-blocking side effect).
- Command: `npm run test:integration src/lib/provisioning/claim-temp-session.test.ts`.

##### Implementation notes
- Re-encrypt the token under the Organization's scope before writing to `connections` (use `src/lib/crypto.ts`).
- Discovered Bases stored as pending records; actual Base table lands in later Phase.

##### Acceptance criteria
- [ ] Four cases green.
- [ ] Encrypted token roundtripped without plaintext on the wire.
- [ ] KV entry deleted post-claim.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.5.2, P1A.5.3, P1A.3.6, P0.7.4
- **Blocks:** P1B.1, P1C.*
- **Can run in parallel with:** P1A.5.4

##### Security 🔒
- Airtable token re-encrypted under master key on persist (PRD §20.2).
- Claim failure logged + audited; never silently loses the OAuth grant.

##### Out of scope
- Multi-Connection conflict resolution (single Connection per Org in MVP).

---

### P1A.6

**Parent:** [P1A.6 Trial state management + cap enforcement](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P1B.8, P4A.1.

Server-side Trial state machine for the Airtable Subscription: 7 days + 1 Backup Run, caps at 1,000 records / 5 tables / 100 attachments. Capability resolver reads `platform + tier + status + trial_ends_at` from the Subscription row, never from Stripe product names.

---

#### [P1A.6.1] `TrialState` enum + state-machine pure function

**Parent:** [P1A.6](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** billing
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:billing`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Pure function: `resolveTrialState(subscription, now)` → `'trial_active' | 'trial_expired' | 'trial_consumed' | 'paid' | 'canceled'`. Deterministic, no side effects, foundation for every downstream check.

##### Spec references
- [Baseout_PRD.md §8.3](Baseout_PRD.md) — Trial caps.
- [Baseout_PRD.md §8.6](Baseout_PRD.md) — 7-day + 1-run trial.
- [Baseout_Features.md §5.5.4](Baseout_Features.md) — per-platform trial scope.

##### Canonical terms
Trial, Subscription, Backup Run.

##### Files to touch
- `src/lib/billing/trial-state.ts` (new)
- `src/lib/billing/trial-state.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/billing/trial-state.test.ts`
- **Cases:**
  - `status='trialing'`, `trial_ends_at` in future, no Runs → `trial_active`.
  - Same, with 1 successful Backup Run → `trial_consumed`.
  - `trial_ends_at` in past → `trial_expired` regardless of run count.
  - `status='active'` → `paid`.
  - `status='canceled'` → `canceled`.
- Command: `npm test src/lib/billing/trial-state.test.ts`.

##### Implementation notes
- Pure function, no I/O.
- Accepts `{ status, trialEndsAt, backupRunCount }`; caller supplies `backupRunCount` (count query lives in P1A.6.2).

##### Acceptance criteria
- [ ] Five cases green.
- [ ] Exhaustive switch on return type (TS enforcement).
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P0.7.5
- **Blocks:** P1A.6.2, P1A.6.3, P1A.6.4, P1A.6.5
- **Can run in parallel with:** none

##### Security 🔒
- N/A (pure function, no external input).

##### Out of scope
- Stripe webhook state transitions (P4A.2).

---

#### [P1A.6.2] `getTrialStateForOrganization` — DB-backed resolver

**Parent:** [P1A.6](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** billing
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:billing`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Wraps the pure state machine with a Drizzle query: pull the Organization's Airtable Subscription + count completed Backup Runs, feed into `resolveTrialState`. This is the function every feature gate calls.

##### Spec references
- [Baseout_PRD.md §8.3](Baseout_PRD.md) — Trial caps enforcement surface.
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `subscriptions` + `backup_runs`.
- [Baseout_Features.md §5.5.6](Baseout_Features.md) — capability resolution by platform.

##### Canonical terms
Organization, Subscription, Backup Run, Trial, Platform.

##### Files to touch
- `src/lib/billing/get-trial-state.ts` (new)
- `src/lib/billing/get-trial-state.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/billing/get-trial-state.test.ts`
- **Cases:**
  - Fixture Organization with fresh trial → `trial_active`.
  - Fixture with 1 Backup Run (`status='success'`) → `trial_consumed`.
  - `trial_ends_at` back-dated → `trial_expired`.
  - Scoped by `platform='airtable'` — Notion subs (future) don't affect result.
- Command: `npm run test:integration src/lib/billing/get-trial-state.test.ts`.

##### Implementation notes
- Single join query: `subscriptions ⋈ backup_runs`.
- Capability resolution reads `platform + tier` from the Subscription row, never a product name (Features §5.5.6).

##### Acceptance criteria
- [ ] Four cases green.
- [ ] Per-platform scoping verified with a cross-platform fixture.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.6.1, P0.7.5, P0.7.6
- **Blocks:** P1A.6.3, P1A.6.4, P1A.6.5
- **Can run in parallel with:** none

##### Security 🔒
- Reads only Subscription + Backup Run counts — never Stripe secrets.

##### Out of scope
- Writing Trial state (Stripe webhook territory, P4A.2).

---

#### [P1A.6.3] Backup-run preflight: refuse 2nd Run while `is_trial`

**Parent:** [P1A.6](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** billing
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:billing`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Before enqueueing any Backup Run, `preflightBackupRun(orgId)` refuses when trial state is `trial_consumed` or `trial_expired`. Web-side first-line defence; engine enforces again in P1B.8.

##### Spec references
- [Baseout_PRD.md §8.3](Baseout_PRD.md) — Trial caps.
- [Baseout_Backlog.md §P1A.6](Baseout_Backlog.md) — preflight acceptance criterion.

##### Canonical terms
Backup Run, Trial, Organization.

##### Files to touch
- `src/lib/billing/preflight-backup-run.ts` (new)
- `src/lib/billing/preflight-backup-run.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/billing/preflight-backup-run.test.ts`
- **Cases:**
  - `trial_active` → `{ ok: true }`.
  - `trial_consumed` → `{ ok: false, reason: 'trial_consumed' }`.
  - `trial_expired` → `{ ok: false, reason: 'trial_expired' }`.
  - `paid` → `{ ok: true }` (no preflight block regardless of Run count).
- Command: `npm run test:integration src/lib/billing/preflight-backup-run.test.ts`.

##### Implementation notes
- Returns a discriminated union; caller does exhaustive switch.
- Engine-side duplicate check in P1B.8 is by design — do not rely on a single surface.

##### Acceptance criteria
- [ ] Four cases green.
- [ ] `{ ok: false }` result carries a structured `reason`, never a UI string.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.6.2
- **Blocks:** P1B.8, P1A.6.5
- **Can run in parallel with:** P1A.6.4

##### Security 🔒
- Server-only; never called from client islands.

##### Out of scope
- Record/table/attachment caps (engine-side, P1B.8).

---

#### [P1A.6.4] Cron-scheduled Day-5 warning + Day-7 expiry email trigger

**Parent:** [P1A.6](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** billing
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:billing`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Daily cron scans Subscriptions: if `trial_ends_at` is in 2 days AND no Day-5 email sent, enqueue Trial Expiry Warning. If `trial_ends_at` is past AND no Day-7 email, enqueue Trial Expired. Uses `notification_log` for idempotency.

##### Spec references
- [Baseout_PRD.md §19.1](Baseout_PRD.md) — Trial Expiry Warning (Day 5) + Trial Expired (Day 7) templates.
- [Baseout_PRD.md §8.3](Baseout_PRD.md) — 7-day trial.

##### Canonical terms
Trial, Subscription, Organization, Notification.

##### Files to touch
- `src/lib/jobs/trial-email-cron.ts` (new)
- `src/pages/api/internal/cron/trial-emails.ts` (new) — HTTP-triggered for Cloudflare Cron.
- `src/lib/jobs/trial-email-cron.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/jobs/trial-email-cron.test.ts`
- **Cases:**
  - Fixture Subscription with `trial_ends_at = now + 2d`, no prior notice → enqueues Warning; writes `notification_log` row.
  - Re-run same day → no second enqueue (idempotent).
  - `trial_ends_at = now - 1h`, no prior expiry notice → enqueues Expired.
  - `paid` Subscription → no emails.
- Command: `npm run test:integration src/lib/jobs/trial-email-cron.test.ts`.

##### Implementation notes
- Cron route protected by a shared secret header (Cloudflare Cron Trigger).
- Templates live in P2D.1 (React Email) — plain-text fallback here.

##### Acceptance criteria
- [ ] Four cases green.
- [ ] Idempotent via `notification_log` (`event_type='trial_day5'` / `'trial_day7'`).
- [ ] Cron endpoint rejects requests without the cron secret.
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.6.2, P1A.1.4, P0.7.5
- **Blocks:** P2D.1 (template integration point)
- **Can run in parallel with:** P1A.6.3, P1A.6.5

##### Security 🔒
- Cron secret from Cloudflare Secrets; rejects internet callers.
- No PII in log bodies beyond the hashed `user_id`/`organization_id`.

##### Out of scope
- Actual email template HTML (P2D.1b).

---

#### [P1A.6.5] UI gate: block "New Backup" CTA when trial consumed/expired

**Parent:** [P1A.6](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** billing
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:billing`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
User-facing enforcement. The "Run Backup" button on the dashboard becomes disabled with an upgrade CTA when Trial state is `trial_consumed` or `trial_expired`. Server still enforces (P1A.6.3) — UI is UX, not security.

##### Spec references
- [Baseout_PRD.md §8.3](Baseout_PRD.md) — Trial state blocks new backups.
- [CLAUDE.md §7](../.claude/CLAUDE.md) — client validation is UX.

##### Canonical terms
Backup Run, Trial, Subscription.

##### Files to touch
- `src/components/dashboard/RunBackupButton.astro` (new)
- `src/stores/trialState.ts` (new) — nanostore mirroring server state.
- `tests/e2e/trial-gate.spec.ts` (new)

##### Failing test to write first
- **File:** `tests/e2e/trial-gate.spec.ts`
- **Cases:**
  - Fresh trial Organization → button enabled, label "Run Backup".
  - After 1 successful Run → button disabled, label "Upgrade to Run Again".
  - After `trial_ends_at` passes (fixture time) → button disabled, label "Trial Expired — Upgrade".
  - Button click when disabled is a no-op (no network call).
- Command: `npm run test:e2e -- trial-gate.spec.ts`.

##### Implementation notes
- Hydrate `trialState` store from `Astro.locals` in `AppLayout.astro`.
- Upgrade CTA links to P4A.1 flow (stub `/billing/upgrade` route if not yet built).

##### Acceptance criteria
- [ ] Four cases green.
- [ ] Button is a `<button disabled>` — not `<a>` — when blocked.
- [ ] Screen-reader announces state change (`aria-live`).
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.6.3, P1A.4.4
- **Blocks:** none
- **Can run in parallel with:** P1A.6.4

##### Security 🔒
- UI gate is defence-in-depth; server gate in P1A.6.3 is canonical.

##### Out of scope
- Actual upgrade flow (P4A.1).

---


### P1B.1

**Parent:** [P1B.1 Airtable OAuth + encrypted token storage](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P1B.2, P1B.4, P1C.1, P2C.2.

OAuth is the Connection mechanism to the Airtable Platform (never a login path for Users). Tokens are AES-256-GCM encrypted at rest per PRD §20.2. Sub-issues are ordered: shared types first, then start route, then callback, refresh-metadata, scope variant, and the end-to-end sandbox check.

---

#### [P1B.1.1] Define `AirtableOAuthConfig` + `AirtableTokenResponse` types

**Parent:** [P1B.1](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:auth`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Shared type surface so every OAuth sub-issue downstream binds to the same shape. No runtime behavior — types + a Zod schema for runtime validation at the HTTP boundary.

##### Spec references
- [Baseout_PRD.md §20.2](Baseout_PRD.md) — AES-256-GCM encryption at rest.
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `connections` columns.
- [Baseout_Features.md §1](Baseout_Features.md) — Connection / Platform.

##### Canonical terms
Connection, Platform (value: `airtable`), Organization.

##### Files to touch
- `src/oauth/airtable/types.ts` (new) — exports `AirtableOAuthConfig`, `AirtableTokenResponse`, `AirtableOAuthState`, `AirtableScopeVariant`.
- `src/oauth/airtable/types.test.ts` (new)

##### Failing test to write first
- **File:** `src/oauth/airtable/types.test.ts`
- **Cases:**
  - Zod schema for `AirtableTokenResponse` rejects a payload missing `access_token`.
  - Zod schema accepts a payload with `access_token`, `refresh_token`, `expires_in`, `token_type`, `scope`.
  - `AirtableScopeVariant` enum accepts only `standard` and `enterprise`.
- Command: `npm test src/oauth/airtable/types.test.ts`.

##### Implementation notes
- No `any`. Use `zod` inferred types (`z.infer`) as the TypeScript surface.
- `AirtableOAuthState` carries `{ nonce, organizationId, returnTo, scopeVariant }` — serialized through the `state` query param.
- Mark the `state` payload as signed in JSDoc; signing itself ships in P1B.1.2.

##### Acceptance criteria
- [ ] Schema + types exported, no `any` introduced (tsc strict).
- [ ] Unit tests cover reject + accept paths.
- [ ] Coverage target met per PRD §14.4 (engine 80%).

##### Dependencies
- **Blocked by:** P0.5.1 (`baseout-backup-engine` scaffold), P0.7.4 (`connections` schema).
- **Blocks:** P1B.1.2, P1B.1.3, P1B.1.4, P1B.1.5.

##### Security 🔒
- `AirtableTokenResponse` JSDoc warns: never log, never serialize to console. Only accepted inside the callback handler boundary.

##### Out of scope
- Token refresh flow (P2C.2).
- UI for connecting (P1C.1).

---

#### [P1B.1.2] `/api/connections/airtable/start` — signed state + redirect

**Parent:** [P1B.1](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:auth`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Start route builds the Airtable authorization URL, signs an `AirtableOAuthState` with a short TTL, stores state nonce server-side (KV or DO), and redirects the User's browser to Airtable. CSRF state binding is mandatory.

##### Spec references
- [Baseout_PRD.md §20.1](Baseout_PRD.md) — Cloudflare Secrets for OAuth client secret.
- [Baseout_Backlog.md P1B.1](Baseout_Backlog.md) — state param TTL.
- [CLAUDE.md §2](../.claude/CLAUDE.md) — CSRF on mutating handlers.

##### Canonical terms
Connection, Organization, Platform.

##### Files to touch
- `src/oauth/airtable/start.ts` (new) — Worker route handler.
- `src/oauth/airtable/state.ts` (new) — sign / verify state via HMAC-SHA256.
- `src/oauth/airtable/start.test.ts` (new)
- `wrangler.toml` (modified) — bind KV namespace `OAUTH_STATE` (existing project file).

##### Failing test to write first
- **File:** `src/oauth/airtable/start.test.ts`
- **Cases:**
  - GET without authenticated User → 401.
  - GET with session but no Organization context → 400.
  - Happy path → 302 to `https://airtable.com/oauth2/v1/authorize?...`, `state` query param is an HMAC-signed token.
  - Same User calling twice produces two different `nonce` values (no replay).
- Command: `npm test src/oauth/airtable/start.test.ts`.

##### Implementation notes
- Client ID from `env.AIRTABLE_OAUTH_CLIENT_ID`; client secret only used in callback.
- `code_challenge` uses PKCE S256 — store `code_verifier` in KV keyed by nonce (5 min TTL).
- Default `scope` variant is `standard`; Enterprise variant is an opt-in query arg `?variant=enterprise`.

##### Acceptance criteria
- [ ] State param is HMAC-signed (not plaintext); tampering rejected in callback.
- [ ] PKCE code_verifier stored in KV with TTL ≤ 5 min.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4 (engine 80%).

##### Dependencies
- **Blocked by:** P1B.1.1, P0.8 (secrets for `AIRTABLE_OAUTH_CLIENT_ID`, `AIRTABLE_OAUTH_CLIENT_SECRET`, `AIRTABLE_OAUTH_STATE_KEY`).
- **Blocks:** P1B.1.3.

##### Security 🔒
- CSRF: state bound to session id; short TTL (≤ 5 min).
- Do not echo `state` contents in logs — log only the nonce.
- Reject non-HTTPS redirect URIs in non-local env.

##### Out of scope
- Enterprise scope variant semantics beyond accepting the query arg (expanded in P1B.1.5).

---

#### [P1B.1.3] `/api/connections/airtable/callback` — exchange code, persist encrypted Connection

**Parent:** [P1B.1](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:auth`, `tier-gate:all`, `🔒 security:auth-path`, `🔒 security:encryption`, `granularity:tdd`, `agentic-ready`
**Estimate:** L

##### Context
Callback verifies state + PKCE, exchanges authorization code for tokens at Airtable's token endpoint, encrypts access + refresh tokens via `src/lib/crypto.ts`, and writes a `connections` row. Plaintext tokens must never touch disk or logs.

##### Spec references
- [Baseout_PRD.md §20.2](Baseout_PRD.md) — AES-256-GCM for OAuth tokens.
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `connections` columns.
- [Baseout_Backlog.md P1B.1](Baseout_Backlog.md) — acceptance criteria.

##### Canonical terms
Connection, Organization, Platform (`airtable`), Schema.

##### Files to touch
- `src/oauth/airtable/callback.ts` (new)
- `src/oauth/airtable/callback.test.ts` (new)
- `src/db/queries/connections.ts` (new) — typed Drizzle insert helper returning the new Connection id.

##### Failing test to write first
- **File:** `src/oauth/airtable/callback.test.ts`
- **Cases:**
  - Tampered state param → 400 and no DB write.
  - Airtable token endpoint returns 400 → 502 to caller, no DB write, metric emitted.
  - Happy path: `connections` row inserted with `access_token_enc` + `refresh_token_enc` as JSON blobs from `encrypt()`; plaintext not present in any column.
  - Decrypting stored blob with `decrypt()` yields the original access token.
- Command: `npm run test:integration src/oauth/airtable/callback.test.ts`.

##### Implementation notes
- Use `msw` to mock Airtable's `/oauth2/v1/token` endpoint.
- On insert, set `platform='airtable'`, `scope` from state, `token_expires_at=now()+expires_in`, `is_dead=false`.
- Wrap exchange → encrypt → insert in a single try/catch; on failure, redirect to `/settings/connections?error=airtable_oauth_failed` (no stack trace exposed).
- Emit audit row (reuse P0.7.5 `notification_log` channel or log-only for MVP — see Open Questions).

##### Acceptance criteria
- [ ] Tamper test green.
- [ ] Happy-path integration test roundtrips encrypted tokens.
- [ ] Grep assertion: callback source contains zero string literals of the word `access_token:` followed by a value, and never writes plaintext to `console`.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.1.1, P1B.1.2, P0.7.3 (crypto helper), P0.7.4 (`connections` schema).
- **Blocks:** P1B.1.4, P1B.1.5, P1B.1.6, P1B.4.*, P1C.1.

##### Security 🔒
- Plaintext tokens held only in local vars during exchange; function scope only.
- Never log the bearer. Error messages sanitize the token from response bodies.
- `DecryptError` surface never leaks to the HTTP response body.

##### Out of scope
- Refresh on expiry (P2C.2).
- UI success screen (P1C.1).

---

#### [P1B.1.4] Airtable user metadata fetch + `Connection.external_user_id`

**Parent:** [P1B.1](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:auth`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Immediately after token exchange, call Airtable `/v0/meta/whoami` to resolve the Airtable user id + email. Stored on the Connection as `external_user_id` so a duplicate connect attempt updates the existing Connection rather than creating a second row.

##### Spec references
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `connections`.
- [Baseout_Features.md §1](Baseout_Features.md) — Connection definition.

##### Canonical terms
Connection, Platform.

##### Files to touch
- `src/oauth/airtable/whoami.ts` (new)
- `src/oauth/airtable/whoami.test.ts` (new)
- `src/db/schema/connections.ts` (modified) — add nullable `external_user_id` text column + follow-on Drizzle migration.

##### Failing test to write first
- **File:** `src/oauth/airtable/whoami.test.ts`
- **Cases:**
  - Mocked `whoami` returns `{ id: 'usrXYZ', email: ... }` → function returns `{ externalUserId: 'usrXYZ' }`.
  - 401 response → throws `AirtableAuthError`.
  - 429 → retries once then throws with `retryable: true`.

##### Implementation notes
- Runs inside the callback transaction from P1B.1.3; on failure the Connection insert rolls back.
- Do not store the email — only the opaque `usrXYZ` id (minimize PII).

##### Acceptance criteria
- [ ] Column added via migration; prior tests still green.
- [ ] `whoami` called once per successful exchange.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.1.3.
- **Blocks:** P1B.1.5.

##### Security 🔒
- Do not log the bearer used for the `whoami` call.
- Email is intentionally not persisted — PII minimization per [CLAUDE.md §2](../.claude/CLAUDE.md).

##### Out of scope
- Multi-connection UI reconciliation (handled in P1C.1).

---

#### [P1B.1.5] Standard vs Enterprise scope variant selection

**Parent:** [P1B.1](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:auth`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Airtable OAuth exposes different scopes for standard vs enterprise workspaces. Baseout records which variant was granted so downstream backup code knows whether enterprise-only endpoints are available.

##### Spec references
- [Baseout_Backlog.md P1B.1](Baseout_Backlog.md) — Standard + Enterprise scope variants.
- [Baseout_Features.md §1](Baseout_Features.md) — Connection.

##### Canonical terms
Connection, Platform, Capability.

##### Files to touch
- `src/oauth/airtable/scopes.ts` (new) — exports `STANDARD_SCOPES`, `ENTERPRISE_SCOPES`, `resolveScopes(variant)`.
- `src/oauth/airtable/scopes.test.ts` (new)
- `src/oauth/airtable/start.ts` (modified) — call `resolveScopes`.
- `src/oauth/airtable/callback.ts` (modified) — persist `scope` column as the granted scope string from the token response.

##### Failing test to write first
- **File:** `src/oauth/airtable/scopes.test.ts`
- **Cases:**
  - `resolveScopes('standard')` returns the minimum viable read set (`data.records:read`, `schema.bases:read`, `data.attachments:read`).
  - `resolveScopes('enterprise')` adds `enterprise.scim.usersAndGroups:read` (or whatever enterprise-only scope is relevant).
  - Unknown variant throws.

##### Implementation notes
- Principle of least privilege: only request scopes we actually use in Phase 1B/2 (no write scopes).
- The granted `scope` string from Airtable may differ from the requested list — persist the actual granted set.

##### Acceptance criteria
- [ ] Unit tests green.
- [ ] No write scopes requested.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.1.2, P1B.1.3.
- **Blocks:** P1B.1.6.

##### Security 🔒
- Scope request review: this is the single enforcement point for "no write to Airtable via Connection" in V1.

##### Out of scope
- Capability gating from `scope` (lives alongside capability resolution in P2C.1).

---

#### [P1B.1.6] End-to-end Airtable OAuth sandbox integration test

**Parent:** [P1B.1](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:auth`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Glue test that wires start → Airtable sandbox → callback → DB row, end-to-end, with real HTTP to Airtable's OAuth sandbox (guarded by `AIRTABLE_SANDBOX=1` env). Keeps the happy path honest as contract drift is caught.

##### Spec references
- [Baseout_PRD.md §14](Baseout_PRD.md) — Playwright E2E for critical flows.
- [Baseout_Backlog.md P1B.1](Baseout_Backlog.md) — acceptance criterion on sandbox.

##### Canonical terms
Connection, Organization.

##### Files to touch
- `tests/e2e/airtable-oauth.spec.ts` (new) — Playwright + Worker dev server.
- `.github/workflows/ci.yml` (modified) — gated job that runs only when `AIRTABLE_SANDBOX_SECRETS` are set (on-demand, not every PR).

##### Failing test to write first
- **File:** `tests/e2e/airtable-oauth.spec.ts`
- **Cases:**
  - Drives a headless browser from `/api/connections/airtable/start`, fills the sandbox consent screen, returns through callback, asserts `connections` row exists with encrypted blobs.
  - Second run with same sandbox user updates the existing row (uses `external_user_id`).

##### Implementation notes
- Skip locally if env var not present — never fail CI with a missing secret.
- Never print Airtable password / secret to the Playwright trace.

##### Acceptance criteria
- [ ] Test passes against sandbox when env set.
- [ ] CI path documents how to enable it.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.1.3, P1B.1.4, P1B.1.5, P0.8 (secrets).
- **Blocks:** P1C.1 sign-off.

##### Security 🔒
- Sandbox credentials stored only in GitHub Encrypted Secrets.
- Playwright trace scrubbed for bearer tokens.

##### Out of scope
- Production credentials in CI (handled via separate staging run).

---

### P1B.2

**Parent:** [P1B.2 Durable Object per Space (state + cron)](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P1B.4, P1B.7, P1B.9, P2A.4.

`SpaceController` DO is the per-Space state machine: holds current Backup Run status, schedules alarms per `spaces.backup_frequency`, and emits WebSocket progress. Sub-issues are ordered: DO class + routing first, then state model, alarm scheduler, WebSocket emit, restart recovery, and the alarm→start-backup glue.

---

#### [P1B.2.1] `SpaceController` Durable Object class scaffold + routing

**Parent:** [P1B.2](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
DO class is already declared in `wrangler.toml` (P0.5.1). This sub-issue stands up the TypeScript class with request routing keyed by Space id and a `fetch` handler that dispatches to `/state`, `/start-run`, `/alarm`, and `/ws`.

##### Spec references
- [Baseout_PRD.md §4](Baseout_PRD.md) — Durable Objects per Space.
- [Baseout_PRD.md §4.3](Baseout_PRD.md) — Architecture diagram.

##### Canonical terms
Space, Backup Run, Organization.

##### Files to touch
- `src/durable-objects/space-controller.ts` (new)
- `src/durable-objects/space-controller.test.ts` (new)
- `src/worker.ts` (modified) — exports DO class, routes `/spaces/:id/*` to the stub.

##### Failing test to write first
- **File:** `src/durable-objects/space-controller.test.ts`
- **Cases:** (Miniflare)
  - GET `/spaces/:id/state` returns 200 with default state (`{ status: 'idle', progress: 0 }`).
  - POST `/spaces/:id/start-run` on an idle DO returns 202.
  - Two distinct `:id`s resolve to two distinct DO instances (object isolation).

##### Implementation notes
- Use `DurableObject.idFromName(spaceId)` for deterministic routing.
- Keep handlers thin — no backup logic in this sub-issue.
- Bind to env via `env.SPACE_CONTROLLER`.

##### Acceptance criteria
- [ ] DO class exported from worker entrypoint.
- [ ] Miniflare tests green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P0.5.1 (`wrangler.toml`), P0.7.5 (`spaces` schema).
- **Blocks:** P1B.2.2, P1B.2.3, P1B.2.4, P1B.2.5, P1B.2.6.

##### Security 🔒
- DO `fetch` handlers validate the caller's Organization owns the Space (join to `spaces.organization_id`) before responding.

##### Out of scope
- Backup execution (P1B.4).
- WebSocket (P1B.2.4).

---

#### [P1B.2.2] DO internal state model: `{ status, progress, currentRunId, error, lastUpdate }`

**Parent:** [P1B.2](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Typed `SpaceControllerState` stored via `state.storage` with a single state-machine transition function. All mutations go through `transition()` — never direct `state.storage.put` scattered across handlers.

##### Spec references
- [Baseout_PRD.md §7.6](Baseout_PRD.md) — WebSocket emits `{progress, status, lastUpdate}`.
- [Baseout_Backlog.md P1B.2](Baseout_Backlog.md) — internal state fields.

##### Canonical terms
Space, Backup Run.

##### Files to touch
- `src/durable-objects/state.ts` (new) — `SpaceControllerState` type + `transition(prev, event)`.
- `src/durable-objects/state.test.ts` (new)
- `src/durable-objects/space-controller.ts` (modified) — route through `transition()`.

##### Failing test to write first
- **File:** `src/durable-objects/state.test.ts`
- **Cases:**
  - `transition({status:'idle'}, {type:'start', runId})` → `{status:'running', progress:0, currentRunId:runId}`.
  - Illegal: `transition({status:'running'}, {type:'start'})` throws `IllegalTransitionError`.
  - `transition({status:'running'}, {type:'complete'})` → `{status:'idle', progress:100, currentRunId:null}`.
  - `transition({status:'running'}, {type:'fail', error})` → `{status:'failed', error, currentRunId:null}`.

##### Implementation notes
- Pure function — no DO storage access inside `transition`.
- Caller persists the returned state via `state.storage.put('state', next)` inside the request handler.

##### Acceptance criteria
- [ ] All four cases green.
- [ ] State shape matches [PRD §7.6](Baseout_PRD.md) emit payload.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.2.1.
- **Blocks:** P1B.2.3, P1B.2.4, P1B.2.5.

##### Security 🔒
- `error` messages persisted in state are sanitized — no bearer tokens, no stack traces from third-party SDKs.

##### Out of scope
- Persisted history of state transitions (lives in `backup_runs` per P1B.7).

---

#### [P1B.2.3] Cron alarm scheduling per `spaces.backup_frequency`

**Parent:** [P1B.2](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
DO sets its own alarm via `state.storage.setAlarm(nextFireAt)`, driven by the Space's `backup_frequency` column (`monthly` / `weekly` / `daily`). On alarm fire, the DO re-schedules the next one atomically before kicking off work.

##### Spec references
- [Baseout_PRD.md §2.2](Baseout_PRD.md) — Backup Schedules.
- [Baseout_PRD.md §4.3](Baseout_PRD.md) — DO cron-like controller.

##### Canonical terms
Space, Backup Run.

##### Files to touch
- `src/durable-objects/alarm.ts` (new) — `computeNextFire(frequency, now, jitterSeed)`.
- `src/durable-objects/alarm.test.ts` (new)
- `src/durable-objects/space-controller.ts` (modified) — `alarm()` handler.

##### Failing test to write first
- **File:** `src/durable-objects/alarm.test.ts`
- **Cases:**
  - `computeNextFire('daily', t)` returns `t + 24h ± jitter ≤ 5m`.
  - `computeNextFire('weekly', t)` returns `t + 7d`.
  - `computeNextFire('monthly', t)` lands on the same day-of-month next month (DST-aware, UTC).
  - Unknown frequency throws.

##### Implementation notes
- Jitter = deterministic hash of Space id modulo 5 minutes — prevents thundering herd while staying reproducible in tests.
- `alarm()` handler: (1) compute next fire, (2) `setAlarm(next)`, (3) POST to `/start-run` internally.
- Starter tier: monthly only; higher tiers validated at the API boundary, not inside the DO.

##### Acceptance criteria
- [ ] All four unit cases green.
- [ ] Miniflare test: advancing virtual time by 1d with a daily Space fires the alarm once.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.2.1, P1B.2.2.
- **Blocks:** P1B.2.6, P1B.9.*.

##### Security 🔒
- Alarm handler verifies the Space is not soft-deleted and its Organization's Subscription is not `canceled` before starting a run.

##### Out of scope
- Instant Backup webhook trigger (P3B.6).

---

#### [P1B.2.4] WebSocket endpoint: `/spaces/:id/ws` emits `{progress, status, lastUpdate}`

**Parent:** [P1B.2](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
DO upgrades the request to a WebSocket via Cloudflare's hibernatable WS API. Every state mutation calls `broadcast(state)`; clients subscribe to get live Backup Run progress on the dashboard.

##### Spec references
- [Baseout_PRD.md §7.6](Baseout_PRD.md) — WebSockets via DO.
- [Baseout_PRD.md §4.4](Baseout_PRD.md) — Real-time progress.

##### Canonical terms
Space, Backup Run.

##### Files to touch
- `src/durable-objects/websocket.ts` (new)
- `src/durable-objects/websocket.test.ts` (new)
- `src/durable-objects/space-controller.ts` (modified) — `broadcast(state)`.

##### Failing test to write first
- **File:** `src/durable-objects/websocket.test.ts`
- **Cases:** (Miniflare)
  - Unauthenticated upgrade → 401.
  - Cross-Organization subscribe → 403.
  - Authenticated subscriber receives a message immediately (initial state) + a second message after a `transition('start')`.
  - Subscribe during an in-flight run → receives current progress within 100 ms.

##### Implementation notes
- Use hibernation: `state.acceptWebSocket(ws)` so inactive connections don't count against DO CPU.
- Auth: session cookie validated at upgrade time; reject the upgrade itself, not the socket after-open.
- Payload = exact `SpaceControllerState` shape from P1B.2.2 — clients bind to one type.

##### Acceptance criteria
- [ ] Both authz tests green.
- [ ] Broadcast fires on every `transition()`.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.2.2.
- **Blocks:** P2A.4 (dashboard live progress).

##### Security 🔒
- Upgrade handler re-verifies session + Space ownership. No trust in `:id` from the URL without the join.
- No sensitive payload fields (no token ids, no error stack traces).

##### Out of scope
- Broadcast fan-out across multiple DOs (N/A — one DO per Space).

---

#### [P1B.2.5] Graceful restart: mark in-flight run `failed` on DO hibernation wake

**Parent:** [P1B.2](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
If a DO evicts mid-run, on the next wake the persisted state says `running` but no worker is processing. Wake path detects orphaned `running` state and transitions to `failed` with `error='restart_orphan'`, freeing the Connection lock (P1B.3) and updating the `backup_runs` row (P1B.7).

##### Spec references
- [Baseout_Backlog.md P1B.2](Baseout_Backlog.md) — graceful restart clause.
- [Baseout_PRD.md §4](Baseout_PRD.md) — DO recovery semantics.

##### Canonical terms
Backup Run, Space, Connection.

##### Files to touch
- `src/durable-objects/space-controller.ts` (modified) — `wake()` method called from `fetch`.
- `src/durable-objects/wake.test.ts` (new)

##### Failing test to write first
- **File:** `src/durable-objects/wake.test.ts`
- **Cases:**
  - DO with stored state `{status:'running', currentRunId}` + no current invocation → first `fetch` transitions to `failed` with `error='restart_orphan'`.
  - Subsequent `fetch` does nothing (idempotent).
  - Connection lock for `currentRunId` is released.

##### Implementation notes
- Gate: only run `wake()` once per DO instance per cold start; use a `boolean` in instance memory.
- Resume hint in `error_message`: the completed base count, so the operator can resume via a fresh run.

##### Acceptance criteria
- [ ] Wake test green.
- [ ] `backup_runs.status` updated to `failed` atomically with `connection_locks` release.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.2.2, P1B.3.* (lock release), P1B.7.* (run row update).
- **Blocks:** P1B.2.6.

##### Security 🔒
- Wake path must not cascade-delete or rewrite backup files — strictly a metadata operation.

##### Out of scope
- Automatic resume / retry (not in MVP).

---

#### [P1B.2.6] Alarm → start Backup Run glue (end-to-end fire)

**Parent:** [P1B.2](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Final integration: simulated alarm fires, DO transitions to `running`, creates a `backup_runs` row, acquires the Connection lock, and dispatches work via the backup engine entry (P1B.4 / P1B.9). This sub-issue wires the contracts — downstream sub-issues fill the real engine.

##### Spec references
- [Baseout_Backlog.md P1B.2](Baseout_Backlog.md).
- [Baseout_PRD.md §4](Baseout_PRD.md).

##### Canonical terms
Backup Run, Space, Connection.

##### Files to touch
- `src/durable-objects/space-controller.ts` (modified) — `alarm()` invokes `startBackupRun(spaceId)`.
- `src/backup/start-run.ts` (new, stub returning `{ runId }`) — real impl in P1B.4.
- `tests/integration/space-controller-alarm.test.ts` (new)

##### Failing test to write first
- **File:** `tests/integration/space-controller-alarm.test.ts`
- **Cases:** (Miniflare + Postgres)
  - Virtual clock advance → alarm fires → `backup_runs` row inserted with `status='pending'` → state transitions to `running`.
  - Next alarm rescheduled per Space frequency.

##### Implementation notes
- `startBackupRun` stub is intentional — keeps this sub-issue shippable before P1B.4 lands.

##### Acceptance criteria
- [ ] Integration test green.
- [ ] `backup_runs` row visible after alarm.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.2.3, P1B.2.5, P1B.7.1 (row insert helper).
- **Blocks:** P1B.4.*, P1B.9.*.

##### Security 🔒
- Stub never accepts an external caller's `organizationId` — resolved from the stored Space row.

##### Out of scope
- Actual file write (P1B.4).

---

### P1B.3

**Parent:** [P1B.3 DB-level connection locking](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P1B.4.

PRD §2.10 requires DB-level locks per Connection with 5-second retry. Sub-issues are ordered: schema, acquire, release, stale reclaim, then retry wrapper.

---

#### [P1B.3.1] `connection_locks` table schema + migration

**Parent:** [P1B.3](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `🔒 security:new-sql-surface`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Single-row-per-Connection lock table. Unique index on `connection_id` enforces mutual exclusion at the DB layer.

##### Spec references
- [Baseout_PRD.md §2.10](Baseout_PRD.md) — lock model.
- [Baseout_PRD.md §21.2](Baseout_PRD.md) — naming.

##### Canonical terms
Connection, Backup Run.

##### Files to touch
- `src/db/schema/connection_locks.ts` (new)
- `src/db/schema/index.ts` (modified)
- `src/db/schema/connection_locks.test.ts` (new)
- `drizzle/migrations/00xx_connection_locks.sql` (generated)

##### Failing test to write first
- **File:** `src/db/schema/connection_locks.test.ts`
- **Cases:**
  - Columns: `connection_id` (PK + FK), `owner_run_id` (FK → `backup_runs.id`), `acquired_at`, `expires_at`.
  - Insert with same `connection_id` twice fails (unique).
  - FK `connection_id` deletes cascade when a Connection is deleted.

##### Implementation notes
- `connection_id` is both PK and FK — one row max per Connection.
- `expires_at` defaults to `acquired_at + 15 minutes` per [P1B.3 acceptance criterion](Baseout_Backlog.md).

##### Acceptance criteria
- [ ] Schema compiles + migrates cleanly.
- [ ] Unique-violation integration test green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P0.7.4 (`connections`), P0.7.5 (`backup_runs`).
- **Blocks:** P1B.3.2, P1B.3.3.

##### Security 🔒
- No PII in this table — by design, only FK ids and timestamps.

##### Out of scope
- Postgres advisory-lock alternative (documented in runbook; schema is source of truth).

---

#### [P1B.3.2] `acquireLock(connectionId, runId)` via `INSERT ... ON CONFLICT DO NOTHING`

**Parent:** [P1B.3](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Primary acquire path. Atomic: one INSERT wins, all others return `null`.

##### Spec references
- [Baseout_PRD.md §2.10](Baseout_PRD.md).

##### Canonical terms
Connection, Backup Run.

##### Files to touch
- `src/db/locks/acquire.ts` (new)
- `src/db/locks/acquire.test.ts` (new)

##### Failing test to write first
- **File:** `src/db/locks/acquire.test.ts`
- **Cases:** (Postgres integration)
  - Single call on an unlocked Connection → returns `{ acquired: true, expiresAt }`.
  - Second call while lock held → returns `{ acquired: false }`.
  - 10 parallel calls → exactly one `acquired: true`.

##### Implementation notes
- Drizzle: `.onConflictDoNothing({ target: connectionLocks.connectionId }).returning()`.
- Deterministic `expires_at = acquired_at + 15 min`.

##### Acceptance criteria
- [ ] Concurrency test green under 10x parallel.
- [ ] No string-concat SQL (Drizzle only, parameterized).
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.3.1.
- **Blocks:** P1B.3.5.

##### Security 🔒
- Parameterized query only; `connectionId` never interpolated as string.

##### Out of scope
- Retry logic (P1B.3.5).

---

#### [P1B.3.3] `releaseLock(connectionId, runId)` in `finally` semantics

**Parent:** [P1B.3](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Deletes the lock row, but only if `owner_run_id` matches the caller's `runId` — prevents a late-waking orphan from releasing someone else's lock.

##### Spec references
- [Baseout_PRD.md §2.10](Baseout_PRD.md).
- [Baseout_Backlog.md P1B.3](Baseout_Backlog.md) — "Released in `finally` block".

##### Canonical terms
Connection, Backup Run.

##### Files to touch
- `src/db/locks/release.ts` (new)
- `src/db/locks/release.test.ts` (new)
- `src/db/locks/with-lock.ts` (new) — `withLock(connectionId, runId, fn)` helper wraps `fn` in try/finally.

##### Failing test to write first
- **File:** `src/db/locks/release.test.ts`
- **Cases:**
  - Release by the owning `runId` deletes the row.
  - Release by a non-owning `runId` is a no-op (row remains).
  - `withLock` calls `release` even when `fn` throws.

##### Implementation notes
- `DELETE ... WHERE connection_id = $1 AND owner_run_id = $2` — returning the deletion count for audit.
- Never swallow the exception from `fn`.

##### Acceptance criteria
- [ ] Non-owner release is a no-op.
- [ ] Throw-in-fn test shows release called.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.3.2.
- **Blocks:** P1B.3.5, P1B.2.5.

##### Security 🔒
- Parameterized DELETE only.

##### Out of scope
- Cross-region lock replication (single master DB per env in MVP).

---

#### [P1B.3.4] Stale lock reclaim (expires_at + audit)

**Parent:** [P1B.3](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
A crashed worker can leave a live lock. When a new acquire attempt finds a row past `expires_at`, it takes over and writes an audit entry.

##### Spec references
- [Baseout_PRD.md §2.10](Baseout_PRD.md).
- [Baseout_Backlog.md P1B.3](Baseout_Backlog.md) — "Stale lock timeout (e.g. 15 min); reclaimable by new run with audit log".

##### Canonical terms
Connection, Backup Run.

##### Files to touch
- `src/db/locks/reclaim.ts` (new)
- `src/db/locks/reclaim.test.ts` (new)
- `src/db/schema/notification_log.ts` (modified — or reuse existing audit channel per P0.7.5).

##### Failing test to write first
- **File:** `src/db/locks/reclaim.test.ts`
- **Cases:**
  - Acquire on a Connection whose lock's `expires_at` is in the past → succeeds, old row replaced.
  - Audit entry inserted with `event_type='connection_lock_reclaimed'`, previous + new `run_id`.
  - Acquire on a fresh (non-expired) lock does NOT reclaim.

##### Implementation notes
- Single transaction: `DELETE ... WHERE expires_at < now() AND connection_id = $1` → `INSERT ... ON CONFLICT DO NOTHING`.
- Audit row goes to `notification_log` (internal) for now; external notification lives in P2D.

##### Acceptance criteria
- [ ] Reclaim and no-reclaim paths covered.
- [ ] Audit row verified.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.3.2, P0.7.5.
- **Blocks:** P1B.3.5.

##### Security 🔒
- Audit inserts parameterized. No token ids in audit payload.

##### Out of scope
- Customer-visible alert on reclaim (V2).

---

#### [P1B.3.5] Retry wrapper: 5s backoff × 3 attempts, then fail

**Parent:** [P1B.3](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
The Backup Run entry point calls `acquireWithRetry(connectionId, runId)` — tries acquire, waits 5s, retries up to 3 times, then throws `LockContentionError` to mark the run `failed`.

##### Spec references
- [Baseout_Backlog.md P1B.3](Baseout_Backlog.md) — retry policy.
- [Baseout_PRD.md §2.10](Baseout_PRD.md).

##### Canonical terms
Connection, Backup Run.

##### Files to touch
- `src/db/locks/acquire-with-retry.ts` (new)
- `src/db/locks/acquire-with-retry.test.ts` (new)

##### Failing test to write first
- **File:** `src/db/locks/acquire-with-retry.test.ts`
- **Cases:** (virtual timers)
  - Lock released between attempt 2 and 3 → returns `{ acquired: true }` with `attempts=3`.
  - Never released → throws `LockContentionError` after attempt 3 + ~10s wall clock (virtual).
  - On immediate acquire → `attempts=1`, no sleep.

##### Implementation notes
- Use `vi.useFakeTimers()` — tests must not actually sleep 10 seconds.
- Reclaim logic (P1B.3.4) runs inside each attempt, not just the last.

##### Acceptance criteria
- [ ] All three timing cases green.
- [ ] `LockContentionError` carries `connectionId` + attempt count.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.3.2, P1B.3.3, P1B.3.4.
- **Blocks:** P1B.4.*.

##### Security 🔒
- `LockContentionError.message` sanitized — no token info even if caller logs the error.

##### Out of scope
- Alternate strategies (jittered backoff, queueing) — MVP is fixed 5s.

---

### P1B.4

**Parent:** [P1B.4 Static backup: schema + records → CSV + R2](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P1B.5, P2B.*.

The core MVP deliverable. Sub-issues ordered: typed Airtable client first, then paginator, schema fetch + `schema.json` write, CSV streaming writer, Field-type encoder, 429 backoff, and the per-Base orchestrator.

---

#### [P1B.4.1] Typed Airtable REST client (fetch + decrypt-on-use)

**Parent:** [P1B.4](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `🔒 security:encryption`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Thin typed wrapper over Airtable REST: `listBases`, `getBaseSchema(baseId)`, `listRecords(baseId, tableId, { pageToken })`. Pulls the Connection row, decrypts `access_token_enc` in-memory only, and attaches the bearer.

##### Spec references
- [Baseout_PRD.md §2.4](Baseout_PRD.md) — Static Backup flow.
- [Baseout_PRD.md §20.2](Baseout_PRD.md) — decrypt on use.

##### Canonical terms
Connection, Base, Table, Field, Schema, Record.

##### Files to touch
- `src/airtable/client.ts` (new)
- `src/airtable/client.test.ts` (new)
- `src/airtable/types.ts` (new) — `AirtableBase`, `AirtableBaseSchema`, `AirtableTable`, `AirtableField`, `AirtableRecord`, `AirtableListRecordsResponse`.

##### Failing test to write first
- **File:** `src/airtable/client.test.ts`
- **Cases:** (`msw`)
  - `getBaseSchema('appXYZ')` with a decrypted bearer yields a `AirtableBaseSchema` parsed via Zod.
  - 401 from Airtable → throws `AirtableAuthError`.
  - Access token is read from DB, passed to `decrypt()` once per request; token plaintext not retained on the client instance.
  - `listRecords` paginates with `offset` query param correctly.

##### Implementation notes
- Fetch wrapper sets `Authorization: Bearer ${decrypted}`; the decrypted string lives only in the local `fetch` call's scope.
- Zod-parse every external response — no `any`.
- Export `createAirtableClient({ connectionId, now })` factory.

##### Acceptance criteria
- [ ] All four cases green.
- [ ] No plaintext token survives the function scope (assert via memory heap shape or an explicit spy on the fetch init).
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P0.7.3 (crypto), P0.7.4 (`connections`), P1B.1.3 (stored tokens).
- **Blocks:** P1B.4.2, P1B.4.3, P1B.4.4, P1B.4.5, P1B.4.6, P1B.4.7.

##### Security 🔒
- Token never logged. Fetch wrapper passes a scrubbed copy of init to a debug logger (strip `Authorization`).
- Bearer reaches the Airtable API only over HTTPS.

##### Out of scope
- Refresh on expiry (P2C.2).

---

#### [P1B.4.2] Paginated record iterator with deleted-record tolerance

**Parent:** [P1B.4](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Async generator `iterateRecords(baseId, tableId)` yields Records page-by-page. Gaps from concurrent deletions are expected and must not crash the iterator (PRD §2.4 / backlog).

##### Spec references
- [Baseout_Backlog.md P1B.4](Baseout_Backlog.md) — "Handles deleted record (gap in IDs) without failing the run".

##### Canonical terms
Table, Record.

##### Files to touch
- `src/airtable/iterate-records.ts` (new)
- `src/airtable/iterate-records.test.ts` (new)

##### Failing test to write first
- **File:** `src/airtable/iterate-records.test.ts`
- **Cases:**
  - 3-page mock → iterator yields all Records in order.
  - Page 2 returns a smaller payload than expected (deletions between pages) → iterator continues.
  - `offset` advances across pages; final page with no `offset` ends the iteration.

##### Implementation notes
- `async function* iterateRecords(...)` — leverage streams, never load all pages into memory.
- Backoff on 429 is handled by P1B.4.6, not here.

##### Acceptance criteria
- [ ] Generator semantics preserved (consumer can `break` early).
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.4.1.
- **Blocks:** P1B.4.4, P1B.4.7.

##### Security 🔒
- N/A (delegates to the client).

##### Out of scope
- Webhook-driven incremental (P3B.6).

---

#### [P1B.4.3] Base Schema fetch → write `schema.json` to R2

**Parent:** [P1B.4](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
For each Base in the Run, fetch the Schema and write it as a canonical `schema.json` at the Base's path in R2 (path computed via P1B.6). CSV writers consume this JSON to drive column order.

##### Spec references
- [Baseout_PRD.md §2.4](Baseout_PRD.md).
- [Baseout_PRD.md §2.9](Baseout_PRD.md) — Schema entity.

##### Canonical terms
Base, Schema, Storage Destination, R2.

##### Files to touch
- `src/backup/write-schema.ts` (new)
- `src/backup/write-schema.test.ts` (new)

##### Failing test to write first
- **File:** `src/backup/write-schema.test.ts`
- **Cases:**
  - Calls `client.getBaseSchema(baseId)` once, passes result to the StorageDestination writer with key `.../schema.json` and `contentType='application/json'`.
  - Schema bytes are stable (deterministic ordering: tables sorted by id, fields sorted by id) — guards against noisy diffs between runs.

##### Implementation notes
- Use the Storage Destination interface from P1D.1 (R2 writer). Do not couple this sub-issue to R2 SDK directly — always through the abstraction.
- Canonicalize JSON via a small sort pass, not `JSON.stringify` alone.

##### Acceptance criteria
- [ ] Two identical schemas serialize to byte-identical payloads.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.4.1, P1B.6.* (path builder), P1D.1 (R2 writer).
- **Blocks:** P1B.4.4, P1B.4.7.

##### Security 🔒
- N/A (no tokens touched here beyond the client's own handling).

##### Out of scope
- Schema diff / Changelog (Phase 3).

---

#### [P1B.4.4] Streaming CSV writer (schema-driven column order)

**Parent:** [P1B.4](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
For each Table, stream Records → CSV → StorageDestination. Header row is `Field.name` in Schema-defined order. Streams end-to-end — the whole Table never lives in memory.

##### Spec references
- [Baseout_PRD.md §2.4](Baseout_PRD.md) — "Streams through memory, never disk".
- [Baseout_Backlog.md P1B.4](Baseout_Backlog.md) — "Column order = Field order from schema".

##### Canonical terms
Table, Field, Record, Storage Destination.

##### Files to touch
- `src/backup/write-csv.ts` (new)
- `src/backup/write-csv.test.ts` (new)

##### Failing test to write first
- **File:** `src/backup/write-csv.test.ts`
- **Cases:**
  - Header row matches `Field.name` in Schema order for a 3-field Table.
  - A Record is written even if it's missing a Field value (empty cell).
  - A Record with extra fields (unknown to Schema) is ignored, with an audit counter incremented.
  - Streaming a 10k-Record Table with a 5-item generator memory budget doesn't exceed 5 items in flight.

##### Implementation notes
- Use Web Streams (`ReadableStream` → `TransformStream`) — works in Workers.
- CSV quoting: RFC 4180 — double-quote wrap any cell containing `,`, `"`, or newline; escape `"` as `""`.
- `writeCsv(table, schema, iterator, storage)` — pure orchestration, delegates encoding to P1B.4.5.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] Memory test green under back-pressure.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.4.2, P1B.4.3, P1B.4.5, P1D.1.
- **Blocks:** P1B.4.7.

##### Security 🔒
- N/A.

##### Out of scope
- JSON output format (backlog mentions JSON optional; MVP is CSV only).

---

#### [P1B.4.5] Field-type → CSV cell encoder

**Parent:** [P1B.4](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Pure function mapping `(AirtableField, AirtableRecord.fields[name])` → CSV cell string. Covers every Airtable Field type the REST API can return: singleLineText, multilineText, richText, email, url, phoneNumber, number, currency, percent, date, dateTime, checkbox, singleSelect, multipleSelects, singleCollaborator, multipleCollaborators, attachments, multipleRecordLinks, formula, rollup, count, lookup, createdTime, createdBy, lastModifiedTime, lastModifiedBy, autoNumber, barcode, duration, rating, button, externalSyncSource, aiText.

##### Spec references
- [Baseout_Backlog.md P1B.4](Baseout_Backlog.md) — "Cell encoding per Airtable Field type (rollups as formatted strings, arrays JSON-encoded)".

##### Canonical terms
Field, Record, Attachment.

##### Files to touch
- `src/backup/encode-cell.ts` (new)
- `src/backup/encode-cell.test.ts` (new) — table-driven cases for every Field type.

##### Failing test to write first
- **File:** `src/backup/encode-cell.test.ts`
- **Cases:**
  - `number` → numeric string.
  - `multipleSelects` → JSON-encoded array.
  - `rollup` → formatted string per Airtable's returned value (not the raw array).
  - `attachments` → JSON array of `{ id, url, filename }` (full object preserved; dedup handled in P1B.5).
  - `multipleRecordLinks` → JSON array of `rec...` ids.
  - Unknown Field type → encoded as `JSON.stringify(value)` with a warning counter.

##### Implementation notes
- Pure function, no I/O.
- Dispatch via a type-narrowed switch over `field.type`.
- Decimal handling: stringify at full precision; never lose digits.

##### Acceptance criteria
- [ ] Every listed Field type has at least one test.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.4.1 (types).
- **Blocks:** P1B.4.4.

##### Security 🔒
- N/A (pure function).

##### Out of scope
- Type-specific restore (P5 concern).

---

#### [P1B.4.6] Rate-limit (429) handling with exponential backoff

**Parent:** [P1B.4](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Wrap the Airtable fetch with a policy: 429 → respect `Retry-After` header when present, else `min(2^attempt, 30s)`. Max 5 attempts per call. On exhaustion, fail the Backup Run for that Base only.

##### Spec references
- [Baseout_Backlog.md P1B.4](Baseout_Backlog.md) — "Handles rate limit (429) with exponential backoff".

##### Canonical terms
Connection, Backup Run.

##### Files to touch
- `src/airtable/retry.ts` (new)
- `src/airtable/retry.test.ts` (new)
- `src/airtable/client.ts` (modified) — wrap `fetch` via the retry policy.

##### Failing test to write first
- **File:** `src/airtable/retry.test.ts`
- **Cases:** (virtual timers)
  - 429 then 200 → returns 200, `attempts=2`.
  - 429 × 5 → throws `AirtableRateLimitError` after ~ (1+2+4+8+16)s virtual.
  - `Retry-After: 7` → waits exactly 7s, not `2^attempt`.
  - 5xx → retried (same policy); 4xx (not 429) → thrown immediately.

##### Implementation notes
- Never use real sleep in tests.
- Connection-level lock (P1B.3) naturally serializes calls on a Connection, but per-call retry remains needed.

##### Acceptance criteria
- [ ] All four cases green.
- [ ] Retry counts persisted on the Backup Run metrics (for ops visibility).
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.4.1.
- **Blocks:** P1B.4.7.

##### Security 🔒
- Retry logs never include the bearer or response body.

##### Out of scope
- Global token-bucket across multiple DOs (one DO per Connection already serializes).

---

#### [P1B.4.7] Per-Base orchestrator: schema + all tables → R2

**Parent:** [P1B.4](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `🔒 security:encryption`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Top-level `backupBase(baseId, runId)` glues the pieces: acquire Connection lock, write schema, iterate each Table, stream CSV through encoder to R2, release lock. Called per Base by Trigger.dev (P1B.9) or directly by the DO.

##### Spec references
- [Baseout_PRD.md §2.4](Baseout_PRD.md).
- [Baseout_Backlog.md P1B.4](Baseout_Backlog.md) — integration acceptance.

##### Canonical terms
Base, Table, Schema, Record, Backup Run, Connection, Storage Destination, R2.

##### Files to touch
- `src/backup/backup-base.ts` (new)
- `tests/integration/backup-base.test.ts` (new)

##### Failing test to write first
- **File:** `tests/integration/backup-base.test.ts`
- **Cases:** (Miniflare + `msw` Airtable + local S3-compatible R2 mock)
  - Fixture base with 2 Tables × 500 Records → R2 bucket contains `schema.json` + 2 CSVs.
  - Row count in CSV == fixture Record count.
  - Lock released on happy path.
  - Lock released when Table 2 errors (finally clause).

##### Implementation notes
- Orchestration only — all real work in the units above.
- Update `backup_runs.table_count` + `record_count` incrementally (P1B.7).

##### Acceptance criteria
- [ ] Integration test green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.3.5, P1B.4.3, P1B.4.4, P1B.4.5, P1B.4.6, P1B.6.*, P1B.7.*, P1D.1.
- **Blocks:** P1B.5.*, P1B.9.*.

##### Security 🔒
- Token decrypt → in-function scope only; never logged.
- Lock always released — verified by the finally-test case.

##### Out of scope
- Attachments (P1B.5).

---

### P1B.5

**Parent:** [P1B.5 Static backup: attachments with dedup](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P1B.8.

Attachments are streamed to the Storage Destination with a composite-ID dedup check against the prior Snapshot manifest. URL refresh on 1–2h Airtable expiry is explicit. Sub-issues ordered: composite ID, manifest IO, dedup check, URL refresh, streaming upload, run-level integration.

---

#### [P1B.5.1] Composite attachment ID generator

**Parent:** [P1B.5](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Deterministic ID: `{baseId}_{tableId}_{recordId}_{fieldId}_{attachmentId}` per PRD §2.8. Pure function; used by dedup + manifest.

##### Spec references
- [Baseout_PRD.md §2.8](Baseout_PRD.md) — composite ID.

##### Canonical terms
Attachment, Base, Table, Record, Field.

##### Files to touch
- `src/backup/attachment-id.ts` (new)
- `src/backup/attachment-id.test.ts` (new)

##### Failing test to write first
- **File:** `src/backup/attachment-id.test.ts`
- **Cases:**
  - Order-stable: swapping arg order changes output.
  - Component with `_` doesn't collide (use a separator that cannot appear in Airtable ids, e.g. `::`).
  - Empty component → throws.

##### Implementation notes
- Airtable ids are URL-safe alphanumerics; using `::` as separator is injection-safe. Document the choice in JSDoc with a link to [PRD §2.8](Baseout_PRD.md).

##### Acceptance criteria
- [ ] All three cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P0.5.1.
- **Blocks:** P1B.5.2, P1B.5.3.

##### Security 🔒
- N/A (pure, no external input beyond already-validated ids).

##### Out of scope
- Hashing the composite ID (not needed — length is bounded).

---

#### [P1B.5.2] Attachment manifest: read prior snapshot, append new entries

**Parent:** [P1B.5](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Each run writes `attachments.manifest.json` at the Base path: a list of `{ compositeId, size, storagePath, sha256? }`. New run reads the **prior** Backup Snapshot's manifest (if any) and uses it for dedup.

##### Spec references
- [Baseout_Backlog.md P1B.5](Baseout_Backlog.md) — "Manifest file written with list of attachment IDs + sizes".

##### Canonical terms
Attachment, Backup Snapshot, Storage Destination.

##### Files to touch
- `src/backup/attachment-manifest.ts` (new) — `readPriorManifest`, `appendToManifest`, `flushManifest`.
- `src/backup/attachment-manifest.test.ts` (new)

##### Failing test to write first
- **File:** `src/backup/attachment-manifest.test.ts`
- **Cases:**
  - No prior snapshot → `readPriorManifest` returns empty Map.
  - Prior snapshot with 3 entries → Map has those 3 keys.
  - Writing same `compositeId` twice within a run keeps one entry (last-write-wins).

##### Implementation notes
- `flushManifest` runs once at end of Base backup — not per attachment — to avoid N+1 writes.
- Use the StorageDestination abstraction (P1D.1).

##### Acceptance criteria
- [ ] Read/write roundtrip green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.5.1, P1D.1.
- **Blocks:** P1B.5.3, P1B.5.6.

##### Security 🔒
- Manifest contains no PII beyond the composite id (which is derived from Airtable opaque ids).

##### Out of scope
- Cross-run manifest garbage collection (V2).

---

#### [P1B.5.3] Dedup check: reference existing storage path, skip re-upload

**Parent:** [P1B.5](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
`ensureAttachment(attachment, priorManifest)` returns either `{ skipped: true, path }` (pointing at the existing object) or triggers the upload path (P1B.5.5).

##### Spec references
- [Baseout_Backlog.md P1B.5](Baseout_Backlog.md) — "Unchanged attachments referenced by hash, not re-uploaded".

##### Canonical terms
Attachment, Backup Snapshot.

##### Files to touch
- `src/backup/ensure-attachment.ts` (new)
- `src/backup/ensure-attachment.test.ts` (new)

##### Failing test to write first
- **File:** `src/backup/ensure-attachment.test.ts`
- **Cases:**
  - Composite id in prior manifest and size unchanged → `skipped: true`, uploader is NOT invoked.
  - Composite id present but size changed → falls through to upload (treat as different file).
  - Composite id absent → falls through to upload.

##### Implementation notes
- Size is a cheap proxy; MVP doesn't hash bytes. Document this in JSDoc.

##### Acceptance criteria
- [ ] All three cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.5.2.
- **Blocks:** P1B.5.5, P1B.5.6.

##### Security 🔒
- N/A.

##### Out of scope
- SHA-256 content hash (V2 — backlog says "by hash" as future; size proxy acceptable for MVP).

---

#### [P1B.5.4] Airtable attachment URL refresh on expiry

**Parent:** [P1B.5](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Airtable attachment URLs expire in 1–2 hours (PRD §2.8). On a 403/expired download, refresh by re-reading the Record via `listRecords`, then retry the download once.

##### Spec references
- [Baseout_PRD.md §2.8](Baseout_PRD.md) — "Airtable URL expiry (~1–2 hrs) handled by refresh process".
- [Baseout_Backlog.md P1B.5](Baseout_Backlog.md) — "Airtable attachment URL refreshed when expired".

##### Canonical terms
Attachment, Record, Field, Base, Table.

##### Files to touch
- `src/backup/refresh-attachment-url.ts` (new)
- `src/backup/refresh-attachment-url.test.ts` (new)

##### Failing test to write first
- **File:** `src/backup/refresh-attachment-url.test.ts`
- **Cases:** (`msw`)
  - Download returns 403 → refreshed URL downloads successfully on retry.
  - Download returns 403 twice → throws `AttachmentFetchError`.
  - Refresh issues exactly one `GET /v0/{baseId}/{tableId}/{recordId}` call.

##### Implementation notes
- Narrow refresh: fetch just the one Record, pluck the attachment field, find the same `attachmentId`.
- Missing from refreshed Record → throw `AttachmentDeletedError` (record row was edited during backup).

##### Acceptance criteria
- [ ] All three cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.4.1.
- **Blocks:** P1B.5.5.

##### Security 🔒
- Refresh call uses the same bearer policy — decrypted only in-function.

##### Out of scope
- Bulk refresh (rare; per-URL refresh acceptable for MVP).

---

#### [P1B.5.5] Streaming attachment download → R2 upload (with 3× retry)

**Parent:** [P1B.5](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Stream the attachment body from Airtable's CDN directly into the Storage Destination PUT — never buffer to memory or disk. 3 retries on transient failure with exponential backoff.

##### Spec references
- [Baseout_PRD.md §2.8](Baseout_PRD.md) — Proxy streaming.
- [Baseout_Backlog.md P1B.5](Baseout_Backlog.md) — "Retry on transient failure (3×, exponential)".

##### Canonical terms
Attachment, Storage Destination, R2.

##### Files to touch
- `src/backup/upload-attachment.ts` (new)
- `src/backup/upload-attachment.test.ts` (new)

##### Failing test to write first
- **File:** `src/backup/upload-attachment.test.ts`
- **Cases:**
  - Happy path: single 200 → PUT invoked once with the pipe.
  - 500 × 2 then 200 → PUT succeeds on attempt 3.
  - 500 × 3 → throws `AttachmentFetchError` after backoff.
  - Memory budget: upload a 100 MB fixture with a 10 MB budget — does not exceed.

##### Implementation notes
- Web Streams pipe: `downloadRes.body.pipeTo(storage.putStream(path))`.
- Backoff times identical to P1B.4.6 policy.

##### Acceptance criteria
- [ ] All four cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.5.3, P1B.5.4, P1D.1.
- **Blocks:** P1B.5.6.

##### Security 🔒
- Request body never logged; only metadata (size, status) recorded.

##### Out of scope
- Client-side encryption (R2 server-side encryption covers this per PRD §2.4).

---

#### [P1B.5.6] Per-Run integration: dedup across two consecutive runs uploads zero new attachments

**Parent:** [P1B.5](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Integration test that mirrors the backlog's acceptance: run twice over an unchanged fixture Base → second run uploads zero new attachments.

##### Spec references
- [Baseout_Backlog.md P1B.5](Baseout_Backlog.md) — "Integration: two runs over same base → second run uploads zero new attachments".

##### Canonical terms
Backup Run, Backup Snapshot, Attachment.

##### Files to touch
- `tests/integration/attachment-dedup.test.ts` (new)
- `src/backup/backup-base.ts` (modified) — invoke `ensureAttachment` for every attachment in every Record.

##### Failing test to write first
- **File:** `tests/integration/attachment-dedup.test.ts`
- **Cases:**
  - Run 1: uploads N attachments. Counter = N.
  - Run 2 (no changes): uploader counter = 0. Manifest referenced from Run 1 paths.

##### Implementation notes
- Fixture base built via `msw` handlers; uploader counter is a `vi.fn` wrapped around the R2 mock.

##### Acceptance criteria
- [ ] Run 2 uploads zero.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.5.1, P1B.5.2, P1B.5.3, P1B.5.5, P1B.4.7.
- **Blocks:** P1B.8.*, P2B.*.

##### Security 🔒
- Integration mocks never emit real tokens or real Airtable URLs.

##### Out of scope
- Partial-change fixture (V2 — MVP covers full-dedup case).

---

### P1B.6

**Parent:** [P1B.6 File path structure](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P1D.*, P1B.4.*, P1B.5.*.

Path builder + sanitizer + collision handling, per PRD §2.6. Chunked (not strict TDD loop) because it's a pure, highly testable utility.

---

#### [P1B.6.1] `buildBackupPath` utility — canonical layout builder

**Parent:** [P1B.6](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Single source of truth for path construction: `/{userRoot}/{spaceName}/{baseName}/{dateTime}/{tableName}.csv` per PRD §2.6. Returns path segments + final key; consumers (CSV writer, attachment uploader, schema writer) call this — never concatenate paths themselves.

##### Spec references
- [Baseout_PRD.md §2.6 + §2.4](Baseout_PRD.md) — file path spec (referenced in backlog P1B.6).

##### Canonical terms
Space, Base, Table, Storage Destination.

##### Files to touch
- `src/backup/paths.ts` (new) — `buildBackupPath(parts): string[]`.
- `src/backup/paths.test.ts` (new)

##### Failing test to write first
- **File:** `src/backup/paths.test.ts`
- **Cases:** (20+ cases per backlog)
  - Simple happy path.
  - Unicode Space name.
  - DateTime formatted as `YYYY-MM-DDTHH-mm-ssZ` (colon-free for Windows filesystems).
  - Path always starts with the user root.

##### Implementation notes
- Pure function. No I/O.
- Returns both the ordered segments (for SDKs that take an array) and the joined string with `/`.

##### Acceptance criteria
- [ ] 20+ test cases covered.
- [ ] Consumers throughout P1B.4/5 call this exclusively (enforced by grep rule in CI or a lint test).
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P0.5.1.
- **Blocks:** P1B.4.3, P1B.4.4, P1B.4.7, P1B.5.5, P1B.6.2, P1B.6.3.

##### Out of scope
- Per-provider quirks (OneDrive 400-char limit) — handled by P1D-series writers.

---

#### [P1B.6.2] Path component sanitizer (slashes, colons, control chars, zero-width)

**Parent:** [P1B.6](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Sanitize Space / Base / Table display names before they become path segments — users can name anything. Strip or replace slashes, colons, backslashes, control chars (0x00–0x1F, 0x7F), zero-width chars. Collapse whitespace. Truncate to 100 chars.

##### Spec references
- [Baseout_Backlog.md P1B.6](Baseout_Backlog.md) — "Invalid characters ... sanitized".

##### Canonical terms
Space, Base, Table.

##### Files to touch
- `src/backup/sanitize-path.ts` (new)
- `src/backup/sanitize-path.test.ts` (new)
- `src/backup/paths.ts` (modified) — call sanitizer before joining.

##### Failing test to write first
- **File:** `src/backup/sanitize-path.test.ts`
- **Cases:**
  - `"../etc/passwd"` → `"etc-passwd"` or similar — no `..` segment possible.
  - `"My Base: Final"` → `"My Base- Final"` (colon replaced).
  - `"name\u0000injection"` → control char stripped.
  - Empty / all-whitespace → `"unnamed"`.
  - Unicode (`"用户-💾"`) preserved.

##### Implementation notes
- Regex-driven; deny-list rather than allow-list so multilingual names aren't mangled.
- Document the replacement character and rule in JSDoc.

##### Acceptance criteria
- [ ] All five cases green.
- [ ] Path traversal (`..`) impossible after sanitization.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.6.1.
- **Blocks:** P1B.6.3.

##### Out of scope
- Per-locale display normalization (out of scope for V1).

---

#### [P1B.6.3] Collision suffix (`-1`, `-2`) for same-second runs + README

**Parent:** [P1B.6](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Two Runs completing in the same second (rare but possible) must not overwrite one another's snapshot. Probe with `HEAD`; if present, append `-1`, `-2`, ... until free. Document the layout in `baseout-backup-engine/README.md` so operators can navigate Storage Destinations by hand.

##### Spec references
- [Baseout_Backlog.md P1B.6](Baseout_Backlog.md) — "Collision-free when two runs complete at the same second (append `-1`, `-2`)".

##### Canonical terms
Backup Run, Storage Destination.

##### Files to touch
- `src/backup/resolve-collision.ts` (new)
- `src/backup/resolve-collision.test.ts` (new)
- `baseout-backup-engine/README.md` (new or modified)

##### Failing test to write first
- **File:** `src/backup/resolve-collision.test.ts`
- **Cases:**
  - No collision → path returned unchanged.
  - One prior snapshot at identical path → `-1` suffix on the date segment.
  - 5 prior snapshots → `-5` suffix.
  - Bounded retry count (say 20) throws `PathCollisionError` to prevent infinite loop.

##### Implementation notes
- Probe uses the StorageDestination abstraction (P1D.1) — `exists(path)` returns a boolean.

##### Acceptance criteria
- [ ] All four cases green.
- [ ] README section documents layout + example with a sample Organization.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.6.1, P1B.6.2, P1D.1.
- **Blocks:** P1B.4.7.

##### Out of scope
- Time-zone-aware layout (always UTC in MVP).

---

### P1B.7

**Parent:** [P1B.7 Backup Run record lifecycle](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P1B.10, P2A.3.

`backup_runs` row transitions from `pending` → `running` → (`success` | `failed` | `trial_complete`). Sub-issues ordered: insert, transition helper, metric persist, failure capture, crash-simulation integration.

---

#### [P1B.7.1] `createBackupRun(spaceId)` — INSERT `pending` with deterministic UUID + `is_trial`

**Parent:** [P1B.7](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Creating the Backup Run row is the first side-effect of any alarm fire. `is_trial` is read from Subscription state at creation time and frozen on the row — even if the Organization upgrades mid-run, this run stays trial.

##### Spec references
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `backup_runs`.
- [Baseout_Backlog.md P1B.7](Baseout_Backlog.md).

##### Canonical terms
Backup Run, Space, Subscription.

##### Files to touch
- `src/db/queries/backup-runs.ts` (new) — `createBackupRun`, `transitionBackupRun`, `updateBackupRunMetrics`.
- `src/db/queries/backup-runs.test.ts` (new)

##### Failing test to write first
- **File:** `src/db/queries/backup-runs.test.ts`
- **Cases:**
  - Happy path: row created with `status='pending'`, `is_trial` matching Subscription.
  - Trialing Subscription → `is_trial=true`.
  - Active Subscription → `is_trial=false`.
  - Calling with an unknown `spaceId` → throws `SpaceNotFoundError`, no row inserted.

##### Implementation notes
- UUID from `gen_random_uuid()` (DB-side) — deterministic in the sense of "always unique, returned from INSERT".
- `started_at` set server-side.

##### Acceptance criteria
- [ ] All four cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P0.7.5.
- **Blocks:** P1B.7.2, P1B.7.3, P1B.7.4, P1B.7.5.

##### Security 🔒
- Query parameterized via Drizzle; no string concat.

##### Out of scope
- Emission to WebSocket (handled by DO via P1B.2.4).

---

#### [P1B.7.2] `transitionBackupRun(id, toStatus)` — single-path state machine

**Parent:** [P1B.7](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Allowed transitions: `pending→running`, `running→success`, `running→failed`, `running→trial_complete`. Anything else throws `IllegalRunTransition`. Completion sets `completed_at=now()`.

##### Spec references
- [Baseout_Backlog.md P1B.7](Baseout_Backlog.md) — "single-path state machine (no skip from `pending` → `success`)".

##### Canonical terms
Backup Run.

##### Files to touch
- `src/db/queries/backup-runs.ts` (modified)
- `src/db/queries/backup-runs-transition.test.ts` (new)

##### Failing test to write first
- **File:** `src/db/queries/backup-runs-transition.test.ts`
- **Cases:**
  - `pending→running` green.
  - `pending→success` throws.
  - `running→trial_complete` green + `completed_at` populated.
  - Calling `transitionBackupRun` on a non-existent id throws.

##### Implementation notes
- Single UPDATE with a `WHERE status IN (...)` guard to avoid race conditions (two DOs can't both win the `pending→running` move).

##### Acceptance criteria
- [ ] Race-safety verified by a 10× parallel test where only one succeeds.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.7.1.
- **Blocks:** P1B.7.3, P1B.7.4, P1B.7.5.

##### Security 🔒
- Query parameterized.

##### Out of scope
- Audit log row for each transition (can piggyback on `notification_log` in a future sub-issue).

---

#### [P1B.7.3] `updateBackupRunMetrics` — record / table / attachment counters + duration

**Parent:** [P1B.7](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Engine increments counters as it writes CSV pages and uploads attachments. Duration calculated on completion as `completed_at - started_at`.

##### Spec references
- [Baseout_PRD.md §21.3](Baseout_PRD.md).
- [Baseout_Backlog.md P1B.7](Baseout_Backlog.md) — "Metrics persisted".

##### Canonical terms
Backup Run, Record, Table, Attachment.

##### Files to touch
- `src/db/queries/backup-runs.ts` (modified) — `incrementRunMetrics({ recordDelta, tableDelta, attachmentDelta })`.
- `src/db/queries/backup-runs-metrics.test.ts` (new)

##### Failing test to write first
- **File:** `src/db/queries/backup-runs-metrics.test.ts`
- **Cases:**
  - Two increments sum correctly (atomic UPDATE ... SET col = col + $1).
  - 10× parallel increments end at the correct total.
  - Duration computed correctly on transition to success.

##### Implementation notes
- Avoid read-modify-write — use `SET count = count + $1` atomic updates.

##### Acceptance criteria
- [ ] Parallel increment test green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.7.2.
- **Blocks:** P1B.7.5, P1B.4.7, P1B.5.6.

##### Security 🔒
- No sensitive data in metric columns — counts only.

##### Out of scope
- Metric streaming to WebSocket (P1B.2.4 already handles via DO state).

---

#### [P1B.7.4] `markBackupRunFailed(id, err)` — sanitized `error_message`

**Parent:** [P1B.7](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `🔒 security:encryption`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Failure path captures a short, user-safe error message in `error_message`. Sensitive details (bearers, SQL, stack traces containing third-party details) are stripped by `sanitizeError(err)`.

##### Spec references
- [Baseout_Backlog.md P1B.7](Baseout_Backlog.md) — "Failure mode captured in `error_message` column (sanitized)".

##### Canonical terms
Backup Run.

##### Files to touch
- `src/db/queries/backup-runs.ts` (modified) — `markBackupRunFailed`.
- `src/lib/sanitize-error.ts` (new)
- `src/lib/sanitize-error.test.ts` (new)

##### Failing test to write first
- **File:** `src/lib/sanitize-error.test.ts`
- **Cases:**
  - `new Error('Bearer abc.def.ghi failed')` → message with `Bearer [redacted]`.
  - `AirtableRateLimitError` → classified message `'rate_limit_exceeded'`.
  - `DecryptError` → classified `'token_decrypt_failed'` with no internal detail.
  - Unknown error → generic `'internal_error'` + a tracking id.

##### Implementation notes
- Error → class mapping via `instanceof` checks.
- Tracking id is a UUID; real details stay in Worker logs only.

##### Acceptance criteria
- [ ] All four cases green.
- [ ] `error_message` never exceeds 500 chars in DB.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.7.2.
- **Blocks:** P1B.7.5.

##### Security 🔒
- Bearer redaction covered by a regex in sanitizer; unit test asserts no `Bearer [a-zA-Z0-9.\-_]{20,}` survives sanitization.

##### Out of scope
- User-facing error page copy (handled in P2A.3).

---

#### [P1B.7.5] Crash-simulation integration: killed Worker → row ends `failed`

**Parent:** [P1B.7](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Matches backlog acceptance test: simulate engine crash mid-run → next DO wake marks row `failed` via P1B.2.5, with `error_message='restart_orphan'`.

##### Spec references
- [Baseout_Backlog.md P1B.7](Baseout_Backlog.md) — "simulate engine crash".

##### Canonical terms
Backup Run, Space.

##### Files to touch
- `tests/integration/backup-run-crash.test.ts` (new)

##### Failing test to write first
- **File:** `tests/integration/backup-run-crash.test.ts`
- **Cases:**
  - Start a Run → throw synthetic error mid-write → re-wake DO → row `status='failed'` with sanitized `error_message`.
  - Metrics counters not rolled back (we keep partial progress for debugging).

##### Implementation notes
- Uses Miniflare to control DO lifecycle; crash emulated by `throw` in a stubbed write step.

##### Acceptance criteria
- [ ] Integration test green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.7.1, P1B.7.2, P1B.7.4, P1B.2.5.
- **Blocks:** P1B.10.*.

##### Security 🔒
- Crash path must not leak the bearer into `error_message`.

##### Out of scope
- Resume from crash (future).

---

### P1B.8

**Parent:** [P1B.8 Trial cap enforcement in engine](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P4A.1.

Engine enforces 1,000 records / 5 tables / 100 attachments (PRD §1.6, §8.3 referenced). Graceful stop after current chunk; row marked `trial_complete`. Sub-issues ordered: counter primitives, per-Table gate, per-Attachment gate, run-level transition, integration.

---

#### [P1B.8.1] `TrialCapCounters` types + factory

**Parent:** [P1B.8](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Typed counter object with `records`, `tables`, `attachments` — plus `limits` pulled from Subscription state (P1A.6). For non-trial runs, limits are `Infinity` and the object becomes a no-op gate.

##### Spec references
- [Baseout_PRD.md §1.6](Baseout_PRD.md) — trial caps (1,000 / 5 / 100).
- [Baseout_Backlog.md P1B.8](Baseout_Backlog.md).

##### Canonical terms
Backup Run, Subscription, Trial, Record, Table, Attachment.

##### Files to touch
- `src/backup/trial-caps.ts` (new)
- `src/backup/trial-caps.test.ts` (new)

##### Failing test to write first
- **File:** `src/backup/trial-caps.test.ts`
- **Cases:**
  - `createCounters({ isTrial: true })` → `{ limits: { records: 1000, tables: 5, attachments: 100 } }`.
  - `createCounters({ isTrial: false })` → `{ limits: { records: Infinity, ... } }`.
  - `counters.recordsRemaining()` decreases on increment.

##### Implementation notes
- Pure data plus pure helpers; no I/O.

##### Acceptance criteria
- [ ] Three cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1A.6 (trial state on Subscription).
- **Blocks:** P1B.8.2, P1B.8.3, P1B.8.4.

##### Security 🔒
- N/A.

##### Out of scope
- Future per-tier cap lookups (read from Stripe metadata per CLAUDE.md §0 gating — MVP trial uses constants).

---

#### [P1B.8.2] Per-Table cap gate (stop after 5 Tables in trial)

**Parent:** [P1B.8](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Before starting Table N, check `counters.tables`. If limit reached, stop enumerating Tables and mark the Run for `trial_complete` transition at the Run end.

##### Spec references
- [Baseout_PRD.md §1.6](Baseout_PRD.md).

##### Canonical terms
Table, Backup Run, Trial.

##### Files to touch
- `src/backup/backup-base.ts` (modified) — check counter before each Table loop iteration.
- `src/backup/trial-caps.test.ts` (modified — add table-gate cases).

##### Failing test to write first
- **Cases:**
  - Fixture with 7 Tables + trial → engine processes first 5, flags `trialComplete: true` and stops.
  - Non-trial → processes all 7.

##### Implementation notes
- Record the `trialComplete` flag on the caller; transition to `trial_complete` runs at end of run (P1B.8.4).

##### Acceptance criteria
- [ ] Two cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.8.1.
- **Blocks:** P1B.8.4.

##### Security 🔒
- N/A.

##### Out of scope
- Per-record cap (P1B.8.3).

---

#### [P1B.8.3] Per-Record + per-Attachment cap gates (mid-chunk stop)

**Parent:** [P1B.8](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Record + Attachment caps: "graceful stop after current chunk; no partial corruption". Stop means: finish the page/chunk already in flight, flush buffers, then do not fetch the next page.

##### Spec references
- [Baseout_Backlog.md P1B.8](Baseout_Backlog.md) — "graceful stop after current chunk".

##### Canonical terms
Record, Attachment, Backup Run, Trial.

##### Files to touch
- `src/backup/write-csv.ts` (modified) — consult counter after each page.
- `src/backup/upload-attachment.ts` (modified) — consult counter before each attachment.
- `src/backup/trial-caps.test.ts` (modified — add record + attachment cases).

##### Failing test to write first
- **Cases:**
  - Fixture with 2,000 Records + trial → Run completes with 1,000 in CSV. CSV is valid (ends with newline, no torn row).
  - Fixture with 150 Attachments + trial → first 100 uploaded, remainder skipped.

##### Implementation notes
- Page boundary: post-page check. Don't abort mid-row.
- Manifest flushed with partial data — restore still works from partial snapshot.

##### Acceptance criteria
- [ ] Torn-row test green: CSV parses without errors after cap hit.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.8.1.
- **Blocks:** P1B.8.4, P1B.8.5.

##### Security 🔒
- N/A.

##### Out of scope
- Record-level sampling UX (not in scope).

---

#### [P1B.8.4] `trial_complete` transition + partial-data retention

**Parent:** [P1B.8](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
When any cap trips, the Run transitions to `trial_complete` (not `success`, not `failed`). Partial data remains in the Storage Destination and is usable for Restore.

##### Spec references
- [Baseout_Backlog.md P1B.8](Baseout_Backlog.md) — "Run marked `trial_complete`; partial data retained and usable for restore".

##### Canonical terms
Backup Run, Backup Snapshot, Trial, Restore.

##### Files to touch
- `src/backup/backup-run-orchestrator.ts` (new or modified) — end-of-run transition.
- `tests/integration/trial-complete-transition.test.ts` (new)

##### Failing test to write first
- **File:** `tests/integration/trial-complete-transition.test.ts`
- **Cases:**
  - Trip any cap → final `backup_runs.status='trial_complete'`.
  - Snapshot files still present in R2 / Storage Destination.
  - Non-cap-trip Run stays `success`.

##### Implementation notes
- Single transition decision at end of run; explicit precedence if both record + attachment caps trip: still just `trial_complete`.

##### Acceptance criteria
- [ ] Three cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.8.2, P1B.8.3, P1B.7.2.
- **Blocks:** P1B.8.5.

##### Security 🔒
- N/A.

##### Out of scope
- Trial-capped email (P2D.1; this sub-issue just queues the notification event — see P1B.8.5).

---

#### [P1B.8.5] Trial-capped event emission + end-to-end integration

**Parent:** [P1B.8](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
On `trial_complete` transition, enqueue a notification event (`event_type='trial_capped'`) via the notification bus (P2D.1 consumer; eventual email delivery goes through `sendEmail()` → `env.EMAIL`). Final integration test ties it all together with the backlog's own fixture (2,000 Records + trial Sub → stops at 1,000).

##### Spec references
- [Baseout_Backlog.md P1B.8](Baseout_Backlog.md) — "Trial-capped email queued (P2D.1)".

##### Canonical terms
Backup Run, Trial, Notification.

##### Files to touch
- `src/notifications/emit.ts` (new or modified) — typed event publisher (P2D.1 consumes).
- `tests/integration/trial-cap-end-to-end.test.ts` (new)

##### Failing test to write first
- **File:** `tests/integration/trial-cap-end-to-end.test.ts`
- **Cases:**
  - Fixture 2,000 Records + trial → Run ends `trial_complete` with exactly 1,000 in CSV.
  - Exactly one `trial_capped` event emitted.
  - Emitting twice for the same run is idempotent (second emit is a no-op).

##### Implementation notes
- Idempotency key = `{runId}:trial_capped` in `notification_log`.

##### Acceptance criteria
- [ ] Three cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.8.4, P0.7.5 (`notification_log`).
- **Blocks:** P4A.1 (upgrade flow releases caps).

##### Security 🔒
- Event payload contains `runId` + `organizationId` only — no Record data.

##### Out of scope
- Actual email send (P2D.1).

---

### P1B.9

**Parent:** [P1B.9 Trigger.dev job integration](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P1B.10.

Trigger.dev V3 fan-outs one `backupBase` job per Base per Run. DO is the coordinator. Sub-issues ordered: project config, typed job definition, DO enqueue, webhook callback, idempotency + integration.

---

#### [P1B.9.1] Trigger.dev project wiring + secrets for staging/prod

**Parent:** [P1B.9](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `🔒 security:new-secret`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Add `@trigger.dev/sdk/v3`, scaffold `trigger/` directory, register `TRIGGER_SECRET_KEY` per environment (staging + prod Cloudflare Secrets).

##### Spec references
- [Baseout_PRD.md §4.1](Baseout_PRD.md) — Trigger.dev in stack.
- [Baseout_Backlog.md P1B.9](Baseout_Backlog.md) — "configured with staging + prod tokens".

##### Canonical terms
Backup Run.

##### Files to touch
- `trigger.config.ts` (new)
- `wrangler.toml` (modified) — declare secret placeholder.
- `infra/docs/secret-rotation.md` (modified) — add `TRIGGER_SECRET_KEY` section.
- `tests/smoke/trigger-config.test.ts` (new)

##### Failing test to write first
- **File:** `tests/smoke/trigger-config.test.ts`
- **Cases:**
  - `trigger.config.ts` exports a config with a project ref.
  - Missing `TRIGGER_SECRET_KEY` at boot throws a clear error (no silent fallback).

##### Implementation notes
- Follow Trigger.dev V3 docs for config shape. Use `ctx7` to fetch docs before implementation.

##### Acceptance criteria
- [ ] Smoke test green.
- [ ] Secrets documented.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P0.8 (secrets).
- **Blocks:** P1B.9.2.

##### Security 🔒
- Secret per-env; never in source.

##### Out of scope
- Observability dashboards (V2).

---

#### [P1B.9.2] `backupBase` job definition (typed input + task)

**Parent:** [P1B.9](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Register the `backupBase` task with a typed input `{ runId, baseId, spaceId, organizationId }`. Body calls into `src/backup/backup-base.ts` from P1B.4.7.

##### Spec references
- [Baseout_Backlog.md P1B.9](Baseout_Backlog.md) — "`backupBase` job registered with typed input".

##### Canonical terms
Base, Backup Run, Space, Organization.

##### Files to touch
- `trigger/backup-base.ts` (new)
- `trigger/backup-base.test.ts` (new)

##### Failing test to write first
- **File:** `trigger/backup-base.test.ts`
- **Cases:**
  - Invoke task with valid input → delegates to `backupBase` from P1B.4.7.
  - Missing `baseId` → Zod-validation throws before side-effects.
  - Task returns `{ runId, baseId, status }` for the DO to consume.

##### Implementation notes
- Use Trigger.dev V3 `task()` helper; validate input via Zod schema from P1B.1.1-style pattern.

##### Acceptance criteria
- [ ] Validation test green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.9.1, P1B.4.7.
- **Blocks:** P1B.9.3.

##### Security 🔒
- Input validated before any DB write or external call.

##### Out of scope
- Alternative job types (schema-only backup) — MVP is one task type.

---

#### [P1B.9.3] DO enqueues one `backupBase` job per Base + awaits fan-out

**Parent:** [P1B.9](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
When the DO transitions to `running`, it lists Bases for the Space, enqueues one `backupBase` job per Base in parallel, and tracks outstanding ids. Completes the Run when all return (or transitions to failed if any fail after retries).

##### Spec references
- [Baseout_Backlog.md P1B.9](Baseout_Backlog.md).

##### Canonical terms
Space, Base, Backup Run.

##### Files to touch
- `src/durable-objects/space-controller.ts` (modified) — `startBackupRun` fan-out.
- `src/durable-objects/fanout.test.ts` (new)

##### Failing test to write first
- **File:** `src/durable-objects/fanout.test.ts`
- **Cases:** (Miniflare + mocked Trigger.dev client)
  - Space with 3 Bases → 3 `backupBase` enqueues.
  - Job completion order independent → DO reaches `success` only after all 3 report done.
  - 1 job fails after retries → DO transitions to `failed` with base-level error captured.

##### Implementation notes
- Maintain `outstandingBaseIds: Set<string>` in DO state; remove on callback (P1B.9.4).

##### Acceptance criteria
- [ ] All three cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.9.2, P1B.2.6.
- **Blocks:** P1B.9.4, P1B.9.5.

##### Security 🔒
- Enqueue payload contains `runId` + `baseId` only; no tokens.

##### Out of scope
- Concurrency limit per Connection (lock in P1B.3 handles serialization).

---

#### [P1B.9.4] Per-job progress webhook back to DO

**Parent:** [P1B.9](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Trigger.dev job POSTs progress/results to `/internal/spaces/:id/base-progress` — the DO consumes and updates state (which broadcasts via WebSocket, P1B.2.4).

##### Spec references
- [Baseout_Backlog.md P1B.9](Baseout_Backlog.md) — "Per-job progress reported back to DO via webhook / API".

##### Canonical terms
Backup Run, Base, Space.

##### Files to touch
- `src/routes/internal/base-progress.ts` (new)
- `src/routes/internal/base-progress.test.ts` (new)

##### Failing test to write first
- **File:** `src/routes/internal/base-progress.test.ts`
- **Cases:**
  - POST without an `X-Internal-Signature` HMAC header → 401.
  - Valid signature with `{ runId, baseId, progress }` → DO state updated.
  - Replayed POST (same `Idempotency-Key`) → 200 no-op.

##### Implementation notes
- HMAC shared secret = `TRIGGER_INTERNAL_WEBHOOK_SECRET`. Never exposed externally.

##### Acceptance criteria
- [ ] Three cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.9.3, P1B.2.4.
- **Blocks:** P1B.9.5.

##### Security 🔒
- Internal endpoint: HMAC-signed, scoped path (`/internal/...`), IP-allowlisted to Trigger.dev egress ranges if supported.
- Replay-protected by an idempotency key.

##### Out of scope
- Customer-visible progress webhook (Outbound Webhooks are V2 per PRD §7.10).

---

#### [P1B.9.5] Idempotent job retry + end-to-end staging integration

**Parent:** [P1B.9](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Jobs must be idempotent — Trigger.dev retries on transient errors. Using `(runId, baseId)` as the dedup key in `backup_runs.base_progress` prevents double-writes. Staging integration test (on-demand) enqueues against real Trigger.dev.

##### Spec references
- [Baseout_Backlog.md P1B.9](Baseout_Backlog.md) — "Jobs idempotent on retry".

##### Canonical terms
Backup Run, Base.

##### Files to touch
- `trigger/backup-base.ts` (modified) — dedup key check.
- `src/db/schema/backup_run_base_progress.ts` (new) — small child table.
- `tests/integration/trigger-backup-base.test.ts` (new, on-demand)

##### Failing test to write first
- **File:** `tests/integration/trigger-backup-base.test.ts`
- **Cases:**
  - Task invoked twice with same input → only one completed-progress row inserted.
  - First invocation succeeds, retry of an already-succeeded job is a no-op.
  - Staging end-to-end (gated by env) → real job completes.

##### Implementation notes
- New child table `backup_run_base_progress` with unique `(run_id, base_id)`.

##### Acceptance criteria
- [ ] Idempotency test green.
- [ ] Staging gate documented; CI skips when absent.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.9.2, P1B.9.4.
- **Blocks:** P1B.10.*.

##### Security 🔒
- Staging secrets gated; dedup key prevents replay side-effects.

##### Out of scope
- Long-running job observability (V2).

---

### P1B.10

**Parent:** [P1B.10 Backup history endpoint](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P2A.3.

Paginated read-only endpoint for the dashboard. `baseout-web` repo — web surface on top of `backup_runs`. Chunked because it's a small, single-responsibility route.

---

#### [P1B.10.1] `GET /api/spaces/:id/backup-runs` route + auth gate

**Parent:** [P1B.10](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:backup`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Astro API route in `baseout-web`. Middleware validates session; handler validates that the authenticated User's Organization owns the Space id before reading `backup_runs`.

##### Spec references
- [Baseout_Backlog.md P1B.10](Baseout_Backlog.md).
- [CLAUDE.md §2](../.claude/CLAUDE.md) — middleware is the sole auth enforcement.

##### Canonical terms
Space, Backup Run, Organization.

##### Files to touch
- `src/pages/api/spaces/[id]/backup-runs.ts` (new)
- `src/pages/api/spaces/[id]/backup-runs.test.ts` (new)
- `src/middleware.ts` (modified if needed — only if route prefix not covered).

##### Failing test to write first
- **File:** `src/pages/api/spaces/[id]/backup-runs.test.ts`
- **Cases:**
  - Unauth → 401.
  - Auth'd User of a different Organization → 403.
  - Auth'd User of the owning Organization → 200 with empty list for a Space with no runs.

##### Implementation notes
- Query joins `spaces.organization_id = users.organization_id` inside the SQL — no trust in URL id.
- Returns `Content-Type: application/json`.

##### Acceptance criteria
- [ ] All three auth cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4 (API 75%).

##### Dependencies
- **Blocked by:** P1B.7.1, P0.7.2 (users schema), P0.7.5 (`backup_runs`).
- **Blocks:** P1B.10.2, P1B.10.3, P2A.3.*.

##### Out of scope
- Write endpoints (this is read-only).

---

#### [P1B.10.2] Cursor pagination + `started_at` desc ordering

**Parent:** [P1B.10](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:backup`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Query params: `?limit=20&cursor=<opaque>`. Cursor is an opaque base64 encoding of `(started_at, id)`. Response includes `nextCursor` when more pages exist.

##### Spec references
- [Baseout_Backlog.md P1B.10](Baseout_Backlog.md) — "paginated runs", "Sort by `started_at` desc".

##### Canonical terms
Backup Run.

##### Files to touch
- `src/pages/api/spaces/[id]/backup-runs.ts` (modified)
- `src/lib/pagination.ts` (new)
- `src/lib/pagination.test.ts` (new)

##### Failing test to write first
- **Cases:**
  - `?limit=10` on a fixture of 25 runs → 10 results + `nextCursor`.
  - Pass `nextCursor` → next 10 results.
  - Mutated cursor (tampered base64) → 400.
  - Default `limit` = 20; max `limit` = 100.

##### Implementation notes
- Cursor encoded as `base64url(json({ ts, id }))`. Signed? — for a read-only dashboard, not required; tamper just produces wrong page, never cross-Org data.

##### Acceptance criteria
- [ ] All four cases green.
- [ ] Stable ordering under ties on `started_at` via secondary `id` key.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.10.1.
- **Blocks:** P1B.10.3, P2A.3.*.

##### Out of scope
- Offset pagination (cursor only).

---

#### [P1B.10.3] Response shape + cross-Org 403 integration

**Parent:** [P1B.10](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:backup`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Finalize the JSON response shape: `{ items: BackupRunSummary[], nextCursor: string | null }` where `BackupRunSummary` is `{ id, status, startedAt, completedAt, durationMs, recordCount, tableCount, attachmentCount, isTrial }`. Plus the backlog's explicit integration: multi-Org fixture → cross-Org reads return 403.

##### Spec references
- [Baseout_Backlog.md P1B.10](Baseout_Backlog.md) — "Includes `status`, metrics, duration".

##### Canonical terms
Backup Run.

##### Files to touch
- `src/pages/api/spaces/[id]/backup-runs.ts` (modified)
- `src/lib/types/backup-run-summary.ts` (new)
- `tests/integration/backup-runs-cross-org.test.ts` (new)

##### Failing test to write first
- **File:** `tests/integration/backup-runs-cross-org.test.ts`
- **Cases:**
  - Two Orgs, each with one Space + one run → Org A's User reading Org B's Space returns 403.
  - Within-Org read returns the expected summary fields (`durationMs` computed).
  - Sensitive columns (`error_message`) included only for Org admins — plain members get a `hasError: boolean` stub.

##### Implementation notes
- Role check via `users.role`; `member` gets reduced field set, `admin`/`owner` get full.
- `durationMs` = `completed_at - started_at` at query time.

##### Acceptance criteria
- [ ] Cross-Org 403 green.
- [ ] Role-based field filtering green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target met per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.10.2, P1B.7.4.
- **Blocks:** P2A.3.*.

##### Out of scope
- Streaming / server-sent events (dashboard uses WebSocket from P1B.2.4 for live progress instead).

---


### P1C.1

**Parent:** [P1C.1 Onboarding Step 1 — Connect Airtable](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P1C.2, P1C.6.

Step 1 of the post-sign-up wizard renders the Organization's first Space and hands off to the Airtable OAuth starter endpoints (P1B.1), then returns the user to the wizard with a live Connection and a discovered Base list.

---

#### [P1C.1.1] Wizard shell + progress indicator + Step 1 route

**Parent:** [P1C.1](Baseout_Backlog.md) · **Repo:** `baseout-web` + `baseout-ui` · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Wizard is a 5-step linear flow ([PRD §6.6](Baseout_PRD.md)). This sub-issue stands up the shell (progress indicator + step frame + layout) shared by all five steps, plus the `step-1` route that renders the "Connect Airtable" CTA. Later steps slot into the shell — do not rebuild it per step.

##### Spec references
- [Baseout_PRD.md §6.6](Baseout_PRD.md) — onboarding wizard.
- [Baseout_PRD.md §6](Baseout_PRD.md) — UX direction.
- [CLAUDE.md §UI/UX](../.claude/CLAUDE.md) — mobile-first, @opensided/theme.

##### Canonical terms
Organization, Space, Connection, Platform, Base.

##### Files to touch
- `src/pages/wizard/step-1.astro` (new) — Step 1 view.
- `src/layouts/WizardLayout.astro` (new) — wraps step slot + progress indicator.
- `baseout-ui/src/components/WizardProgress.astro` (new) — 5-dot indicator with active/completed states.
- `src/stores/wizard.ts` (new) — nanostores atom `currentStep: 1..5`.
- `src/layouts/WizardLayout.test.ts`, `baseout-ui/tests/WizardProgress.test.ts` (new).

##### Failing test to write first
- **File:** `baseout-ui/tests/WizardProgress.test.ts`
- **Cases:**
  - Renders 5 steps with the given `current` step highlighted.
  - Steps before `current` render as "completed"; steps after as "upcoming".
  - Progress indicator has `role="progressbar"` with `aria-valuenow`/`aria-valuemin`/`aria-valuemax`.
- Command: `npm test baseout-ui/tests/WizardProgress.test.ts`.

##### Implementation notes
- Use `Layout` from P0.9.6 as the outer shell; `WizardLayout` wraps `Layout` with progress indicator.
- `currentStep` atom hydrates from `spaces.wizard_step` on page load; Step 1 writes `1` on mount.
- CTA "Connect Airtable" is a `Button` from P0.9.2 variant `primary`, posts to `/api/wizard/step-1/start-oauth`.

##### Acceptance criteria
- [ ] Shell renders on each of the 5 routes without duplicated markup.
- [ ] Step 1 shows CTA and explanatory copy using canonical term "Airtable" as a Platform.
- [ ] Mobile-first verified at 375px breakpoint.
- [ ] Touch targets ≥ 44×44px.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (UI 60% unit).

##### Dependencies
- **Blocked by:** P0.9.2 (Button), P0.9.6 (Layout, stores), P1A.4 (session-gated routing).
- **Blocks:** P1C.1.2, P1C.2.*, P1C.3.*, P1C.4.*, P1C.5.*.

##### Out of scope
- Actual OAuth round-trip (P1C.1.2).
- Step 2–5 views (their own sub-issues).

---

#### [P1C.1.3] Persist Airtable Connection + discover Bases on return

**Parent:** [P1C.1](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:backup`, `tier-gate:all`, `🔒 security:encryption`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
After Airtable OAuth callback (P1B.1), exchange the code for tokens, encrypt via `src/lib/crypto.ts` (P0.7.3), insert a `connections` row (P0.7.4), then call Airtable Metadata API to discover Bases under the consented scope. Store the discovered Base list on the Space config for Step 2 to consume.

##### Spec references
- [Baseout_PRD.md §20.2](Baseout_PRD.md) — AES-256-GCM token storage.
- [Baseout_Features.md §1](Baseout_Features.md) — Connection, Base, Platform.

##### Canonical terms
Connection, Base, Platform (value: `airtable`), Space, Organization.

##### Files to touch
- `src/pages/api/wizard/step-1/callback.ts` (new) — handles Airtable OAuth callback redirect from P1B.1.
- `src/lib/airtable/discoverBases.ts` (new) — fetches Base list via Metadata API.
- `src/db/queries/connections.ts` (modified) — `insertAirtableConnection(orgId, tokens)`.
- `src/db/queries/spaces.ts` (modified) — `setDiscoveredBases(spaceId, bases)`.
- `src/pages/api/wizard/step-1/callback.test.ts`, `src/lib/airtable/discoverBases.test.ts` (new).

##### Failing test to write first
- **File:** `src/pages/api/wizard/step-1/callback.test.ts`
- **Cases:**
  - Valid OAuth code → Connection row inserted with `access_token_enc` + `refresh_token_enc` non-null; no plaintext tokens anywhere in DB.
  - Metadata API response with 3 Bases → `spaces.discovered_bases` (jsonb) populated with 3 entries.
  - Airtable returns 401 on metadata fetch → Connection marked `is_dead=true`; user redirected to Step 1 with error.
  - User on a Starter tier Organization → callback rejects a second Connection attempt (tier limit 1 Connection per [Features §4.1](Baseout_Features.md)).

##### Implementation notes
- Reuse `src/lib/crypto.ts` `encrypt()` helper; never log plaintext tokens.
- Airtable Metadata API endpoint: `GET https://api.airtable.com/v0/meta/bases`.
- On success, advance `spaces.wizard_step` to `2` and redirect to `/wizard/step-2`.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] No plaintext tokens in logs or DB (grep check in test).
- [ ] `wizard_step` advanced atomically with Connection insert (transaction).
- [ ] Mobile-first verified at 375px breakpoint (error redirect page).
- [ ] Touch targets ≥ 44×44px.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (API 75% / backend 80%).

##### Dependencies
- **Blocked by:** P0.7.3 (crypto), P0.7.4 (connections schema), P1B.1 (OAuth starter).
- **Blocks:** P1C.2.*.

##### Security 🔒
- Tokens encrypted via P0.7.3 helper; scope narrowed per Airtable minimum required (`data.records:read`, `schema.bases:read`).
- CSRF state param validated against session (re-uses P1B.1 helper).
- Input validation on callback query params server-side.

##### Out of scope
- Base selection UI (P1C.2).
- Webhook registration (P2C.1).

---

#### [P1C.1.2] Wire "Connect Airtable" CTA to OAuth starter endpoint

**Parent:** [P1C.1](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `🔒 security:auth-path`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Kicks off Airtable OAuth via the starter endpoint (P1B.1) and handles the returning state token round-trip. Also renders the error state when OAuth is denied/timed-out.

##### Spec references
- [Baseout_PRD.md §6.6](Baseout_PRD.md).
- [Baseout_PRD.md §20.1](Baseout_PRD.md) — secrets management for OAuth client.

##### Canonical terms
Connection, Platform (value: `airtable`).

##### Files to touch
- `src/pages/api/wizard/step-1/start-oauth.ts` (new) — issues state token, redirects to Airtable authorize URL.
- `src/pages/wizard/step-1.astro` (modified) — wires error-state island for denied/timeout.
- `src/pages/api/wizard/step-1/start-oauth.test.ts` (new).

##### Failing test to write first
- **File:** `src/pages/api/wizard/step-1/start-oauth.test.ts`
- **Cases:**
  - Authenticated user → returns 302 to Airtable with state param set in signed cookie.
  - Unauthenticated user → returns 401 (middleware enforced, see [src/middleware.ts](../src/middleware.ts)).
  - State cookie is HttpOnly + SameSite=Lax.
- Command: `npm test src/pages/api/wizard/step-1/start-oauth.test.ts`.

##### Implementation notes
- Reuse OAuth state helper from P1B.1.
- CTA on Step 1 posts to this endpoint with CSRF token from `better-auth`.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] Error state (OAuth denied / timeout) shows `Toast` (P0.9.6) with retry CTA.
- [ ] Mobile-first verified at 375px breakpoint.
- [ ] Touch targets ≥ 44×44px.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (API 75%).

##### Dependencies
- **Blocked by:** P1C.1.1, P1B.1.
- **Blocks:** P1C.1.3.

##### Security 🔒
- CSRF via `better-auth`; state cookie HttpOnly, SameSite=Lax, short TTL.
- No client-side storage of OAuth state.

##### Out of scope
- Callback handler (P1C.1.3).

---

### P1C.2

**Parent:** [P1C.2 Onboarding Step 2 — Select bases](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P1C.3, P1C.6.

User picks which discovered Bases to include in the Space and toggles "auto-add future bases". Selections persist to Space config; advance gated on ≥ 1 Base selected.

---

#### [P1C.2.1] Add `selected_bases` + `auto_add_future_bases` persistence on `spaces`

**Parent:** [P1C.2](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ci-cd
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ci-cd`, `🔒 security:new-sql-surface`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Drizzle migration adds `selected_bases jsonb` (array of `{ base_id, name }`) and `auto_add_future_bases boolean default false` to `spaces` (extends P0.7.5). Also adds `discovered_bases jsonb` if not already added in P1C.1.3.

##### Spec references
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `spaces` columns.
- [Baseout_Features.md §4.1](Baseout_Features.md) — Bases per Space tier cap.

##### Canonical terms
Space, Base.

##### Files to touch
- `src/db/schema/spaces.ts` (modified).
- `drizzle/migrations/NNNN_wizard_bases.sql` (new, generated).
- `src/db/schema/spaces.test.ts` (modified).

##### Failing test to write first
- **File:** `src/db/schema/spaces.test.ts`
- **Cases:**
  - Insert Space with `selected_bases=[{base_id:'appX',name:'Ops'}]` round-trips.
  - `auto_add_future_bases` defaults to `false`.
  - Migration runs idempotently against existing fixture (P0.7.6).

##### Implementation notes
- Store as `jsonb`; validate shape at query layer with a Zod schema in `src/lib/schemas.ts`.
- Do not store Base credentials or tokens — only identifiers and names.

##### Acceptance criteria
- [ ] Schema migrates cleanly.
- [ ] Roundtrip test green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P0.7.5, P0.7.6.
- **Blocks:** P1C.2.2, P1C.2.3.

##### Out of scope
- Tier enforcement on Base count (belongs to P1C.3 via `resolveCapability`).

---

#### [P1C.2.2] Step 2 view: Base list + "Select all" + auto-add toggle

**Parent:** [P1C.2](Baseout_Backlog.md) · **Repo:** `baseout-web` + `baseout-ui` · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Renders the `discovered_bases` list with checkboxes, a "Select all" header toggle, and an auto-add-future-bases switch. Advance is disabled until ≥ 1 Base is selected.

##### Spec references
- [Baseout_PRD.md §6.6](Baseout_PRD.md).
- [CLAUDE.md §UI/UX](../.claude/CLAUDE.md) §2 component structure.

##### Canonical terms
Base, Space.

##### Files to touch
- `src/pages/wizard/step-2.astro` (new).
- `baseout-ui/src/components/Checkbox.astro` (new, if not present) or reuse.
- `src/stores/wizardBaseSelection.ts` (new) — map atom `{baseId: boolean}`.
- `baseout-ui/tests/Checkbox.test.ts`, `src/pages/wizard/step-2.test.ts` (new).

##### Failing test to write first
- **File:** `src/pages/wizard/step-2.test.ts`
- **Cases:**
  - Renders one checkbox per entry in `discovered_bases`.
  - "Select all" toggle flips every checkbox; toggling any individual unchecks header toggle.
  - Advance CTA disabled when zero Bases selected; enabled at ≥ 1.
  - Auto-add toggle persists state in the store.

##### Implementation notes
- Use `Table` component (P0.9.2) for the Base list rows.
- Server-fetch `discovered_bases` on page load; do not expose tokens to client.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] Mobile-first verified at 375px breakpoint (stacked rows, no horizontal scroll).
- [ ] Touch targets ≥ 44×44px (checkbox hit area).
- [ ] Semantic HTML: `<fieldset>` + `<legend>` for the Base group.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (UI 60%).

##### Dependencies
- **Blocked by:** P1C.1.3, P1C.2.1, P0.9.2.
- **Blocks:** P1C.2.3.

##### Out of scope
- Persistence endpoint (P1C.2.3).

---

#### [P1C.2.3] Persist selections + advance `wizard_step` to 3

**Parent:** [P1C.2](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
POST handler writes `selected_bases` + `auto_add_future_bases` to the Space, advances `wizard_step` to `3`, and redirects to `/wizard/step-3`.

##### Spec references
- [Baseout_PRD.md §6.6](Baseout_PRD.md).
- [Baseout_Features.md §4.1](Baseout_Features.md) — max Bases per Space.

##### Canonical terms
Space, Base.

##### Files to touch
- `src/pages/api/wizard/step-2/save.ts` (new).
- `src/db/queries/spaces.ts` (modified).
- `src/pages/api/wizard/step-2/save.test.ts` (new).

##### Failing test to write first
- **File:** `src/pages/api/wizard/step-2/save.test.ts`
- **Cases:**
  - Valid payload with 2 selected Bases → DB updated, response 303 to `/wizard/step-3`.
  - Zero Bases selected → 400 with error body.
  - Selection count exceeds tier cap → 403 with upgrade CTA payload.
  - Unauthenticated → 401 via middleware.

##### Implementation notes
- Server-side Zod validation against `SelectedBasesInput`.
- Transaction: update spaces + advance wizard_step together.
- Read tier cap via `getOrgTier(orgId)` (stub here; proper gate lands in P1C.3).

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] Mobile-first verified at 375px breakpoint (error/success rendering).
- [ ] Touch targets ≥ 44×44px.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (API 75%).

##### Dependencies
- **Blocked by:** P1C.2.2, P1C.2.1.
- **Blocks:** P1C.3.*, P1C.6.*.

##### Out of scope
- Tier limit copy/strings (lives with P1C.3 resolver messaging).

---

### P1C.3

**Parent:** [P1C.3 Onboarding Step 3 — Pick backup frequency (capability resolver)](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P1C.4, every later capability gate in Phases 1–4.

This parent introduces the **shared `resolveCapability(subscription, capabilityName)` helper** ([Features §5.5.4](Baseout_Features.md)) that all later tier gates depend on. Sub-issue ordering: capability schema → resolver helper + tests → frequency mapping → UI → persistence.

---

#### [P1C.3.1] Define `Capability` type + `capabilityMatrix` constant

**Parent:** [P1C.3](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** billing
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:billing`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Shared contract — a single source of truth mapping `(platform, tier, capabilityName)` → allowed values / boolean. Must be reused by every downstream tier gate (P1C.4, P1D.6, P1D.7, P2A, P4A). Implemented as a pure TypeScript object — no runtime I/O.

##### Spec references
- [Baseout_Features.md §5.5.4](Baseout_Features.md) — capability resolution rules.
- [Baseout_Features.md §4](Baseout_Features.md) — tier limits.
- [Baseout_Features.md §14](Baseout_Features.md) — Storage Destination tier gates.

##### Canonical terms
Capability, Tier, Platform, Subscription.

##### Files to touch
- `src/lib/capabilities/types.ts` (new) — `Capability`, `CapabilityName`, `TierName`, `PlatformName` types.
- `src/lib/capabilities/matrix.ts` (new) — `capabilityMatrix` constant covering V1 capabilities (`backup.frequency`, `storage.destinations`, `connections.max`, `bases.maxPerSpace`, etc.).
- `src/lib/capabilities/matrix.test.ts` (new).

##### Failing test to write first
- **File:** `src/lib/capabilities/matrix.test.ts`
- **Cases:**
  - `capabilityMatrix.airtable.starter['backup.frequency']` === `['monthly']`.
  - `capabilityMatrix.airtable.launch['backup.frequency']` === `['monthly','weekly']`.
  - `capabilityMatrix.airtable.pro['backup.frequency']` === `['monthly','weekly','daily','instant']`.
  - `capabilityMatrix.airtable.starter['storage.destinations']` excludes `r2`, `s3`, `frameio`.
  - Every `tier` ∈ {starter,launch,growth,pro,business,enterprise} has a non-empty entry for every `CapabilityName`.
- Command: `npm test src/lib/capabilities/matrix.test.ts`.

##### Implementation notes
- Pure constant — no imports from DB / env / Stripe. Keeps unit tests fast and side-effect-free.
- Exhaustiveness enforced via `satisfies Record<PlatformName, Record<TierName, ...>>`.

##### Acceptance criteria
- [ ] All five test cases green.
- [ ] Matrix values trace to [Features §4](Baseout_Features.md) + [Features §14](Baseout_Features.md) (cited inline as JSDoc).
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** none (pure data).
- **Blocks:** P1C.3.2, every downstream capability gate.

##### Out of scope
- Stripe metadata parsing (P1C.3.2).
- UI copy for upgrade CTAs (P1C.3.4).

---

#### [P1C.3.2] `resolveCapability(subscription, capabilityName)` helper

**Parent:** [P1C.3](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** billing
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:billing`, `🔒 security:new-sql-surface`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
The single shared helper every later capability gate calls. Input: a `Subscription` row (Stripe-synced, per [Features §5.5.3](Baseout_Features.md)) + a `CapabilityName`. Output: `{ allowed: string[] | boolean, reason?: 'tier_gate' | 'trial_locked' | 'inactive' }`. Must never read Stripe product name strings ([Features §5.5.4](Baseout_Features.md)).

##### Spec references
- [Baseout_Features.md §5.5.4](Baseout_Features.md) — resolution rules.
- [Baseout_Features.md §5.5.3](Baseout_Features.md) — subscription architecture.
- [CLAUDE.md §2](../.claude/CLAUDE.md) — principle of least privilege.

##### Canonical terms
Capability, Subscription, Tier, Platform, Trial.

##### Files to touch
- `src/lib/capabilities/resolveCapability.ts` (new) — exports `resolveCapability()`.
- `src/lib/capabilities/resolveCapability.test.ts` (new).

##### Failing test to write first
- **File:** `src/lib/capabilities/resolveCapability.test.ts`
- **Cases:**
  - `status=active`, platform=`airtable`, tier=`pro` → `backup.frequency` returns `['monthly','weekly','daily','instant']`.
  - `status=canceled` → every capability returns `{allowed: false, reason: 'inactive'}`.
  - `status=trialing` + trial-locked capability → `{allowed: false, reason: 'trial_locked'}`.
  - Unknown `capabilityName` throws `UnknownCapabilityError` (typed, not generic).
  - Input lacking `platform`/`tier` metadata throws `InvalidSubscriptionMetadataError` — never silently falls back to a default tier.

##### Implementation notes
- Read `subscription.platform` + `subscription.tier` (stored on the row in P0.7.5).
- For V1, `trial_locked` is a placeholder — full trial enforcement lands in P1B.5. Keep the branch in so callers don't need a refactor.
- Export named error classes; no magic strings.

##### Acceptance criteria
- [ ] All five test cases green.
- [ ] No product-name parsing anywhere in the helper.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1C.3.1, P0.7.5 (`subscriptions` schema).
- **Blocks:** P1C.3.3, P1C.4.*, P1D.6.*, P1D.7.*, P2A.*, P4A.*.

##### Security 🔒
- Tests assert no `console.log` touches full `subscription` rows (may contain PII).
- Helper does not query the DB itself — callers pass the row, enforcing least-privilege.

##### Out of scope
- Stripe webhook handling (P4A.4).
- Caching / memoization (follow-up if profiling warrants).

---

#### [P1C.3.3] Map frequencies to tier via `resolveCapability('backup.frequency')`

**Parent:** [P1C.3](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** billing
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:billing`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Thin adapter `getAllowedFrequencies(orgId)` that loads the Organization's active airtable Subscription and calls `resolveCapability()`. Proves the helper works end-to-end and keeps DB access out of the pure resolver.

##### Spec references
- [Baseout_Features.md §4.2](Baseout_Features.md) — frequency per tier.

##### Canonical terms
Subscription, Tier, Capability.

##### Files to touch
- `src/lib/billing/getAllowedFrequencies.ts` (new).
- `src/db/queries/subscriptions.ts` (modified) — `getActiveSubscriptionForPlatform(orgId, platform)`.
- `src/lib/billing/getAllowedFrequencies.test.ts` (new).

##### Failing test to write first
- **File:** `src/lib/billing/getAllowedFrequencies.test.ts`
- **Cases:**
  - Starter Organization → `['monthly']`.
  - Launch Organization → `['monthly','weekly']`.
  - Pro Organization → `['monthly','weekly','daily','instant']`.
  - No active subscription → throws `NoActiveSubscriptionError`.

##### Implementation notes
- Query scopes to `(organization_id, platform='airtable', status IN ('active','trialing'))`.
- Delegate all decision logic to `resolveCapability`; this file is a DB adapter only.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] No duplication of tier → frequency mapping (delegated to resolver).
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1C.3.2.
- **Blocks:** P1C.3.4, P1C.3.5.

##### Out of scope
- Cross-platform frequency resolution (V2).

---

#### [P1C.3.4] Step 3 view: frequency radio + disabled/upgrade copy

**Parent:** [P1C.3](Baseout_Backlog.md) · **Repo:** `baseout-web` + `baseout-ui` · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Step 3 renders four frequency options; options not in `getAllowedFrequencies(orgId)` render disabled with an inline "Upgrade" link to the billing page ([Features §4.2](Baseout_Features.md)).

##### Spec references
- [Baseout_PRD.md §6.6](Baseout_PRD.md).
- [Baseout_Features.md §4.2](Baseout_Features.md).

##### Canonical terms
Tier, Capability, Space.

##### Files to touch
- `src/pages/wizard/step-3.astro` (new).
- `baseout-ui/src/components/RadioCard.astro` (new) — reusable radio-card with disabled state + slot for upgrade CTA.
- `src/stores/wizardFrequency.ts` (new) — atom `'monthly'|'weekly'|'daily'|'instant'|null`.
- `baseout-ui/tests/RadioCard.test.ts`, `src/pages/wizard/step-3.test.ts` (new).

##### Failing test to write first
- **File:** `src/pages/wizard/step-3.test.ts`
- **Cases:**
  - Starter → only `monthly` enabled; `weekly`/`daily`/`instant` show disabled state + upgrade link.
  - Pro → all four enabled.
  - Clicking disabled option fires no selection change; upgrade link routes to `/settings/billing`.
  - Keyboard navigation with arrow keys cycles only enabled options.

##### Implementation notes
- Server-render the initial set of allowed frequencies — never trust a client to compute gates.
- Use `RadioCard` from `baseout-ui` with `variant="tier-gated"`.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] Mobile-first verified at 375px breakpoint (cards stack full-width).
- [ ] Touch targets ≥ 44×44px.
- [ ] Color contrast meets WCAG AA on disabled state.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (UI 60%).

##### Dependencies
- **Blocked by:** P1C.3.3, P0.9.2.
- **Blocks:** P1C.3.5.

##### Out of scope
- Backend persistence (P1C.3.5).
- Billing flow (P4A.*).

---

#### [P1C.3.5] Persist frequency + advance `wizard_step` to 4

**Parent:** [P1C.3](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
POST handler validates the selected frequency against `getAllowedFrequencies(orgId)` server-side (client disabled-state is UX only), writes `spaces.backup_frequency`, and advances to Step 4.

##### Spec references
- [Baseout_Features.md §4.2](Baseout_Features.md).
- [CLAUDE.md §2](../.claude/CLAUDE.md) — server-side validation non-negotiable.

##### Canonical terms
Space, Tier, Capability.

##### Files to touch
- `src/pages/api/wizard/step-3/save.ts` (new).
- `src/db/queries/spaces.ts` (modified) — `setBackupFrequency(spaceId, frequency)`.
- `src/pages/api/wizard/step-3/save.test.ts` (new).

##### Failing test to write first
- **File:** `src/pages/api/wizard/step-3/save.test.ts`
- **Cases:**
  - Starter + `frequency=weekly` payload → 403 `tier_gate`.
  - Starter + `frequency=monthly` → 303 to `/wizard/step-4`; `spaces.backup_frequency='monthly'`.
  - Pro + `frequency=instant` → 303; row updated.
  - Unauthenticated → 401 via middleware.

##### Implementation notes
- Reuse `resolveCapability` indirectly via `getAllowedFrequencies`; do not re-derive gate logic in the handler.
- Transaction wraps the update + `wizard_step` advance.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] Forbidden frequency never persists.
- [ ] Mobile-first verified at 375px breakpoint.
- [ ] Touch targets ≥ 44×44px.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (API 75%).

##### Dependencies
- **Blocked by:** P1C.3.4, P1C.3.3.
- **Blocks:** P1C.4.*, P1C.6.*.

##### Out of scope
- Cron scheduling of the Space's first run (P1B.4).

---

### P1C.4

**Parent:** [P1C.4 Onboarding Step 4 — Pick Storage Destination](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P1C.5, P1C.6.

User selects a Storage Destination gated by tier ([Features §14](Baseout_Features.md)). BYOS options route through the matching connector's OAuth (P1D.2–7); R2 is zero-config (P1D.1).

---

#### [P1C.4.1] Step 4 view: destination list gated by `resolveCapability('storage.destinations')`

**Parent:** [P1C.4](Baseout_Backlog.md) · **Repo:** `baseout-web` + `baseout-ui` · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Renders a card per destination (R2, Google Drive, Dropbox, Box, OneDrive, S3, Frame.io) with tier-appropriate enable/disable per [Features §14](Baseout_Features.md). Disabled cards show upgrade CTAs. Relies on `resolveCapability` (P1C.3.2).

##### Spec references
- [Baseout_Features.md §14](Baseout_Features.md) — Storage Destination tier gates.
- [Baseout_PRD.md §6.6](Baseout_PRD.md).
- [Baseout_PRD.md §2.6](Baseout_PRD.md) — file path structure (referenced for copy).

##### Canonical terms
Storage Destination, BYOS, R2.

##### Files to touch
- `src/pages/wizard/step-4.astro` (new).
- `baseout-ui/src/components/DestinationCard.astro` (new) — card with icon, name, gate state, CTA slot.
- `src/stores/wizardDestination.ts` (new) — atom `StorageDestinationSelection | null`.

##### Failing test to write first
- **File:** `src/pages/wizard/step-4.test.ts`
- **Cases:**
  - Starter (no R2/S3/Frame.io) → Google Drive, Dropbox, Box, OneDrive enabled; R2/S3/Frame.io disabled.
  - Launch → R2 enabled.
  - Growth → S3 + Frame.io enabled.
  - Clicking a BYOS card posts to the connector's start-OAuth endpoint (P1D.2–7) via `DestinationCard`'s CTA.

##### Implementation notes
- Card list ordered: R2 first when allowed (managed = lowest friction), then BYOS alphabetized.
- Selecting R2 inlines a "Use managed storage" confirm; selecting BYOS routes through OAuth/credentials flow.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] Mobile-first verified at 375px breakpoint (cards wrap to single column).
- [ ] Touch targets ≥ 44×44px.
- [ ] Each card has `<img alt="">` and `aria-disabled` where appropriate.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (UI 60%).

##### Dependencies
- **Blocked by:** P1C.3.2 (resolver), P1D.1.1 (StorageDestination interface existence for type imports).
- **Blocks:** P1C.4.2, P1C.4.3.

##### Out of scope
- Folder picker (P1C.4.2).
- Credential form for S3 (P1D.6.*).

---

#### [P1C.4.2] Folder picker for Google Drive + OneDrive

**Parent:** [P1C.4](Baseout_Backlog.md) · **Repo:** `baseout-web` + `baseout-ui` · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
After Google Drive / OneDrive OAuth success, user chooses a destination folder. Implemented as a modal with a lazy-loaded tree view; each node expansion queries the provider server-side through the authenticated Connection.

##### Spec references
- [Baseout_PRD.md §2.6](Baseout_PRD.md) — file path structure (`/orgs/{org-id}/...`).
- [Baseout_Features.md §14](Baseout_Features.md).

##### Canonical terms
Storage Destination, Connection.

##### Files to touch
- `src/pages/api/wizard/step-4/folders/list.ts` (new) — polymorphic over `platform` param.
- `baseout-ui/src/components/FolderPicker.astro` (new).
- `src/pages/wizard/step-4.astro` (modified) — wires modal.
- `src/pages/api/wizard/step-4/folders/list.test.ts` (new).

##### Failing test to write first
- **File:** `src/pages/api/wizard/step-4/folders/list.test.ts`
- **Cases:**
  - Authenticated request for Google Drive folders returns a tree shape `{id, name, children?}`.
  - Unauthenticated or mismatched Connection → 403.
  - Provider 401 → Connection marked `is_dead=true`; response 409 telling UI to re-auth.

##### Implementation notes
- Reuse `Modal` from `baseout-ui` P0.9.2-style pattern.
- Server holds tokens; client receives only folder IDs + names.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] Mobile-first verified at 375px breakpoint (modal full-screen on mobile).
- [ ] Touch targets ≥ 44×44px.
- [ ] Keyboard-navigable tree (arrow keys expand/collapse, Enter selects).
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (API 75%).

##### Dependencies
- **Blocked by:** P1C.4.1, P1D.2.*, P1D.5.*.
- **Blocks:** P1C.4.3.

##### Out of scope
- Dropbox/Box folder picker (app-folder scoped per P1D.3–4).

---

#### [P1C.4.3] Persist `storage_destination_id` on Space + advance `wizard_step` to 5

**Parent:** [P1C.4](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Validates the chosen destination against `resolveCapability('storage.destinations')`, writes `spaces.storage_destination_id` (FK to a `storage_destinations` row created by the connector), and advances the wizard.

##### Spec references
- [Baseout_PRD.md §6.6](Baseout_PRD.md).
- [Baseout_Features.md §14](Baseout_Features.md).

##### Canonical terms
Space, Storage Destination, Tier.

##### Files to touch
- `src/pages/api/wizard/step-4/save.ts` (new).
- `src/db/queries/spaces.ts` (modified) — `setStorageDestination(spaceId, destinationId)`.
- `src/pages/api/wizard/step-4/save.test.ts` (new).

##### Failing test to write first
- **File:** `src/pages/api/wizard/step-4/save.test.ts`
- **Cases:**
  - Starter + destination=`s3` → 403 `tier_gate`.
  - Starter + destination=`google_drive` → 303 to `/wizard/step-5`.
  - Destination belonging to a different Organization → 403.
  - Unauthenticated → 401.

##### Implementation notes
- Validate FK ownership (Organization scope) before write.
- Transaction: update + advance.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] Mobile-first verified at 375px breakpoint.
- [ ] Touch targets ≥ 44×44px.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (API 75%).

##### Dependencies
- **Blocked by:** P1C.4.2, P1C.4.1, P1D.1.1.
- **Blocks:** P1C.5.*, P1C.6.*.

##### Out of scope
- First backup dispatch (P1C.5).

---

### P1C.5

**Parent:** [P1C.5 Onboarding Step 5 — Confirm + run first backup](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P1C.6.

Summary screen dispatches the first Backup Run to the Space's Durable Object (P1B.*), surfaces live progress, and exits the wizard on success. Sub-issue ordering: run-dispatch endpoint → confirm view → live progress via WebSocket → trial-cap banner → redirect-on-success.

---

#### [P1C.5.1] `POST /api/wizard/step-5/run-first-backup` dispatch endpoint

**Parent:** [P1C.5](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:backup`, `🔒 security:auth-path`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Validates the Space is fully configured (Connection + ≥ 1 Base + frequency + destination) and enqueues the first Backup Run via the Space Durable Object (P1B.2 / P1B.4). Marks the run as `is_trial=true` when the Organization's subscription is trialing.

##### Spec references
- [Baseout_PRD.md §6.6](Baseout_PRD.md).
- [Baseout_PRD.md §6.1](Baseout_PRD.md) — user journey.

##### Canonical terms
Backup Run, Space, Trial, Subscription.

##### Files to touch
- `src/pages/api/wizard/step-5/run-first-backup.ts` (new).
- `src/lib/backup/dispatchRun.ts` (new) — wraps Durable Object invocation.
- `src/pages/api/wizard/step-5/run-first-backup.test.ts` (new).

##### Failing test to write first
- **File:** `src/pages/api/wizard/step-5/run-first-backup.test.ts`
- **Cases:**
  - Fully-configured Space → 202 with `runId`; `backup_runs` row inserted with `status='pending'`.
  - Missing Connection → 409 with remediation link.
  - Duplicate dispatch (same Space already has `status IN ('pending','running')`) → 409 idempotently returns existing `runId`.
  - Trialing subscription → inserted row has `is_trial=true`.

##### Implementation notes
- Idempotency key: `spaces.id`; use `INSERT ... ON CONFLICT DO NOTHING RETURNING id`.
- Dispatch via `env.SPACE_DO.idFromName(spaceId).fetch(...)`.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] Mobile-first verified at 375px breakpoint (error renders).
- [ ] Touch targets ≥ 44×44px.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (API 75%).

##### Dependencies
- **Blocked by:** P1C.4.3, P1B.2, P1B.4, P0.7.5.
- **Blocks:** P1C.5.2, P1C.5.3.

##### Security 🔒
- Ownership check: session user's Organization must own the Space.
- No token material returned in response.

##### Out of scope
- Actual backup execution (P1B.*).

---

#### [P1C.5.2] Step 5 confirm view: summary + "Run first backup" CTA

**Parent:** [P1C.5](Baseout_Backlog.md) · **Repo:** `baseout-web` + `baseout-ui` · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Summary of selected Bases + backup frequency + Storage Destination, plus the CTA that posts to `run-first-backup` (P1C.5.1).

##### Spec references
- [Baseout_PRD.md §6.6](Baseout_PRD.md).

##### Canonical terms
Space, Base, Storage Destination.

##### Files to touch
- `src/pages/wizard/step-5.astro` (new).
- `baseout-ui/src/components/SummaryList.astro` (new) — label/value stack.
- `src/pages/wizard/step-5.test.ts` (new).

##### Failing test to write first
- **File:** `src/pages/wizard/step-5.test.ts`
- **Cases:**
  - Summary renders Base names, frequency label, Storage Destination name.
  - CTA disabled while dispatch in flight; shows spinner.
  - On 409 duplicate → UI resumes progress view with the existing `runId`.

##### Implementation notes
- Fetch summary data server-side to avoid token-leak risk.
- Spinner uses shared `Button` loading state from P0.9.2.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] Mobile-first verified at 375px breakpoint.
- [ ] Touch targets ≥ 44×44px.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (UI 60%).

##### Dependencies
- **Blocked by:** P1C.5.1, P0.9.2.
- **Blocks:** P1C.5.3.

##### Out of scope
- Progress streaming (P1C.5.3).

---

#### [P1C.5.3] Live progress bar via WebSocket from Space Durable Object

**Parent:** [P1C.5](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Step 5 opens a WebSocket (P2A.4 helper — stubbed here as `/ws/run/:id`) to receive `runStatus` messages. Progress store drives a progress bar and status text.

##### Spec references
- [Baseout_PRD.md §6.6](Baseout_PRD.md).
- [CLAUDE.md §4](../.claude/CLAUDE.md) — nanostores for real-time backup status.

##### Canonical terms
Backup Run, Space.

##### Files to touch
- `src/stores/backupProgress.ts` (new) — map atom `{runId, percent, status, recordCount}`.
- `src/components/BackupProgress.astro` (new, island) — subscribes, renders progress.
- `src/lib/ws/runClient.ts` (new) — WebSocket client wrapper.
- `src/stores/backupProgress.test.ts`, `src/lib/ws/runClient.test.ts` (new).

##### Failing test to write first
- **File:** `src/lib/ws/runClient.test.ts`
- **Cases:**
  - On `open`, client sends `{subscribe: runId}`.
  - On `runStatus` message, store updates atomically.
  - On `close` without `success`, auto-reconnect up to 3× with exponential backoff.
  - On `status='success'`, emits `done` event consumed by Step 5.

##### Implementation notes
- Island `client:idle`; do not block initial render on WS handshake.
- Close socket on `beforeunload`.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] Mobile-first verified at 375px breakpoint.
- [ ] Touch targets ≥ 44×44px.
- [ ] Progress bar has `role="progressbar"` with live `aria-valuenow`.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (UI 60%).

##### Dependencies
- **Blocked by:** P1C.5.2.
- **Blocks:** P1C.5.4, P1C.5.5.

##### Out of scope
- Full `/ws/run/:id` server implementation (P2A.4).

---

#### [P1C.5.4] Trial-cap banner with "partial result" + upgrade CTA

**Parent:** [P1C.5](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
If the Backup Run completes with `status='trial_complete'` (trial cap hit mid-run, per P1B.5), show a banner with the partial record count and a CTA routing to `/settings/billing`.

##### Spec references
- [Baseout_PRD.md §6.6](Baseout_PRD.md) — trial UX.
- [Baseout_Features.md §5.5.4](Baseout_Features.md) — trial resolution.

##### Canonical terms
Trial, Backup Run, Subscription.

##### Files to touch
- `src/components/TrialCapBanner.astro` (new).
- `src/pages/wizard/step-5.astro` (modified) — renders banner when `status='trial_complete'`.
- `src/components/TrialCapBanner.test.ts` (new).

##### Failing test to write first
- **File:** `src/components/TrialCapBanner.test.ts`
- **Cases:**
  - `status='trial_complete'` → banner renders with record count + upgrade link.
  - `status='success'` → banner hidden.
  - Upgrade link has `data-cta="trial-upgrade"` for analytics.

##### Implementation notes
- Banner uses `Toast`-adjacent styling from P0.9.6 but persists until dismissed or navigated away.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] Mobile-first verified at 375px breakpoint.
- [ ] Touch targets ≥ 44×44px.
- [ ] Color contrast WCAG AA.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (UI 60%).

##### Dependencies
- **Blocked by:** P1C.5.3.
- **Blocks:** P1C.5.5.

##### Out of scope
- Billing flow (P4A.*).

---

#### [P1C.5.5] On success: mark wizard complete + redirect to dashboard

**Parent:** [P1C.5](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
When the run WebSocket emits `status='success'`, set `spaces.wizard_step=null` (or `'complete'`) and redirect to `/dashboard` (handled in P2A.*). Must be idempotent — double-fire does not cause a double-write.

##### Spec references
- [Baseout_PRD.md §6.6](Baseout_PRD.md).

##### Canonical terms
Space.

##### Files to touch
- `src/pages/api/wizard/complete.ts` (new).
- `src/db/queries/spaces.ts` (modified) — `markWizardComplete(spaceId)` idempotent.
- `src/pages/api/wizard/complete.test.ts` (new).

##### Failing test to write first
- **File:** `src/pages/api/wizard/complete.test.ts`
- **Cases:**
  - First call → `wizard_step` set to `'complete'`; 200 with redirect target.
  - Second call → 200, no-op (idempotent).
  - Wizard not yet at Step 5 → 409 (prevents skipping).

##### Implementation notes
- Use `UPDATE ... WHERE wizard_step = 5 RETURNING id` for idempotency gate.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] Mobile-first verified at 375px breakpoint.
- [ ] Touch targets ≥ 44×44px.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (API 75%).

##### Dependencies
- **Blocked by:** P1C.5.3, P1C.5.4.
- **Blocks:** P1C.6.*.

##### Out of scope
- Dashboard rendering (P2A.*).

---

### P1C.6

**Parent:** [P1C.6 Resume incomplete wizard state](Baseout_Backlog.md) · granularity: `chunk` · Blocks: none (exits the wizard graph).

If a user abandons the wizard, the next authenticated request lands them on the last completed step; dashboard is blocked behind a banner until the wizard completes.

---

#### [P1C.6.1] Middleware: redirect to `/wizard/step-N` while `wizard_step != 'complete'`

**Parent:** [P1C.6](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `🔒 security:auth-path`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Extends [src/middleware.ts](../src/middleware.ts) to redirect authenticated users with an incomplete wizard to their current step. Applies to every non-wizard, non-auth, non-API route.

##### Spec references
- [Baseout_PRD.md §6.6](Baseout_PRD.md).
- [CLAUDE.md §2](../.claude/CLAUDE.md) — auth enforcement lives in middleware.

##### Canonical terms
Space, Organization.

##### Files to touch
- `src/middleware.ts` (modified).
- `src/middleware.test.ts` (modified).

##### Failing test to write first
- **File:** `src/middleware.test.ts`
- **Cases:**
  - Authenticated user with `wizard_step=3` requests `/dashboard` → 303 to `/wizard/step-3`.
  - Authenticated user with `wizard_step='complete'` → request passes through.
  - Unauthenticated user → existing auth redirect still wins (order-of-precedence).

##### Implementation notes
- Avoid querying DB on every request — read `wizard_step` from session payload (populated by P1A.4 on login).
- Skip redirect for `/wizard/*`, `/auth/*`, `/api/*`, static assets.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] Mobile-first verified at 375px breakpoint (redirect target renders correctly).
- [ ] Touch targets ≥ 44×44px (no new UI, reuses shell).
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1C.5.5, P1A.4.
- **Blocks:** P1C.6.2.

##### Security 🔒
- No auth bypass introduced — wizard redirect runs after auth guard.

##### Out of scope
- Dashboard banner (P1C.6.2).

---

#### [P1C.6.2] Dashboard banner when wizard incomplete (deep-link fallback)

**Parent:** [P1C.6](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Defense-in-depth: if a user lands on `/dashboard` somehow (e.g., stale session before middleware re-checks), show a banner with a "Finish setup" CTA to the correct step.

##### Spec references
- [Baseout_PRD.md §6.6](Baseout_PRD.md).

##### Canonical terms
Space.

##### Files to touch
- `src/components/WizardResumeBanner.astro` (new).
- `src/pages/dashboard/index.astro` (modified).
- `src/components/WizardResumeBanner.test.ts` (new).

##### Failing test to write first
- **File:** `src/components/WizardResumeBanner.test.ts`
- **Cases:**
  - `wizard_step=2` session → banner renders with CTA to `/wizard/step-2`.
  - `wizard_step='complete'` → banner hidden.
  - Banner dismissal is NOT persisted (reappears next page load).

##### Implementation notes
- Renders above the dashboard main content.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] Mobile-first verified at 375px breakpoint.
- [ ] Touch targets ≥ 44×44px.
- [ ] Color contrast WCAG AA.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (UI 60%).

##### Dependencies
- **Blocked by:** P1C.6.1.
- **Blocks:** P1C.6.3.

##### Out of scope
- Full dashboard UI (P2A.*).

---

#### [P1C.6.3] Integration test: log out at Step 3 → log in → lands on Step 3

**Parent:** [P1C.6](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
End-to-end check for the resume flow. Confirms middleware + session payload + persistence cooperate. Uses Playwright per [PRD §14.2](Baseout_PRD.md).

##### Spec references
- [Baseout_PRD.md §14.2](Baseout_PRD.md) — integration testing.
- [Baseout_PRD.md §14.5](Baseout_PRD.md) — E2E scenarios.

##### Canonical terms
Space, Organization.

##### Files to touch
- `tests/e2e/wizard-resume.spec.ts` (new).

##### Failing test to write first
- **File:** `tests/e2e/wizard-resume.spec.ts`
- **Cases:**
  - Sign up → complete Step 1 + Step 2 → navigate to Step 3 → log out → log in → URL is `/wizard/step-3`.
  - Log out at Step 5 mid-dispatch → log in → lands on Step 5 and resumes progress.

##### Implementation notes
- Reuse Playwright fixtures from P0.2.*; seed an Airtable OAuth mock.

##### Acceptance criteria
- [ ] Both test cases green in CI.
- [ ] Mobile-first verified at 375px breakpoint (Playwright viewport).
- [ ] Touch targets ≥ 44×44px.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (E2E critical flow).

##### Dependencies
- **Blocked by:** P1C.6.1, P1C.6.2, P1C.5.5.
- **Blocks:** none.

##### Out of scope
- Cross-browser matrix (MVP runs Chromium only).

---

### P1D.1

**Parent:** [P1D.1 R2 managed storage (StorageDestination interface)](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P1C.4, P1D.2–7, P1B.4.

**This parent defines the `StorageDestination` interface that every P1D.x connector (Google Drive, Dropbox, Box, OneDrive, S3, Frame.io) conforms to.** Sub-issue ordering: interface first → R2 writer → manifest → path helper → quota check → integration test.

---

#### [P1D.1.1] Define `StorageDestination` interface + types

**Parent:** [P1D.1](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
The single contract every Storage Destination implements. Drives P1D.2–7 (Google Drive, Dropbox, Box, OneDrive, S3, Frame.io) and the `baseout-web` destination picker. Must cover: write (file stream), read (optional, for verify), delete, list, and path resolution.

##### Spec references
- [Baseout_PRD.md §2.6](Baseout_PRD.md) — file path structure.
- [Baseout_PRD.md §2.8](Baseout_PRD.md) — attachment handling (proxy streaming).
- [Baseout_Features.md §14](Baseout_Features.md) — per-tier support matrix.

##### Canonical terms
Storage Destination, BYOS, Attachment.

##### Files to touch
- `src/storage/StorageDestination.ts` (new) — interface + `WriteOptions`, `ReadResult`, `PathParts`, `StorageCapabilities` types.
- `src/storage/errors.ts` (new) — `StorageWriteError`, `StorageAuthError`, `StorageQuotaError`.
- `src/storage/StorageDestination.test.ts` (new) — type-level tests + error class tests.

##### Failing test to write first
- **File:** `src/storage/StorageDestination.test.ts`
- **Cases:**
  - Type-level: a mock class that omits `write()` fails to satisfy `StorageDestination` (tsc error captured via `expectError`).
  - `StorageAuthError` is an `Error` subclass with a `connectionId` field.
  - `StorageCapabilities` includes `supportsStreamUpload: boolean` and `supportsFolderSelection: boolean`.
  - A minimal conforming mock passes the interface check.
- Command: `npm test src/storage/StorageDestination.test.ts`.

##### Implementation notes
- Interface methods: `write(pathParts, stream, opts)`, `delete(pathParts)`, `list(prefix)`, `getCapabilities()`, `verifyAuth()`.
- `write()` accepts a `ReadableStream` so proxy-stream connectors (P1D.3–4) can implement without buffering to disk.
- Path helpers live alongside the interface for reuse.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] Interface documented with JSDoc citing [PRD §2.6](Baseout_PRD.md) + [PRD §2.8](Baseout_PRD.md).
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P0.1.2.
- **Blocks:** P1D.1.2, P1D.2.*, P1D.3.*, P1D.4.*, P1D.5.*, P1D.6.*, P1D.7.*, P1C.4.1.

##### Out of scope
- Any concrete implementation (own sub-issues).

---

#### [P1D.1.2] Path helper: `/orgs/{org-id}/spaces/{space-id}/runs/{run-id}/...`

**Parent:** [P1D.1](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
A pure helper that every `StorageDestination` uses to compose output paths. Centralizes [PRD §2.6](Baseout_PRD.md) path structure so P1D.2–7 cannot diverge.

##### Spec references
- [Baseout_PRD.md §2.6](Baseout_PRD.md).

##### Canonical terms
Organization, Space, Backup Run, Base, Table, Attachment.

##### Files to touch
- `src/storage/paths.ts` (new) — `buildPath(pathParts)`, `parsePath(pathString)`.
- `src/storage/paths.test.ts` (new).

##### Failing test to write first
- **File:** `src/storage/paths.test.ts`
- **Cases:**
  - `buildPath({orgId:'o1',spaceId:'s1',runId:'r1',kind:'records',baseId:'b1',tableId:'t1'})` === `'/orgs/o1/spaces/s1/runs/r1/records/b1/t1.csv'`.
  - `buildPath({orgId,spaceId,runId,kind:'attachment',baseId,tableId,recordId,fieldId,attachmentId})` includes the composite attachment ID from [PRD §2.8](Baseout_PRD.md).
  - `buildPath` rejects any segment containing `/` or `..`.
  - `parsePath` round-trips any valid `buildPath` output.

##### Implementation notes
- Pure function — no filesystem, no IO.
- Reject path traversal inputs at build time (throw `InvalidPathSegmentError`).

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1D.1.1.
- **Blocks:** P1D.1.3, P1D.2.*, P1D.3.*, P1D.4.*, P1D.5.*, P1D.6.*, P1D.7.*.

##### Out of scope
- Historic path migrations (not MVP).

---

#### [P1D.1.3] `StorageR2` writer implementing the interface

**Parent:** [P1D.1](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:encryption`, `tier-gate:launch+`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Default managed storage. Uses Cloudflare R2 SSE ([PRD §20.2](Baseout_PRD.md)). Per-Organization prefix isolates data.

##### Spec references
- [Baseout_PRD.md §20.2](Baseout_PRD.md).
- [Baseout_Features.md §14](Baseout_Features.md) — R2 on Launch+.

##### Canonical terms
R2, Storage Destination, Organization.

##### Files to touch
- `src/storage/r2.ts` (new) — `class StorageR2 implements StorageDestination`.
- `src/storage/r2.test.ts` (new).

##### Failing test to write first
- **File:** `src/storage/r2.test.ts`
- **Cases:**
  - `write()` PUTs to R2 with `x-amz-server-side-encryption: AES256` set.
  - Path includes `/orgs/{orgId}/` prefix.
  - `list()` returns only objects under the Organization's prefix.
  - `delete()` removes the object and returns `{deleted: true}`.

##### Implementation notes
- Use `R2Bucket` binding from Workers; test against Miniflare.
- Per-Organization prefix is non-negotiable — hardcoded in `StorageR2`, not caller-controlled.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1D.1.1, P1D.1.2, P0.5 (R2 bucket provisioned).
- **Blocks:** P1D.1.4, P1D.1.5, P1B.4.

##### Security 🔒
- SSE enabled on every PUT.
- No cross-Organization read path exists.

##### Out of scope
- Lifecycle policies (ops concern).

---

#### [P1D.1.4] Manifest writer: `manifest.json` per Backup Run

**Parent:** [P1D.1](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Every Backup Run writes a `manifest.json` to the Storage Destination listing files, sizes, sha256, record counts per Base/Table — used for verification ([PRD §2.6](Baseout_PRD.md)) and restore (P2B.*).

##### Spec references
- [Baseout_PRD.md §2.6](Baseout_PRD.md) — verification.

##### Canonical terms
Backup Run, Base, Table, Attachment, Storage Destination.

##### Files to touch
- `src/storage/manifest.ts` (new).
- `src/storage/manifest.test.ts` (new).

##### Failing test to write first
- **File:** `src/storage/manifest.test.ts`
- **Cases:**
  - Builds manifest with file entries `{path, bytes, sha256, kind}`.
  - Totals match sum of entries.
  - Writes to `/orgs/{orgId}/spaces/{spaceId}/runs/{runId}/manifest.json` via any `StorageDestination`.
  - Rejects ambiguous duplicate path entries.

##### Implementation notes
- Accept `StorageDestination` by injection — works for R2 and any BYOS connector.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1D.1.1, P1D.1.2, P1D.1.3.
- **Blocks:** P1B.4, P2B.*.

##### Out of scope
- Manifest schema versioning (add when restore spec firms up in P2B).

---

#### [P1D.1.5] Tier quota check before write (R2 bytes used vs limit)

**Parent:** [P1D.1](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:launch+`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Before each R2 `write()`, check the Organization's current managed-storage bytes used against the tier cap ([Features §4.1](Baseout_Features.md)). Call `resolveCapability` (P1C.3.2) for the cap; fail with `StorageQuotaError` on overage unless `overage_mode='auto'`.

##### Spec references
- [Baseout_Features.md §4.1](Baseout_Features.md) — managed R2 per tier.
- [Baseout_Features.md §5](Baseout_Features.md) — overage pricing.

##### Canonical terms
R2, Tier, Capability, Subscription.

##### Files to touch
- `src/storage/r2.ts` (modified).
- `src/storage/quota.ts` (new) — `assertR2QuotaOrThrow(orgId, bytesIncoming)`.
- `src/storage/quota.test.ts` (new).

##### Failing test to write first
- **File:** `src/storage/quota.test.ts`
- **Cases:**
  - Launch tier, 900 MB used, 50 MB incoming → passes.
  - Launch tier, 1024 MB used, 1 MB incoming, `overage_mode='cap'` → throws `StorageQuotaError`.
  - Launch tier, overage, `overage_mode='auto'` → passes and records overage line.
  - Starter tier → throws `StorageQuotaError` (R2 not available).

##### Implementation notes
- Read `subscription` via existing query; call `resolveCapability('storage.managedBytes')`.
- Overage line recording stubbed (P4A.*); interface in place.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1D.1.3, P1C.3.2.
- **Blocks:** P1D.1.6.

##### Out of scope
- Actual overage billing (P4A.*).

---

#### [P1D.1.6] Integration test: write CSV + manifest, read back identical bytes

**Parent:** [P1D.1](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:launch+`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
End-to-end verify against Miniflare R2: write a CSV + manifest, read back, assert byte-equal + sha256 match. Locks in the round-trip contract every other P1D.x connector will replicate.

##### Spec references
- [Baseout_PRD.md §14.3](Baseout_PRD.md) — integration testing.

##### Canonical terms
Backup Run, R2.

##### Files to touch
- `tests/integration/storage-r2.test.ts` (new).

##### Failing test to write first
- **File:** `tests/integration/storage-r2.test.ts`
- **Cases:**
  - Write a 1 MB CSV → read → byte-equal.
  - Write manifest → parse → matches original structure.
  - Cross-Organization read attempt → throws (per-Organization prefix enforced).

##### Implementation notes
- Uses Miniflare R2; no live Cloudflare call.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1D.1.3, P1D.1.4, P1D.1.5.
- **Blocks:** P1B.4, P1C.4.1.

##### Out of scope
- Full backup pipeline test (P1B.*).

---

### P1D.2

**Parent:** [P1D.2 Google Drive connector](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P1C.4.

Implements `StorageDestination` (P1D.1.1) against Google Drive with narrow `drive.file` scope and a server-side folder picker. Tokens encrypted via P0.7.3.

---

#### [P1D.2.1] OAuth start + callback with `drive.file` scope + encrypted token storage

**Parent:** [P1D.2](Baseout_Backlog.md) · **Repo:** `baseout-web` + `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:auth-path`, `🔒 security:encryption`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
OAuth flow for Google Drive. Scope is narrowed to `drive.file` per [Baseout_Backlog.md P1D.2 Security](Baseout_Backlog.md). Tokens encrypted using `src/lib/crypto.ts` (P0.7.3) and stored in `connections` (P0.7.4).

##### Spec references
- [Baseout_Features.md §14](Baseout_Features.md) — Google Drive on all tiers.
- [Baseout_PRD.md §20.1](Baseout_PRD.md), [§20.2](Baseout_PRD.md).

##### Canonical terms
Connection, Platform (value: `google_drive`), Storage Destination.

##### Files to touch
- `src/pages/api/connectors/google-drive/start-oauth.ts` (new, `baseout-web`).
- `src/pages/api/connectors/google-drive/callback.ts` (new, `baseout-web`).
- `src/storage/googleDrive.ts` (new, `baseout-backup-engine`) — stub class for now, P1D.2.3 finishes it.
- Test files for each (new).

##### Failing test to write first
- **File:** `src/pages/api/connectors/google-drive/callback.test.ts`
- **Cases:**
  - Valid code → `connections` row with `platform='google_drive'`, `access_token_enc`, `refresh_token_enc`, `token_expires_at` set.
  - Scope returned includes `drive.file` only; broader scopes (`drive`) rejected with 400.
  - CSRF state mismatch → 403.

##### Implementation notes
- Never log the raw tokens.
- Reuse OAuth state cookie pattern from P1C.1.2 / P1B.1.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (API 75%).

##### Dependencies
- **Blocked by:** P0.7.3, P0.7.4, P0.8.4 (OAuth client secret), P1D.1.1.
- **Blocks:** P1D.2.2, P1D.2.3.

##### Security 🔒
- Scope narrowed (`drive.file`, never `drive`).
- Tokens encrypted at rest.
- CSRF state cookie HttpOnly + SameSite=Lax.

##### Out of scope
- Folder picker (P1D.2.2).
- Writer (P1D.2.3).

---

#### [P1D.2.2] Server-side folder search + selection endpoint

**Parent:** [P1D.2](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:backup`, `🔒 security:auth-path`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Lazy-load folder tree through the Drive API using the Connection's access token. Consumed by the `FolderPicker` in P1C.4.2.

##### Spec references
- [Baseout_Features.md §14](Baseout_Features.md).
- [Baseout_PRD.md §2.6](Baseout_PRD.md) — file path structure.

##### Canonical terms
Connection, Storage Destination.

##### Files to touch
- `src/pages/api/connectors/google-drive/folders.ts` (new).
- `src/lib/googleDrive/listFolders.ts` (new).
- Test files (new).

##### Failing test to write first
- **File:** `src/pages/api/connectors/google-drive/folders.test.ts`
- **Cases:**
  - Returns `{id, name, hasChildren}` for each top-level folder with `drive.file` visibility.
  - 401 from Google → 409 response with `reauth_required`; Connection marked `is_dead`.
  - Pagination token returned when > 100 folders.

##### Implementation notes
- Server-side only; never forward tokens to client.
- Respect Drive API pagination.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (API 75%).

##### Dependencies
- **Blocked by:** P1D.2.1.
- **Blocks:** P1D.2.3, P1C.4.2.

##### Out of scope
- Search text input (follow-up if UX requires).

---

#### [P1D.2.3] `StorageGoogleDrive` writer implementing the interface + token refresh

**Parent:** [P1D.2](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:encryption`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Resumable uploads to Drive. Pre-upload check refreshes the access token if within 60s of expiry; 401 mid-upload → re-fetch token + retry once, otherwise mark `is_dead`.

##### Spec references
- [Baseout_Features.md §14](Baseout_Features.md).
- [Baseout_PRD.md §2.6](Baseout_PRD.md).

##### Canonical terms
Connection, Storage Destination.

##### Files to touch
- `src/storage/googleDrive.ts` (modified).
- `src/storage/googleDrive.test.ts` (new).
- `tests/integration/storage-google-drive.test.ts` (new, `msw`-mocked).

##### Failing test to write first
- **File:** `src/storage/googleDrive.test.ts`
- **Cases:**
  - `write()` uses resumable upload when file > 5 MB; simple upload otherwise.
  - Token expiring in 30s triggers refresh before write.
  - 401 mid-upload → one refresh + retry; second 401 → marks `is_dead` + throws `StorageAuthError`.
  - Path helper output used verbatim as the Drive file name.

##### Implementation notes
- Reuse `StorageDestination` types from P1D.1.1.
- Mock Drive API with `msw` per [CLAUDE.md §3](../.claude/CLAUDE.md) (external APIs mocked at HTTP boundary).

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1D.2.1, P1D.2.2, P1D.1.1, P1D.1.2.
- **Blocks:** P1C.4.1.

##### Security 🔒
- Never persist plaintext tokens; re-encrypt after refresh.

##### Out of scope
- Shared Drive support (V2).

---

### P1D.3

**Parent:** [P1D.3 Dropbox connector (first proxy stream)](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P1C.4, P1D.4 (reuses abstraction).

**Dropbox is the first proxy-stream connector.** It must introduce a reusable `ProxyStreamUploader` abstraction ([PRD §2.8](Baseout_PRD.md)) that Box (P1D.4) reuses. Sub-issue ordering: OAuth → proxy-stream abstraction → Dropbox writer → attachment URL refresh → end-to-end stream test.

---

#### [P1D.3.1] OAuth + app-folder scope + encrypted token storage

**Parent:** [P1D.3](Baseout_Backlog.md) · **Repo:** `baseout-web` + `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:auth-path`, `🔒 security:encryption`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Dropbox OAuth with `files.content.write` scoped to the app folder. Tokens encrypted (P0.7.3); stored in `connections` (P0.7.4).

##### Spec references
- [Baseout_Features.md §14](Baseout_Features.md).
- [Baseout_PRD.md §20.2](Baseout_PRD.md).

##### Canonical terms
Connection, Platform (value: `dropbox`), Storage Destination.

##### Files to touch
- `src/pages/api/connectors/dropbox/start-oauth.ts` (new).
- `src/pages/api/connectors/dropbox/callback.ts` (new).
- Test files (new).

##### Failing test to write first
- **File:** `src/pages/api/connectors/dropbox/callback.test.ts`
- **Cases:**
  - Valid code → `connections` row inserted with `platform='dropbox'`, tokens encrypted.
  - Scope `files.content.read,files.content.write` on app folder only; broader scopes rejected.
  - CSRF state mismatch → 403.

##### Implementation notes
- Reuse OAuth starter helpers from P1B.1.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (API 75%).

##### Dependencies
- **Blocked by:** P0.7.3, P0.7.4, P0.8.4, P1D.1.1.
- **Blocks:** P1D.3.2.

##### Security 🔒
- Tokens encrypted at rest; scope narrowed.

##### Out of scope
- Writer (P1D.3.3).

---

#### [P1D.3.2] Reusable `ProxyStreamUploader` abstraction

**Parent:** [P1D.3](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
The first proxy-streaming connector introduces the shared abstraction used by Dropbox here and Box in P1D.4 (and any future proxy-only provider). Streams bytes from source (Airtable attachment URL) through the Worker's memory directly to destination; no disk write.

##### Spec references
- [Baseout_PRD.md §2.8](Baseout_PRD.md) — proxy streaming for Dropbox + Box.
- [Baseout_PRD.md §20.2](Baseout_PRD.md) — data in transit.

##### Canonical terms
Attachment, Storage Destination.

##### Files to touch
- `src/storage/proxyStream.ts` (new) — `class ProxyStreamUploader` with `stream(source: ReadableStream, sink: UploadSink, opts)`.
- `src/storage/proxyStream.test.ts` (new).

##### Failing test to write first
- **File:** `src/storage/proxyStream.test.ts`
- **Cases:**
  - Streams a 50 MB fixture end-to-end without instantiating a Buffer > 1 MB (assert via memory snapshot spy).
  - Propagates source-side errors as `StorageWriteError` with `phase='source'`.
  - Propagates sink-side errors as `StorageWriteError` with `phase='sink'`.
  - Sha256 digest computed on-the-fly matches post-hoc digest of the same bytes.

##### Implementation notes
- `UploadSink` is a narrow interface any proxy-stream connector implements (chunk append + finalize).
- Use `TransformStream` for the tee to compute sha256 without double-reading.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1D.1.1, P1D.1.2.
- **Blocks:** P1D.3.3, P1D.4.*.

##### Out of scope
- Parallel multi-part upload (connector-specific; handled in writer).

---

#### [P1D.3.3] `StorageDropbox` writer using `ProxyStreamUploader`

**Parent:** [P1D.3](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:encryption`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Dropbox session upload API in chunks. Writer implements `StorageDestination` (P1D.1.1) and delegates streaming to `ProxyStreamUploader` (P1D.3.2).

##### Spec references
- [Baseout_PRD.md §2.8](Baseout_PRD.md).

##### Canonical terms
Storage Destination, Connection, Attachment.

##### Files to touch
- `src/storage/dropbox.ts` (new).
- `src/storage/dropbox.test.ts` (new).

##### Failing test to write first
- **File:** `src/storage/dropbox.test.ts`
- **Cases:**
  - `write()` creates a `upload_session/start`, `append_v2` per chunk, and `finish` with path from `buildPath`.
  - Token refresh invoked when within 60s of expiry.
  - 401 → one retry; second 401 marks Connection `is_dead`.
  - No disk write anywhere in the path (memory-only assertion).

##### Implementation notes
- Chunk size 8 MB (Dropbox recommendation).
- Use `msw` to mock Dropbox session endpoints.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1D.3.1, P1D.3.2, P1D.1.1, P1D.1.2.
- **Blocks:** P1D.3.4, P1D.3.5, P1C.4.1.

##### Security 🔒
- Re-encrypt refreshed tokens before storing.

##### Out of scope
- Team folder support.

---

#### [P1D.3.4] Airtable attachment URL refresh on proxy-stream start

**Parent:** [P1D.3](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Airtable attachment URLs expire in 1–2 hours ([PRD §2.8](Baseout_PRD.md)). Proxy-stream pipelines must refresh the URL right before opening the source stream. Helper lives on the backup-engine side and is also reused by Box (P1D.4).

##### Spec references
- [Baseout_PRD.md §2.8](Baseout_PRD.md) — attachment URL expiry.

##### Canonical terms
Attachment, Connection, Airtable.

##### Files to touch
- `src/lib/airtable/refreshAttachmentUrl.ts` (new).
- `src/lib/airtable/refreshAttachmentUrl.test.ts` (new).

##### Failing test to write first
- **File:** `src/lib/airtable/refreshAttachmentUrl.test.ts`
- **Cases:**
  - Given a fresh attachment record, returns the URL directly.
  - Given an expired (or close-to-expiry) URL, calls Airtable REST to re-fetch and returns the new URL.
  - Airtable 401 → throws `ConnectionAuthError` tagged for the Airtable Connection.
  - Results not cached across Backup Runs.

##### Implementation notes
- "Close to expiry" = within 5 minutes; conservative buffer for large files.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1B.1 (Airtable OAuth).
- **Blocks:** P1D.3.5, P1D.4.*.

##### Out of scope
- Cross-run dedup (P2B.*).

---

#### [P1D.3.5] Integration test: proxy 50 MB file end-to-end, no disk write

**Parent:** [P1D.3](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Locks in the proxy-stream invariant. Box (P1D.4) reuses the same test harness.

##### Spec references
- [Baseout_PRD.md §2.8](Baseout_PRD.md).
- [Baseout_PRD.md §14.3](Baseout_PRD.md).

##### Canonical terms
Storage Destination, Attachment.

##### Files to touch
- `tests/integration/storage-dropbox-proxy.test.ts` (new).

##### Failing test to write first
- **File:** `tests/integration/storage-dropbox-proxy.test.ts`
- **Cases:**
  - 50 MB fixture streams from mock Airtable CDN to mock Dropbox; assert resident set never exceeds 1× chunk size.
  - Sha256 in manifest matches the source sha256.
  - Mid-stream source 500 → writer surfaces `StorageWriteError` and does not finalize the Dropbox session.

##### Implementation notes
- Memory snapshot: `process.memoryUsage().rss` sampled every 100 ms; assert max is ≤ 32 MB over baseline.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1D.3.3, P1D.3.4.
- **Blocks:** P1C.4.1, P1D.4.*.

##### Out of scope
- Live Dropbox sandbox (deferred to staging smoke).

---

### P1D.4

**Parent:** [P1D.4 Box connector (proxy stream repeat)](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P1C.4.

Same shape as Dropbox (P1D.3). Reuses `ProxyStreamUploader` (P1D.3.2) + attachment URL refresh (P1D.3.4). Differences: Box chunked upload API + scope.

---

#### [P1D.4.1] OAuth + `root_readwrite` scope (app folder) + encrypted token storage

**Parent:** [P1D.4](Baseout_Backlog.md) · **Repo:** `baseout-web` + `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:auth-path`, `🔒 security:encryption`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Box OAuth; scope narrowed to a single user-chosen folder. Tokens encrypted (P0.7.3) stored in `connections` (P0.7.4).

##### Spec references
- [Baseout_Features.md §14](Baseout_Features.md).
- [Baseout_PRD.md §20.2](Baseout_PRD.md).

##### Canonical terms
Connection, Platform (value: `box`), Storage Destination.

##### Files to touch
- `src/pages/api/connectors/box/start-oauth.ts` (new).
- `src/pages/api/connectors/box/callback.ts` (new).
- Test files (new).

##### Failing test to write first
- **File:** `src/pages/api/connectors/box/callback.test.ts`
- **Cases:**
  - Valid code → `connections` row with `platform='box'`, encrypted tokens.
  - Scope limited to the user-chosen folder.
  - CSRF state mismatch → 403.

##### Implementation notes
- Same cookie/state helpers as P1D.2.1 / P1D.3.1.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (API 75%).

##### Dependencies
- **Blocked by:** P0.7.3, P0.7.4, P0.8.4, P1D.1.1, P1D.3.1 (for pattern reuse).
- **Blocks:** P1D.4.2, P1D.4.3.

##### Security 🔒
- Tokens encrypted at rest; scope narrowed to chosen folder.

##### Out of scope
- Writer (P1D.4.2).

---

#### [P1D.4.2] `StorageBox` writer reusing `ProxyStreamUploader`

**Parent:** [P1D.4](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:encryption`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Box chunked upload via `upload_session/create`, `upload_session/:id/part`, `upload_session/:id/commit`. Delegates streaming to `ProxyStreamUploader` (P1D.3.2) and attachment URL refresh to P1D.3.4.

##### Spec references
- [Baseout_PRD.md §2.8](Baseout_PRD.md).

##### Canonical terms
Storage Destination, Connection, Attachment.

##### Files to touch
- `src/storage/box.ts` (new).
- `src/storage/box.test.ts` (new).

##### Failing test to write first
- **File:** `src/storage/box.test.ts`
- **Cases:**
  - `write()` for file ≥ 50 MB creates a session; smaller files use single-POST path.
  - Parts are committed with SHA-1 checksum header (Box requirement).
  - Token refresh invoked when within 60s of expiry.
  - No disk write anywhere in the path.

##### Implementation notes
- Chunk size 8 MB; must be a multiple of Box's `part_size` hint — fetch from `upload_session` response.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1D.4.1, P1D.3.2, P1D.3.4, P1D.1.1, P1D.1.2.
- **Blocks:** P1D.4.3, P1C.4.1.

##### Security 🔒
- Re-encrypt refreshed tokens before storing.

##### Out of scope
- Box Governance / retention policies (V2).

---

#### [P1D.4.3] Integration test against Box sandbox-style `msw` harness

**Parent:** [P1D.4](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Replays the P1D.3.5 harness against Box endpoints: 50 MB fixture end-to-end, no disk, sha-1 checksum verified at commit.

##### Spec references
- [Baseout_PRD.md §2.8](Baseout_PRD.md).
- [Baseout_PRD.md §14.3](Baseout_PRD.md).

##### Canonical terms
Storage Destination, Attachment.

##### Files to touch
- `tests/integration/storage-box-proxy.test.ts` (new).

##### Failing test to write first
- **File:** `tests/integration/storage-box-proxy.test.ts`
- **Cases:**
  - 50 MB fixture → all parts uploaded + commit 201; resident memory ≤ 32 MB over baseline.
  - Commit rejected with 412 (checksum mismatch) → writer throws `StorageWriteError` and does not mark run success.
  - Mid-stream 401 → one refresh + retry succeeds.

##### Implementation notes
- `msw` handlers simulate Box part endpoints. Do not call live Box.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1D.4.2, P1D.3.5 (harness pattern).
- **Blocks:** P1C.4.1.

##### Out of scope
- Live Box sandbox smoke (staging).

---

### P1D.5

**Parent:** [P1D.5 OneDrive connector](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P1C.4.

Microsoft Graph OAuth + folder picker; writer uses Graph chunked upload sessions. Conforms to `StorageDestination` (P1D.1.1).

---

#### [P1D.5.1] OAuth + `Files.ReadWrite` + encrypted token storage

**Parent:** [P1D.5](Baseout_Backlog.md) · **Repo:** `baseout-web` + `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:auth-path`, `🔒 security:encryption`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Microsoft Graph OAuth with `Files.ReadWrite` scope (narrow — not `Files.ReadWrite.All`). Tokens encrypted (P0.7.3), stored in `connections` (P0.7.4).

##### Spec references
- [Baseout_Features.md §14](Baseout_Features.md).
- [Baseout_PRD.md §20.2](Baseout_PRD.md).

##### Canonical terms
Connection, Platform (value: `onedrive`), Storage Destination.

##### Files to touch
- `src/pages/api/connectors/onedrive/start-oauth.ts` (new).
- `src/pages/api/connectors/onedrive/callback.ts` (new).
- Test files (new).

##### Failing test to write first
- **File:** `src/pages/api/connectors/onedrive/callback.test.ts`
- **Cases:**
  - Valid code → `connections` row with `platform='onedrive'`, tokens encrypted.
  - Refresh token present (required for long-lived Graph sessions).
  - Broader scope than `Files.ReadWrite` rejected with 400.

##### Implementation notes
- Microsoft Graph `/common/` endpoint (supports personal + work sign-in for MVP).

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (API 75%).

##### Dependencies
- **Blocked by:** P0.7.3, P0.7.4, P0.8.4, P1D.1.1.
- **Blocks:** P1D.5.2, P1D.5.3.

##### Security 🔒
- Tokens encrypted at rest; scope narrowed.

##### Out of scope
- SharePoint document libraries (V2).

---

#### [P1D.5.2] Graph folder picker endpoint

**Parent:** [P1D.5](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:backup`, `🔒 security:auth-path`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Server-side Graph `drive/root/children` lazy tree for the `FolderPicker` (P1C.4.2).

##### Spec references
- [Baseout_Features.md §14](Baseout_Features.md).
- [Baseout_PRD.md §2.6](Baseout_PRD.md).

##### Canonical terms
Connection, Storage Destination.

##### Files to touch
- `src/pages/api/connectors/onedrive/folders.ts` (new).
- `src/lib/onedrive/listFolders.ts` (new).
- Test files (new).

##### Failing test to write first
- **File:** `src/pages/api/connectors/onedrive/folders.test.ts`
- **Cases:**
  - Returns `{id, name, hasChildren}` per child folder.
  - 401 from Graph → 409 `reauth_required`; Connection marked `is_dead`.
  - Pagination via Graph `@odata.nextLink`.

##### Implementation notes
- Server-side only; never expose tokens to client.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (API 75%).

##### Dependencies
- **Blocked by:** P1D.5.1.
- **Blocks:** P1D.5.3, P1C.4.2.

##### Out of scope
- Search input (follow-up).

---

#### [P1D.5.3] `StorageOneDrive` writer — Graph chunked upload session

**Parent:** [P1D.5](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:encryption`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
OneDrive is upload-to-disk on the destination side but does NOT require proxy streaming. Uses Graph `createUploadSession` + PUT ranges. Still implements `StorageDestination` (P1D.1.1).

##### Spec references
- [Baseout_Features.md §14](Baseout_Features.md).
- [Baseout_PRD.md §2.6](Baseout_PRD.md).

##### Canonical terms
Storage Destination, Connection.

##### Files to touch
- `src/storage/oneDrive.ts` (new).
- `src/storage/oneDrive.test.ts` (new).
- `tests/integration/storage-onedrive.test.ts` (new).

##### Failing test to write first
- **File:** `src/storage/oneDrive.test.ts`
- **Cases:**
  - `write()` for ≥ 4 MB uses `createUploadSession`; smaller files use simple PUT.
  - Chunk boundaries aligned to Graph's 320 KiB multiple requirement.
  - Token refresh when within 60s of expiry.
  - 401 mid-upload → one refresh + retry; second 401 marks `is_dead`.

##### Implementation notes
- Chunk size: 5 MB rounded to nearest 320 KiB = 5.12 MB.
- Path from `buildPath` rewritten to `/drive/root:/orgs/.../spaces/...:` (Graph URL escaping).

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1D.5.1, P1D.5.2, P1D.1.1, P1D.1.2.
- **Blocks:** P1C.4.1.

##### Security 🔒
- Re-encrypt refreshed tokens before storing.

##### Out of scope
- SharePoint sites (V2).

---

### P1D.6

**Parent:** [P1D.6 S3 connector (Growth+)](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P1C.4 (Growth+).

S3 uses IAM access keys (not OAuth). Tier-gated to Growth+ via `resolveCapability('storage.destinations')` (P1C.3.2). Conforms to `StorageDestination` (P1D.1.1).

---

#### [P1D.6.1] Credential form + AES-256-GCM-encrypted key storage + tier gate

**Parent:** [P1D.6](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:backup`, `🔒 security:new-secret`, `🔒 security:encryption`, `tier-gate:growth+`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
User submits `{accessKeyId, secretAccessKey, region, bucket, prefix}`. Server validates tier via `resolveCapability('storage.destinations')` (P1C.3.2), encrypts keys (P0.7.3), and stores in `connections` with `platform='s3'`.

##### Spec references
- [Baseout_Features.md §14](Baseout_Features.md) — S3 Growth+.
- [Baseout_PRD.md §20.2](Baseout_PRD.md).

##### Canonical terms
Connection, Platform (value: `s3`), Storage Destination, Tier.

##### Files to touch
- `src/pages/wizard/step-4-s3-form.astro` (new) — S3-specific inline form (reached from the S3 destination card).
- `src/pages/api/connectors/s3/save.ts` (new).
- Test files (new).

##### Failing test to write first
- **File:** `src/pages/api/connectors/s3/save.test.ts`
- **Cases:**
  - Pro-tier Org, valid creds → `connections` row with encrypted keys + `platform='s3'`; 200.
  - Starter-tier Org → 403 `tier_gate`.
  - Missing `secretAccessKey` → 400.
  - UI displays key fingerprint (first 4 + last 4), never full secret.

##### Implementation notes
- Server-side Zod schema enforces required fields.
- Never log secrets; mask on response.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] Mobile-first verified at 375px breakpoint.
- [ ] Touch targets ≥ 44×44px.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (API 75%).

##### Dependencies
- **Blocked by:** P0.7.3, P0.7.4, P1C.3.2, P1D.1.1.
- **Blocks:** P1D.6.2, P1D.6.3.

##### Security 🔒
- Secret key never returned in any response.
- Warn in UI if IAM policy appears overly broad (see P1D.6.3).
- Encryption at rest via P0.7.3.

##### Out of scope
- STS assume-role flow (V2).

---

#### [P1D.6.2] Bucket existence + write test on save + IAM scope warning

**Parent:** [P1D.6](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:growth+`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
On save, perform a `HeadBucket` + throwaway `PutObject`/`DeleteObject` to confirm credentials. Inspect the caller's IAM policy shape (via `GetCallerIdentity` + bucket ACL probe); if `Resource: *` or `Action: s3:*` detected in error signals, warn the user and record it.

##### Spec references
- [Baseout_Features.md §14](Baseout_Features.md).
- [CLAUDE.md §2](../.claude/CLAUDE.md) — principle of least privilege.

##### Canonical terms
Connection, Storage Destination.

##### Files to touch
- `src/storage/s3.ts` (new) — includes `verifyAuth()` for health check.
- `src/storage/s3.test.ts` (new).

##### Failing test to write first
- **File:** `src/storage/s3.test.ts`
- **Cases:**
  - `verifyAuth()` with valid creds + bucket → `{ok: true, warnings: []}`.
  - Missing bucket → `{ok: false, reason: 'bucket_missing'}`.
  - Bucket in wrong region → `{ok: false, reason: 'region_mismatch'}`.
  - Overly-broad IAM (heuristic from error messages) → `{ok: true, warnings: ['broad_iam']}`.

##### Implementation notes
- Use AWS SDK v3 `S3Client`.
- Throwaway object keyed `baseout-healthcheck-{runId}.txt`, deleted on success.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1D.6.1, P1D.1.1.
- **Blocks:** P1D.6.3, P1C.4.1.

##### Out of scope
- Full IAM policy analyzer (V2).

---

#### [P1D.6.3] `StorageS3` writer + expired-credentials handling

**Parent:** [P1D.6](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:encryption`, `tier-gate:growth+`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Multipart upload via AWS SDK v3. On `ExpiredToken`/`InvalidAccessKeyId`, mark the Connection `is_dead` and surface to notifications (P2C.3).

##### Spec references
- [Baseout_Features.md §14](Baseout_Features.md).
- [Baseout_PRD.md §2.6](Baseout_PRD.md).

##### Canonical terms
Storage Destination, Connection.

##### Files to touch
- `src/storage/s3.ts` (modified).
- `tests/integration/storage-s3.test.ts` (new, MinIO/localstack fixture).

##### Failing test to write first
- **File:** `tests/integration/storage-s3.test.ts`
- **Cases:**
  - Multipart write of 50 MB succeeds against localstack; sha256 in manifest matches.
  - `ExpiredToken` → writer throws `StorageAuthError`; Connection row `is_dead=true`.
  - Cross-Organization write attempt (prefix violation) → throws before any PUT.

##### Implementation notes
- Use AWS SDK v3 `@aws-sdk/lib-storage` `Upload` helper for automatic multipart.
- MinIO reachable via Docker Compose (P0.3.*).

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1D.6.2, P1D.1.1, P1D.1.2.
- **Blocks:** P1C.4.1.

##### Security 🔒
- Never log full secret key; reuse P0.7.3 decryption only within writer scope.

##### Out of scope
- Cross-region replication.

---

### P1D.7

**Parent:** [P1D.7 Frame.io connector (Growth+, unknowns)](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P1C.4 (Growth+).

Frame.io is Growth+ only and carries ⚠️ unknowns ([Baseout_Backlog.md P1D.7 Context](Baseout_Backlog.md)). Sub-issue ordering: open-questions capture → OAuth → project/folder picker → writer with conditional proxy → integration smoke.

---

#### [P1D.7.1] Capture open questions + confirm API shape before build

**Parent:** [P1D.7](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:growth+`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Before writing any connector code, confirm the ambiguities flagged in the backlog: does Frame.io V4 require proxy streaming? Which scope covers project + folder + upload? Which API version (V3 vs V4)? File answers into this sub-issue's PR description so later sub-issues branch correctly.

##### Spec references
- [Baseout_Features.md §14](Baseout_Features.md) — Frame.io Growth+.
- [Baseout_PRD.md §2.8](Baseout_PRD.md) — proxy streaming.
- [Baseout_Backlog.md P1D.7](Baseout_Backlog.md) — ⚠️ spec note.

##### Canonical terms
Connection, Platform (value: `frameio`), Storage Destination.

##### Files to touch
- `docs/connectors/frameio-open-questions.md` (new) — stores resolved answers + citation links.

##### Failing test to write first
- **File:** `tests/integration/frameio-contract.test.ts` (new, stub-only)
- **Cases:**
  - Asserts that `docs/connectors/frameio-open-questions.md` exists and answers each open question (parsed checklist).
  - Test fails until every question is resolved "Yes/No" with a citation.

##### Implementation notes
- Not a code change per se — a forcing function to resolve ambiguity before building the writer.
- Open questions captured: proxy requirement, API version (V3 vs V4), scope names, large-file multipart shape, media proxy transcode side-effects, signed URL expiry.

##### Acceptance criteria
- [ ] Each open question answered with citation to Frame.io docs.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** none (investigation).
- **Blocks:** P1D.7.2, P1D.7.3, P1D.7.4, P1D.7.5.

##### Open questions
- Does Frame.io V4 require proxy streaming like Dropbox/Box, or does it allow direct upload-session URLs the source can POST to?
- Is project + folder hierarchy exposed via a single GraphQL endpoint or per-resource REST endpoints?
- Does Frame.io transcode uploads (create proxy renditions) automatically — do we need to opt out to preserve originals?
- What are the exact scope names required for `read project + write file` in V4?
- What is the maximum individual file size via the standard upload session?

##### Out of scope
- Any connector code (blocked on this sub-issue's answers).

---

#### [P1D.7.2] OAuth + narrow scope + encrypted token storage

**Parent:** [P1D.7](Baseout_Backlog.md) · **Repo:** `baseout-web` + `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:auth-path`, `🔒 security:encryption`, `tier-gate:growth+`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Frame.io OAuth (V3 or V4 per P1D.7.1 outcome). Scope narrowed per answers. Tokens encrypted (P0.7.3), stored in `connections`.

##### Spec references
- [Baseout_Features.md §14](Baseout_Features.md).
- [Baseout_PRD.md §20.2](Baseout_PRD.md).

##### Canonical terms
Connection, Platform (value: `frameio`), Storage Destination.

##### Files to touch
- `src/pages/api/connectors/frameio/start-oauth.ts` (new).
- `src/pages/api/connectors/frameio/callback.ts` (new).
- Test files (new).

##### Failing test to write first
- **File:** `src/pages/api/connectors/frameio/callback.test.ts`
- **Cases:**
  - Valid code → `connections` row with `platform='frameio'`, encrypted tokens.
  - Growth-tier Org → allowed; Launch Org → 403 `tier_gate`.
  - Scope returned matches the documented set from P1D.7.1.

##### Implementation notes
- Pattern matches P1D.2.1 / P1D.3.1 / P1D.5.1.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (API 75%).

##### Dependencies
- **Blocked by:** P1D.7.1, P0.7.3, P0.7.4, P0.8.4, P1D.1.1, P1C.3.2.
- **Blocks:** P1D.7.3, P1D.7.4.

##### Security 🔒
- Tokens encrypted at rest; scope narrowed per P1D.7.1.

##### Out of scope
- Writer (P1D.7.4).

---

#### [P1D.7.3] Project/folder picker endpoint

**Parent:** [P1D.7](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-web`, `capability:backup`, `🔒 security:auth-path`, `tier-gate:growth+`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Lists Frame.io Projects + the folder tree under a chosen Project. Consumed by `FolderPicker` (P1C.4.2).

##### Spec references
- [Baseout_Features.md §14](Baseout_Features.md).
- [Baseout_PRD.md §2.6](Baseout_PRD.md).

##### Canonical terms
Connection, Storage Destination.

##### Files to touch
- `src/pages/api/connectors/frameio/projects.ts` (new).
- `src/pages/api/connectors/frameio/folders.ts` (new).
- Test files (new).

##### Failing test to write first
- **File:** `src/pages/api/connectors/frameio/folders.test.ts`
- **Cases:**
  - Project-list endpoint returns `{id, name}` for each accessible Project.
  - Folder-list under chosen Project returns `{id, name, hasChildren}`.
  - 401 from Frame.io → 409 `reauth_required`; Connection marked `is_dead`.

##### Implementation notes
- Server-side only; never forward tokens to client.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (API 75%).

##### Dependencies
- **Blocked by:** P1D.7.2.
- **Blocks:** P1D.7.4, P1C.4.2.

##### Out of scope
- Team / root-team selection beyond a single default (follow-up if answers require).

---

#### [P1D.7.4] `StorageFrameio` writer — conditional proxy-stream vs direct upload

**Parent:** [P1D.7](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `🔒 security:encryption`, `tier-gate:growth+`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Based on P1D.7.1 answers: if Frame.io requires proxy streaming, reuse `ProxyStreamUploader` (P1D.3.2) + attachment URL refresh (P1D.3.4). Otherwise, use Frame.io's signed upload URL (direct from source Airtable CDN → Frame.io) to avoid the Worker being in the bytes path.

##### Spec references
- [Baseout_Features.md §14](Baseout_Features.md).
- [Baseout_PRD.md §2.8](Baseout_PRD.md).

##### Canonical terms
Storage Destination, Connection, Attachment.

##### Files to touch
- `src/storage/frameio.ts` (new).
- `src/storage/frameio.test.ts` (new).

##### Failing test to write first
- **File:** `src/storage/frameio.test.ts`
- **Cases:**
  - If proxy-required (flag from P1D.7.1), `write()` goes through `ProxyStreamUploader`; no disk write.
  - If direct-upload allowed, `write()` obtains a signed upload URL + returns without the Worker reading bytes.
  - Token refresh invoked when within 60s of expiry.
  - Opt-out of auto-transcoding if P1D.7.1 flagged it as an issue.

##### Implementation notes
- Branch once at writer-construction time; keep the hot path branch-free.

##### Acceptance criteria
- [ ] All four test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1D.7.1, P1D.7.2, P1D.7.3, P1D.3.2, P1D.3.4, P1D.1.1, P1D.1.2.
- **Blocks:** P1D.7.5, P1C.4.1.

##### Security 🔒
- Signed upload URL is time-bounded; never logged.

##### Out of scope
- Comments/review workflow integration (V2).

---

#### [P1D.7.5] Integration smoke: 50 MB asset via chosen Frame.io path

**Parent:** [P1D.7](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** backup
**Labels:** `phase:1`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:backup`, `tier-gate:growth+`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
End-to-end smoke against an `msw` Frame.io harness shaped per P1D.7.1 answers. Locks in the behavior chosen in P1D.7.4.

##### Spec references
- [Baseout_PRD.md §2.8](Baseout_PRD.md).
- [Baseout_PRD.md §14.3](Baseout_PRD.md).

##### Canonical terms
Storage Destination, Attachment.

##### Files to touch
- `tests/integration/storage-frameio.test.ts` (new).

##### Failing test to write first
- **File:** `tests/integration/storage-frameio.test.ts`
- **Cases:**
  - Proxy branch (if applicable): 50 MB through `ProxyStreamUploader`; resident memory ≤ 32 MB over baseline.
  - Direct-upload branch (if applicable): signed URL returned; Worker never reads body bytes (spy asserts).
  - 401 mid-flow → one refresh + retry succeeds.

##### Implementation notes
- Harness swap-able per branch (`proxy` | `direct`) controlled by a config flag read from P1D.7.1's doc.

##### Acceptance criteria
- [ ] All three test cases green.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per [PRD §14.4](Baseout_PRD.md) (backend 80%).

##### Dependencies
- **Blocked by:** P1D.7.4.
- **Blocks:** P1C.4.1.

##### Out of scope
- Live Frame.io sandbox smoke (staging).

---

---

## 5. Epic 3 — Phase 2: Dashboard, Restore & Background Services

**Milestone:** MVP · **Plan ref:** Phase 2 · **Epic doc:** [Baseout_Backlog.md §Epic 3](Baseout_Backlog.md)

**Parents in this epic (20 after P2D.1 split):**

| Parent | Title | Granularity | Sub-issue count |
|---|---|---|---|
| [P2A.1](#p2a1) | Space selector sidebar nav | chunk | 3 |
| [P2A.2](#p2a2) | Backup status widget | tdd | 5 |
| [P2A.3](#p2a3) | Backup history list | chunk | 3 |
| [P2A.4](#p2a4) | Real-time progress via WebSocket | tdd | 5 |
| [P2A.5](#p2a5) | Storage usage summary | chunk | 3 |
| [P2A.6](#p2a6) | Notification / action items panel | chunk | 3 |
| [P2B.1](#p2b1) | Point-in-time snapshot selection UI | chunk | 3 |
| [P2B.2](#p2b2) | Base-level restore | tdd | 6 |
| [P2B.3](#p2b3) | Table-level restore | tdd | 5 |
| [P2B.4](#p2b4) | Restore destination: existing Base | tdd | 6 |
| [P2B.5](#p2b5) | Restore destination: new Base | tdd | 5 |
| [P2B.6](#p2b6) | Post-restore verification (Growth+) | tdd | 5 |
| [P2C.1](#p2c1) | Webhook renewal service | tdd | 5 |
| [P2C.2](#p2c2) | OAuth token refresh service | tdd | 6 |
| [P2C.3](#p2c3) | Dead connection detection + 4-touch notification | tdd | 6 |
| [P2C.4](#p2c4) | Connection lock manager | tdd | 5 |
| [P2C.5](#p2c5) | Trial expiry monitor | chunk | 3 |
| [P2C.6](#p2c6) | Quota usage monitor | chunk | 3 |
| [P2D.1a](#p2d1a) | Email render harness + magic-link template | tdd | 5 |
| [P2D.1b](#p2d1b) | Remaining V1 email templates | chunk | 4 |

---

> Sub-issue decomposition for Phase 2 parents (P2A.1–6, P2B.1–6, P2C.1–6, P2D.1a, P2D.1b).
> Companion to [Baseout_Backlog.md](Baseout_Backlog.md) · [Baseout_Backlog_MVP.md](Baseout_Backlog_MVP.md).
> Parents link back to canonical entries in [Baseout_Backlog.md](Baseout_Backlog.md).

---

### P2A.1

**Parent:** [P2A.1 Space selector sidebar nav](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P2A.2–P2A.6.

Sidebar surface lists Spaces for the active Organization, persists last-viewed per user, and wires into the `currentSpace` nanostore. Mobile-first; touch targets ≥ 44×44px per CLAUDE.md §UI/UX.

---

#### [P2A.1.1] Space list API endpoint + server types

**Parent:** [P2A.1](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Sidebar needs a typed API to list Spaces for the active Organization. Endpoint reads from `spaces` table scoped to the caller's Organization membership.

##### Spec references
- [Baseout_PRD.md §6.2](Baseout_PRD.md) — dashboard Space selector.
- [Baseout_PRD.md §6.4](Baseout_PRD.md) — Organization/Space hierarchy.
- [Baseout_Features.md §4.1](Baseout_Features.md) — Spaces per tier.

##### Canonical terms
Organization, Space, Platform.

##### Files to touch
- `src/pages/api/spaces/index.ts` (new) — GET handler.
- `src/lib/types.ts` (modified) — `SpaceSummary` shape.
- `src/db/queries/spaces.ts` (new) — Drizzle query scoped by `organization_id`.

##### Failing test to write first
- **File:** `tests/api/spaces.list.test.ts`
- **Cases:** returns only Spaces in active Org; unauthenticated → 401; other Org's Spaces excluded.

##### Implementation notes
- Reuse `resolveActiveOrganization()` from P1A session helpers.
- Response shape: `{ id, name, platform, status, lastBackupAt | null }`.
- Parameterized Drizzle query — no string concat.

##### Acceptance criteria
- [ ] `GET /api/spaces` returns Spaces for active Organization only.
- [ ] No `any` types (tsc strict).
- [ ] Coverage target per PRD §14.4 (API 75%).
- [ ] 401 for unauthenticated requests (middleware enforced).

##### Dependencies
- **Blocked by:** P1A.4, P0.7.*
- **Blocks:** P2A.1.2, P2A.1.3

##### Out of scope
- WebSocket status feed (P2A.4).
- Last-viewed persistence (P2A.1.3).

---

#### [P2A.1.2] Sidebar component + currentSpace nanostore wiring

**Parent:** [P2A.1](Baseout_Backlog.md) · **Repo:** `baseout-web`, `baseout-ui` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Renders the sidebar Space list, binds selection to `src/stores/currentSpace.ts`. Astro island `client:idle`; mobile-first, touch targets ≥ 44×44px.

##### Spec references
- [Baseout_PRD.md §6.2](Baseout_PRD.md) — Space selector.
- [Baseout_PRD.md §6.5](Baseout_PRD.md) — mobile responsiveness.
- [CLAUDE.md §4](../.claude/CLAUDE.md) — nanostores.

##### Canonical terms
Organization, Space.

##### Files to touch
- `baseout-ui/src/components/SpaceSidebar.astro` (new).
- `src/components/layout/DashboardShell.astro` (modified) — mount sidebar.
- `src/stores/currentSpace.ts` (modified) — selection setter + active Org guard.

##### Failing test to write first
- **File:** `tests/components/SpaceSidebar.test.ts`
- **Cases:** renders list fixture; clicking item updates `currentSpace` store; 44×44px touch target assertion; mobile viewport (<375px) renders collapsed state.

##### Implementation notes
- Use `@opensided/theme` primitives for list items; daisyUI fallback for drawer.
- Reuse `toasts.ts` for failure to load.
- No hardcoded spacing — theme tokens only.

##### Acceptance criteria
- [ ] Sidebar renders Space list on dashboard routes.
- [ ] Selecting a Space updates `currentSpace` store and URL (`?space=<id>`).
- [ ] Mobile: viewport < 375px renders drawer trigger with ≥ 44×44px tap target.
- [ ] Touch target assertion passes in tests.
- [ ] No `any` types.
- [ ] Coverage target per PRD §14.4 (UI 60%).

##### Dependencies
- **Blocked by:** P2A.1.1, P0.9.6
- **Blocks:** P2A.1.3

##### Out of scope
- New-Space CTA wizard routing (covered by P1C).
- Last-viewed restore (P2A.1.3).

---

#### [P2A.1.3] Last-viewed Space persistence + restore on login

**Parent:** [P2A.1](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Per PRD §6.2 the Space selector "defaults to last viewed Space per user." Persist server-side on `users` table and hydrate into `currentSpace` store on login.

##### Spec references
- [Baseout_PRD.md §6.2](Baseout_PRD.md) — last-viewed Space persistence.

##### Canonical terms
Organization, Space.

##### Files to touch
- `src/db/schema/users.ts` (modified) — add `last_space_id uuid` column + Drizzle migration.
- `src/pages/api/user/last-space.ts` (new) — PATCH to record last-viewed.
- `src/lib/account.ts` (modified) — hydrate `last_space_id` into session payload.
- `src/stores/currentSpace.ts` (modified) — init from session hydration.

##### Failing test to write first
- **File:** `tests/api/last-space.test.ts`
- **Cases:** switching Space PATCHes `last_space_id`; fresh login hydrates store from `last_space_id`; touch target on drawer toggle still ≥ 44×44px after hydration.

##### Implementation notes
- Debounce PATCH by 500ms to avoid spam on rapid switching.
- Migration is add-column only — no backfill (null permitted → first Space fallback).

##### Acceptance criteria
- [ ] `users.last_space_id` migration lands.
- [ ] Switching Space PATCHes endpoint within 500ms debounce.
- [ ] On login, `currentSpace` store initialises from `last_space_id` when present.
- [ ] Mobile-first: drawer toggle ≥ 44×44px.
- [ ] No `any` types. Coverage target per PRD §14.4.

##### Dependencies
- **Blocked by:** P2A.1.2
- **Blocks:** P2A.2.*, P2A.5.*, P2A.6.*

##### Out of scope
- Cross-device sync (session-level cookie store is sufficient).

---

### P2A.2

**Parent:** [P2A.2 Backup status widget](Baseout_Backlog.md) · granularity: `tdd` · Blocks: none direct, feeds dashboard trust signal.

TDD decomposition of the dashboard backup status widget: idle / running / failed states driven by run history + live WebSocket feed.

---

#### [P2A.2.1] BackupStatus view-model types + state reducer

**Parent:** [P2A.2](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Pure state reducer that maps the latest Backup Run + optional live progress event into one of three UI states: `idle`, `running`, `failed`.

##### Spec references
- [Baseout_PRD.md §6.2](Baseout_PRD.md) — backup status on dashboard.
- [Baseout_PRD.md §4.4](Baseout_PRD.md) — real-time progress.

##### Canonical terms
Backup Run, Backup Snapshot.

##### Files to touch
- `src/lib/backupStatus.ts` (new) — reducer + `BackupStatusVM` types.
- `src/lib/types.ts` (modified) — export shared VM.

##### Failing test to write first
- **File:** `tests/lib/backupStatus.test.ts`
- **Cases:** idle from last successful run; running when live progress active; failed when last run failed and no live progress; record/table/attachment counts surfaced.

##### Implementation notes
- Pure function — no I/O, no store subscriptions.
- Explicit `BackupStatusVM` discriminated union.

##### Acceptance criteria
- [ ] Reducer covers all three states.
- [ ] No `any` types; discriminated union tags states.
- [ ] Coverage target per PRD §14.4 (backend logic 80%).

##### Dependencies
- **Blocked by:** P0.7.*
- **Blocks:** P2A.2.2, P2A.2.4

##### Out of scope
- UI rendering (P2A.2.4).

---

#### [P2A.2.2] `/api/spaces/:id/status` endpoint

**Parent:** [P2A.2](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Returns the Space's most recent Backup Run summary so the widget can render idle/failed state without a live connection.

##### Spec references
- [Baseout_PRD.md §6.2](Baseout_PRD.md).
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `backup_runs` columns.

##### Canonical terms
Space, Backup Run.

##### Files to touch
- `src/pages/api/spaces/[id]/status.ts` (new).
- `src/db/queries/backupRuns.ts` (new).

##### Failing test to write first
- **File:** `tests/api/space-status.test.ts`
- **Cases:** returns last run for authorized caller; 403 for Space outside caller's Org; 404 for unknown Space.

##### Implementation notes
- Reducer from P2A.2.1 applied server-side for a ready-to-render VM.
- Parameterized Drizzle query; index on `(space_id, started_at desc)` assumed from P0.7.

##### Acceptance criteria
- [ ] 200 returns `BackupStatusVM` JSON.
- [ ] 403 / 404 paths covered by tests.
- [ ] No `any` types; coverage per PRD §14.4 (API 75%).

##### Dependencies
- **Blocked by:** P2A.2.1
- **Blocks:** P2A.2.4

##### Out of scope
- Live updates (P2A.2.3).

---

#### [P2A.2.3] nanostore for live widget state

**Parent:** [P2A.2](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
`backupStatus` atom; subscribes to the WebSocket stream from P2A.4 and folds each event through the P2A.2.1 reducer.

##### Spec references
- [CLAUDE.md §4](../.claude/CLAUDE.md) — nanostores policy.
- [Baseout_PRD.md §4.4](Baseout_PRD.md).

##### Canonical terms
Backup Run.

##### Files to touch
- `src/stores/backupStatus.ts` (new).

##### Failing test to write first
- **File:** `tests/stores/backupStatus.test.ts`
- **Cases:** initialises from `/api/spaces/:id/status`; `progress` event transitions to running; `complete` event transitions to idle with new counts; clears on logout.

##### Implementation notes
- No secrets in store. Reset on logout per CLAUDE.md §4.
- `computed` for derived labels (e.g., ETA formatting).

##### Acceptance criteria
- [ ] Store resets on logout.
- [ ] No `any` types.
- [ ] Coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2A.2.2, P2A.4.*
- **Blocks:** P2A.2.4

##### Out of scope
- Reconnection backoff — lives in the WebSocket client (P2A.4.3).

---

#### [P2A.2.4] BackupStatusWidget Astro island + three-state render

**Parent:** [P2A.2](Baseout_Backlog.md) · **Repo:** `baseout-web`, `baseout-ui` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Renders idle/running/failed states from the `backupStatus` store. Prominent dashboard element — trust-signal-first design.

##### Spec references
- [Baseout_PRD.md §6.0](Baseout_PRD.md) — trust-signal design.
- [Baseout_PRD.md §6.2](Baseout_PRD.md).

##### Canonical terms
Backup Run.

##### Files to touch
- `baseout-ui/src/components/BackupStatusWidget.astro` (new).
- `src/pages/dashboard/index.astro` (modified) — embed widget.

##### Failing test to write first
- **File:** `tests/components/BackupStatusWidget.test.ts`
- **Cases:** renders idle fixture (timestamp + counts); running fixture (progress bar + ETA); failed fixture (error summary + link to run log); ≥ 44×44px on all interactive elements; mobile < 375px renders.

##### Implementation notes
- `@opensided/theme` primitives first; daisyUI progress bar fallback.
- Semantic HTML: `<article>` + heading + `<progress>`.
- No client JS beyond `useStore`.

##### Acceptance criteria
- [ ] All three states render from fixture data.
- [ ] Touch target ≥ 44×44px asserted.
- [ ] Mobile-first layout (< 375px) verified.
- [ ] No `any` types; coverage per PRD §14.4 (UI 60%).

##### Dependencies
- **Blocked by:** P2A.2.3
- **Blocks:** P2A.2.5

##### Out of scope
- Notification panel integration (P2A.6).

---

#### [P2A.2.5] Playwright E2E — widget reflects a real run

**Parent:** [P2A.2](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
End-to-end happy path: trigger a backup (stubbed engine); widget transitions idle → running → idle within test timeout.

##### Spec references
- [Baseout_PRD.md §14.5](Baseout_PRD.md) — E2E scenarios.

##### Canonical terms
Backup Run, Space.

##### Files to touch
- `tests/e2e/backup-status-widget.spec.ts` (new).
- `tests/e2e/fixtures/spaces.ts` (modified) — seeded Space + fake run emitter.

##### Failing test to write first
- Same file as above; fails until P2A.2.4 ships.

##### Implementation notes
- Use msw for Airtable API boundary; the engine stub emits three WebSocket frames.
- Mobile viewport run included via Playwright device profile.

##### Acceptance criteria
- [ ] Widget visits idle → running → idle in one scenario.
- [ ] Mobile profile passes.
- [ ] No `any` types; coverage per PRD §14.4 (critical flow E2E).

##### Dependencies
- **Blocked by:** P2A.2.4, P2A.4.*
- **Blocks:** none

##### Out of scope
- Failure-state E2E (covered via unit fixture — E2E would need a flaky engine stub).

---

### P2A.3

**Parent:** [P2A.3 Backup history list](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P2B.1 (snapshot picker reads same data).

Paginated Backup Run history with cursor pagination, filter, and a detail drawer. Mobile-first table with touch-friendly row targets.

---

#### [P2A.3.1] History list API with cursor pagination

**Parent:** [P2A.3](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
`GET /api/spaces/:id/runs?cursor&status` returns Backup Runs with metrics. Cursor based on `started_at desc, id desc`.

##### Spec references
- [Baseout_PRD.md §2.10](Baseout_PRD.md) — audit history retention.
- [Baseout_PRD.md §6.2](Baseout_PRD.md).
- [Baseout_PRD.md §21.3](Baseout_PRD.md).

##### Canonical terms
Backup Run, Space.

##### Files to touch
- `src/pages/api/spaces/[id]/runs.ts` (new).
- `src/db/queries/backupRuns.ts` (modified) — cursor helper.

##### Failing test to write first
- **File:** `tests/api/runs.list.test.ts`
- **Cases:** first page returns newest runs; cursor advances correctly; filter `status=failed` restricts results; unauthorized Space → 403.

##### Implementation notes
- Limit 25 rows per page.
- Parameterized Drizzle.

##### Acceptance criteria
- [ ] Pagination stable across repeat calls.
- [ ] Status filter works.
- [ ] No `any` types; coverage per PRD §14.4 (API 75%).

##### Dependencies
- **Blocked by:** P1B.10
- **Blocks:** P2A.3.2, P2B.1.*

##### Out of scope
- Full-run detail endpoint (P2A.3.2).

---

#### [P2A.3.2] History list component + detail drawer

**Parent:** [P2A.3](Baseout_Backlog.md) · **Repo:** `baseout-web`, `baseout-ui` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** L

##### Context
Renders the run list with columns per PRD §6.2, opens a drawer on row click showing metrics + error. Mobile: card layout < 768px.

##### Spec references
- [Baseout_PRD.md §6.2](Baseout_PRD.md).
- [Baseout_PRD.md §6.5](Baseout_PRD.md) — mobile.

##### Canonical terms
Backup Run.

##### Files to touch
- `baseout-ui/src/components/BackupHistoryList.astro` (new).
- `baseout-ui/src/components/BackupRunDrawer.astro` (new).
- `src/pages/dashboard/backups/index.astro` (new).

##### Failing test to write first
- **File:** `tests/components/BackupHistoryList.test.ts`
- **Cases:** renders rows with status/started/duration/records/tables/attachments; row click opens drawer; status filter chips work; row tap target ≥ 44×44px; mobile card layout < 768px renders.

##### Implementation notes
- Use `@opensided/theme` table primitive; fall back to daisyUI if needed.
- Semantic `<table>` + ARIA row labels.

##### Acceptance criteria
- [ ] Columns match PRD §6.2.
- [ ] Drawer shows metrics + error.
- [ ] Mobile-first card layout < 768px.
- [ ] Touch target ≥ 44×44px.
- [ ] No `any` types; coverage per PRD §14.4 (UI 60%).

##### Dependencies
- **Blocked by:** P2A.3.1
- **Blocks:** P2A.3.3

##### Out of scope
- Infinite scroll UX polish — covered by P2A.3.3.

---

#### [P2A.3.3] Infinite scroll + filter persistence + Playwright check

**Parent:** [P2A.3](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Wires `IntersectionObserver`-based infinite scroll, persists status filter to URL, and asserts the full flow in Playwright.

##### Spec references
- [Baseout_PRD.md §14.5](Baseout_PRD.md).

##### Canonical terms
Backup Run.

##### Files to touch
- `src/lib/infiniteScroll.ts` (new).
- `tests/e2e/backup-history.spec.ts` (new).

##### Failing test to write first
- Playwright scenario: list loads 25 rows → scroll loads next 25 → filter reduces → detail drawer opens.

##### Implementation notes
- Filter persisted as `?status=`.
- Debounce scroll observer by 100ms.

##### Acceptance criteria
- [ ] Infinite scroll fetches next cursor page.
- [ ] Filter persisted in URL and restored on reload.
- [ ] Mobile viewport scenario passes; tap targets ≥ 44×44px.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2A.3.2
- **Blocks:** none

##### Out of scope
- Date-range filter — deferred.

---

### P2A.4

**Parent:** [P2A.4 Real-time progress via WebSocket](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P2A.2, P2B.2 progress.

TDD decomposition of the WebSocket pipe from the Space Durable Object (P1B.2) to the dashboard. Auth via session middleware; reconnect with exponential backoff; nanostore bridge; security close-on-logout.

---

#### [P2A.4.1] Progress event contract + shared types

**Parent:** [P2A.4](Baseout_Backlog.md) · **Repo:** `baseout-web`, `baseout-backup-engine`, `baseout-ui` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Single source of truth for the WebSocket payload shape. Shared between emitter (SpaceController DO) and consumer (dashboard).

##### Spec references
- [Baseout_PRD.md §7.6](Baseout_PRD.md) — WebSockets.
- [Baseout_PRD.md §4.4](Baseout_PRD.md) — real-time progress.

##### Canonical terms
Backup Run.

##### Files to touch
- `baseout-ui/src/types/progress.ts` (new) — `ProgressEvent` discriminated union.
- `baseout-backup-engine/src/types/progress.ts` (new, re-exports the same shape).

##### Failing test to write first
- **File:** `tests/types/progress.test.ts` (both repos)
- **Cases:** `start`, `progress`, `complete`, `failed` variants serialise/deserialise identically; unknown `type` rejected by a typed parser.

##### Implementation notes
- Include monotonically increasing `seq` for ordering.
- No PII in payload (record IDs only).

##### Acceptance criteria
- [ ] Discriminated union covers all run transitions.
- [ ] No `any` types.
- [ ] Coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P1B.2
- **Blocks:** P2A.4.2, P2A.4.3, P2A.4.4

##### Out of scope
- Emission logic (P2A.4.2).

---

#### [P2A.4.2] WebSocket route `/api/spaces/:id/progress` with session auth

**Parent:** [P2A.4](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Cloudflare Workers WebSocket upgrade that authenticates via session cookie, resolves the Space, and proxies to the SpaceController Durable Object.

##### Spec references
- [Baseout_PRD.md §7.6](Baseout_PRD.md).
- [Baseout_PRD.md §20](Baseout_PRD.md) — security.

##### Canonical terms
Space, Backup Run.

##### Files to touch
- `src/pages/api/spaces/[id]/progress.ts` (new) — handles `Upgrade: websocket`.
- `src/middleware.ts` (modified) — permit WS upgrade through auth middleware.

##### Failing test to write first
- **File:** `tests/api/progress.ws.test.ts`
- **Cases:** unauthenticated upgrade → 401 + close; Space in another Org → 403 + close; authorized upgrade routes to DO and forwards frames; close on session invalidation.

##### Implementation notes
- Cookie validated before `accept()`.
- Forward frames unchanged; do not re-parse on the Worker.

##### Acceptance criteria
- [ ] Unauthorized upgrades closed with 1008.
- [ ] Authorized session forwards ProgressEvent frames.
- [ ] Connection closed if session invalidated mid-stream.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2A.4.1, P1B.2
- **Blocks:** P2A.4.3

##### Security 🔒
- Session cookie required before `accept()`.
- Close on logout (clears WS per CLAUDE.md §2).
- No sensitive payload in frames — verify shape in tests.

##### Out of scope
- Horizontal scaling via DO stubs (inherited from P1B.2).

---

#### [P2A.4.3] Browser client with exponential backoff reconnect

**Parent:** [P2A.4](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Client-side `ProgressClient` reconnects with exponential backoff (jittered, 1s → 30s cap) and exposes a typed event stream.

##### Spec references
- [Baseout_PRD.md §7.6](Baseout_PRD.md).

##### Canonical terms
Backup Run.

##### Files to touch
- `src/lib/progressClient.ts` (new).

##### Failing test to write first
- **File:** `tests/lib/progressClient.test.ts`
- **Cases:** reconnects after drop with increasing delays; stops after logout event; delivers typed events; drops malformed frames.

##### Implementation notes
- Use `AbortController` for cancellation on logout.
- Cap retries at 30s; reset on clean close.

##### Acceptance criteria
- [ ] Reconnect interval doubles until cap.
- [ ] Stops on logout signal from auth store.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2A.4.2
- **Blocks:** P2A.4.4

##### Out of scope
- Server-side heartbeat (covered by P1B.2).

---

#### [P2A.4.4] nanostore bridge + logout teardown

**Parent:** [P2A.4](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Bridge `ProgressClient` events into `backupStatus` + a new `progressEvents` store, and tear them both down on logout.

##### Spec references
- [CLAUDE.md §4](../.claude/CLAUDE.md) — nanostore teardown on logout.

##### Canonical terms
Backup Run.

##### Files to touch
- `src/stores/progress.ts` (new).
- `src/lib/authClient.ts` (modified) — logout hook clears store.

##### Failing test to write first
- **File:** `tests/stores/progress.test.ts`
- **Cases:** new frame updates store; logout closes socket and resets store; stores never hold auth tokens.

##### Implementation notes
- Computed value exposes latest per-Space ProgressEvent.

##### Acceptance criteria
- [ ] Logout closes socket and clears store.
- [ ] No secrets in store (asserted in test).
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2A.4.3
- **Blocks:** P2A.4.5

##### Security 🔒
- Token/session never stored in-browser store.
- Store reset on logout.

##### Out of scope
- Multi-Space fan-out (single active Space only in V1).

---

#### [P2A.4.5] Integration test — fake run emits events within 1s

**Parent:** [P2A.4](Baseout_Backlog.md) · **Repo:** `baseout-web`, `baseout-backup-engine` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
End-to-end integration: trigger a fake run; assert the browser store observes `start → progress → complete` events, all within 1s of emission, plus one reconnect cycle.

##### Spec references
- [Baseout_PRD.md §14.5](Baseout_PRD.md) — critical E2E flows.

##### Canonical terms
Backup Run, Space.

##### Files to touch
- `tests/integration/progress-e2e.test.ts` (new).
- `baseout-backup-engine/tests/fakeRun.ts` (new).

##### Failing test to write first
- Same file above; drives the P1B.2 DO with fixture payloads.

##### Implementation notes
- Miniflare WebSocket supported via the `WebSocketPair` shim.
- Assert `seq` ordering.

##### Acceptance criteria
- [ ] All three events observed within 1s.
- [ ] Reconnect cycle tested.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2A.4.4, P1B.2
- **Blocks:** none

##### Out of scope
- Cross-tab sync.

---

### P2A.5

**Parent:** [P2A.5 Storage usage summary](Baseout_Backlog.md) · granularity: `chunk` · Blocks: nothing directly (feeds quota awareness).

Dashboard widget rendering R2 + destination usage vs tier cap with 75/90/100% threshold states and upgrade CTA.

---

#### [P2A.5.1] Usage snapshot API + tier cap resolver

**Parent:** [P2A.5](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Returns a Space's current storage usage vs the tier cap resolved from Stripe metadata via `resolveCapability()` (P1C.3.1).

##### Spec references
- [Baseout_Features.md §4.1](Baseout_Features.md) — managed storage caps.
- [Baseout_Features.md §5.5.6](Baseout_Features.md) — capability resolver.

##### Canonical terms
Space, Storage Destination, R2, Tier, Capability.

##### Files to touch
- `src/pages/api/spaces/[id]/usage.ts` (new).
- `src/lib/quota.ts` (new) — aggregates usage values.

##### Failing test to write first
- **File:** `tests/api/usage.test.ts`
- **Cases:** returns `{ r2Bytes, destBytes, capBytes, pct }`; respects tier resolved from Stripe metadata (not product name); 403 outside Org.

##### Implementation notes
- Use `resolveCapability({ platform, tier })` from P1C.3.1.
- Never parse product name — metadata only.

##### Acceptance criteria
- [ ] `pct` computed correctly at boundary values (0, 75, 90, 100).
- [ ] Capability resolved from metadata only.
- [ ] No `any` types; coverage per PRD §14.4 (API 75%).

##### Dependencies
- **Blocked by:** P1C.3.1, P2C.6.*
- **Blocks:** P2A.5.2

##### Out of scope
- Background re-computation (P2C.6 handles daily rollups).

---

#### [P2A.5.2] StorageUsageSummary component with threshold colors

**Parent:** [P2A.5](Baseout_Backlog.md) · **Repo:** `baseout-web`, `baseout-ui` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Renders a usage bar with color states at 75% warn / 90% critical / 100% block. Mobile-first.

##### Spec references
- [Baseout_PRD.md §6.2](Baseout_PRD.md).
- [Baseout_Features.md §5.3](Baseout_Features.md) — threshold notifications.

##### Canonical terms
Space, Storage Destination, R2.

##### Files to touch
- `baseout-ui/src/components/StorageUsageSummary.astro` (new).
- `src/pages/dashboard/index.astro` (modified).

##### Failing test to write first
- **File:** `tests/components/StorageUsageSummary.test.ts`
- **Cases:** 50% → default color; 80% → warn; 95% → critical; 100% → block; upgrade CTA ≥ 44×44px; mobile viewport < 375px renders.

##### Implementation notes
- Use `@opensided/theme` tokens; avoid hardcoded hex.
- Color contrast WCAG AA ≥ 4.5:1.

##### Acceptance criteria
- [ ] All threshold states render correct color.
- [ ] Upgrade CTA ≥ 44×44px.
- [ ] Mobile-first layout.
- [ ] No `any` types; coverage per PRD §14.4 (UI 60%).

##### Dependencies
- **Blocked by:** P2A.5.1
- **Blocks:** P2A.5.3

##### Out of scope
- Billing page integration.

---

#### [P2A.5.3] Upgrade CTA routing + stub billing target

**Parent:** [P2A.5](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
When usage crosses 75% the CTA links to `/billing?reason=storage` (the real billing page lands in P4A.2); verify link routing + analytics event.

##### Spec references
- [Baseout_PRD.md §6.2](Baseout_PRD.md).

##### Canonical terms
Subscription, Tier, Overage.

##### Files to touch
- `src/pages/billing/index.astro` (new stub).
- `src/lib/analytics.ts` (modified) — emit `upgrade_cta_click`.

##### Failing test to write first
- **File:** `tests/components/StorageUsageSummary.route.test.ts`
- **Cases:** CTA href equals `/billing?reason=storage` above 75%; analytics event emitted on click.

##### Implementation notes
- Stub billing page shows "Coming soon in P4A.2".

##### Acceptance criteria
- [ ] CTA routes correctly.
- [ ] Analytics emitted once per click.
- [ ] Touch target ≥ 44×44px.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2A.5.2
- **Blocks:** none (superseded in P4A.2)

##### Out of scope
- Full billing page.

---

### P2A.6

**Parent:** [P2A.6 Notification / action items panel](Baseout_Backlog.md) · granularity: `chunk` · Blocks: none directly (consumes 2C outputs).

Collates failures, quota warnings, dead-connection prompts into one panel with action CTAs.

---

#### [P2A.6.1] Notification feed API with severity sort

**Parent:** [P2A.6](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
`GET /api/notifications?space=` returns current Org + Space alerts sorted by severity then recency. Reads `notification_log` + run failures.

##### Spec references
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `notification_log`.
- [Baseout_Features.md §16.2](Baseout_Features.md) — notification types.

##### Canonical terms
Organization, Space, Notification, Alert, Connection.

##### Files to touch
- `src/pages/api/notifications.ts` (new).
- `src/db/queries/notifications.ts` (new).

##### Failing test to write first
- **File:** `tests/api/notifications.test.ts`
- **Cases:** high severity (failure, dead-connection, 100% quota) sorts above medium (90%) above low (75%); scoped by Org + Space; read/unread state returned per user.

##### Implementation notes
- `read_at` column on a new `notification_read` table (keyed by user_id + notification_id) — migration part of this sub-issue.

##### Acceptance criteria
- [ ] Severity ordering asserted.
- [ ] Per-user read state honored.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P0.7.5, P2C.*
- **Blocks:** P2A.6.2

##### Out of scope
- Notification dismissal UX (P2A.6.3).

---

#### [P2A.6.2] Notification panel component

**Parent:** [P2A.6](Baseout_Backlog.md) · **Repo:** `baseout-web`, `baseout-ui` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Panel rendering alerts with an action CTA (reconnect, upgrade, retry run).

##### Spec references
- [Baseout_PRD.md §6.2](Baseout_PRD.md).

##### Canonical terms
Notification, Alert, Connection.

##### Files to touch
- `baseout-ui/src/components/NotificationPanel.astro` (new).
- `src/pages/dashboard/index.astro` (modified).

##### Failing test to write first
- **File:** `tests/components/NotificationPanel.test.ts`
- **Cases:** unread dot renders; severity color; action CTA per type; ≥ 44×44px per item; mobile < 375px renders stacked.

##### Implementation notes
- `@opensided/theme` list primitive first.

##### Acceptance criteria
- [ ] Each notification type maps to correct CTA.
- [ ] Mobile-first; tap targets ≥ 44×44px.
- [ ] No `any` types; coverage per PRD §14.4 (UI 60%).

##### Dependencies
- **Blocked by:** P2A.6.1
- **Blocks:** P2A.6.3

##### Out of scope
- Mark-read round-trip (P2A.6.3).

---

#### [P2A.6.3] Mark-read + dismiss flow + Playwright smoke

**Parent:** [P2A.6](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
PATCH endpoint to mark a notification read + Playwright scenario that seeds multiple notifications and asserts panel ordering + dismiss.

##### Spec references
- [Baseout_PRD.md §14.5](Baseout_PRD.md).

##### Canonical terms
Notification.

##### Files to touch
- `src/pages/api/notifications/[id]/read.ts` (new).
- `tests/e2e/notifications.spec.ts` (new).

##### Failing test to write first
- Playwright: seed 3 notifications → panel shows sorted → click mark-read → unread dot gone.

##### Implementation notes
- CSRF token on PATCH (Better Auth helper per CLAUDE.md §2).

##### Acceptance criteria
- [ ] Mark-read persists across reload.
- [ ] Panel sorts correctly.
- [ ] Touch target ≥ 44×44px.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2A.6.2
- **Blocks:** none

##### Out of scope
- Bulk mark-all-read.

---

### P2B.1

**Parent:** [P2B.1 Point-in-time snapshot selection UI](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P2B.2, P2B.3.

UI wizard step that lists Backup Snapshots for a Space with timestamp, metrics, and date-range filter, then advances to the scope picker.

---

#### [P2B.1.1] Snapshot list API (successful + trial_complete runs)

**Parent:** [P2B.1](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:restore`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
`GET /api/spaces/:id/snapshots` returns Backup Snapshots sourced from `backup_runs` where `status in ('success', 'trial_complete')`.

##### Spec references
- [Baseout_PRD.md §2.7](Baseout_PRD.md) — restore snapshot selection.
- [Baseout_PRD.md §2.3](Baseout_PRD.md) — restore scope.

##### Canonical terms
Backup Snapshot, Restore, Space.

##### Files to touch
- `src/pages/api/spaces/[id]/snapshots.ts` (new).
- `src/db/queries/snapshots.ts` (new).

##### Failing test to write first
- **File:** `tests/api/snapshots.test.ts`
- **Cases:** only `success` / `trial_complete` runs returned; failed runs excluded; date-range filter respected; 403 outside Org.

##### Implementation notes
- Reuse cursor pagination helper from P2A.3.1.

##### Acceptance criteria
- [ ] Status filter enforced server-side.
- [ ] Date-range filter works.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2A.3.1
- **Blocks:** P2B.1.2

##### Out of scope
- Engine-level snapshot validation.

---

#### [P2B.1.2] Snapshot picker component with date filter

**Parent:** [P2B.1](Baseout_Backlog.md) · **Repo:** `baseout-web`, `baseout-ui` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:restore`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Lists snapshots, supports date-range filter, radio-select a snapshot, advance button to scope picker.

##### Spec references
- [Baseout_PRD.md §2.7](Baseout_PRD.md).

##### Canonical terms
Backup Snapshot, Restore.

##### Files to touch
- `baseout-ui/src/components/SnapshotPicker.astro` (new).
- `src/pages/restore/select.astro` (new).
- `src/stores/restoreWizard.ts` (new) — stash selected snapshot id.

##### Failing test to write first
- **File:** `tests/components/SnapshotPicker.test.ts`
- **Cases:** list renders with timestamps + counts; date filter narrows list; selecting a snapshot enables advance; advance navigates to `/restore/scope`; radio tap target ≥ 44×44px; mobile < 375px renders.

##### Implementation notes
- `@opensided/theme` radio + list primitives first.

##### Acceptance criteria
- [ ] Selection state stored in `restoreWizard`.
- [ ] Mobile-first layout; touch targets ≥ 44×44px.
- [ ] No `any` types; coverage per PRD §14.4 (UI 60%).

##### Dependencies
- **Blocked by:** P2B.1.1
- **Blocks:** P2B.1.3, P2B.2.*, P2B.3.*

##### Out of scope
- Scope picker (lives in P2B.2 / P2B.3).

---

#### [P2B.1.3] Playwright — pick snapshot → proceed to scope

**Parent:** [P2B.1](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:restore`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Playwright scenario per PRD §2.7 — pick a snapshot, advance to scope picker.

##### Spec references
- [Baseout_PRD.md §14.5](Baseout_PRD.md).

##### Canonical terms
Backup Snapshot, Restore.

##### Files to touch
- `tests/e2e/snapshot-picker.spec.ts` (new).

##### Failing test to write first
- Scenario: open restore → select snapshot → click Continue → URL `/restore/scope?snapshot=<id>`.

##### Implementation notes
- Mobile device profile included.

##### Acceptance criteria
- [ ] Scenario green.
- [ ] Mobile profile passes; touch targets ≥ 44×44px.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.1.2
- **Blocks:** P2B.2.*, P2B.3.*

##### Out of scope
- Scope picker + dispatch (subsequent parents).

---

### P2B.2

**Parent:** [P2B.2 Base-level restore](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P2B.6.

Whole-Base restore — dispatches a Trigger.dev job and streams progress via existing WebSocket plumbing. Never overwrites existing data.

---

#### [P2B.2.1] Restore job contract types + payload validator

**Parent:** [P2B.2](Baseout_Backlog.md) · **Repo:** `baseout-web`, `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Shared `RestoreJobInput` / `RestoreJobResult` types. Server-side Zod validation on dispatch.

##### Spec references
- [Baseout_PRD.md §2.3](Baseout_PRD.md) — restore V1 scope.

##### Canonical terms
Backup Snapshot, Restore, Base, Table.

##### Files to touch
- `baseout-backup-engine/src/restore/types.ts` (new).
- `src/lib/validators/restore.ts` (new) — Zod schemas.

##### Failing test to write first
- **File:** `tests/lib/restoreValidator.test.ts`
- **Cases:** valid base-level payload parses; missing `snapshotId` rejected; `destination.kind` required (`existing | new`); never accept `overwrite: true`.

##### Implementation notes
- Server-side validation only — never trust client.

##### Acceptance criteria
- [ ] Zod + shared types.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.1.2
- **Blocks:** P2B.2.2, P2B.3.*, P2B.4.*, P2B.5.*

##### Out of scope
- Engine implementation (P2B.2.4).

---

#### [P2B.2.2] Capability check + dispatch endpoint

**Parent:** [P2B.2](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
`POST /api/restores` validates input, resolves Capability (gates Growth+ features later), and dispatches a Trigger.dev job using the P1B.9 pattern.

##### Spec references
- [Baseout_Features.md §6.4](Baseout_Features.md) — restore gates.
- [Baseout_Features.md §5.5.6](Baseout_Features.md) — resolver.

##### Canonical terms
Restore, Capability, Subscription, Tier.

##### Files to touch
- `src/pages/api/restores/index.ts` (new).
- `src/lib/restore/dispatch.ts` (new) — Trigger.dev client.

##### Failing test to write first
- **File:** `tests/api/restores.dispatch.test.ts`
- **Cases:** valid payload dispatches; 400 on invalid; 403 on Capability denial (future-proof for Growth+); CSRF enforced.

##### Implementation notes
- Reuse `resolveCapability()` from P1C.3.1.
- Return `{ runId }` for progress subscription.

##### Acceptance criteria
- [ ] Dispatch succeeds for Starter+ base-level.
- [ ] CSRF required.
- [ ] No `any` types; coverage per PRD §14.4 (API 75%).

##### Dependencies
- **Blocked by:** P2B.2.1, P1B.9, P1C.3.1
- **Blocks:** P2B.2.4

##### Out of scope
- Engine execution (P2B.2.4).

---

#### [P2B.2.3] Restore scope picker UI (base vs table)

**Parent:** [P2B.2](Baseout_Backlog.md) · **Repo:** `baseout-web`, `baseout-ui` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Scope picker page — select base-level OR table-level; routes to destination step.

##### Spec references
- [Baseout_PRD.md §2.3](Baseout_PRD.md).

##### Canonical terms
Backup Snapshot, Restore, Base, Table.

##### Files to touch
- `src/pages/restore/scope.astro` (new).
- `baseout-ui/src/components/RestoreScopePicker.astro` (new).

##### Failing test to write first
- **File:** `tests/components/RestoreScopePicker.test.ts`
- **Cases:** base radio advances to destination; table radio reveals Table list (from P2B.3); ≥ 44×44px selection; mobile < 375px.

##### Implementation notes
- Reuse `restoreWizard` store.

##### Acceptance criteria
- [ ] Choice persisted in wizard store.
- [ ] Mobile-first; touch targets ≥ 44×44px.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.2.2
- **Blocks:** P2B.2.5, P2B.3.*

##### Out of scope
- Destination picker (P2B.4 / P2B.5).

---

#### [P2B.2.4] Engine: base-level restore orchestration

**Parent:** [P2B.2](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** L

##### Context
Orchestrates the base-level restore: load snapshot from Storage Destination, resolve Table dependency order (P2B.4 logic), stream progress events, finalize run record.

##### Spec references
- [Baseout_PRD.md §2.3](Baseout_PRD.md).
- [Baseout_PRD.md §4.4](Baseout_PRD.md).

##### Canonical terms
Backup Snapshot, Restore, Base, Table.

##### Files to touch
- `src/restore/baseLevelRestore.ts` (new).
- `src/restore/index.ts` (new — public entry).

##### Failing test to write first
- **File:** `tests/restore/baseLevelRestore.test.ts`
- **Cases:** successful restore emits `start → progress* → complete`; failed mid-run emits `failed` with error; never writes to live tables; dependency order honored.

##### Implementation notes
- Progress events align with P2A.4.1 contract.
- Use msw for Airtable API boundary.

##### Acceptance criteria
- [ ] Dependency-ordered writes.
- [ ] Progress events emitted.
- [ ] No `any` types; coverage per PRD §14.4 (engine 80%).

##### Dependencies
- **Blocked by:** P2B.2.2, P2B.4.*, P2B.5.*, P1D.1
- **Blocks:** P2B.2.6, P2B.6.*

##### Out of scope
- Subset selection (P2B.3).

---

#### [P2B.2.5] Destination chooser + review page

**Parent:** [P2B.2](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Destination chooser — existing Base vs new Base — + review & submit page that POSTs to `/api/restores`.

##### Spec references
- [Baseout_PRD.md §2.3](Baseout_PRD.md).

##### Canonical terms
Base, Restore.

##### Files to touch
- `src/pages/restore/destination.astro` (new).
- `src/pages/restore/review.astro` (new).

##### Failing test to write first
- **File:** `tests/e2e/restore-base.spec.ts`
- **Cases:** choose existing Base → review → submit → redirects to run page; choose new Base → collects Workspace ID → review → submit; CSRF present; mobile passes; touch targets ≥ 44×44px.

##### Implementation notes
- Validate Workspace ID client-side (UX) + server-side (security).

##### Acceptance criteria
- [ ] Both destination paths submit successfully.
- [ ] CSRF enforced.
- [ ] Mobile + 44×44px touch targets.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.2.3, P2B.2.4
- **Blocks:** P2B.2.6

##### Out of scope
- Subset table selection (P2B.3).

---

#### [P2B.2.6] E2E — backup → restore → counts match

**Parent:** [P2B.2](Baseout_Backlog.md) · **Repo:** `baseout-web`, `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** L

##### Context
Full happy path: seed a backup → run restore to new Base → assert record counts match snapshot.

##### Spec references
- [Baseout_PRD.md §14.5](Baseout_PRD.md).

##### Canonical terms
Backup Snapshot, Restore, Base.

##### Files to touch
- `tests/e2e/restore-happy-path.spec.ts` (new).
- `tests/e2e/fixtures/airtable-sandbox.ts` (new).

##### Failing test to write first
- Same file above; fails until all P2B.2 sub-issues land.

##### Implementation notes
- Airtable sandbox account via env var; skipped in CI if missing credential.

##### Acceptance criteria
- [ ] Counts match across Schema, Records, Attachments.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.2.5, P2B.4.*, P2B.5.*
- **Blocks:** P2B.6.*

##### Out of scope
- Post-restore audit (P2B.6).

---

### P2B.3

**Parent:** [P2B.3 Table-level restore](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P2B.6.

Subset restore — user picks one or more Tables from a snapshot; engine respects the subset.

---

#### [P2B.3.1] Snapshot → Table inventory endpoint

**Parent:** [P2B.3](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
`GET /api/snapshots/:id/tables` returns the Table list stored in a snapshot, so the picker can render multi-select.

##### Spec references
- [Baseout_PRD.md §2.3](Baseout_PRD.md).

##### Canonical terms
Backup Snapshot, Table.

##### Files to touch
- `src/pages/api/snapshots/[id]/tables.ts` (new).
- `src/db/queries/snapshots.ts` (modified).

##### Failing test to write first
- **File:** `tests/api/snapshot-tables.test.ts`
- **Cases:** returns Table list with counts; 403 outside Org; 404 for unknown snapshot.

##### Implementation notes
- Read from snapshot metadata row (schema set in P1B).

##### Acceptance criteria
- [ ] Correct Table inventory.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.1.1
- **Blocks:** P2B.3.2

##### Out of scope
- Engine subset logic (P2B.3.3).

---

#### [P2B.3.2] Multi-select Table picker

**Parent:** [P2B.3](Baseout_Backlog.md) · **Repo:** `baseout-web`, `baseout-ui` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Multi-select list of Tables with select-all, count summary, mobile card layout.

##### Spec references
- [Baseout_PRD.md §2.3](Baseout_PRD.md).

##### Canonical terms
Table, Restore.

##### Files to touch
- `baseout-ui/src/components/TableMultiPicker.astro` (new).
- `src/pages/restore/tables.astro` (new).

##### Failing test to write first
- **File:** `tests/components/TableMultiPicker.test.ts`
- **Cases:** select-all toggles; individual select updates count; advance disabled if zero selected; ≥ 44×44px checkbox targets; mobile < 375px renders.

##### Implementation notes
- Use `@opensided/theme` checkbox primitive first.

##### Acceptance criteria
- [ ] Selection state in `restoreWizard`.
- [ ] Mobile + 44×44px.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.3.1, P2B.2.3
- **Blocks:** P2B.3.3, P2B.3.4

##### Out of scope
- Engine subset logic.

---

#### [P2B.3.3] Engine: subset Table restore

**Parent:** [P2B.3](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Extends the orchestrator to respect a `tables: string[]` filter while still honoring dependency order for linked Records.

##### Spec references
- [Baseout_PRD.md §2.3](Baseout_PRD.md).

##### Canonical terms
Restore, Table.

##### Files to touch
- `src/restore/tableLevelRestore.ts` (new).
- `src/restore/dependencyOrder.ts` (new or modified from P2B.4).

##### Failing test to write first
- **File:** `tests/restore/tableLevelRestore.test.ts`
- **Cases:** 3-table base, restore 2 → only 2 written; dependency order honored even when parent table is excluded (skip + warn event).

##### Implementation notes
- Emit `warning` progress event when linked-record parent is missing.

##### Acceptance criteria
- [ ] Subset respected.
- [ ] Dependency warnings emitted.
- [ ] No `any` types; coverage per PRD §14.4 (engine 80%).

##### Dependencies
- **Blocked by:** P2B.2.4, P2B.4.*, P2B.5.*
- **Blocks:** P2B.3.4

##### Out of scope
- Parent-table auto-pull (future V1.1).

---

#### [P2B.3.4] Dispatch wiring — table-level path

**Parent:** [P2B.3](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Enables the table-level branch through `/api/restores` and the review page.

##### Spec references
- [Baseout_PRD.md §2.3](Baseout_PRD.md).

##### Canonical terms
Restore, Table.

##### Files to touch
- `src/pages/restore/review.astro` (modified).
- `src/lib/restore/dispatch.ts` (modified).

##### Failing test to write first
- **File:** `tests/api/restores.table.test.ts`
- **Cases:** payload with `scope: 'table'` + Table IDs dispatches; empty Tables array → 400.

##### Implementation notes
- Reuse validator from P2B.2.1.

##### Acceptance criteria
- [ ] Table-level POST dispatches job.
- [ ] CSRF enforced.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.3.3
- **Blocks:** P2B.3.5

##### Out of scope
- Engine logic (P2B.3.3).

---

#### [P2B.3.5] Integration — 3-table base, 2 restored

**Parent:** [P2B.3](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Integration scenario from PRD §2.3 — 3 tables, restore 2, asserted on sandbox.

##### Spec references
- [Baseout_PRD.md §14.5](Baseout_PRD.md).

##### Canonical terms
Backup Snapshot, Restore, Table.

##### Files to touch
- `tests/integration/subset-restore.test.ts` (new).

##### Failing test to write first
- Same file above.

##### Implementation notes
- msw-mocked sandbox; deterministic counts.

##### Acceptance criteria
- [ ] Counts match expectation.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.3.4
- **Blocks:** P2B.6.*

##### Out of scope
- E2E browser test (covered in P2B.2.6).

---

### P2B.4

**Parent:** [P2B.4 Restore destination: existing Base](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P2B.2, P2B.3. 🔒 restore write path.

Writes restored Tables as **new** tables into an existing Base — never modifies existing tables. Table names suffixed with `-restore-{timestamp}`.

---

#### [P2B.4.1] Airtable meta API client: create table + field mapper

**Parent:** [P2B.4](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Thin client around `POST /meta/bases/{baseId}/tables`. Maps snapshot Field types to Airtable's write API.

##### Spec references
- [Baseout_PRD.md §2.3](Baseout_PRD.md).
- [Baseout_PRD.md §20](Baseout_PRD.md) — OAuth scopes.

##### Canonical terms
Base, Table, Field.

##### Files to touch
- `src/platform/airtable/metaClient.ts` (new or modified from P1B.1).
- `src/platform/airtable/fieldMap.ts` (new).

##### Failing test to write first
- **File:** `tests/platform/airtable/metaClient.test.ts`
- **Cases:** create-table payload shape; unknown Field type → mapped to `singleLineText` with warning; 401 surfaces as re-auth needed.

##### Implementation notes
- OAuth token decrypted at call time via `src/lib/crypto.ts`.

##### Acceptance criteria
- [ ] Known Field types mapped.
- [ ] Auth errors surface for P2C.3 flow.
- [ ] No `any` types; coverage per PRD §14.4 (engine 80%).

##### Dependencies
- **Blocked by:** P1B.1, P0.7.3
- **Blocks:** P2B.4.2, P2B.4.3, P2B.4.6

##### Security 🔒
- Least-privilege scope (`schema.bases:write` only when invoked).
- Token never logged.

##### Out of scope
- Record writes (P2B.4.3).

---

#### [P2B.4.2] Table name suffixing + collision handling

**Parent:** [P2B.4](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Computes `"{originalName}-restore-{isoTimestamp}"` with collision fallback (`-restore-{ts}-{n}`).

##### Spec references
- [Baseout_PRD.md §2.3](Baseout_PRD.md) — restore creates new data.

##### Canonical terms
Table, Restore.

##### Files to touch
- `src/restore/tableName.ts` (new).

##### Failing test to write first
- **File:** `tests/restore/tableName.test.ts`
- **Cases:** standard suffix format; second collision appends `-2`; Airtable 20-byte limit truncates original name gracefully.

##### Implementation notes
- Deterministic from `snapshotId + tableId + ts` for idempotent retries.

##### Acceptance criteria
- [ ] Collision handled.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** none (pure)
- **Blocks:** P2B.4.3

##### Out of scope
- Writing to Airtable (P2B.4.3).

---

#### [P2B.4.3] Record writer with rate-limit awareness

**Parent:** [P2B.4](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Batches Records into Airtable's 10-per-request write API respecting the DO-based rate-limit gateway (P1B.2).

##### Spec references
- [Baseout_PRD.md §4.2](Baseout_PRD.md) — DO as rate-limit gateway.

##### Canonical terms
Table, Record, Restore.

##### Files to touch
- `src/platform/airtable/recordWriter.ts` (new).

##### Failing test to write first
- **File:** `tests/platform/airtable/recordWriter.test.ts`
- **Cases:** 25 records → 3 batches; 429 response → backoff + retry; 401 → re-auth-needed signal.

##### Implementation notes
- Defer rate-limit to DO; record writer only backs off on 429 + jitter.

##### Acceptance criteria
- [ ] Batch size 10.
- [ ] 429 retried with backoff.
- [ ] No `any` types; coverage per PRD §14.4 (engine 80%).

##### Dependencies
- **Blocked by:** P2B.4.1, P1B.2
- **Blocks:** P2B.4.4, P2B.4.5

##### Security 🔒
- Token decrypted per-request; never cached in plaintext beyond call scope.

##### Out of scope
- Linked-record ordering (P2B.4.4).

---

#### [P2B.4.4] Linked-record dependency order resolver

**Parent:** [P2B.4](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Topologically sorts Tables so referenced records are written before referring Records.

##### Spec references
- [Baseout_PRD.md §2.3](Baseout_PRD.md).

##### Canonical terms
Table, Field, Record, Restore.

##### Files to touch
- `src/restore/dependencyOrder.ts` (new).

##### Failing test to write first
- **File:** `tests/restore/dependencyOrder.test.ts`
- **Cases:** linear chain sorted; diamond dependency sorted; cycle detected → error; map-only schema passes through.

##### Implementation notes
- Kahn's algorithm; deterministic ordering tie-break on Table id.

##### Acceptance criteria
- [ ] Cycles surfaced explicitly.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.4.3
- **Blocks:** P2B.4.5

##### Out of scope
- Mapping old → new linked-record IDs (P2B.4.5).

---

#### [P2B.4.5] Attachment re-upload via Storage Destination

**Parent:** [P2B.4](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Streams Attachments from snapshot storage back into Airtable, using proxy stream for Dropbox/Box.

##### Spec references
- [Baseout_PRD.md §2.8](Baseout_PRD.md) — attachment handling.

##### Canonical terms
Attachment, Storage Destination, R2, Restore.

##### Files to touch
- `src/restore/attachmentReupload.ts` (new).

##### Failing test to write first
- **File:** `tests/restore/attachmentReupload.test.ts`
- **Cases:** R2-sourced attachment streams directly; Dropbox-sourced uses proxy; expired URL → refresh before upload.

##### Implementation notes
- Reuse `StorageDestination` interface from P1D.1.

##### Acceptance criteria
- [ ] Proxy vs direct streaming correctly selected.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.4.4, P1D.1
- **Blocks:** P2B.4.6

##### Security 🔒
- Storage Destination OAuth token decrypted per-call.
- No raw URL logging.

##### Out of scope
- Dedup checks (done in original backup pipeline).

---

#### [P2B.4.6] Airtable sandbox integration test

**Parent:** [P2B.4](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Integration test hitting a real Airtable sandbox account to assert create-table + record write + attachment re-upload succeed.

##### Spec references
- [Baseout_PRD.md §14.3](Baseout_PRD.md).

##### Canonical terms
Base, Table, Record, Attachment, Restore.

##### Files to touch
- `tests/integration/existing-base-restore.test.ts` (new).

##### Failing test to write first
- Same file above; skipped without `AIRTABLE_SANDBOX_TOKEN` env.

##### Implementation notes
- Clean-up step deletes any suffixed tables created during the test.

##### Acceptance criteria
- [ ] Integration green locally with env; skipped in CI without credential.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.4.5
- **Blocks:** P2B.2.4

##### Out of scope
- New-Base destination (P2B.5).

---

### P2B.5

**Parent:** [P2B.5 Restore destination: new Base](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P2B.2. 🔒 restore write path.

Creates a new Airtable Base via API and writes all Tables from the snapshot into it.

---

#### [P2B.5.1] Workspace ID validator (client + server)

**Parent:** [P2B.5](Baseout_Backlog.md) · **Repo:** `baseout-web`, `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Before creating a Base, validate the supplied Airtable Workspace ID via the meta API. Implemented both server-side (security) and surfaced client-side (UX).

##### Spec references
- [Baseout_PRD.md §2.3](Baseout_PRD.md).

##### Canonical terms
Base, Connection.

##### Files to touch
- `src/platform/airtable/workspaceCheck.ts` (new).
- `src/pages/api/restores/validate-workspace.ts` (new).

##### Failing test to write first
- **File:** `tests/platform/airtable/workspaceCheck.test.ts`
- **Cases:** valid ID → true; unknown ID → false; insufficient scopes → error.

##### Implementation notes
- Client UI calls the server endpoint — never raw Airtable from the browser.

##### Acceptance criteria
- [ ] Server-side validation is authoritative.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.4.1
- **Blocks:** P2B.5.2, P2B.5.5

##### Out of scope
- Workspace search UI (future).

---

#### [P2B.5.2] Create-Base API client

**Parent:** [P2B.5](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:all`, `🔒 security:auth-path`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Thin wrapper over `POST /meta/bases` with `workspaceId`, `name`, and initial schema.

##### Spec references
- [Baseout_PRD.md §2.3](Baseout_PRD.md).

##### Canonical terms
Base, Table, Field.

##### Files to touch
- `src/platform/airtable/createBase.ts` (new).

##### Failing test to write first
- **File:** `tests/platform/airtable/createBase.test.ts`
- **Cases:** valid payload returns new Base id; 403 surfaces clearly; name too long truncated + warn.

##### Implementation notes
- Base name = `{snapshotBaseName}-restore-{ts}`.

##### Acceptance criteria
- [ ] Happy path green against msw.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.5.1
- **Blocks:** P2B.5.3

##### Security 🔒
- Token decrypted per-call.
- Scope least-privilege: `schema.bases:write`.

##### Out of scope
- Table writes (reused from P2B.4.x).

---

#### [P2B.5.3] New-Base orchestrator

**Parent:** [P2B.5](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Creates new Base, then reuses P2B.4 Table + Record + Attachment writers under the same dependency ordering.

##### Spec references
- [Baseout_PRD.md §2.3](Baseout_PRD.md).

##### Canonical terms
Base, Restore.

##### Files to touch
- `src/restore/newBaseRestore.ts` (new).

##### Failing test to write first
- **File:** `tests/restore/newBaseRestore.test.ts`
- **Cases:** creates Base → writes Tables in dependency order → attachments re-uploaded → progress events emitted; failed Base creation → run marked failed.

##### Implementation notes
- Rollback: if any Table write fails, emit warning — do NOT delete the new Base (user may want to inspect).

##### Acceptance criteria
- [ ] Orchestration succeeds.
- [ ] Failure surfaces clearly.
- [ ] No `any` types; coverage per PRD §14.4 (engine 80%).

##### Dependencies
- **Blocked by:** P2B.5.2, P2B.4.5
- **Blocks:** P2B.5.4, P2B.2.4

##### Security 🔒
- Token handling identical to P2B.4.1.

##### Out of scope
- Audit (P2B.6).

---

#### [P2B.5.4] Dispatch wiring — new-Base branch

**Parent:** [P2B.5](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
`destination.kind = 'new'` path on `/api/restores` dispatches the new-Base orchestrator.

##### Spec references
- [Baseout_PRD.md §2.3](Baseout_PRD.md).

##### Canonical terms
Base, Restore.

##### Files to touch
- `src/lib/restore/dispatch.ts` (modified).

##### Failing test to write first
- **File:** `tests/api/restores.newbase.test.ts`
- **Cases:** `workspaceId` required; dispatch succeeds; invalid workspace → 400.

##### Implementation notes
- Reuse validator from P2B.2.1 + Workspace check from P2B.5.1.

##### Acceptance criteria
- [ ] Branch routes to orchestrator.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.5.3
- **Blocks:** P2B.5.5

##### Out of scope
- UI (covered in P2B.2.5).

---

#### [P2B.5.5] Integration — new-Base count parity

**Parent:** [P2B.5](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Sandbox integration asserting the new Base has the same counts as the snapshot.

##### Spec references
- [Baseout_PRD.md §14.5](Baseout_PRD.md).

##### Canonical terms
Base, Backup Snapshot, Restore.

##### Files to touch
- `tests/integration/new-base-restore.test.ts` (new).

##### Failing test to write first
- Same file above.

##### Implementation notes
- Clean-up deletes the created Base after assertions.

##### Acceptance criteria
- [ ] Counts match.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.5.4
- **Blocks:** P2B.2.6, P2B.6.*

##### Out of scope
- Audit (P2B.6).

---

### P2B.6

**Parent:** [P2B.6 Post-restore verification (Growth+)](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P2A.6 (audit surfaces in panel).

Growth+ only. Compares restored record counts to snapshot, writes audit rows, surfaces failures via notification panel.

---

#### [P2B.6.1] `restore_audit` schema migration

**Parent:** [P2B.6](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:restore`, `tier-gate:growth+`, `🔒 security:new-sql-surface`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
New master-DB table storing per-Table audit results for each Restore.

##### Spec references
- [Baseout_PRD.md §2.10](Baseout_PRD.md) — audit.
- [Baseout_PRD.md §21.3](Baseout_PRD.md).

##### Canonical terms
Restore, Backup Snapshot, Table.

##### Files to touch
- `src/db/schema/restoreAudit.ts` (new).
- `src/db/migrations/XXXX_restore_audit.sql` (new).

##### Failing test to write first
- **File:** `tests/db/restoreAudit.test.ts`
- **Cases:** migration applies cleanly; columns `id, restore_id, table_id, snapshot_count, restored_count, mismatch, notes, created_at`; FK to `backup_runs`.

##### Implementation notes
- Indices on `restore_id` and `(mismatch = true)`.

##### Acceptance criteria
- [ ] Migration reversible.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P0.7.*
- **Blocks:** P2B.6.2, P2B.6.3

##### Security 🔒
- Parameterized Drizzle only.

##### Out of scope
- Writer (P2B.6.3).

---

#### [P2B.6.2] Capability gate — Growth+ check

**Parent:** [P2B.6](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:growth+`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
`isGrowthPlus()` predicate reads Stripe metadata via `resolveCapability()`. Audit only runs for Growth+.

##### Spec references
- [Baseout_Features.md §6.4](Baseout_Features.md).
- [Baseout_Features.md §5.5.6](Baseout_Features.md).

##### Canonical terms
Capability, Tier, Subscription.

##### Files to touch
- `src/restore/capabilityGate.ts` (new).

##### Failing test to write first
- **File:** `tests/restore/capabilityGate.test.ts`
- **Cases:** Growth tier → true; Launch → false; Starter → false; resolves from metadata, not product name (asserted).

##### Implementation notes
- Uses `resolveCapability()` from P1C.3.1.

##### Acceptance criteria
- [ ] Returns correct boolean per tier.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P1C.3.1
- **Blocks:** P2B.6.3, P2B.6.4

##### Out of scope
- UI surfacing.

---

#### [P2B.6.3] Audit writer: compare counts + persist rows

**Parent:** [P2B.6](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:growth+`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
After restore completes, fetch per-Table counts from Airtable and compare to snapshot. Write rows to `restore_audit`.

##### Spec references
- [Baseout_PRD.md §2.10](Baseout_PRD.md).

##### Canonical terms
Restore, Table, Record.

##### Files to touch
- `src/restore/auditWriter.ts` (new).

##### Failing test to write first
- **File:** `tests/restore/auditWriter.test.ts`
- **Cases:** matching counts → no mismatch; short by 1 → mismatch row; Airtable 5xx → audit row with `notes='fetch_failed'`; gated off for non-Growth+ tiers.

##### Implementation notes
- Parameterized Drizzle writes; idempotent on `(restore_id, table_id)`.

##### Acceptance criteria
- [ ] Mismatches persisted.
- [ ] Idempotent re-run.
- [ ] No `any` types; coverage per PRD §14.4 (engine 80%).

##### Dependencies
- **Blocked by:** P2B.6.1, P2B.6.2, P2B.5.3, P2B.3.3
- **Blocks:** P2B.6.4, P2B.6.5

##### Out of scope
- Notification emission (P2B.6.4).

---

#### [P2B.6.4] Notification hook — mismatches surface in panel

**Parent:** [P2B.6](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:growth+`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
On mismatch, emit a notification record (P2A.6.1 consumer).

##### Spec references
- [Baseout_Features.md §16.2](Baseout_Features.md).
- [Baseout_PRD.md §21.3](Baseout_PRD.md).

##### Canonical terms
Notification, Alert, Restore.

##### Files to touch
- `src/restore/auditWriter.ts` (modified).

##### Failing test to write first
- **File:** `tests/restore/auditNotification.test.ts`
- **Cases:** mismatch → notification inserted once; match → no notification; notification payload includes `restoreId`.

##### Implementation notes
- Idempotent notification insertion — dedupe on `(restore_id, type='restore_mismatch')`.

##### Acceptance criteria
- [ ] Notification raised only on mismatch.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.6.3, P2A.6.1
- **Blocks:** P2B.6.5

##### Out of scope
- UI rendering (P2A.6.2).

---

#### [P2B.6.5] Integration — tampered post-restore → flagged

**Parent:** [P2B.6](Baseout_Backlog.md) · **Repo:** `baseout-backup-engine` · **Capability:** restore
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-backup-engine`, `capability:restore`, `tier-gate:growth+`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Integration: run restore → delete one Record via msw → run audit → mismatch flagged.

##### Spec references
- [Baseout_PRD.md §14.5](Baseout_PRD.md).

##### Canonical terms
Restore, Record, Backup Snapshot.

##### Files to touch
- `tests/integration/restore-audit.test.ts` (new).

##### Failing test to write first
- Same file above.

##### Implementation notes
- Deterministic fixture.

##### Acceptance criteria
- [ ] Mismatch flagged; notification raised.
- [ ] No `any` types; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P2B.6.4
- **Blocks:** none

##### Out of scope
- UI E2E.

---



### P2C.1

**Parent:** [P2C.1 Webhook renewal service](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P3B.6.

Airtable webhooks expire at 7 days — the daily cron sweeps and renews every webhook older than 6 days. Structure: contract types → query → renewer → cron wiring → integration.

---

#### [P2C.1.1] Webhook registry query + types

**Parent:** [P2C.1](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Typed query returning every active Airtable webhook past the 6-day renewal threshold. Other cron handlers (P2C.3) reuse the same query shape.

##### Spec references
- [Baseout_PRD.md §2.9](Baseout_PRD.md) — background services.
- [Baseout_Implementation_Plan.md §Phase 2C](Baseout_Implementation_Plan.md) — renewal cadence.

##### Canonical terms
Connection, Webhook, Backup Run.

##### Files to touch
- `baseout-background-services/src/queries/webhooks.ts` (new)
- `baseout-background-services/src/queries/webhooks.test.ts` (new)

##### Failing test to write first
- **File:** `baseout-background-services/src/queries/webhooks.test.ts`
- **Cases:**
  - Returns webhooks where `created_at < now() - 6d` AND `is_dead = false`.
  - Excludes webhooks on invalidated Connections.
  - Orders by oldest-first.
- Command: `npm run test:integration`.

##### Implementation notes
- Reuse Drizzle client from the shared `baseout-background-services` DB module (imports from `src/db/index.ts`).
- Return shape: `Array<{ id, connection_id, organization_id, created_at, external_webhook_id }>`.

##### Acceptance criteria
- [ ] Typed return; no `any`.
- [ ] Empty-state returns `[]` (not null).
- [ ] Coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P0.1.3, P0.7.4
- **Blocks:** P2C.1.3
- **Can run in parallel with:** P2C.1.2

##### Out of scope
- Non-Airtable platforms (V2).

---

#### [P2C.1.2] Airtable webhook renewal client

**Parent:** [P2C.1](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Thin wrapper around `PATCH /v0/bases/{baseId}/webhooks/{id}/refresh` (Airtable Webhooks API). Must handle 401 (token expired — chain to P2C.2) and 404 (webhook deleted upstream).

##### Spec references
- [Baseout_PRD.md §2.9](Baseout_PRD.md).
- [Baseout_PRD.md §20](Baseout_PRD.md) — token handling.

##### Canonical terms
Connection, Webhook, Platform (value: `airtable`).

##### Files to touch
- `baseout-background-services/src/integrations/airtable/webhook-client.ts` (new)
- `baseout-background-services/src/integrations/airtable/webhook-client.test.ts` (new)

##### Failing test to write first
- **File:** `webhook-client.test.ts`
- **Cases:**
  - Happy path: 200 → returns new `expires_at`.
  - 401 → throws `TokenExpiredError` (caught by caller to trigger P2C.2).
  - 404 → throws `WebhookGoneError` (caller marks webhook `is_dead`).
  - 429 → retries once after `Retry-After` header.
- Mocked via `msw`; command: `npm test`.

##### Implementation notes
- Decrypt Connection token via `src/lib/crypto.ts` (from P0.7.3) at call site, pass plaintext in-memory only.
- Typed error classes exported for the handler.

##### Acceptance criteria
- [ ] All four cases green.
- [ ] Token never logged.
- [ ] No `any`; coverage per PRD §14.4.

##### Security 🔒
- Plaintext token held only inside the function's stack frame.

##### Dependencies
- **Blocked by:** P0.7.3, P1B.1.1
- **Blocks:** P2C.1.3
- **Can run in parallel with:** P2C.1.1

##### Out of scope
- Token refresh itself (P2C.2).

---

#### [P2C.1.3] Renewal handler — orchestrate query + renew + log

**Parent:** [P2C.1](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Pure handler function combining P2C.1.1 + P2C.1.2 with persistence + notification hooks. Testable without cron wiring.

##### Spec references
- [Baseout_PRD.md §2.9](Baseout_PRD.md).

##### Canonical terms
Webhook, Connection, Notification.

##### Files to touch
- `baseout-background-services/src/cron/webhook-renewal.ts` (new — handler export only; cron wiring in P2C.1.4).
- `baseout-background-services/src/cron/webhook-renewal.test.ts` (new).

##### Failing test to write first
- **File:** `webhook-renewal.test.ts`
- **Cases:**
  - 3 eligible webhooks → 3 renewal calls → 3 `expires_at` updates.
  - One 401 → chained to token-refresh queue (stubbed by test).
  - One 404 → webhook row marked `is_dead`.
  - Summary row written to `notification_log` on completion.

##### Implementation notes
- Sequential, not parallel — keeps under Airtable per-token rate limit.
- Reuse `notification_log` writer (to be extracted to `src/lib/notifications.ts` in P2C.3.1; for now write directly via Drizzle).

##### Acceptance criteria
- [ ] All cases green.
- [ ] Handler idempotent on partial failure (re-runs skip already-renewed).

##### Dependencies
- **Blocked by:** P2C.1.1, P2C.1.2
- **Blocks:** P2C.1.4
- **Can run in parallel with:** none

##### Out of scope
- Cron trigger registration (P2C.1.4).

---

#### [P2C.1.4] Wrangler cron trigger + `scheduled` entry wiring

**Parent:** [P2C.1](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Wire the handler from P2C.1.3 into the Worker's `scheduled` entry point and declare the cron trigger in `wrangler.toml`.

##### Spec references
- [Baseout_Implementation_Plan.md §Phase 2C](Baseout_Implementation_Plan.md).

##### Canonical terms
N/A.

##### Files to touch
- `baseout-background-services/wrangler.toml` (modified) — add `triggers.crons = ["0 3 * * *"]` (daily 03:00 UTC) under both env blocks.
- `baseout-background-services/src/index.ts` (modified — scaffolded in P0.5.3) — add `scheduled` export that routes by cron expression.
- `baseout-background-services/src/index.test.ts` (modified).

##### Failing test to write first
- **File:** `src/index.test.ts`
- **Cases:**
  - `scheduled` with cron `"0 3 * * *"` invokes the renewal handler.
  - Unknown cron string logs + no-ops (never throws).

##### Implementation notes
- Miniflare test environment supports `scheduled(event, env, ctx)` invocation.

##### Acceptance criteria
- [ ] Dry-run deploy includes the new cron.
- [ ] Miniflare invocation green.

##### Dependencies
- **Blocked by:** P2C.1.3, P0.5.2
- **Blocks:** P2C.1.5
- **Can run in parallel with:** none

##### Out of scope
- Other cron triggers (own parents).

---

#### [P2C.1.5] Integration test — fixture ages webhook + renewal sweeps

**Parent:** [P2C.1](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
End-to-end check against real local Postgres and msw-mocked Airtable.

##### Spec references
- [Baseout_PRD.md §14.2](Baseout_PRD.md) — integration vs real PG.

##### Canonical terms
Webhook.

##### Files to touch
- `baseout-background-services/tests/integration/webhook-renewal.test.ts` (new).

##### Failing test to write first
- Same file.
- **Cases:**
  - Seed a Connection + Webhook with `created_at` 6d ago.
  - Invoke scheduled handler.
  - Assert Webhook row has a fresh `expires_at`.
  - Assert `notification_log` has a summary entry.

##### Implementation notes
- Use the fixture helper from `scripts/seed.ts` (P0.3.2).

##### Acceptance criteria
- [ ] Green in CI with Postgres service container (P0.2.2).

##### Dependencies
- **Blocked by:** P2C.1.4, P0.3.2
- **Blocks:** none (P2C.1 complete)
- **Can run in parallel with:** P2C.2.*

##### Out of scope
- Load / stress testing.

---

### P2C.2

**Parent:** [P2C.2 OAuth token refresh service](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P2C.3.

Refreshes Airtable + Storage Destination OAuth tokens before expiry; re-encrypts with `MASTER_ENCRYPTION_KEY`. Classifies refresh errors (transient vs revoked).

---

#### [P2C.2.1] Refresh-eligible query + error classification types

**Parent:** [P2C.2](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** auth
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:auth`, `🔒 security:auth-path`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Returns Connections whose `token_expires_at` falls within the next 1 hour. Defines `RefreshErrorClass` union (`transient` | `revoked` | `unknown`) used by all subsequent sub-issues.

##### Spec references
- [Baseout_PRD.md §20](Baseout_PRD.md) — token handling.
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `connections.token_expires_at`.

##### Canonical terms
Connection, Platform.

##### Files to touch
- `baseout-background-services/src/queries/expiring-connections.ts` (new)
- `baseout-background-services/src/integrations/refresh-errors.ts` (new) — types + typed error classes.
- `baseout-background-services/src/queries/expiring-connections.test.ts` (new).

##### Failing test to write first
- Cases:
  - Query returns Connections with `token_expires_at < now() + 1h` AND not `is_dead`.
  - `RefreshErrorClass` discriminated union compiles with no `any`.

##### Implementation notes
- Query excludes Connections without a refresh token (can't refresh them).

##### Acceptance criteria
- [ ] Typed union + error classes exported.
- [ ] Coverage per PRD §14.4.

##### Security 🔒
- No Connection token read in this sub-issue.

##### Dependencies
- **Blocked by:** P0.7.4
- **Blocks:** P2C.2.2, P2C.2.3
- **Can run in parallel with:** P2C.1.*

##### Out of scope
- Per-platform refresh mechanics (P2C.2.2).

---

#### [P2C.2.2] Airtable token refresh client + re-encryption

**Parent:** [P2C.2](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** auth
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:auth`, `🔒 security:auth-path`, `🔒 security:encryption`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Exchanges the encrypted refresh token for a new access+refresh pair, re-encrypts both, writes back to `connections.access_token_enc` + `refresh_token_enc`.

##### Spec references
- [Baseout_PRD.md §20.2](Baseout_PRD.md).

##### Canonical terms
Connection, Platform.

##### Files to touch
- `baseout-background-services/src/integrations/airtable/refresh-client.ts` (new)
- `baseout-background-services/src/integrations/airtable/refresh-client.test.ts` (new).

##### Failing test to write first
- Cases:
  - Happy path: refresh → new tokens → both encrypted → written.
  - 400 `invalid_grant` → throws `RevokedTokenError`.
  - 500 → throws `TransientRefreshError`.
  - Old tokens never appear in logs or thrown errors.

##### Implementation notes
- Reuse `encrypt` from `src/lib/crypto.ts` (P0.7.3).
- Update `token_expires_at` atomically in the same transaction.

##### Acceptance criteria
- [ ] All cases green.
- [ ] Write is atomic (tests assert partial failure leaves old encrypted row intact).
- [ ] No `any`; coverage per PRD §14.4.

##### Security 🔒
- Plaintext tokens exist only on the transaction stack; never logged or returned.
- Error types never expose raw provider response beyond a sanitized message.

##### Dependencies
- **Blocked by:** P2C.2.1, P0.7.3, P1B.1.3
- **Blocks:** P2C.2.4
- **Can run in parallel with:** P2C.2.3

##### Out of scope
- Storage-destination refresh (P2C.2.3).

---

#### [P2C.2.3] Storage-destination token refresh (Google Drive, Dropbox, Box, OneDrive)

**Parent:** [P2C.2](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** auth
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:auth`, `🔒 security:auth-path`, `🔒 security:encryption`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Common refresh dispatcher that routes by `Connection.platform` into the right provider's refresh client.

##### Spec references
- [Baseout_Features.md §14](Baseout_Features.md) — Storage Destinations.

##### Canonical terms
Connection, Storage Destination, Platform.

##### Files to touch
- `baseout-background-services/src/integrations/storage/refresh-dispatcher.ts` (new)
- `baseout-background-services/src/integrations/storage/{google,dropbox,box,onedrive}-refresh.ts` (new, four files)
- Tests per file.

##### Failing test to write first
- Cases (per provider):
  - Happy path returns new tokens.
  - `invalid_grant` → `RevokedTokenError`.
  - Transient → `TransientRefreshError`.
- Dispatcher: unknown platform throws; known platform routes correctly.

##### Implementation notes
- Pattern: each provider file exports `refresh(connection): Promise<EncryptedTokens>`; dispatcher switches on `platform`.
- Reuse `ProxyStreamUploader` pattern's naming from P1D.3.2 for consistency.

##### Acceptance criteria
- [ ] All four providers covered.
- [ ] Dispatcher exhaustive over MVP platforms; default case throws.

##### Security 🔒
- Plaintext token lifetime bounded to the transaction.
- S3 (IAM-based) is excluded — it has no OAuth refresh; dispatcher must not route `s3` here.

##### Dependencies
- **Blocked by:** P2C.2.1, P1D.2.*, P1D.3.*, P1D.4.*, P1D.5.*
- **Blocks:** P2C.2.4
- **Can run in parallel with:** P2C.2.2

##### Out of scope
- S3 / Frame.io refresh (S3 has no OAuth; Frame.io follows a later spike).

---

#### [P2C.2.4] Refresh handler orchestration + dead-connection flagging

**Parent:** [P2C.2](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** auth
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:auth`, `🔒 security:auth-path`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Combines query + provider dispatchers; classifies outcomes; `RevokedTokenError` marks Connection `is_dead` (triggering P2C.3 cadence).

##### Spec references
- [Baseout_PRD.md §2.9](Baseout_PRD.md).

##### Canonical terms
Connection, Notification.

##### Files to touch
- `baseout-background-services/src/cron/token-refresh.ts` (new — handler only)
- `baseout-background-services/src/cron/token-refresh.test.ts` (new).

##### Failing test to write first
- Cases:
  - 5 expiring Connections (mixed platforms) → correct dispatcher called per platform.
  - `RevokedTokenError` → Connection `is_dead=true` + `notification_log` entry with event `connection_revoked`.
  - `TransientRefreshError` → connection unchanged; retry scheduled (log only — no new schema for retry queue in MVP).

##### Implementation notes
- Sequential per Connection to avoid per-token rate limits.
- Notification event types are string literals in `src/lib/notifications.ts` (extracted in P2C.3.1; stub-import here).

##### Acceptance criteria
- [ ] All cases green.
- [ ] Idempotent on rerun.

##### Security 🔒
- No token material in the log; only `connection_id` + outcome class.

##### Dependencies
- **Blocked by:** P2C.2.2, P2C.2.3
- **Blocks:** P2C.2.5, P2C.3.*
- **Can run in parallel with:** none

##### Out of scope
- Retry queue persistence (future work).

---

#### [P2C.2.5] Wrangler cron trigger for token refresh

**Parent:** [P2C.2](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** auth
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:auth`, `🔒 security:auth-path`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Runs every 30 minutes to catch tokens expiring in the next hour.

##### Spec references
- [Baseout_Implementation_Plan.md §Phase 2C](Baseout_Implementation_Plan.md).

##### Canonical terms
N/A.

##### Files to touch
- `baseout-background-services/wrangler.toml` (modified) — add `"*/30 * * * *"` cron.
- `baseout-background-services/src/index.ts` (modified) — route the cron to the P2C.2.4 handler.
- `baseout-background-services/src/index.test.ts` (modified).

##### Failing test to write first
- Cases:
  - Miniflare scheduled invocation with `"*/30 * * * *"` calls the refresh handler.

##### Implementation notes
- Two crons now registered (P2C.1 + P2C.2); routing by cron expression in `scheduled`.

##### Acceptance criteria
- [ ] Dry-run deploy includes the new cron.
- [ ] Miniflare invocation green.

##### Dependencies
- **Blocked by:** P2C.2.4
- **Blocks:** P2C.2.6
- **Can run in parallel with:** none

##### Out of scope
- Per-env cron differences (both use the same expression).

---

#### [P2C.2.6] Integration test — token-near-expiry → refreshed end-to-end

**Parent:** [P2C.2](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** auth
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:auth`, `🔒 security:auth-path`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Proves the full refresh path against real Postgres + msw-mocked OAuth provider.

##### Spec references
- [Baseout_PRD.md §14.2](Baseout_PRD.md).

##### Canonical terms
Connection.

##### Files to touch
- `baseout-background-services/tests/integration/token-refresh.test.ts` (new).

##### Failing test to write first
- Cases:
  - Airtable Connection with `token_expires_at = now() + 30m` → after scheduled invocation, new `access_token_enc` + updated `token_expires_at`.
  - Revoked token → `is_dead=true` + `notification_log` row.

##### Implementation notes
- Decrypt updated token in test only to assert it differs from the original.

##### Acceptance criteria
- [ ] Green in CI with Postgres service container.

##### Security 🔒
- Test-only decryption gated behind test-runtime env check; no prod code path.

##### Dependencies
- **Blocked by:** P2C.2.5
- **Blocks:** none (P2C.2 complete)
- **Can run in parallel with:** P2C.3.*, P2C.4.*

##### Out of scope
- Load testing.

---

### P2C.3

**Parent:** [P2C.3 Dead connection detection + 4-touch notification](Baseout_Backlog.md) · granularity: `tdd` · Blocks: P2A.6.

Cadence per [PRD §11](Baseout_PRD.md): `Send → 2d → Send → 3d → Send → 5d → Final`, then mark `invalidated`. State machine is its own sub-issue so dispatch logic is testable without cron or email.

---

#### [P2C.3.1] Notification event type catalog + `notification_log` writer helper

**Parent:** [P2C.3](Baseout_Backlog.md) · **Repo:** `baseout-web` + `baseout-background-services` (shared module) · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Single source of truth for notification event names (discriminated union). All cron handlers + the notification panel (P2A.6) read/write through this helper.

##### Spec references
- [Baseout_PRD.md §21.3](Baseout_PRD.md) — `notification_log` columns.

##### Canonical terms
Notification, Alert.

##### Files to touch
- `src/lib/notifications.ts` (new) — `NotificationEventType` union, `recordNotification()` helper.
- `src/lib/notifications.test.ts` (new).

##### Failing test to write first
- Cases:
  - `recordNotification({ type: 'connection_revoked', ... })` inserts with valid enum.
  - Unknown type rejected at compile time (tested via `@ts-expect-error`).
  - Duplicate suppression: same `(organization_id, type, external_key)` within 24h is a no-op.

##### Implementation notes
- `NotificationEventType` includes: `connection_revoked`, `connection_dead_touch_1`, `connection_dead_touch_2`, `connection_dead_touch_3`, `connection_dead_final`, `trial_day_5`, `trial_expired`, `quota_75`, `quota_90`, `quota_100`, `backup_failed`, `backup_trial_complete`, `webhook_renewal_summary`.
- Writer shared between `baseout-web` and `baseout-background-services` (Workers can import it).

##### Acceptance criteria
- [ ] Union exported; writer tested.
- [ ] Suppression test green.

##### Dependencies
- **Blocked by:** P0.7.5
- **Blocks:** P2C.3.3, P2C.5.*, P2C.6.*, P2A.6.*
- **Can run in parallel with:** P2C.2.*

##### Out of scope
- Email dispatch (P2D.1a).

---

#### [P2C.3.2] 4-touch state machine — types + transitions

**Parent:** [P2C.3](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Pure state machine — input `(currentState, lastSentAt, now)` → output `nextAction` (`wait` | `send_touch_n` | `invalidate`). No I/O. Easy to unit-test exhaustively.

##### Spec references
- [Baseout_PRD.md §11](Baseout_PRD.md) — cadence resolution.

##### Canonical terms
Connection.

##### Files to touch
- `baseout-background-services/src/state/dead-connection-cadence.ts` (new)
- `baseout-background-services/src/state/dead-connection-cadence.test.ts` (new).

##### Failing test to write first
- Cases:
  - State 0 (just marked dead) → `send_touch_1` immediately.
  - State 1 + `lastSentAt` 1d ago → `wait`.
  - State 1 + `lastSentAt` 2d ago → `send_touch_2`.
  - State 2 + `lastSentAt` 3d ago → `send_touch_3`.
  - State 3 + `lastSentAt` 5d ago → `send_final` then `invalidate`.
  - Invalidated → `noop` (never transitions back).

##### Implementation notes
- Pure function; no Date.now() inside — always accepts `now` as argument for determinism.
- Input/output discriminated unions; zero `any`.

##### Acceptance criteria
- [ ] Exhaustive case table green.
- [ ] Coverage ≥ 95% on this file.

##### Dependencies
- **Blocked by:** none
- **Blocks:** P2C.3.3
- **Can run in parallel with:** P2C.3.1

##### Out of scope
- Side-effects (handler owns those).

---

#### [P2C.3.3] Dead-connection handler: detect + advance + dispatch email

**Parent:** [P2C.3](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
Combines cadence state machine + notification writer + email dispatch. Invoked by the daily cron.

##### Spec references
- [Baseout_PRD.md §2.9](Baseout_PRD.md).

##### Canonical terms
Connection, Notification.

##### Files to touch
- `baseout-background-services/src/cron/dead-connection.ts` (new — handler)
- `baseout-background-services/src/cron/dead-connection.test.ts` (new).

##### Failing test to write first
- Cases:
  - 3 dead Connections at different stages → correct `send_touch_N` emails dispatched.
  - One Connection hitting `send_final` → `is_dead=true` + `invalidated_at` set + future runs noop.
  - Re-auth by user between runs (Connection `is_dead=false`) → state resets; cadence restarts.

##### Implementation notes
- Email dispatch uses `src/lib/mail.ts` (created in P2D.1a); stub in test.
- Calls `recordNotification()` (P2C.3.1) for each send.

##### Acceptance criteria
- [ ] All cases green.
- [ ] Handler idempotent inside a single day (guarded by `recordNotification` suppression).

##### Dependencies
- **Blocked by:** P2C.3.1, P2C.3.2, P2C.2.4, P2D.1a.*
- **Blocks:** P2C.3.4
- **Can run in parallel with:** none

##### Out of scope
- Frontend panel display (P2A.6).

---

#### [P2C.3.4] Wrangler cron trigger — dead-connection daily

**Parent:** [P2C.3](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Register the daily cron + route it to P2C.3.3.

##### Spec references
- [Baseout_Implementation_Plan.md §Phase 2C](Baseout_Implementation_Plan.md).

##### Canonical terms
N/A.

##### Files to touch
- `baseout-background-services/wrangler.toml` (modified) — add `"0 4 * * *"` (04:00 UTC, staggered from P2C.1).
- `baseout-background-services/src/index.ts` (modified).
- `baseout-background-services/src/index.test.ts` (modified).

##### Failing test to write first
- Cases:
  - Miniflare scheduled invocation with the new cron calls the handler.

##### Implementation notes
- Stagger crons by 1h to avoid piling on the DB at one minute.

##### Acceptance criteria
- [ ] Dry-run deploy includes all three crons (renewal, refresh, dead).

##### Dependencies
- **Blocked by:** P2C.3.3
- **Blocks:** P2C.3.5
- **Can run in parallel with:** none

##### Out of scope
- Ad-hoc invocation endpoints.

---

#### [P2C.3.5] Re-auth reset flow — user reconnects Connection, cadence resets

**Parent:** [P2C.3](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** auth
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:auth`, `🔒 security:auth-path`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
When user completes re-auth on a dead Connection, clear `is_dead` + `invalidated_at` + reset cadence state. Triggered from the Notification panel CTA (P2A.6).

##### Spec references
- [Baseout_PRD.md §2.9](Baseout_PRD.md).

##### Canonical terms
Connection.

##### Files to touch
- `src/pages/api/connections/[id]/reauth.ts` (new — POST endpoint).
- `src/pages/api/connections/[id]/reauth.test.ts` (new).

##### Failing test to write first
- Cases:
  - Authenticated user with Org-scoped Connection → OAuth restart URL returned.
  - On successful callback: `is_dead=false`, cadence state cleared, notification entry `connection_reauth_success` written.
  - Cross-Org access → 403.

##### Implementation notes
- OAuth restart reuses P1B.1 flow for Airtable; per-provider restart for Storage Destinations.
- Cleared fields: `is_dead`, `invalidated_at`, any cadence counter column (add nullable columns in this sub-issue's migration if not already on `connections`).

##### Acceptance criteria
- [ ] All cases green.
- [ ] Existing backup schedule re-enabled on success.

##### Security 🔒
- CSRF enforced; session-scoped.
- Cross-Org isolation verified.

##### Dependencies
- **Blocked by:** P2C.3.3, P1B.1.3
- **Blocks:** P2C.3.6
- **Can run in parallel with:** none

##### Out of scope
- UI surfaces (P2A.6 owns the CTA).

---

#### [P2C.3.6] Integration test — 4-touch cadence over 10 simulated days

**Parent:** [P2C.3](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
End-to-end with time travel: fixture Connection → 10 daily invocations → asserts 4 emails + `invalidated` state.

##### Spec references
- [Baseout_PRD.md §11](Baseout_PRD.md).

##### Canonical terms
Connection.

##### Files to touch
- `baseout-background-services/tests/integration/dead-connection-cadence.test.ts` (new).

##### Failing test to write first
- Same file.
- **Cases:**
  - Seed dead Connection; advance clock day-by-day; after 10 days, assert 4 email dispatches + `invalidated_at` set.

##### Implementation notes
- Pass `now()` into handlers explicitly so test can override.

##### Acceptance criteria
- [ ] Deterministic: runs identically across machines.

##### Dependencies
- **Blocked by:** P2C.3.4, P2C.3.5
- **Blocks:** none (P2C.3 complete)
- **Can run in parallel with:** P2C.4.*

##### Out of scope
- UI.

---

### P2C.4

**Parent:** [P2C.4 Connection lock manager](Baseout_Backlog.md) · granularity: `tdd` · Blocks: none.

Sweeps stale locks from `connection_locks` table (P1B.3). Runs every 5 minutes; reclaims locks older than 15 minutes with an audit entry.

---

#### [P2C.4.1] Stale-lock query + reclaim helper

**Parent:** [P2C.4](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Typed query + delete for locks past the 15-minute TTL.

##### Spec references
- [Baseout_PRD.md §2.10](Baseout_PRD.md) — locks.

##### Canonical terms
Connection.

##### Files to touch
- `baseout-background-services/src/queries/stale-locks.ts` (new)
- `baseout-background-services/src/queries/stale-locks.test.ts` (new).

##### Failing test to write first
- Cases:
  - Query returns locks with `acquired_at < now() - 15m`.
  - Reclaim deletes returned rows in a transaction.
  - Fresh locks never deleted.

##### Implementation notes
- Reuse `connection_locks` schema from P1B.3.
- Transaction-scoped: select + delete under advisory lock to avoid double-reclaim if two sweeps overlap.

##### Acceptance criteria
- [ ] Cases green.
- [ ] No `any`.

##### Dependencies
- **Blocked by:** P1B.3.*
- **Blocks:** P2C.4.2
- **Can run in parallel with:** none

##### Out of scope
- Notifying affected Backup Runs (handler concern).

---

#### [P2C.4.2] Lock-sweep handler + audit log entry

**Parent:** [P2C.4](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Wraps the query + reclaim; writes one `notification_log` entry per reclamation event (visible in admin app — P6.1).

##### Spec references
- [Baseout_PRD.md §2.10](Baseout_PRD.md).
- [Baseout_PRD.md §16.1](Baseout_PRD.md) — admin observability.

##### Canonical terms
Connection, Notification.

##### Files to touch
- `baseout-background-services/src/cron/connection-lock-sweep.ts` (new)
- `baseout-background-services/src/cron/connection-lock-sweep.test.ts` (new).

##### Failing test to write first
- Cases:
  - 2 stale + 3 fresh → 2 reclaimed, 3 remain.
  - Audit entry written with `run_id` + `connection_id` + reclamation timestamp.
  - No reclamation needed → handler exits clean; no notification spam.

##### Implementation notes
- Event type `stale_lock_reclaimed` added to `NotificationEventType` (P2C.3.1) — extend its union.

##### Acceptance criteria
- [ ] All cases green.
- [ ] Handler silent when nothing to do.

##### Dependencies
- **Blocked by:** P2C.4.1, P2C.3.1
- **Blocks:** P2C.4.3
- **Can run in parallel with:** none

##### Out of scope
- Notifying the Backup Run owner (future enhancement).

---

#### [P2C.4.3] Wrangler cron — every 5 minutes

**Parent:** [P2C.4](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
High-frequency sweep keeps stuck Backup Runs recoverable within 5 min + 15 min = 20 min worst-case.

##### Spec references
- [Baseout_Implementation_Plan.md §Phase 2C](Baseout_Implementation_Plan.md).

##### Canonical terms
N/A.

##### Files to touch
- `baseout-background-services/wrangler.toml` (modified) — add `"*/5 * * * *"`.
- `baseout-background-services/src/index.ts` (modified).
- `baseout-background-services/src/index.test.ts` (modified).

##### Failing test to write first
- Miniflare scheduled invocation calls the lock-sweep handler.

##### Implementation notes
- Four crons now registered.

##### Acceptance criteria
- [ ] Dry-run deploy includes the new cron.

##### Dependencies
- **Blocked by:** P2C.4.2
- **Blocks:** P2C.4.4
- **Can run in parallel with:** none

##### Out of scope
- Per-env overrides.

---

#### [P2C.4.4] Integration — stuck lock aged 20m → removed on next sweep

**Parent:** [P2C.4](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
End-to-end against real Postgres.

##### Spec references
- [Baseout_PRD.md §14.2](Baseout_PRD.md).

##### Canonical terms
Connection.

##### Files to touch
- `baseout-background-services/tests/integration/lock-sweep.test.ts` (new).

##### Failing test to write first
- Seed stale lock; invoke scheduled; assert deleted + notification row.

##### Implementation notes
- N/A.

##### Acceptance criteria
- [ ] Green in CI.

##### Dependencies
- **Blocked by:** P2C.4.3
- **Blocks:** P2C.4.5
- **Can run in parallel with:** P2C.3.6

##### Out of scope
- N/A.

---

#### [P2C.4.5] Admin surface — expose lock reclamation events in admin app stub

**Parent:** [P2C.4](Baseout_Backlog.md) · **Repo:** `baseout-admin` · **Capability:** backup
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-admin`, `capability:backup`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Placeholder list view reading `notification_log` entries of type `stale_lock_reclaimed`. Admin app UI deepens in P6.1; this stub seeds the data path.

##### Spec references
- [Baseout_PRD.md §16.1](Baseout_PRD.md).

##### Canonical terms
Notification.

##### Files to touch
- `baseout-admin/src/pages/ops/lock-reclamations.astro` (new)
- `baseout-admin/tests/integration/lock-reclamations.test.ts` (new).

##### Failing test to write first
- Unauth request → redirect to admin sign-in.
- Authenticated admin → table renders recent reclamations.

##### Implementation notes
- Admin auth gating is a placeholder — use the better-auth setup from P1A.1. Admin RBAC lands in Phase 6.

##### Acceptance criteria
- [ ] Table renders from real data.
- [ ] No `any`.

##### Dependencies
- **Blocked by:** P2C.4.4, P0.1.1 (baseout-admin repo)
- **Blocks:** none (P2C.4 complete)
- **Can run in parallel with:** P2C.5.*, P2C.6.*

##### Out of scope
- Admin RBAC (P6.1).

---

### P2C.5

**Parent:** [P2C.5 Trial expiry monitor](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P4A.1.

Daily cron scans Subscriptions near `trial_ends_at`; sends day-5 warning and day-7 expired email.

---

#### [P2C.5.1] Expiring-trial query + handler

**Parent:** [P2C.5](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** billing
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:billing`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Queries Subscriptions where `status='trialing'` AND (`trial_ends_at` = today + 2d → day-5 warning) OR (`trial_ends_at` <= today → expired). Dispatches corresponding email via `src/lib/mail.ts`.

##### Spec references
- [Baseout_PRD.md §8.3](Baseout_PRD.md) — trial 7d.
- [Baseout_PRD.md §19](Baseout_PRD.md) — email templates.

##### Canonical terms
Subscription, Trial.

##### Files to touch
- `baseout-background-services/src/queries/expiring-trials.ts` (new)
- `baseout-background-services/src/cron/trial-expiry.ts` (new — handler)
- Tests per file.

##### Failing test to write first
- Cases:
  - Sub expiring in 2 days → `trial_day_5` email dispatched + notification row.
  - Sub past `trial_ends_at` → `trial_expired` email + Subscription status → `past_due` + backup-run block flag set.
  - Already-notified Sub (via suppression) → no duplicate.

##### Implementation notes
- Block backups by flipping a capability flag (`resolveCapability` reads it).

##### Acceptance criteria
- [ ] Cases green; suppression enforced.
- [ ] No `any`; coverage per PRD §14.4.

##### Dependencies
- **Blocked by:** P0.7.5, P1A.6.*, P2C.3.1, P2D.1b.*
- **Blocks:** P2C.5.2
- **Can run in parallel with:** P2C.6.*

##### Out of scope
- Upgrade UI (P4A.1).

---

#### [P2C.5.2] Wrangler cron — daily trial sweep

**Parent:** [P2C.5](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** billing
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:billing`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Daily at 05:00 UTC (staggered from other daily crons).

##### Spec references
- [Baseout_Implementation_Plan.md §Phase 2C](Baseout_Implementation_Plan.md).

##### Canonical terms
N/A.

##### Files to touch
- `baseout-background-services/wrangler.toml` (modified) — add `"0 5 * * *"`.
- `baseout-background-services/src/index.ts` (modified).

##### Failing test to write first
- Miniflare scheduled invocation calls the trial handler.

##### Implementation notes
- Five crons registered now.

##### Acceptance criteria
- [ ] Dry-run deploy includes new cron.

##### Dependencies
- **Blocked by:** P2C.5.1
- **Blocks:** P2C.5.3
- **Can run in parallel with:** none

##### Out of scope
- N/A.

---

#### [P2C.5.3] Integration test — trial age 5d → warning; 7d → expired

**Parent:** [P2C.5](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** billing
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:billing`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
End-to-end assertions on the two thresholds.

##### Spec references
- [Baseout_PRD.md §14.2](Baseout_PRD.md).

##### Canonical terms
Subscription.

##### Files to touch
- `baseout-background-services/tests/integration/trial-expiry.test.ts` (new).

##### Failing test to write first
- Seed Sub with `trial_ends_at = now() + 2d` → invoke → email + notification row written.
- Seed Sub with `trial_ends_at = now() - 1d` → invoke → status `past_due` + backups blocked.

##### Implementation notes
- Use a deterministic clock helper.

##### Acceptance criteria
- [ ] Green in CI.

##### Dependencies
- **Blocked by:** P2C.5.2
- **Blocks:** none (P2C.5 complete)
- **Can run in parallel with:** P2C.6.*

##### Out of scope
- N/A.

---

### P2C.6

**Parent:** [P2C.6 Quota usage monitor](Baseout_Backlog.md) · granularity: `chunk` · Blocks: P2A.5.

Alerts at 75/90/100% of tier limits. `cap` mode at 100% blocks new Backup Runs; `overage` mode charges per [Features §5.3](Baseout_Features.md).

---

#### [P2C.6.1] Usage aggregator + tier-cap comparator

**Parent:** [P2C.6](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** billing
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:billing`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Per-Organization usage snapshot (records, attachments, storage bytes) + compare to tier caps via `resolveCapability` (P1C.3.1). Classifies each Org as `ok` | `warn_75` | `warn_90` | `cap_100`.

##### Spec references
- [Baseout_Features.md §5.3](Baseout_Features.md).
- [Baseout_Features.md §4](Baseout_Features.md).

##### Canonical terms
Organization, Overage, Tier, Capability.

##### Files to touch
- `baseout-background-services/src/queries/usage-snapshot.ts` (new)
- `baseout-background-services/src/cron/quota-monitor.ts` (new)
- Tests per file.

##### Failing test to write first
- Cases:
  - Fixture Org at 74% → `ok` (no notification).
  - Fixture Org at 76% → `warn_75` + email + notification.
  - Fixture Org at 92% → `warn_90` + email.
  - Fixture Org at 100% (cap mode) → `cap_100` + backups blocked; (overage mode) → `cap_100` + overage event written.

##### Implementation notes
- Reuse `resolveCapability()` for tier lookup.
- Suppression: one 75%/90% email per Org per week; one 100% per Org per day.

##### Acceptance criteria
- [ ] Cases green.
- [ ] Cap vs overage paths both covered.

##### Dependencies
- **Blocked by:** P0.7.5, P1C.3.1, P2C.3.1, P2D.1b.*
- **Blocks:** P2C.6.2
- **Can run in parallel with:** P2C.5.*

##### Out of scope
- Stripe overage invoicing (Phase 4A.3).

---

#### [P2C.6.2] Wrangler cron — daily quota sweep

**Parent:** [P2C.6](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** billing
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:billing`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Daily 06:00 UTC — last in the staggered sequence.

##### Spec references
- [Baseout_Implementation_Plan.md §Phase 2C](Baseout_Implementation_Plan.md).

##### Canonical terms
N/A.

##### Files to touch
- `baseout-background-services/wrangler.toml` (modified) — add `"0 6 * * *"`.
- `baseout-background-services/src/index.ts` (modified).

##### Failing test to write first
- Miniflare scheduled invocation calls the quota handler.

##### Implementation notes
- Six crons registered total.

##### Acceptance criteria
- [ ] Dry-run deploy includes new cron.

##### Dependencies
- **Blocked by:** P2C.6.1
- **Blocks:** P2C.6.3
- **Can run in parallel with:** none

##### Out of scope
- N/A.

---

#### [P2C.6.3] Integration — Org at 92% sees 90% email exactly once

**Parent:** [P2C.6](Baseout_Backlog.md) · **Repo:** `baseout-background-services` · **Capability:** billing
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-background-services`, `capability:billing`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** S

##### Context
Idempotency is the critical invariant — re-running the cron must not spam.

##### Spec references
- [Baseout_PRD.md §14.2](Baseout_PRD.md).

##### Canonical terms
Organization.

##### Files to touch
- `baseout-background-services/tests/integration/quota-monitor.test.ts` (new).

##### Failing test to write first
- Seed Org at 92% → invoke scheduled twice same day → assert exactly one email sent.

##### Implementation notes
- Suppression by `notification_log` (P2C.3.1).

##### Acceptance criteria
- [ ] Green in CI; idempotent.

##### Dependencies
- **Blocked by:** P2C.6.2
- **Blocks:** none (P2C.6 complete; Phase 2C complete)
- **Can run in parallel with:** P2D.1a.*, P2D.1b.*

##### Out of scope
- N/A.

---

### P2D.1a

**Parent:** [P2D.1 V1 React Email templates + Cloudflare Email Service binding integration](Baseout_Backlog.md) (split per Appendix A) · granularity: `tdd` · Blocks: P1A.2, P2C.3.3.

Render harness + magic-link template — the security-critical slice that unblocks Phase 1A sign-in. (Cloudflare Email Service binding wiring already landed with P1A.1.4.)

---

#### [P2D.1a.1] Install React Email; set up render harness

**Parent:** [P2D.1a](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
React Email installed; local render harness lets the team preview every template in the browser during development. No email SDK needed — sends go through the existing `env.EMAIL` binding via `src/lib/email/send.ts`.

##### Spec references
- [Baseout_PRD.md §19](Baseout_PRD.md).

##### Canonical terms
N/A.

##### Files to touch
- `package.json` (modified) — add `@react-email/components`, `@react-email/render`.
- `src/emails/_preview.astro` (new) — dev-only preview page iterating registered templates.
- `src/emails/README.md` (new) — pattern + preview instructions.
- `src/emails/_preview.test.ts` (new).

##### Failing test to write first
- Cases:
  - Preview route renders in dev; returns 404 in prod (guarded by `import.meta.env.DEV`).
  - Adding a template to the registry surfaces in preview list.

##### Implementation notes
- React Email version pinned; snapshot tests rely on deterministic render.

##### Acceptance criteria
- [ ] Installs + preview route works in dev.
- [ ] Prod returns 404 on preview route.

##### Dependencies
- **Blocked by:** P0.1.2, P0.10.3
- **Blocks:** P2D.1a.2, P2D.1a.3
- **Can run in parallel with:** none

##### Out of scope
- Template content.

---

#### [P2D.1a.2] Shared `_layout.tsx` — logo, footer, unsubscribe

**Parent:** [P2D.1a](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Every template wraps content in the shared layout. Defines brand, footer text, optional unsubscribe link.

##### Spec references
- [Baseout_PRD.md §19](Baseout_PRD.md).
- [CLAUDE.md §UI/UX](../.claude/CLAUDE.md) — brand tokens.

##### Canonical terms
Organization.

##### Files to touch
- `src/emails/_layout.tsx` (new)
- `src/emails/_layout.test.ts` (new).

##### Failing test to write first
- Cases:
  - Layout renders given `children` + optional `unsubscribeUrl`.
  - `unsubscribeUrl` omitted → footer renders no unsubscribe row.
  - Brand logo + primary color pulled from `@opensided/theme`.

##### Implementation notes
- Inline CSS (email clients don't reliably support linked stylesheets).

##### Acceptance criteria
- [ ] Snapshot test stable.
- [ ] No `any`.

##### Dependencies
- **Blocked by:** P2D.1a.1
- **Blocks:** P2D.1a.3, P2D.1a.4, P2D.1b.*
- **Can run in parallel with:** none

##### Out of scope
- Dark-mode variant (nice-to-have).

---

#### [P2D.1a.3] Wire React Email templates into the existing `sendEmail()` abstraction

**Parent:** [P2D.1a](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `🔒 security:auth-path`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** M

##### Context
`sendEmail()` in `src/lib/email/send.ts` already exists and calls `env.EMAIL.send({ from, to, subject, html, text })`. This task adds a typed `Template` union + `vars` layer on top, so callers pass `{ template, to, vars }` and the helper renders with React Email before handing off to `sendEmail()`. Other modules never build raw HTML.

##### Spec references
- [Baseout_PRD.md §19](Baseout_PRD.md).

##### Canonical terms
N/A.

##### Files to touch
- `src/lib/email/render.ts` (new) — typed `renderTemplate({ template, vars })` returning `{ subject, html, text }`.
- `src/lib/email/render.test.ts` (new).
- `src/emails/registry.ts` (new) — template → render function mapping.

##### Failing test to write first
- Cases:
  - `renderTemplate({ template: 'magic-link', vars: { url } })` returns deterministic `{ subject, html, text }` with the URL in both fallbacks.
  - Sending to missing template name → compile error (via `@ts-expect-error` test).
  - Caller can pass the result into `sendEmail()` and the binding fake receives the expected payload.

##### Implementation notes
- No HTTP mocking — binding is a host object. Inject a fake `SendEmail` in tests (same pattern as `send.test.ts`).
- Template → render function mapping stored in `src/emails/registry.ts`.

##### Acceptance criteria
- [ ] All cases green.
- [ ] Zero `any`; template names are a TypeScript union.
- [ ] Never logs recipient email (log hashed ID only).

##### Security 🔒
- No runtime API key — auth via `EMAIL` binding.
- Recipient PII policy: log event + hashed ID, not the address itself.

##### Dependencies
- **Blocked by:** P2D.1a.1, P2D.1a.2, P1A.1.4 (binding already wired)
- **Blocks:** P2D.1a.4, P2D.1a.5, P2C.3.3, P2D.1b.*
- **Can run in parallel with:** none

##### Out of scope
- Queueing / retry pool (Cloudflare handles transient retries at the service layer).

---

#### [P2D.1a.4] `magic-link.tsx` template + snapshot test + vars contract

**Parent:** [P2D.1a](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `🔒 security:auth-path`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
The magic-link template used by P1A.2 — minimal content, strong brand, 15-minute expiry notice.

##### Spec references
- [Baseout_PRD.md §19.1](Baseout_PRD.md) — magic-link spec.
- [Baseout_PRD.md §13.1](Baseout_PRD.md) — 15-min expiry.

##### Canonical terms
Magic Link.

##### Files to touch
- `src/emails/magic-link.tsx` (new)
- `src/emails/magic-link.test.ts` (new).

##### Failing test to write first
- Cases:
  - Template renders with `vars: { url, expiresInMinutes: 15 }`.
  - Snapshot stable.
  - Missing `url` → compile error.
  - Plain-text version contains the URL.

##### Implementation notes
- Wrap in `_layout.tsx` (P2D.1a.2).
- Register in `src/emails/registry.ts`.

##### Acceptance criteria
- [ ] Snapshot test stable.
- [ ] Plain-text fallback present.

##### Security 🔒
- Token URL rendered as-is; never logged inside render.

##### Dependencies
- **Blocked by:** P2D.1a.2, P2D.1a.3
- **Blocks:** P1A.2.*, P2D.1a.5
- **Can run in parallel with:** none

##### Out of scope
- Localization (MVP is English-only).

---

#### [P2D.1a.5] Integration test — magic-link end-to-end via the `EMAIL` binding

**Parent:** [P2D.1a](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:tdd`, `agentic-ready`
**Estimate:** S

##### Context
Proof that `sendEmail` + React Email template + Cloudflare Email Service binding + DKIM all line up before Phase 1 uses it for real users.

##### Spec references
- [Baseout_PRD.md §19](Baseout_PRD.md).

##### Canonical terms
N/A.

##### Files to touch
- `tests/integration/email-magic-link.test.ts` (new).

##### Failing test to write first
- Staging-only: trigger a magic-link flow against a staging Worker with `EMAIL` bound; confirm `env.EMAIL.send()` returns a `messageId` and an internal test inbox receives the email. DKIM=pass checked manually once, then test asserts the `messageId` shape only.

##### Implementation notes
- Staging-only (`wrangler dev --remote` or deployed staging). Skipped locally because the `EMAIL` binding is not available in plain `wrangler dev` / miniflare (undocumented) — the dev-mode console-log branch in `send.ts` covers local flows.

##### Acceptance criteria
- [ ] Green on staging.
- [ ] Skipped cleanly locally when the `EMAIL` binding is unavailable.

##### Dependencies
- **Blocked by:** P2D.1a.4, P0.10.3
- **Blocks:** P1A.2.5 (E2E magic-link flow)
- **Can run in parallel with:** P2D.1b.*

##### Out of scope
- Production send (prod credential flow is a separate ops ritual).

---

### P2D.1b

**Parent:** [P2D.1 V1 React Email templates + Cloudflare Email Service binding integration](Baseout_Backlog.md) (split per Appendix A) · granularity: `chunk` · Blocks: P2C.3, P2C.5, P2C.6, P4A.*.

Remaining V1 templates, grouped logically across four sub-issues.

---

#### [P2D.1b.1] Trial-lifecycle templates (welcome · day-5 · expired)

**Parent:** [P2D.1b](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Three templates for the trial lifecycle: welcome on sign-up, day-5 warning, day-7 expired.

##### Spec references
- [Baseout_PRD.md §19](Baseout_PRD.md) — template list.
- [Baseout_PRD.md §8.3](Baseout_PRD.md).

##### Canonical terms
Trial, Subscription.

##### Files to touch
- `src/emails/trial-welcome.tsx`, `trial-day-5.tsx`, `trial-expired.tsx` (new)
- Registry update in `src/emails/registry.ts` (modified).
- Snapshot tests per template (new).

##### Failing test to write first
- Each template renders with its typed vars; snapshot stable; vars union enforced at compile time.

##### Implementation notes
- Vars: `trial-welcome` → `{ organizationName, dashboardUrl }`; `trial-day-5` → `{ organizationName, trialEndsAt, upgradeUrl }`; `trial-expired` → `{ organizationName, upgradeUrl }`.

##### Acceptance criteria
- [ ] Three templates registered and tested.
- [ ] No `any`.

##### Dependencies
- **Blocked by:** P2D.1a.3
- **Blocks:** P1A.3.*, P2C.5.1
- **Can run in parallel with:** P2D.1b.2, P2D.1b.3, P2D.1b.4

##### Out of scope
- Localization.

---

#### [P2D.1b.2] Operational templates (backup failure · backup warning · audit report · monthly summary)

**Parent:** [P2D.1b](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Four templates for ongoing backup operations.

##### Spec references
- [Baseout_PRD.md §19](Baseout_PRD.md).

##### Canonical terms
Backup Run, Backup Snapshot, Space.

##### Files to touch
- `src/emails/backup-failure.tsx`, `backup-warning.tsx`, `audit-report.tsx`, `monthly-summary.tsx` (new)
- Registry update.
- Snapshot tests per template.

##### Failing test to write first
- Each template renders with typed vars.

##### Implementation notes
- Vars: `backup-failure` → `{ spaceName, runId, errorSummary, runLogUrl }`; `audit-report` → `{ runId, verificationRows }`; `monthly-summary` → `{ orgName, runCount, successRate, totalRecords, link }`.

##### Acceptance criteria
- [ ] All four registered and tested.
- [ ] No `any`.

##### Dependencies
- **Blocked by:** P2D.1a.3
- **Blocks:** P1B.7.*, P2B.6.*
- **Can run in parallel with:** P2D.1b.1, P2D.1b.3, P2D.1b.4

##### Out of scope
- N/A.

---

#### [P2D.1b.3] Quota + billing templates (quota 75/90/100% · upgrade confirm · overage notice)

**Parent:** [P2D.1b](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Five templates: three quota thresholds + upgrade confirmation + overage notice.

##### Spec references
- [Baseout_PRD.md §19](Baseout_PRD.md).
- [Baseout_Features.md §5.3](Baseout_Features.md).

##### Canonical terms
Overage, Tier, Subscription.

##### Files to touch
- `src/emails/quota-75.tsx`, `quota-90.tsx`, `quota-100.tsx`, `upgrade-confirm.tsx`, `overage-notice.tsx` (new)
- Registry update.
- Snapshot tests per template.

##### Failing test to write first
- Each renders with typed vars.

##### Implementation notes
- Vars: `quota-*` → `{ orgName, currentPct, tierLimit, upgradeUrl }`; `upgrade-confirm` → `{ orgName, newTier, effectiveAt }`; `overage-notice` → `{ orgName, overageSummary }`.

##### Acceptance criteria
- [ ] All five registered and tested.

##### Dependencies
- **Blocked by:** P2D.1a.3
- **Blocks:** P2C.6.1, P4A.*
- **Can run in parallel with:** P2D.1b.1, P2D.1b.2, P2D.1b.4

##### Out of scope
- Overage amount computation (Phase 4A.3 owns that math).

---

#### [P2D.1b.4] Connection + account templates (dead-connection ×4 · migration welcome · password reset)

**Parent:** [P2D.1b](Baseout_Backlog.md) · **Repo:** `baseout-web` · **Capability:** ux
**Labels:** `phase:2`, `milestone:mvp`, `repo:baseout-web`, `capability:ux`, `🔒 security:auth-path`, `tier-gate:all`, `granularity:chunk`, `agentic-ready`
**Estimate:** M

##### Context
Six templates: four for the dead-connection 4-touch cadence (distinct body text per touch), plus On2Air migration welcome, plus password reset (used once Phase 6 password auth ships — template built now, invocation later).

##### Spec references
- [Baseout_PRD.md §19](Baseout_PRD.md).
- [Baseout_PRD.md §11](Baseout_PRD.md) — 4-touch cadence.

##### Canonical terms
Connection, Migration.

##### Files to touch
- `src/emails/connection-dead-1.tsx`, `connection-dead-2.tsx`, `connection-dead-3.tsx`, `connection-dead-final.tsx`, `migration-welcome.tsx`, `password-reset.tsx` (new)
- Registry update.
- Snapshot tests per template.

##### Failing test to write first
- Each renders; each has typed vars; forbidden synonyms absent in snapshots.

##### Implementation notes
- Dead-connection templates share a helper sub-component for the "Reconnect" CTA — different body copy per touch for escalation.

##### Acceptance criteria
- [ ] Six templates registered + tested.
- [ ] No `any`.
- [ ] `password-reset` wired to registry even though P6 supplies the invocation.

##### Security 🔒
- Password-reset template never includes the raw token in logs; template receives only a URL.

##### Dependencies
- **Blocked by:** P2D.1a.3
- **Blocks:** P2C.3.3
- **Can run in parallel with:** P2D.1b.1, P2D.1b.2, P2D.1b.3

##### Out of scope
- Password-reset invocation flow (Phase 6 owns).

---

## Appendix A — Granularity rule

Two granularity classes drive sub-issue count per parent.

### Option 1 — TDD / single-concern (tagged `granularity:tdd`, ~5–7 sub-issues)

Use when the parent matches **any** of:
- 🔒 security label · OAuth token handling · encryption · auth middleware
- Billing · capability resolution · trial state · Stripe logic
- State machines with >2 states (backup run lifecycle · connection locks · trial · 4-touch email cadence)
- Core engine work (backup · restore · attachments · schema capture)
- Novel / first-of-kind patterns (first storage writer · first proxy-stream connector · first real-time WebSocket)

### Option 3 — half-day chunks (tagged `granularity:chunk`, ~3 sub-issues)

Use when the parent matches **all** of:
- Pure infra/config/scaffolding **or** repeat of an already-proven pattern
- Security-ordinary (no new secrets or auth paths beyond already-built)
- UI wiring with no real-time / live state

### Classification overrides — borderline calls

- **P1C.3** (Pick backup frequency) — **Option 1**. It introduces the capability resolver pattern that every later gated feature depends on.
- **P1D.1** (R2 managed storage) — **Option 1**. First `StorageDestination` writer; sets the interface every later connector conforms to.
- **P2D.1** (Email templates) — **split** into P2D.1a (render harness + magic-link, Option 1) and P2D.1b (remaining templates, Option 3).

### Classification counts

| Class | Parent count | Typical sub-issues | Total sub-issues |
|---|---|---|---|
| `granularity:tdd` (Option 1) | 34 | 5–7 | ~180 |
| `granularity:chunk` (Option 3) | 26 | 3 | ~80 |
| **Total** | **60** | — | **~260** |

---

## Appendix B — Sub-issue body template

This is the canonical shape. Every sub-issue fills every section (write `N/A` when a field doesn't apply — never omit).

````markdown
### [ID] <Short imperative title>

**Parent:** [ID](Baseout_Backlog.md) · **Repo:** <repo> · **Capability:** <capability>
**Labels:** `phase:N`, `milestone:mvp`, `repo:<repo>`, `capability:<capability>`, [`tier-gate:<tier>`], [`🔒 security:<class>`], `granularity:<tdd|chunk>`, `agentic-ready`
**Estimate:** <S | M | L>  (S ≤ 2h, M ≤ 4h, L ≤ 1d)

#### Context
<1–3 sentences: why this sub-issue exists, what it unblocks, where it fits in the parent.>

#### Spec references
- [Baseout_PRD.md §X.Y](Baseout_PRD.md) — <what this section dictates>
- [Baseout_Features.md §Z](Baseout_Features.md) — <if relevant>
- [CLAUDE.md §N](../.claude/CLAUDE.md) — <policy cite if relevant>

#### Canonical terms
<Comma-separated from Features §1. Note any non-obvious forbidden synonyms.>

#### Files to touch
- `<exact path>` (new | modified) — <one-line purpose>

#### Failing test to write first
- **File:** `<test path>`
- **Cases:**
  - <behavior 1>
  - <behavior 2>
- Command: `<npm run …>`

#### Implementation notes
- <constraint / library choice / specific API>
- Reuse: <existing util at `<path>` if applicable>

#### Acceptance criteria
- [ ] <testable behavior>
- [ ] No `any` types introduced (tsc strict).
- [ ] Coverage target met per PRD §14.4.

#### Dependencies
- **Blocked by:** <IDs or `none`>
- **Blocks:** <IDs or `none`>
- **Can run in parallel with:** <IDs>

#### Security 🔒  (only when a 🔒 label applies)
- <specific gate>

#### Out of scope
- <what this sub-issue explicitly does NOT do — prevents agent drift>
````

### Why this shape

| Field | Why it exists |
|---|---|
| `Context` | Agent joins the thread cold — needs the "why" without reading specs. |
| `Spec references` | Bounded cite list prevents the agent from over-reading. |
| `Canonical terms` | Enforces the [Features §1](Baseout_Features.md) naming contract, surfaces forbidden synonyms. |
| `Files to touch` | Constrains blast radius — agent won't sprawl into unrelated files. |
| `Failing test to write first` | TDD gate — red test, then green impl. Matches [CLAUDE.md §3](../.claude/CLAUDE.md). |
| `Implementation notes` | Names libraries / APIs / existing utilities to reuse — prevents re-implementation. |
| `Acceptance criteria` | Binary tests for "done." |
| `Dependencies` | Lets the work queue resolve; prevents out-of-order execution. |
| `Security 🔒` | Explicit gate on secrets/auth/encryption/write paths. |
| `Out of scope` | Prevents scope drift — the most common agent failure. |

---

## Appendix C — Labels + milestones catalog

### Every sub-issue inherits

- `milestone:mvp`
- `agentic-ready`

### Phase

- `phase:0` · `phase:1` · `phase:2`

### Repo

- `repo:baseout-ui` · `repo:baseout-web` · `repo:baseout-backup-engine` · `repo:baseout-background-services` · `repo:baseout-admin` · `repo:infra`

### Capability

- `capability:ci-cd` · `capability:auth` · `capability:backup` · `capability:billing` · `capability:ux` · `capability:restore` · `capability:schema`

### Tier gate (per [Features §5.5.4](Baseout_Features.md))

- `tier-gate:all` · `tier-gate:starter` · `tier-gate:launch+` · `tier-gate:growth+` · `tier-gate:pro+` · `tier-gate:business+` · `tier-gate:enterprise`

### Security (per [PRD §20](Baseout_PRD.md) / [CLAUDE.md §2](../.claude/CLAUDE.md))

- `🔒 security:auth-path` — any change to login / session / middleware
- `🔒 security:new-secret` — introduces a new secret in Cloudflare Secrets
- `🔒 security:encryption` — reads/writes an AES-256-GCM encrypted column or equivalent
- `🔒 security:new-sql-surface` — new table, new `WHERE`-uncovered column, new direct-SQL endpoint

### Granularity

- `granularity:tdd` — Option 1 parents
- `granularity:chunk` — Option 3 parents

### Ops

- `parallel-ok` — no intra-parent sequencing required for this sub-issue
- `critical-path` — any delay slips MVP exit

### Milestones (from [Baseout_Backlog.md](Baseout_Backlog.md))

- `milestone:mvp` — Epics 1–3, Phases 0–2 (scope of this file)
- `milestone:v1` — Epics 4–7, Phases 3–6 (future decomposition)
- `milestone:v2` — Continuing / deferred

---

## Appendix D — Open questions surfaced during decomposition

Open questions are documented here and NOT invented in sub-issue bodies. Each entry cites the sub-issue that flagged it; resolving entries in this appendix unblocks those sub-issues.

<!-- APPENDIX_D_OPEN_QUESTIONS: populated during agent merge pass; see report at end of task -->

### D.1 — Tracked from [PRD §11](Baseout_PRD.md) (Master Open Questions)

These are PRD-level open questions that flowed through into sub-issues as `Open question` notes:

- **Dead-connection 4-touch cadence** — cadence is `Send → 2d → Send → 3d → Send → 5d → Final`; captured in P2C.3 sub-issues. No change needed unless ops pushes back.
- **Schema Health Score algorithm** — TBD (V1 / Phase 3 scope; out of MVP).
- **Diagram export formats per tier** — Growth: PNG · Pro: SVG · Business: PDF · Enterprise: embed (V1 / Phase 3 scope).
- **Frame.io proxy requirements** — TBD; flagged in P1D.7 sub-issues; confirm during build.

### D.2 — Surfaced during MVP decomposition

Unresolved questions that were papered over with documented defaults. Each should be confirmed before the cited sub-issue starts.

#### Auth + session (P1A)

- **[P1A.1.2]** Session strategy — default chosen: **DB-backed** (to support admin revocation per PRD §16.1). [PRD §13.2](Baseout_PRD.md) says "JWT vs DB-backed TBD during spike."
- **[P1A.3.3]** Trial duration for Airtable — default chosen: **7 days** (matches [PRD §8.6](Baseout_PRD.md) + [PRD §8.3](Baseout_PRD.md)). [Features §5.5.5](Baseout_Features.md) implies per-platform configurability.
- **[P1A.5.2]** Pre-registration schema viz session TTL — default chosen: **24h server TTL + session cookie (no Max-Age)**. Baseout_Backlog.md P1A.5 says "tab close OR after 24h"; PRD §13.2 says "tab close." Reconciled to both.
- **[P1A.6.1]** Trial cap enforcement split — web-side = time (`trial_ends_at`) + preflight denial; engine-side = in-run counters (P1B.8). Confirm split is intended.
- **[P1A.1.6]** Auth audit events in MVP — default chosen: **reuse `notification_log`** rather than a dedicated `auth_audit` table. Flagged for Phase 6 SOC-2-adjacent work.

#### Backup engine (P1B)

- **Trial caps spec citation** — canonical values `1000 records / 5 tables / 100 attachments` live in [PRD §1.6](Baseout_PRD.md) but [Baseout_Backlog.md P1B.8](Baseout_Backlog.md) cites §8.3. Sub-issues cite §1.6 (authoritative).
- **[P1B.5]** Attachment dedup — default chosen: **composite ID `{base_id}_{table_id}_{record_id}_{field_id}_{attachment_id}` + size**. Backlog says "by hash" — SHA-256 content hashing explicitly deferred to V2.
- **[P1B.1.3]** OAuth callback audit — default chosen: **reuse `notification_log`**. Dedicated `auth_audit` table not yet in [PRD §21.3](Baseout_PRD.md).
- **[P1B.9.x]** Trigger.dev internal webhook auth — default chosen: **HMAC-signed `/internal/...` endpoint**. No PRD section explicitly covers this auth class.

#### Storage destinations (P1D)

- **[P1D.7.1] Frame.io** — open questions flagged at build time:
  - Does Frame.io V4 require proxy streaming or allow direct upload-session URLs?
  - GraphQL endpoint vs per-resource REST for project+folder hierarchy?
  - Does Frame.io auto-transcode uploads? Do we opt out to preserve originals?
  - Exact V4 scope names for read-project + write-file?
  - Maximum individual file size via standard upload session?

#### Dashboard + restore (P2A/P2B)

- **[P2A.4.x]** WebSocket reconnect policy — default chosen: **exponential backoff starting at 1s, max 30s, cap 5 attempts before showing "reconnecting" state**.
- **[P2B.4.2]** Table name collision handling on restore-to-existing — default chosen: **suffix `-restore-{timestamp}`**. Makes restores visible in Airtable without clobbering.

#### Background + email (P2C/P2D)

- **[P2C.3]** Dead-connection cadence — resolved per [PRD §11](Baseout_PRD.md): `Send → 2d → Send → 3d → Send → 5d → Final → invalidate`. Encoded as a pure state machine (P2C.3.2).
- **[P2C.6]** Quota notification suppression — default chosen: **one 75%/90% email per Org per week; one 100% email per Org per day**. Not specified in PRD.
- **[P2D.1b.4]** Password-reset template — authored in MVP; invocation ships in Phase 6 with email+password auth. Template sits unused until then — intentional.
