## Overview

Seven phases. The load-bearing chain is **A (env-flag + scaffold) → B (auth stub) → C (PGlite-backed DB) → D (external-service fakes) → E (designer control panel) → F (build/deploy) → G (smoke + docs)**. A through C must land in order; D fakes can be parallelized once C is in place; E layers on top of B/C/D; F is a deploy-only step that depends on all preceding phases having a buildable artifact; G is human-driven verification.

The single architectural call: **PGlite (in-memory Postgres in WASM) as the design-mode DB, swapped in at the `createDb()` chokepoint.** Alternative was a hand-rolled fake of Drizzle's query API (brittle — every new query in the app would force a fake update). PGlite runs the real Drizzle schema, executes real SQL, and gives the designer the same behavior the real Postgres would. The 2 MB WASM weight is acceptable because the design Worker is a separate deploy target — production never bundles PGlite. PGlite is confirmed to run under workerd (the project ships an explicit `@electric-sql/pglite/wasm` import path that works with Wrangler's WASM module resolution; the Phase C tasks include a smoke step to verify this on Day 1 before the rest of the seed plumbing is built out).

The second call: **single env-var (`PUBLIC_DESIGN_MODE`) at every boundary, never a constant import.** Reading `env.PUBLIC_DESIGN_MODE === 'true'` per boundary makes the fences greppable and prevents accidental tree-shake-defeat. `PUBLIC_` prefix is Astro's convention for env vars safe to expose at build time; in our case it also signals "this affects observable runtime behavior" to anyone reviewing.

The third call: **a separate Worker deploy target (`baseout-design`) with no real secrets.** The fakes alone are not sufficient defense-in-depth. By giving the design Worker zero Hyperdrive binding, zero Mailgun secret, zero Stripe secret, zero real OAuth client secrets, and zero `BACKUP_ENGINE` service binding, we make it physically impossible for design-mode code to reach production state even if a fake were misconfigured.

## Phase A — Env-flag plumbing + scaffold

### A.1 Env shape

- `PUBLIC_DESIGN_MODE` is read off `env` (Cloudflare runtime) and `import.meta.env` (build-time / `astro dev`). Both must be `'true'` (string) to enable. Anything else — including unset, `'false'`, `'1'`, `'on'` — is off. The strict string match prevents future "we changed to `0`/`1`" drift.
- Add the var to [apps/web/wrangler.jsonc.example](../../../apps/web/wrangler.jsonc.example) under a new `env.design` block with `vars: { PUBLIC_DESIGN_MODE: "true" }`. Document in the comment block at the top of the file that this env block intentionally has no Hyperdrive, no service bindings, and no secrets.
- Add the var to `apps/web/src/env.d.ts` `App.Locals` typing as `designMode: boolean` so consumers don't `string === 'true'` repeatedly.

### A.2 Directory layout

New tree under [apps/web/src/](../../../apps/web/src/):

```
design-mode/
  fixtures/
    users.ts                Stub session users (Admin, Billing Owner, Read-only, Trial)
    orgs.ts                 One demo Org, plus the tier-variants for the control panel
    spaces.ts               Trial Space + Pro Space
    connections.ts          Airtable connection + storage destinations (Drive, R2)
    bases.ts                Realistic Airtable base schemas (3)
    backup-runs.ts          50 historical runs + 1 in-progress + 1 failed
    scenarios.ts            "Fresh signup" / "Mid-onboarding" / "Backup running" / etc.
  fake-engine.ts            Replacement for the BACKUP_ENGINE service binding
  fake-oauth.ts             Helpers for the fake OAuth consent flow + token mint
  fake-email.ts             No-op email transport
  pglite.ts                 PGlite singleton + first-request seed gate
  seed.ts                   Applies migrations + seeds fixtures into PGlite
  control-panel-state.ts    Mutations triggered by the control panel
  guard.ts                  isDesignMode(env): boolean — single source of truth
components/design-mode/
  Banner.astro              Top-of-page warning banner
  ControlPanel.astro        Bottom-right floating panel
pages/design-mode/
  fake-stripe-portal.astro
  fake-oauth-consent.astro
pages/api/internal/design-mode/
  state.ts                  POST { userId?, tier?, spaceId? } — mutates current session/Org
  reset.ts                  POST → re-runs seed
  scenario.ts               POST { name } — jumps to a named demo scenario
stores/design-mode.ts       nanostore: { activeUserId, activeOrgId, activeSpaceId, scenario }
```

### A.3 The `isDesignMode` guard

Single function in `design-mode/guard.ts`:

```ts
import type { APIContext } from 'astro'

export function isDesignMode(env: APIContext['locals']['runtime']['env']): boolean {
  return (env as Record<string, unknown>).PUBLIC_DESIGN_MODE === 'true'
}
```

Every fence point imports this. Don't duplicate the string literal. Don't substitute a boolean coercion.

## Phase B — Auth stub

### B.1 Middleware bypass

[apps/web/src/middleware.ts](../../../apps/web/src/middleware.ts) currently:

1. Looks up session via `better-auth` `getSession()` using the cookie.
2. Fetches account context via `getAccountContext(db, session.user.id)`.
3. Attaches `db`, `session`, `user`, `account` to `Astro.locals`.

DESIGN_MODE branch (add at the top of the middleware handler, before the existing session-cache lookup):

```ts
if (isDesignMode(env)) {
  context.locals.designMode = true
  const stubUser = await getStubUserFromCookie(context, db)
  context.locals.session = stubUser.session
  context.locals.user = stubUser.user
  context.locals.account = stubUser.account
  // Skip the entire better-auth + SESSION_CACHE branch below.
  return next()
}
context.locals.designMode = false
// …existing branch unchanged…
```

The `getStubUserFromCookie` reads a `design-mode-user-id` cookie set by the control panel (defaulting to `'admin'` on first visit) and returns the matching fixture row from PGlite.

### B.2 `auth-factory.ts` no-op

[apps/web/src/lib/auth-factory.ts](../../../apps/web/src/lib/auth-factory.ts) — in DESIGN_MODE, return a `better-auth` instance whose `magicLink.sendVerificationOTP` is a no-op (logs via the structured logger that an email *would have* been sent, returns success). The `/login` form POST handler at [apps/web/src/pages/api/auth/](../../../apps/web/src/pages/api/auth/) hits this and returns the existing "check your email" response. Designer can navigate back to `/` and is "already signed in" by virtue of the stub middleware.

### B.3 `PUBLIC_PATHS` widening

In DESIGN_MODE, expand `PUBLIC_PATHS` to include `/design-mode/*` and `/api/internal/design-mode/*`. The middleware's `isPublicRoute` check gains a DESIGN_MODE-gated branch for these prefixes.

### B.4 Logout

The existing logout flow hits `better-auth`'s sign-out. In DESIGN_MODE, the sign-out endpoint sets the `design-mode-user-id` cookie to an empty string and redirects to `/login`. The designer can use this to test the signed-out UX.

## Phase C — PGlite-backed DB

### C.1 PGlite handle

[apps/web/src/design-mode/pglite.ts](../../../apps/web/src/design-mode/pglite.ts):

```ts
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '../db/schema'

let handle: { db: AppDb; pg: PGlite } | null = null
let seedPromise: Promise<void> | null = null

export async function getDesignModeDb(): Promise<AppDb> {
  if (!handle) {
    const pg = new PGlite()
    const db = drizzle(pg, { schema })
    handle = { db, pg }
  }
  if (!seedPromise) {
    seedPromise = runMigrationsAndSeed(handle.db)
  }
  await seedPromise
  return handle.db
}
```

Single-flight via the module-level `seedPromise`. PGlite handle lives for the Worker isolate's lifetime; cold-starts wipe and re-seed.

### C.2 Migration runner

`runMigrationsAndSeed` reads the SQL files under [apps/web/drizzle/](../../../apps/web/drizzle/) at build time (Vite glob import: `import.meta.glob('../../drizzle/*.sql', { eager: true, as: 'raw' })`), sorts by filename, and runs each through `pg.exec()`. Then it calls into [design-mode/seed.ts](../../../apps/web/src/design-mode/seed.ts) which runs the fixture inserts.

### C.3 `createDb` swap

[apps/web/src/db/worker.ts](../../../apps/web/src/db/worker.ts) gains a branch:

```ts
export async function createDb(env: Env): Promise<{ db: AppDb; sql: Sql | null }> {
  if (isDesignMode(env)) {
    const db = await getDesignModeDb()
    return { db, sql: null }
  }
  // …existing postgres-js branch…
}
```

The signature changes from `(connectionString: string)` to `(env: Env)` so it can read the flag. Callers (currently middleware) update accordingly. The middleware's `ctx.waitUntil(sql.end())` teardown skips when `sql` is `null`.

### C.4 Fixtures

Each fixtures file exports a typed array matching the corresponding Drizzle table's `InferInsertModel`. Fields like `created_at` are derived from a base date (e.g. 30 days ago) so the demo Org never has timestamps "from before the user was born."

- `users.ts` — four users, one per role. UUID v4 stable strings (committed in the file) so the control-panel cookie can address them by ID.
- `orgs.ts` — one Org with `stripe_subscription_tier='pro'`, plus a `tierOverrides` map keyed by tier name that the control panel's `state.ts` POST handler uses to mutate the Org's tier in place.
- `bases.ts` — three realistic schemas: a project tracker, a CRM, a content calendar. Each with 5–10 tables, mixed field types (text, single-select, multi-select, attachment, formula, lookup) — enough fidelity that the designer can see how the schema-graph view renders.
- `backup-runs.ts` — 50 runs spread over the last 30 days with `status='completed'`, plus one `status='running'` (so the in-progress UI is visible), plus one `status='failed'` (with a realistic error message).

### C.5 Tier-swap mechanic

When the control panel POSTs `{ tier: 'business' }` to `/api/internal/design-mode/state`, the handler executes `UPDATE organizations SET stripe_subscription_tier = $1, stripe_platform = 'baseout', stripe_metadata = $metadata WHERE id = $orgId` inside PGlite using the tier→metadata map from [shared/Baseout_Features.md](../../../shared/Baseout_Features.md) §5.5. Capability gates downstream read from the existing `apps/web/src/lib/capabilities/` resolver against PGlite's updated row — no special-case capability path needed.

## Phase D — External-service fakes

### D.1 Fake engine

[apps/web/src/design-mode/fake-engine.ts](../../../apps/web/src/design-mode/fake-engine.ts) exports an object satisfying the same shape that [apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts) consumes from `env.BACKUP_ENGINE`. Implementations:

- `triggerBackup({ spaceId, baseIds })` — inserts a `backup_runs` row with `status='running'` and one `backup_run_bases` row per base. Returns `{ runId }`. Schedules `setInterval` ticks (200 ms) that increment per-table `records_synced` counts and POST to the in-process progress handler. After all bases reach 100%, flips the run to `status='completed'`.
- `cancelBackup({ runId })` — flips `status='cancelled'` and clears the interval.
- `getRunStatus({ runId })` — reads from PGlite, returns the current row.

[apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts) gains a branch at top:

```ts
export function getEngine(env: Env) {
  if (isDesignMode(env)) return fakeEngine
  return realEngineBoundToServiceBinding(env.BACKUP_ENGINE)
}
```

Every caller already routes through `getEngine` (verify in implementation; if any caller bypasses, route it through).

### D.2 Fake Stripe portal

[apps/web/src/pages/api/billing/portal.ts](../../../apps/web/src/pages/api/billing/portal.ts) (or current equivalent) — in DESIGN_MODE, return `{ url: '/design-mode/fake-stripe-portal' }` instead of calling the Stripe SDK. The fake portal page renders a daisyUI card titled "Stripe Customer Portal (Design Mode)" with `Manage subscription`, `View invoices`, `Cancel subscription` buttons that no-op. Closing the page returns the designer to the `/settings/billing` page.

### D.3 Fake OAuth consent

A single shared page at [apps/web/src/pages/design-mode/fake-oauth-consent.astro](../../../apps/web/src/pages/design-mode/fake-oauth-consent.astro) accepts `?provider=airtable|google|dropbox|box|onedrive&state=...&redirect_uri=...`. Renders a mock provider-branded consent screen with `Approve` and `Deny` buttons. Approve redirects to `redirect_uri?code=fake_design_mode_code&state=<state>` (the existing callback handler).

Each provider's `getAuthorizationUrl` in [apps/web/src/lib/airtable/](../../../apps/web/src/lib/airtable/), [apps/web/src/lib/google-drive/](../../../apps/web/src/lib/google-drive/), [apps/web/src/lib/dropbox/](../../../apps/web/src/lib/dropbox/), [apps/web/src/lib/box/](../../../apps/web/src/lib/box/), [apps/web/src/lib/onedrive/](../../../apps/web/src/lib/onedrive/) gains a branch in DESIGN_MODE that returns `/design-mode/fake-oauth-consent?provider=<p>&state=<s>&redirect_uri=<r>`.

Each provider's callback handler (which calls `exchangeCodeForTokens`) gains a DESIGN_MODE branch that, when `code === 'fake_design_mode_code'`, mints a fake encrypted-token row directly (skipping the real provider's `/token` endpoint). The encryption key for the design Worker is a fixed string committed to [apps/web/src/design-mode/pglite.ts](../../../apps/web/src/design-mode/pglite.ts) (clearly labeled as fake; not reusable for any other env).

### D.4 Fake Airtable

Reuse the existing `AIRTABLE_STUBS_ENABLED=1` path. In DESIGN_MODE, force this on regardless of explicit env. The stub endpoints under [apps/web/src/pages/api/stub/](../../../apps/web/src/pages/api/stub/) already return canned base / table / record shapes — verify they cover the surfaces the designer hits; extend if not.

### D.5 Fake email

[apps/web/src/lib/email/](../../../apps/web/src/lib/email/) — when DESIGN_MODE, the transport's `send` returns success without doing anything. A structured-logger info-line records the would-have-been recipient and template name. No raw `console.*` per [CLAUDE.md](../../../CLAUDE.md) §3.5.

## Phase E — Designer control panel

### E.1 Component

[apps/web/src/components/design-mode/ControlPanel.astro](../../../apps/web/src/components/design-mode/ControlPanel.astro): a fixed-position `<div class="fixed bottom-4 right-4 ...">` that, when expanded, shows a daisyUI `card` with four sections:

1. **Active user** — radio group across the four stub users
2. **Active org tier** — dropdown across the six tiers
3. **Demo scenarios** — list of named scenarios with one-click jump
4. **Reset** — button that re-runs the seed

Collapsed state: a small daisyUI `btn btn-circle btn-warning` showing a gear icon. Expanded state: the card.

### E.2 nanostore

[apps/web/src/stores/design-mode.ts](../../../apps/web/src/stores/design-mode.ts) — a `map` with keys `activeUserId`, `activeOrgId`, `activeSpaceId`, `currentScenario`. Hydrated from a server-rendered `<script type="application/json" id="design-mode-state">` block in the design-mode layout wrapper. The control panel reads/writes this store.

### E.3 Mutation flow

When the panel mutates the store, an `onMount` `$store.subscribe` handler:

1. POSTs the new state to `/api/internal/design-mode/state`
2. On 2xx, calls `astro.navigate(window.location.pathname, { history: 'replace' })` to soft-refresh the current page with the new server state.

This way the designer sees the page re-render with the new user / org / tier without losing scroll position.

### E.4 Scenarios

The control panel exposes a named-scenario dropdown. Each scenario is a function in [apps/web/src/design-mode/fixtures/scenarios.ts](../../../apps/web/src/design-mode/fixtures/scenarios.ts) that takes the PGlite DB and rewrites enough rows to land the designer in that state. Examples:

- `Fresh signup` — delete all Spaces, Connections, Bases, Runs for the demo Org; redirect to `/welcome`.
- `Mid-onboarding` — one Connection in place, no Bases selected yet; redirect to `/integrations`.
- `Backup running` — start a fake-engine backup against the existing Pro Space's bases; redirect to `/backups`.
- `Backup failed` — insert a `status='failed'` run with a realistic error; redirect to `/backups/<runId>`.
- `Quota exhausted` — flip the Org's tier to Trial and bump `records_synced` past the cap; redirect to `/backups`.
- `Trial expired` — flip the Org to a tier=`trial_expired` shape; redirect to `/integrations`.

### E.5 Banner

[apps/web/src/components/design-mode/Banner.astro](../../../apps/web/src/components/design-mode/Banner.astro): a daisyUI `alert alert-warning` rendered at the top of [apps/web/src/layouts/](../../../apps/web/src/layouts/) `Layout.astro` in DESIGN_MODE. Text: "Design mode — fake data, fake auth, no real backups will run. State resets when this Worker cold-starts." Dismiss button stores dismissed-state in sessionStorage (resets per tab).

## Phase F — Build + deploy

### F.1 Dependency

`pnpm --filter @baseout/web add @electric-sql/pglite drizzle-orm` (drizzle-orm already there). PGlite is the only new runtime dependency; everything else is conditional imports of files that already exist or are added by this change.

### F.2 wrangler.jsonc.example block

Append a new `env.design` block:

```jsonc
{
  "env": {
    "design": {
      "name": "baseout-design",
      "vars": {
        "PUBLIC_DESIGN_MODE": "true",
        "PUBLIC_AUTH_BASE_URL": "https://baseout-design.YOURDOMAIN.workers.dev"
      }
      // NO hyperdrive, NO services.BACKUP_ENGINE, NO secrets.
      // The design Worker is a sealed sandbox.
    }
  }
}
```

Comment block explains that omitting bindings and secrets is intentional — Phase F's defense-in-depth.

### F.3 Scripts

[apps/web/package.json](../../../apps/web/package.json) gains:

```jsonc
{
  "scripts": {
    "dev:design": "PUBLIC_DESIGN_MODE=true astro dev",
    "design:deploy": "wrangler deploy --env design && pnpm run design:secrets",
    "design:secrets": "wrangler secret bulk .dev.vars.design --env design"
  }
}
```

`.dev.vars.design` is a separate secrets file that only contains `MASTER_ENCRYPTION_KEY` (a known fake value) — no provider client secrets. Committed `.dev.vars.design.example` documents the contents.

### F.4 Production-bundle tree-shake check

Add to [apps/web/scripts/](../../../apps/web/scripts/) a small build-time script that runs `wrangler deploy --dry-run --env dev` and asserts the resulting bundle does **not** include `@electric-sql/pglite`. If it does, fail loudly. This is the regression alarm if anyone accidentally couples design-mode code into a non-design module.

### F.5 Documentation

[shared/internal/design-mode.md](../../../shared/internal/design-mode.md):

- **Section 1**: What design mode is. The "fake everything, click anywhere" pitch.
- **Section 2**: Local-dev path. `pnpm --filter @baseout/web dev:design`. Visit `localhost:4321/`. Designer lands signed-in.
- **Section 3**: Hosted URL. `https://baseout-design.<account>.workers.dev`. No login required.
- **Section 4**: The control panel. Where it is, what each section does, what the scenarios mean.
- **Section 5**: What's faked vs. what's real. Real: every Astro page, every component, every nanostore, the entire `@opensided/theme` + daisyUI styling, every route. Fake: DB (PGlite), auth (stub user), engine (setInterval simulator), OAuth (consent stub), Stripe (fake portal), email (no-op).
- **Section 6**: Reporting design-mode bugs. Designer files under a GitHub label `design-mode`. Engineering audits design-mode-only issues separately from prod issues.
- **Section 7**: Limitations. State resets on cold-start. No persistence. Latency is unrealistically fast. Use the control panel for explicit error/latency scenarios.

## Phase G — Smoke + handoff

### G.1 Walk-through

Per the user's standing workflow ([feedback_no_prs_human_test_then_local_commit.md](#)), the agent surfaces the dev command; the human walks the designer-facing surfaces and approves before any commit lands:

- `pnpm --filter @baseout/web dev:design`
- Visit `/` → marketing.
- Visit `/login` → login UI renders, submit short-circuits.
- Visit `/` (already signed in) → dashboard.
- Visit `/welcome`, `/integrations`, `/backups`, `/restore`, `/schema`, `/reports`, `/profile`, `/settings`, `/ops`. Every page renders, no 500, no DB-missing-column errors (matches the auto-memory `feedback_schema_migrate_before_ship.md` — the seed runs migrations first, so this is structurally impossible if Phase C is correct, but verify).
- Control panel: switch tier, see capability-gated UI flip (e.g. Pro features lock when tier=Starter).
- Control panel: jump to `Backup running` scenario, watch the simulator tick the backup to completion in <30 s.
- Control panel: reset → state returns to seed.
- Deploy to `baseout-design`, walk the hosted URL.

### G.2 Hand-off

Once smoke is green, write the Slack/email hand-off to the designer with:
- The hosted URL
- Login: "you're already signed in"
- A 30-second tour of the control panel (linked screenshot or screen-capture)
- The bug-reporting path (label `design-mode`)
- The cold-start state-reset caveat
