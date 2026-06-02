> **Standing workflow**: per [feedback_no_prs_human_test_then_local_commit.md](#), the agent implements, surfaces the smoke command, and waits for human approval before any local commit lands. No PR is opened from this change; no `origin/main` push happens without explicit user approval at the point of the push.

## Phase A — Env-flag plumbing + scaffold

### A.1 — `isDesignMode` guard

- [ ] A.1.1 Create [apps/web/src/design-mode/guard.ts](../../../apps/web/src/design-mode/guard.ts) exporting `isDesignMode(env: unknown): boolean` per [design.md](./design.md) §A.3. Strict `=== 'true'` string match.
- [ ] A.1.2 Add `designMode: boolean` to `App.Locals` in [apps/web/src/env.d.ts](../../../apps/web/src/env.d.ts).

### A.2 — Directory scaffold

- [ ] A.2.1 Create the empty directories listed in [design.md](./design.md) §A.2: `apps/web/src/design-mode/`, `apps/web/src/design-mode/fixtures/`, `apps/web/src/components/design-mode/`, `apps/web/src/pages/design-mode/`, `apps/web/src/pages/api/internal/design-mode/`. Drop a placeholder `.gitkeep` in each that won't get a file in Phase A so they survive lint.

### A.3 — Wrangler env block

- [ ] A.3.1 Append the `env.design` block to [apps/web/wrangler.jsonc.example](../../../apps/web/wrangler.jsonc.example) per [design.md](./design.md) §F.2. Include the comment block explaining the absence of Hyperdrive, services, and secrets is intentional.
- [ ] A.3.2 Add `PUBLIC_DESIGN_MODE` to the `Env` interface in `apps/web/worker-configuration.d.ts` (or wherever the auto-generated env shape lives) as `PUBLIC_DESIGN_MODE?: string`.

### A.4 — Dependency

- [ ] A.4.1 `pnpm --filter @baseout/web add @electric-sql/pglite`. Verify the lockfile updates cleanly.
- [ ] A.4.2 Sanity smoke: import `PGlite` in a one-off script under [apps/web/scripts/](../../../apps/web/scripts/), instantiate it, run `SELECT 1`, log the result, delete the script. Confirms the dep is importable under the project's TS config and runs in `astro dev`.
- [ ] A.4.3 **PGlite-in-workerd smoke**: build the design-mode Worker bundle locally (`wrangler deploy --env design --dry-run --outdir=/tmp/baseout-design-bundle`), inspect that `pglite.wasm` is referenced via Wrangler's module-resolution path and not stripped, then run `wrangler dev --env design --local --port 4444` in a scratch worktree, hit `http://localhost:4444/api/internal/design-mode/state` with a smoke handler that instantiates PGlite and runs `SELECT 1`. If this fails, **stop**: PGlite-in-workerd is the single-point-of-failure for this change, and a fallback (Node-based design preview, or a hand-rolled fixtures facade) needs to be chosen with the user before Phase C continues. Document the outcome inline in [design.md](./design.md) §Overview if the call changes.

## Phase B — Auth stub

### B.1 — Middleware bypass

- [ ] B.1.1 Add the DESIGN_MODE branch at the top of [apps/web/src/middleware.ts](../../../apps/web/src/middleware.ts) per [design.md](./design.md) §B.1. Branch reads the `design-mode-user-id` cookie, defaults to `'admin'`, looks up the stub user row in PGlite, and synthesizes `session` + `user` + `account` on `context.locals`. Falls through to existing `better-auth` branch only when `isDesignMode(env)` is false.
- [ ] B.1.2 Extend `PUBLIC_PATHS` / `isPublicRoute` per [design.md](./design.md) §B.3 — `/design-mode/*` and `/api/internal/design-mode/*` are public when DESIGN_MODE is on.

### B.2 — `auth-factory.ts`

- [ ] B.2.1 Add a DESIGN_MODE branch at the top of [apps/web/src/lib/auth-factory.ts](../../../apps/web/src/lib/auth-factory.ts) that returns a `better-auth` instance whose magic-link transport is a no-op. The no-op uses the structured logger from [apps/web/src/lib/](../../../apps/web/src/lib/) (verify the existing logger module's name; if none exists, add one rather than `console.*`). Log line includes recipient + template for debugging.

### B.3 — Logout

- [ ] B.3.1 In DESIGN_MODE, the sign-out handler ([apps/web/src/pages/api/auth/sign-out.ts](../../../apps/web/src/pages/api/auth/sign-out.ts) or equivalent) clears the `design-mode-user-id` cookie and redirects to `/login`. Verify the `/login` page renders cleanly when no stub user is active (designer needs to see the signed-out UX).

## Phase C — PGlite-backed DB

### C.1 — PGlite handle

- [ ] C.1.1 Create [apps/web/src/design-mode/pglite.ts](../../../apps/web/src/design-mode/pglite.ts) per [design.md](./design.md) §C.1. Module-level singleton handle + `seedPromise` single-flight gate.

### C.2 — Migration runner + seed

- [ ] C.2.1 Create [apps/web/src/design-mode/seed.ts](../../../apps/web/src/design-mode/seed.ts) that:
  - Uses `import.meta.glob('../../drizzle/*.sql', { eager: true, as: 'raw' })` to read every migration.
  - Sorts by filename.
  - Runs each through `pg.exec()`.
  - Calls the fixture inserters in dependency order (users → orgs → spaces → connections → bases → backup_runs).
- [ ] C.2.2 Verify migration ordering matches what Drizzle would do on a fresh DB; if any migration references `IF NOT EXISTS` semantics PGlite doesn't support, adapt per the PGlite docs.

### C.3 — Fixtures

- [ ] C.3.1 Create [apps/web/src/design-mode/fixtures/users.ts](../../../apps/web/src/design-mode/fixtures/users.ts) per [design.md](./design.md) §C.4 — four stub users with stable UUIDs.
- [ ] C.3.2 Create [apps/web/src/design-mode/fixtures/orgs.ts](../../../apps/web/src/design-mode/fixtures/orgs.ts) — one Org plus the `tierOverrides` map keyed by tier. Tier→metadata mapping uses [shared/Baseout_Features.md](../../../shared/Baseout_Features.md) §5.5 verbatim.
- [ ] C.3.3 Create [apps/web/src/design-mode/fixtures/spaces.ts](../../../apps/web/src/design-mode/fixtures/spaces.ts) — Trial + Pro.
- [ ] C.3.4 Create [apps/web/src/design-mode/fixtures/connections.ts](../../../apps/web/src/design-mode/fixtures/connections.ts) — one Airtable + one Drive storage destination, plus the managed-R2 placeholder row consistent with the current `system-r2-park` stance (no R2 binding wired; the row exists so the storage-picker UI can render the "Managed (paused)" option).
- [ ] C.3.5 Create [apps/web/src/design-mode/fixtures/bases.ts](../../../apps/web/src/design-mode/fixtures/bases.ts) — three realistic schemas (project tracker, CRM, content calendar). Each base ID is a stable `app...` string; each table/field follows Airtable's `tbl.../fld...` prefix convention.
- [ ] C.3.6 Create [apps/web/src/design-mode/fixtures/backup-runs.ts](../../../apps/web/src/design-mode/fixtures/backup-runs.ts) — 50 completed runs spread over 30 days + 1 in-progress + 1 failed. Each run has corresponding `backup_run_bases` rows with realistic `records_synced` counts.
- [ ] C.3.7 Create [apps/web/src/design-mode/fixtures/scenarios.ts](../../../apps/web/src/design-mode/fixtures/scenarios.ts) — exports an object map of scenario name → `(db: AppDb) => Promise<{ redirectTo: string }>`. Scenarios per [design.md](./design.md) §E.4.

### C.4 — `createDb` swap

- [ ] C.4.1 Modify [apps/web/src/db/worker.ts](../../../apps/web/src/db/worker.ts) `createDb` signature to take `env` instead of `connectionString`. In DESIGN_MODE return the PGlite-backed instance + `sql: null`; otherwise existing `postgres-js` path with `env.HYPERDRIVE.connectionString` or `process.env.DATABASE_URL` per CLAUDE.md §5.1.
- [ ] C.4.2 Update the call site in [apps/web/src/middleware.ts](../../../apps/web/src/middleware.ts) to pass `env`. Adjust the `ctx.waitUntil(sql.end())` teardown to skip when `sql === null`.
- [ ] C.4.3 Update any other `createDb`/`createMasterDb` call sites in `apps/web` (scripts/* may use the node singleton — those are unaffected; verify by grep).

### C.5 — Tier-swap mutation

- [ ] C.5.1 Create [apps/web/src/pages/api/internal/design-mode/state.ts](../../../apps/web/src/pages/api/internal/design-mode/state.ts) POST handler. Body: `{ userId?, tier?, spaceId? }`. Reads the `tier → stripe_metadata` map from [apps/web/src/design-mode/fixtures/orgs.ts](../../../apps/web/src/design-mode/fixtures/orgs.ts) and UPDATEs the Org row in PGlite. Sets the `design-mode-user-id` cookie if `userId` provided. Returns 200 with new state. 404 (not 401/403) if DESIGN_MODE is off.

## Phase D — External-service fakes

### D.1 — Fake engine

- [ ] D.1.1 Create [apps/web/src/design-mode/fake-engine.ts](../../../apps/web/src/design-mode/fake-engine.ts) per [design.md](./design.md) §D.1. Methods: `triggerBackup`, `cancelBackup`, `getRunStatus`.
- [ ] D.1.2 The progress simulator uses `setInterval` for live ticks. Use `globalThis.setInterval` (the same one `wrangler dev --local` supports). Persist the interval handle in a module-level `Map<runId, NodeJS.Timer>` so `cancelBackup` can clear it.
- [ ] D.1.3 Modify [apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts) — add `getEngine(env)` shim that returns the fake in DESIGN_MODE. Route every existing call site that touches `env.BACKUP_ENGINE` through this shim. (Grep for `BACKUP_ENGINE` first to enumerate the call sites; update each.)

### D.2 — Fake Stripe portal

- [ ] D.2.1 Identify the current billing-portal route ([apps/web/src/pages/api/billing/portal.ts](../../../apps/web/src/pages/api/billing/portal.ts) or current equivalent — grep for `stripe.billingPortal` to find it). Add a DESIGN_MODE branch that returns `{ url: '/design-mode/fake-stripe-portal' }`.
- [ ] D.2.2 Create [apps/web/src/pages/design-mode/fake-stripe-portal.astro](../../../apps/web/src/pages/design-mode/fake-stripe-portal.astro) — a daisyUI card per [design.md](./design.md) §D.2. Renders only when `isDesignMode(env)` is true; otherwise 404.

### D.3 — Fake OAuth consent

- [ ] D.3.1 Create [apps/web/src/pages/design-mode/fake-oauth-consent.astro](../../../apps/web/src/pages/design-mode/fake-oauth-consent.astro). Accepts `?provider=<p>&state=<s>&redirect_uri=<r>`. Renders mock consent screen. `Approve` button redirects to `redirect_uri?code=fake_design_mode_code&state=<state>`. `Deny` redirects to `redirect_uri?error=access_denied&state=<state>`.
- [ ] D.3.2 Modify each provider's `getAuthorizationUrl` to return the fake URL in DESIGN_MODE:
  - [ ] D.3.2.a [apps/web/src/lib/airtable/](../../../apps/web/src/lib/airtable/) — find the Connect URL builder, add the branch.
  - [ ] D.3.2.b [apps/web/src/lib/google-drive/](../../../apps/web/src/lib/google-drive/) — same.
  - [ ] D.3.2.c [apps/web/src/lib/dropbox/](../../../apps/web/src/lib/dropbox/) — same.
  - [ ] D.3.2.d [apps/web/src/lib/box/](../../../apps/web/src/lib/box/) — same.
  - [ ] D.3.2.e [apps/web/src/lib/onedrive/](../../../apps/web/src/lib/onedrive/) — same. (OneDrive impl per [project_byos_box_onedrive_parked.md](#) is parked — if the directory is empty, leave the OneDrive branch as a TODO with a pointer to the parked status.)
- [ ] D.3.3 Modify each provider's callback handler to detect `code === 'fake_design_mode_code'` and mint a fake encrypted-token row directly, skipping the real provider's `/token` exchange. Each fake row uses the fake `MASTER_ENCRYPTION_KEY` value from `.dev.vars.design` so decryption round-trips work.

### D.4 — Force Airtable stubs on

- [ ] D.4.1 In [apps/web/src/middleware.ts](../../../apps/web/src/middleware.ts) — when DESIGN_MODE, treat `AIRTABLE_STUBS_ENABLED` as `'1'` for the purposes of `isPublicRoute` and the createAirtableClient path.
- [ ] D.4.2 Audit [apps/web/src/pages/api/stub/](../../../apps/web/src/pages/api/stub/) — list what's covered. If any Airtable surface the designer hits (bases list, schema discovery, attachment URLs) lacks a stub, add it. Otherwise the page silently 500s in design mode.

### D.5 — Fake email

- [ ] D.5.1 [apps/web/src/lib/email/](../../../apps/web/src/lib/email/) — add a DESIGN_MODE branch that returns success without sending. Structured logger info-line records the would-have-been recipient + template.
- [ ] D.5.2 Verify no raw `console.*` is added. Per [CLAUDE.md](../../../CLAUDE.md) §3.5.

## Phase E — Designer control panel

### E.1 — nanostore

- [ ] E.1.1 Create [apps/web/src/stores/design-mode.ts](../../../apps/web/src/stores/design-mode.ts) — `map({ activeUserId, activeOrgId, activeSpaceId, currentScenario })`. Hydrated server-side from PGlite via a JSON-script in the layout per [CLAUDE.md](../../../CLAUDE.md) §4.1.

### E.2 — Component

- [ ] E.2.1 Create [apps/web/src/components/design-mode/Banner.astro](../../../apps/web/src/components/design-mode/Banner.astro) per [design.md](./design.md) §E.5.
- [ ] E.2.2 Create [apps/web/src/components/design-mode/ControlPanel.astro](../../../apps/web/src/components/design-mode/ControlPanel.astro) per [design.md](./design.md) §E.1. Sections: Active user (radio), Active tier (dropdown), Scenarios (list), Reset (button).
- [ ] E.2.3 Wire both components into [apps/web/src/layouts/Layout.astro](../../../apps/web/src/layouts/Layout.astro) (and any other top-level layout used by `/ops`) — render only when `Astro.locals.designMode === true`.

### E.3 — Mutation flow

- [ ] E.3.1 ControlPanel's `<script>` subscribes to the nanostore and POSTs changes to `/api/internal/design-mode/state` (already built in C.5). On success, calls `astro.navigate(window.location.pathname, { history: 'replace' })`.
- [ ] E.3.2 Verify the soft-nav refresh preserves scroll position via Astro's `<ClientRouter />` behavior; if not, scroll-to-top is acceptable.

### E.4 — Scenarios

- [ ] E.4.1 Create [apps/web/src/pages/api/internal/design-mode/scenario.ts](../../../apps/web/src/pages/api/internal/design-mode/scenario.ts) POST handler. Body: `{ name }`. Looks up the scenario from `fixtures/scenarios.ts`, executes it against PGlite, returns `{ redirectTo }`.

### E.5 — Reset

- [ ] E.5.1 Create [apps/web/src/pages/api/internal/design-mode/reset.ts](../../../apps/web/src/pages/api/internal/design-mode/reset.ts) POST handler. Drops every table and re-runs migrations + seed. Returns 200. (Implementation note: faster to drop+recreate inside PGlite than to instantiate a fresh PGlite — verify in profiling; either is acceptable for the designer.)

## Phase F — Build + deploy

### F.1 — Scripts

- [ ] F.1.1 Add `dev:design`, `design:deploy`, `design:secrets` to [apps/web/package.json](../../../apps/web/package.json) per [design.md](./design.md) §F.3.
- [ ] F.1.2 Add `.dev.vars.design.example` documenting `MASTER_ENCRYPTION_KEY` (fake value) — no real provider secrets. Add `.dev.vars.design` to `.gitignore` if not already covered by the existing `.dev.vars*` glob.

### F.2 — Tree-shake guard

- [ ] F.2.1 Create [apps/web/scripts/check-design-mode-isolation.mjs](../../../apps/web/scripts/check-design-mode-isolation.mjs). Runs `wrangler deploy --dry-run --env dev --outdir=/tmp/baseout-web-dev-bundle`, then `grep -r "pglite" /tmp/baseout-web-dev-bundle` — exits non-zero if any match.
- [ ] F.2.2 Wire the script into the existing pre-commit hook or a CI step. Document in CLAUDE.md §3.x if appropriate, or surface in [shared/internal/design-mode.md](../../../shared/internal/design-mode.md) §Limitations.

### F.3 — Verify

- [ ] F.3.1 `pnpm --filter @baseout/web typecheck` — clean.
- [ ] F.3.2 `pnpm --filter @baseout/web build` — clean.
- [ ] F.3.3 `git diff -U0 -- apps/web | grep -E "console\.(log|debug|info|warn|error|trace)|debugger"` — empty (per CLAUDE.md §3.5).

### F.4 — Documentation

- [ ] F.4.1 Create [shared/internal/design-mode.md](../../../shared/internal/design-mode.md) with the seven sections per [design.md](./design.md) §F.5.
- [ ] F.4.2 Cross-link from [shared/Baseout_Implementation_Plan.md](../../../shared/Baseout_Implementation_Plan.md) under a new "Designer onboarding" subsection if one doesn't exist.

## Phase G — Smoke (human-in-the-loop)

Per the standing workflow, the agent will not commit until the human walks this smoke.

### G.1 — Local smoke

Surface this for the human tester:

- [ ] G.1.1 `pnpm --filter @baseout/web dev:design` — server boots, no errors.
- [ ] G.1.2 Visit `/` — marketing renders, no auth redirect.
- [ ] G.1.3 Visit `/login` — login UI renders, submit short-circuits to "check your email" without sending email.
- [ ] G.1.4 Visit `/welcome`, `/integrations`, `/backups`, `/restore`, `/schema`, `/reports`, `/profile`, `/settings`, `/ops` — each renders cleanly, dashboard data populated from PGlite.
- [ ] G.1.5 Click "Backup now" on the Pro Space — fake-engine simulator starts; backup progress bar ticks; completes in <30 s.
- [ ] G.1.6 Open control panel, switch tier to `Trial` — capability-gated UI updates (Pro features show "Upgrade" prompts).
- [ ] G.1.7 Open control panel, switch active user to `Read-only` — write actions become unavailable.
- [ ] G.1.8 Open control panel, jump to `Backup failed` scenario — `/backups/<runId>` renders the failure state.
- [ ] G.1.9 Open control panel, click `Reset` — state returns to seed.
- [ ] G.1.10 Initiate an OAuth Connect (Airtable, Google Drive, Dropbox, Box) — fake-consent screen renders, Approve creates a fake connection row, designer lands back in `/integrations` with the new connection visible.

### G.2 — Hosted smoke

- [ ] G.2.1 `pnpm --filter @baseout/web design:deploy` — Worker deploys.
- [ ] G.2.2 Visit `https://baseout-design.<account>.workers.dev/` — banner visible, dashboard renders.
- [ ] G.2.3 Walk the same checklist as G.1 against the hosted URL.

### G.3 — Production isolation

- [ ] G.3.1 `pnpm --filter @baseout/web run check-design-mode-isolation` — green (no PGlite in dev/staging/prod bundles).
- [ ] G.3.2 Verify a normal `wrangler dev` (non-design env) still boots cleanly and serves real-DB-backed pages — i.e. the env-flag check is correctly off by default.

### G.4 — Hand-off

- [ ] G.4.1 Draft the designer hand-off (Slack/email): hosted URL + "you're already signed in" + 30-second control-panel tour + GitHub-label-bug-report path + cold-start caveat.

### G.5 — Commit

- [ ] G.5.1 Once the human approves G.1–G.4, commit locally with a conventional-commits message: `feat(web): design mode — env-gated demo of the live app with PGlite + fakes`. No PR; no `origin/main` push without explicit user request.
