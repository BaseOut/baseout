## 1. Scaffold

- [x] 1.1 Create `apps/design/package.json` (`@baseout/design`, Astro 6 + Node adapter, port 4332, no wrangler, no DB scripts).
- [x] 1.2 Create `apps/design/astro.config.mjs` with `@astrojs/node` standalone adapter, `publicDir: ../web/public`, Vite `resolve.alias` for `@web/*`, `security.checkOrigin: false`.
- [x] 1.3 Create `apps/design/tsconfig.json` extending `astro/tsconfigs/strict` with `paths.@web/*` → `../web/src/*` and `include` extending into `../web/src/**`.
- [x] 1.4 Create `apps/design/.gitignore`.

## 2. Middleware + fixtures

- [x] 2.1 `src/env.d.ts` declares `App.Locals = { user, account }` (no `db`, no Cloudflare context).
- [x] 2.2 `src/fixtures/types.ts` mirrors `AccountContext` locally so apps/design doesn't transitively pull in drizzle through `@web/lib/account`.
- [x] 2.3 `src/fixtures/account.ts` exports `FIXTURE_USER`, `FIXTURE_USER_TRIAL`, `FIXTURE_ACCOUNT`, `FIXTURE_ACCOUNT_EMPTY`, `FIXTURE_ACCOUNT_TRIAL`.
- [x] 2.4 `src/fixtures/integrations.ts` exports `FIXTURE_INTEGRATIONS_STATE` (Airtable + Google Drive + 3 bases, 1 unread space event) and `FIXTURE_INTEGRATIONS_STATE_EMPTY`. Typed against `@web/stores/connections#IntegrationsState`.
- [x] 2.5 `src/fixtures/backup-runs.ts` exports 8 typed `BackupRunSummary` rows covering queued / running / succeeded (×3) / trial_succeeded / failed / cancelled, plus `FIXTURE_BACKUP_RUNS_EMPTY` and `FIXTURE_BACKUP_RUNS_FAILED` variants.
- [x] 2.6 `src/middleware.ts` reads `?fixture=` and assigns `locals.user` + `locals.account` from the fixture set. No session check, no DB call.

## 3. Pages

Mirror every customer-facing `.astro` route in `apps/web/src/pages/`. Each is a thin shell — `<SidebarLayout>` (or `<AuthLayout>`) wrapping a `<View>` from `@web/views/`, with fixture props.

- [x] 3.1 `/` (`index.astro`) — `DashboardView` with `FIXTURE_ACCOUNT`, `FIXTURE_INTEGRATIONS_STATE`, `FIXTURE_BACKUP_RUNS`.
- [x] 3.2 `/integrations` — `IntegrationsView` with the same fixtures.
- [x] 3.3 `/backups` — `RunBackupButton` + `BackupHistoryWidget`. (apps/web's `backups.astro` does the same; we mirror inline rather than depend on a not-yet-extracted `BackupsView`.)
- [x] 3.4 `/restore`, `/schema`, `/reports`, `/help` — `PlaceholderView`.
- [x] 3.5 `/settings` — inline minimal account-settings card (matches apps/web).
- [x] 3.6 `/profile` — Avatar + TextInput form; submit is a fake "saved" message (no `authClient.updateUser`).
- [x] 3.7 `/login`, `/register` — `AuthLayout` + form; submit dispatches a fake "check your email" success after 600ms.
- [x] 3.8 `/welcome` — `AuthLayout` + onboarding form; "Continue" no-ops to `/` after 500ms.
- [x] 3.9 `/404` and `/[...slug]` — `NotFoundView` (404 status).

## 4. API stub

- [x] 4.1 `src/pages/api/[...path].ts` — single handler exporting GET/POST/PATCH/PUT/DELETE/ALL. Returns realistic JSON for:
  - `GET /api/spaces` → fixture space list
  - `POST /api/spaces/[id]/backup-runs` → `{ ok, runId, triggerRunIds }` for the RunBackupButton path
  - `GET /api/spaces/[id]/backup-runs` → `{ runs: [] }` to keep the BackupHistoryWidget poll loop quiet
  - `POST /api/connections/airtable/start` and storage `/authorize` → `302 → /integrations?statusCode=connected`
  - `POST /api/connections/airtable/test` → fixture whoami response
  - `/api/auth/*` → better-auth-shaped success responses
  - Everything else → `200 { ok: true }`.

## 5. Wiring + docs

- [x] 5.1 Root `package.json` adds `"design"` and `"dev:design"` scripts.
- [x] 5.2 `apps/design/README.md` — one-page brief: how to boot, which directories the designer edits vs. doesn't edit, fixture query-string variants, what's stubbed.

## 5b. Apps/web touch — explicit @source

- [x] 5b.1 Add one-line `@source "../**/*.{astro,ts,tsx,html,mdx}"` next to the Tailwind import in [apps/web/src/styles/global.css](apps/web/src/styles/global.css). No-op for apps/web (Tailwind v4 auto-scans the project root), required for apps/design's Tailwind compilation to emit the utility classes used by shared components.

## 6. Verification

- [ ] 6.1 `pnpm install` at repo root resolves the new workspace.
- [ ] 6.2 `pnpm design` boots Astro at `http://localhost:4332` with no errors.
- [ ] 6.3 Every page renders end-to-end (browser smoke):
  - `/`, `/integrations`, `/backups`, `/restore`, `/schema`, `/reports`, `/help`, `/settings`, `/profile`, `/login`, `/register`, `/welcome`, `/404`, an arbitrary `/foo` (catch-all).
- [ ] 6.4 Click each interactive control (Run backup, Cancel run, Delete run, Switch space, Reconnect Airtable, Sign out, Magic-link sign-in, Onboarding Continue). Each either no-ops cleanly or appends a fake state change — nothing 500s.
- [ ] 6.5 Live-edit smoke: edit a token in `apps/web/src/styles/global.css` (or markup in a `@web/components/ui/*.astro` component) while `pnpm design` is running. Confirm the design app hot-reloads with the change applied. Confirm `apps/web` still typechecks (`pnpm --filter @baseout/web run typecheck`).
- [ ] 6.6 Fixture-variant smoke: `/?fixture=empty`, `/?fixture=failed`, `/?fixture=trial`.
- [ ] 6.7 No regression in `apps/web`: `pnpm --filter @baseout/web run build` succeeds.

## 7. Optional follow-ups (file separately if pursued)

- [ ] 7.1 Add a Playwright smoke-test workflow that boots `apps/design` and screenshots every route — would catch the import-graph regressions Risk §1 documents.
- [ ] 7.2 If more apps/web pages get extracted into `src/views/`, replace the inline `/backups`, `/settings`, `/profile`, `/welcome` markup in apps/design with the new views.
- [ ] 7.3 If the designer wants per-component isolation (Storybook-style), file `<app>-design-components` or similar.
