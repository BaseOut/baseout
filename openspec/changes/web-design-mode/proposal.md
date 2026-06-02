## Why

Baseout is bringing in a designer to refine the customer-facing UX. The designer needs to **click through the live app** — marketing pages, auth flows, onboarding, Connect flows, Spaces dashboard, backups, restores, settings, the `/ops` staff console — without any of the runtime dependencies that make the real app expensive to stand up:

- No PostgreSQL (Hyperdrive + master DB)
- No `better-auth` magic-link round-trip + Mailgun email
- No Airtable / Google Drive / Dropbox / Box / OneDrive OAuth clients
- No `apps/server` engine service binding (no Trigger.dev, no Durable Objects)
- No Stripe customer portal
- No real `INTERNAL_TOKEN` between web and engine

A designer landing on `/` today gets bounced to `/login` (no email, no magic-link infra). Static screenshots, Figma redraws, and stale fixtures are the alternative — they decay the moment a real screen ships and force the designer to redesign against memory instead of reality.

We need a **single env-flag flip** that turns `apps/web` into a click-around demo of itself — stub everywhere the app crosses a process boundary, hold all state in memory, and reflect the designer's clicks back on screen. Same Astro source, same components, same routes, same daisyUI + `@opensided/theme` styling. The designer iterates against the real codebase; design and engineering stay in sync; new screens land in design-mode automatically.

## What Changes

Introduce a `PUBLIC_DESIGN_MODE=true` env-var gate, evaluated at boot in [apps/web/src/middleware.ts](../../../apps/web/src/middleware.ts), with the following effects:

### A. Auth stub

- Middleware bypasses the `better-auth` session lookup and synthesizes a stub `Astro.locals.session` + `Astro.locals.user` from `apps/web/src/design-mode/fixtures/users.ts`. The `/login` and `/register` routes render their normal UI but the submit handler short-circuits to a redirect.
- `apps/web/src/lib/auth-factory.ts` returns a no-op `better-auth` instance in DESIGN_MODE so the magic-link send path can't actually call Mailgun. `apps/web/src/lib/email/*` becomes a no-op transport that logs (via the structured logger, not raw `console.*`) to surface that an email *would have* been sent.

### B. DB fixtures backed by PGlite

- `apps/web/src/db/worker.ts` `createDb()` checks `env.PUBLIC_DESIGN_MODE`. When set, returns a Drizzle instance wired to [`@electric-sql/pglite`](https://pglite.dev) (in-memory Postgres in WASM) rather than `postgres-js`. Schema is the existing Drizzle schema — no fakes, no shape mismatch.
- A new `apps/web/src/design-mode/seed.ts` runs the existing Drizzle migrations against PGlite at first request, then inserts a fully populated demo Org with: one Admin user (the stub session above), one billing-owner user, 2 Spaces (one Trial, one Pro), 3 connected Bases each with realistic schemas, 50 completed `backup_runs` spread across the last 30 days, one in-progress run, one failed run, one BYOS Google Drive destination, one managed-R2 destination.
- A module-level promise gates concurrent first-request seeding (single-flight). PGlite handle lives per Worker isolate; designer reloads do not reset state (state is reset on Worker cold-start, which is fine).

### C. External-service fakes

- **Engine service binding** (`env.BACKUP_ENGINE` → `apps/server`): replaced by a local fake in `apps/web/src/design-mode/fake-engine.ts`. `triggerBackup` writes a `backup_runs` row in PGlite and starts a `setInterval`-driven progress simulator that ticks per-table counts and posts to the same in-process progress consumer the real engine writes to.
- **Stripe**: `apps/web/src/lib/stripe.ts` (if/where present) and the billing-portal redirect route return a fake portal URL pointing at `/design-mode/fake-stripe-portal` — an Astro page rendered only in DESIGN_MODE.
- **Airtable / Google Drive / Dropbox / Box / OneDrive OAuth**: each provider's `getAuthorizationUrl` returns a URL pointing at a single `/design-mode/fake-oauth-consent` page that renders a "Authorize Baseout" mock screen with `Approve` / `Deny` buttons. `Approve` hits the provider's existing callback handler with a fake code; the callback's token-exchange step is shimmed in DESIGN_MODE to mint a fake encrypted-token row in the `connections` / `storage_destinations` table.
- **Airtable API**: existing `AIRTABLE_STUBS_ENABLED` dev-stub path (per [apps/web/src/middleware.ts](../../../apps/web/src/middleware.ts) `isPublicRoute`) is reused and forced on whenever DESIGN_MODE is on. The stub endpoints under `apps/web/src/pages/api/stub/` already return canned base/table responses.

### D. Designer control panel

A floating bottom-right panel (DESIGN_MODE-gated) — new component `apps/web/src/components/design-mode/ControlPanel.astro` — that lets the designer:

- Switch the active stub user (Admin / Billing Owner / Read-only / Trial-only user)
- Switch the active Org tier (Community / Starter / Growth / Pro / Business / Enterprise) — re-evaluates capability gates per [Features §5.5](../../../shared/Baseout_Features.md)
- Switch the active Space (Trial Space / Pro Space)
- Trigger demo scenarios: `Fresh signup`, `Mid-onboarding`, `All connected`, `Backup running`, `Backup failed`, `Quota exhausted`, `Trial expired`
- Reset all fixtures (re-run seed)

The panel writes to a nanostore (`src/stores/design-mode.ts`) whose change handler POSTs to `/api/internal/design-mode/state` (DESIGN_MODE-gated) to mutate PGlite, then triggers a soft-nav refresh.

### E. Banner + brand-stamp

Top-of-page banner reading "Design mode — fake data, fake auth, no real backups will run" (daisyUI `alert alert-warning`, dismissible per session). Prevents the designer or any drive-by reviewer from mistaking the demo for production state.

### F. Build + deploy

- New env `PUBLIC_DESIGN_MODE` declared in `apps/web/wrangler.jsonc.example` under a new `env.design` block. Hosted target: a separate Worker `baseout-design` deployed by `pnpm --filter @baseout/web design:deploy` (parallels existing `dev:deploy` per memory: `project_apps_web_remote_mode.md`).
- The design Worker has **no Hyperdrive binding, no `BACKUP_ENGINE` service binding, no Mailgun secret, no Stripe secret, no real OAuth client secrets**. Removing them is part of the security envelope — a misconfigured design build cannot leak production state because it has no path to reach it.
- Local: `pnpm --filter @baseout/web dev:design` script that sets `PUBLIC_DESIGN_MODE=true` and skips the wrangler `--remote` flag (no service-binding needed).
- A new "Designer Quickstart" doc at [shared/internal/design-mode.md](../../../shared/internal/design-mode.md) documents the local-dev path, the hosted URL, the scenarios available in the control panel, and how to file design-mode-only bug reports.

### G. Test runner posture

- The PGlite seed module and fake-engine simulator are pure-ish — they're not part of any production code path and don't need TDD coverage. The `PUBLIC_DESIGN_MODE` gate at every boundary is a single-line conditional; the test for the *gate* is "the gate is off in unit tests and integration tests" (i.e. `PUBLIC_DESIGN_MODE` is never set in Vitest config), which we assert via a tiny smoke test that fails if `process.env.PUBLIC_DESIGN_MODE` is truthy at test boot. No 80% coverage target applies; this is tooling, not production runtime code.

## Out of Scope

- **`apps/server` design mode.** The engine has no UI; the designer never reaches it. The fake-engine lives entirely in `apps/web`.
- **`apps/workflows` (Trigger.dev) design mode.** Same reason.
- **Realistic-latency or error-state injection.** Fake-engine progress ticks happen on a 200 ms interval; OAuth approvals complete instantly. The designer can request specific error states via the control panel ("Backup failed" scenario) but we do not generally simulate flakiness.
- **Persisting designer-induced state across Worker cold starts.** PGlite is in-memory; restart wipes it. Acceptable per the user decision "click-around + in-memory state."
- **Authentication on the hosted design URL.** The hosted Worker is publicly reachable but contains zero real secrets and zero real customer data. We may layer Cloudflare Access in a follow-up if the URL becomes findable enough to matter; not required for V1.
- **A separate `apps/design-preview/` app.** Considered and rejected per the user decision — one codebase, one flag, keeps design and reality in lockstep.
- **Static export (`astro build --static`).** Considered and rejected — the app is SSR-heavy and a static export would lose the click-around state machine the designer needs.
- **Mocking the staff `/ops` console with a different data shape.** `/ops` consumes the same Drizzle tables (`users`, `organizations`, `backup_runs`, etc.) so it gets design-mode data for free without further work.
- **Storybook-style component gallery.** Out of scope. The designer wants to see the app, not a component library.

## Capabilities

This change introduces tooling, not a customer-facing product capability. No spec delta is required.

No requirement in [openspec/specs/web/](../../specs/web/) (existing spec base) describes design-mode behavior. If review later determines the design-mode contract (which env var, which fakes, which control-panel scenarios) should be documented as a first-class spec, it can be added under `web/specs/design-mode/` in a follow-up. For now the design.md + tasks.md here are the source of truth.

## Impact

- **Behavior:**
  - With `PUBLIC_DESIGN_MODE` unset (every production-shaped env): zero behavior change. Every fake is fenced behind a single env check. The fake modules are tree-shakable: `src/design-mode/*` is imported from a single conditional in middleware/createDb/createAppAuth, and the rest of the app never references it.
  - With `PUBLIC_DESIGN_MODE=true`: app boots in <1 s on a cold Worker (PGlite WASM + seed); designer lands signed in; clicks anywhere work.
- **Bundle:**
  - `@electric-sql/pglite` adds ~2 MB WASM to the design Worker bundle. The design Worker is a separate deploy target — production Workers do **not** include PGlite (verified via the build script's tree-shake check in Phase F).
  - PGlite + fakes add ~80 KB of TypeScript to the source tree under `apps/web/src/design-mode/`.
- **Markup:** A new banner partial and a new floating control-panel component render only in DESIGN_MODE. Existing pages and components are untouched.
- **Routes:** Five new routes, all DESIGN_MODE-gated 404s otherwise: `/design-mode/fake-stripe-portal`, `/design-mode/fake-oauth-consent`, `/api/internal/design-mode/state` (control-panel mutations), `/api/internal/design-mode/reset` (re-seed), `/api/internal/design-mode/scenario` (jump to demo state).
- **Soft-nav:** Existing Astro `<ClientRouter />` flow unchanged. The control panel's nanostore + soft-nav refresh hook is additive.
- **Tests:** One new smoke test asserting `PUBLIC_DESIGN_MODE` is unset in test envs. No coverage targets touched.
- **Security:**
  - Net positive. The design Worker carries no real secrets — strictly weaker than any other deploy target.
  - Every fake is fenced behind `env.PUBLIC_DESIGN_MODE === 'true'`; an unset/undefined value is treated as "off." String comparison (not `!!`) so a literal `"false"` cannot accidentally enable it.
  - The fake-OAuth-consent page mints connection rows using a known fake encryption key shipped with the design Worker. That key is never reused for real envs (different `MASTER_ENCRYPTION_KEY` value entirely).
  - The new `/api/internal/design-mode/*` routes assert `env.PUBLIC_DESIGN_MODE === 'true'` and return 404 otherwise. They also do not require `INTERNAL_TOKEN` (since the engine is fake), which is correct for design mode and explicitly wrong for any other env.
  - Banner-on-every-page prevents a designer from mistaking the demo for production and reporting "I deleted X and now it's gone" as a bug.
- **A11y:** Banner and control panel use semantic `<button>` / `<dialog>` with proper labels. No regressions to existing pages.
- **OAuth runbook coupling:** None directly — design mode does **not** register new OAuth redirect URIs, does not change `PUBLIC_AUTH_BASE_URL`, and does not touch [shared/internal/oauth-setup.md](../../../shared/internal/oauth-setup.md). It short-circuits OAuth flows *before* the redirect URI matters. If [shared/internal/oauth-setup.md](../../../shared/internal/oauth-setup.md) §3 ever gains a "design env" row, it would be informational only (no real provider registration).

## Reversibility

Mechanical. Revert is the diff that adds:

- [apps/web/src/design-mode/](../../../apps/web/src/design-mode/) — the entire directory (delete it)
- [apps/web/src/components/design-mode/](../../../apps/web/src/components/design-mode/) — delete
- [apps/web/src/pages/design-mode/](../../../apps/web/src/pages/design-mode/) — delete
- [apps/web/src/pages/api/internal/design-mode/](../../../apps/web/src/pages/api/internal/design-mode/) — delete
- [apps/web/src/stores/design-mode.ts](../../../apps/web/src/stores/design-mode.ts) — delete
- The DESIGN_MODE check in [apps/web/src/middleware.ts](../../../apps/web/src/middleware.ts), [apps/web/src/db/worker.ts](../../../apps/web/src/db/worker.ts), [apps/web/src/lib/auth-factory.ts](../../../apps/web/src/lib/auth-factory.ts), [apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts), and each provider's OAuth helper — delete the conditional, keep the existing branch
- The `env.design` block in [apps/web/wrangler.jsonc.example](../../../apps/web/wrangler.jsonc.example) — delete
- The `dev:design` and `design:deploy` scripts in [apps/web/package.json](../../../apps/web/package.json) — delete
- The `@electric-sql/pglite` dependency in [apps/web/package.json](../../../apps/web/package.json) — `pnpm remove`
- [shared/internal/design-mode.md](../../../shared/internal/design-mode.md) — delete

No data migration. No prod env-var change. No prod deploy ordering. The hosted `baseout-design` Worker can be deleted at any time via `wrangler delete baseout-design`.
