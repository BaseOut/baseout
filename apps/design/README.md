# `@baseout/design` — UI/UX Preview App

A runnable, fully-styled mirror of the Baseout customer app, wired to
in-memory fixtures. No login. No database. No OAuth. No Stripe. No
Cloudflare. Every page renders end-to-end the moment you boot it.

It exists for one reason: let the designer (and reviewers) open the
real app in a browser, click every page, and iterate on shared UI
components without spinning up Postgres, the backup engine, OAuth
registrations, mkcert, or `baseout.local`.

---

## TL;DR

```bash
# from the repo root, once
pnpm install

# any time after
pnpm design
```

Open <http://localhost:4332>. That's it. The app is already "signed
in" as a fixture user named **Reese Designer** in **Demo Org / Demo
Space**.

> If you forget the port, the script prints it on boot. The full alias
> is `pnpm --filter @baseout/design dev`; `pnpm design` from the repo
> root is the shortcut.

---

## What you'll see

Every customer-facing page in `apps/web` is rendered against fixtures.
Sidebar nav, top bar, theme toggle, breadcrumbs, and inline panels all
behave the way they do in production.

| Path            | What's on it                                                                |
| --------------- | --------------------------------------------------------------------------- |
| `/`             | Dashboard — welcome card, org/space/next-step cards, backup history (8 runs spanning every status), system-status strip, quick links |
| `/integrations` | Integrations — Airtable connection (active), one storage destination (Google Drive), 3 bases (2 selected for backup), a "new bases discovered" banner, base-selection form, frequency picker, storage picker, run-backup button |
| `/backups`      | Backups — run-backup CTA + the full backup history widget (queued, running, succeeded, failed, cancelled, trial entries)              |
| `/restore`      | Placeholder ("ready for content")                                            |
| `/schema`       | Placeholder                                                                  |
| `/reports`      | Placeholder                                                                  |
| `/help`         | Placeholder                                                                  |
| `/settings`     | Minimal account-settings card                                                |
| `/profile`      | Profile-info form with avatar, name, email                                   |
| `/login`        | Sign-in screen with magic-link form (no real email sent — see below)         |
| `/register`     | Register screen (same shape as login)                                        |
| `/welcome`      | Onboarding wizard form — name, job title, org name, referral source          |
| `/404`          | Not-found page                                                               |
| `/<anything>`   | Anything not listed falls through to the 404 view                            |

---

## State variants

Add a `?fixture=...` query to any page to swap the underlying data:

| Query              | What changes                                                                |
| ------------------ | --------------------------------------------------------------------------- |
| *(none)*           | Default — fully-onboarded user, one Airtable connection, runs in mixed states |
| `?fixture=empty`   | Zero state — no connections, no bases, no backup runs                        |
| `?fixture=failed`  | Only a single failed backup run is visible on the history                    |
| `?fixture=trial`   | Pre-onboarding — no org, no space. `/` redirects you nowhere, but `/welcome` is the page to look at for this state |

Examples:

- `http://localhost:4332/?fixture=empty` — preview the "first run" dashboard
- `http://localhost:4332/integrations?fixture=empty` — preview the "no Airtable connected" Integrations page
- `http://localhost:4332/welcome?fixture=trial` — preview the onboarding form for a brand-new user

---

## What works vs. what's faked

The visual surface and the navigation are real. Server-side actions
are stubbed to either no-op cleanly or append a fake state change so
you can preview the interaction without anything actually happening.

### What works as expected

- Clicking nav items, the sidebar collapse, theme toggle (light/dark)
- Sidebar Space switcher (UI only — switching is a no-op visually)
- "Run backup now" — adds a fake run to the history
- Cancel / Delete buttons on individual runs — UI updates, no
  persistence
- "Connect Airtable" — redirects to `/integrations?statusCode=connected`
  (no actual OAuth dance)
- "Sign In / Send Sign-In Link" — shows the "Check your email" success
  panel after 600 ms (no email)
- "Continue" on `/welcome` — redirects to `/`
- "Save changes" on `/profile` — flashes a success message (no
  persistence)

### What is NOT real

- **No data persists.** Refresh the page and any fake interaction you
  triggered resets to the fixture.
- **No emails are sent.** All `authClient.signIn.magicLink(...)` calls
  are short-circuited to a fake success.
- **No backups actually run.** The "running" run on the dashboard is
  hard-coded; it never advances. New runs you trigger get a fake ID
  but never appear with progress because the polling stub returns
  empty.
- **No OAuth.** The Connect-storage buttons (Drive, Dropbox, Box,
  OneDrive) all redirect to the success page; none of them open the
  real provider's auth screen.
- **No Stripe.** No trial provisioning, no checkout.
- **No `/ops` staff console.** It's intentionally out of scope for v1.

---

## Editing the design

This is the part the design app is built for.

**Edit these directories — the changes show up in this app AND ship to
production via the normal `apps/web` PR flow:**

| Where                                | What lives there                                         |
| ------------------------------------ | -------------------------------------------------------- |
| `apps/web/src/components/ui/`        | Buttons, cards, inputs, badges, modals, tabs, avatars    |
| `apps/web/src/components/layout/`    | Sidebar, header                                          |
| `apps/web/src/components/backups/`   | Backup history widget, run button, frequency / storage pickers |
| `apps/web/src/layouts/`              | Page-level shells (Sidebar layout, Auth layout, base Layout) |
| `apps/web/src/views/`                | Dashboard, Integrations, Placeholder, NotFound, ConnectAirtableModal — the "page bodies" |
| `apps/web/src/styles/`               | Global CSS, theme overrides, per-component CSS           |

How the design app picks up your edits: pages here import their views,
layouts, and components via a `@web/*` TypeScript path alias that
resolves to `apps/web/src/*`. Astro hot-reloads on save, so changes
appear within ~200 ms of a save.

**Don't edit these in the course of design work** — they wire the
spoofed runtime, not the UI:

- `apps/design/src/pages/`        — thin shells that feed fixtures into the apps/web views
- `apps/design/src/layouts/`      — wrappers around apps/web layouts (only there to load the design's CSS @source extension)
- `apps/design/src/fixtures/`     — the fake account / connections / backup-run data
- `apps/design/src/middleware.ts` — assigns the fixture to `Astro.locals` on every request
- `apps/design/src/pages/api/[...path].ts` — catch-all for client-side `fetch()` calls
- `apps/design/src/styles/design.css` — Tailwind content-scan extension
- `apps/design/astro.config.mjs`, `tsconfig.json` — wiring

If you find yourself wanting to change a *page* (e.g., "the dashboard
should show this card differently"), the change probably belongs in
`apps/web/src/views/DashboardView.astro`, not in
`apps/design/src/pages/index.astro`.

### Editing fixtures (rare)

If you want to design against different fake data — a longer org name,
a backup run with a 50-line error message, a connection in the
`pending_reauth` state — edit:

- `apps/design/src/fixtures/account.ts`
- `apps/design/src/fixtures/integrations.ts`
- `apps/design/src/fixtures/backup-runs.ts`

These are typed against the same interfaces apps/web uses, so a
type-error pops up if you stray from a valid shape.

---

## Troubleshooting

**The page loads but the styles look broken / unstyled.**
Stop the dev server and re-run `pnpm design`. Tailwind's first run
sometimes misses a class on cold start; the second run picks it up.

**`pnpm install` complains about `minimumReleaseAge`.**
The repo enforces a 7-day waiting period on newly-published versions.
If a dep was bumped less than a week ago, downgrade it to the last
released version > 7 days old. This is rare in apps/design (it has
~10 deps).

**An import error like `Cannot find module 'cloudflare:workers'`.**
Some apps/web file you depend on transitively grew a runtime import
that's only valid inside Cloudflare Workers. Tell the engineer who
made that change; the workaround is either (a) pull the workerd-only
code out of the shared component, or (b) extend
`apps/design/src/lib/cloudflare-workers-stub.ts` to fake whatever the
new code reads.

**The app boots but `/integrations` 500s with a missing module error.**
Same root cause as above — something in the
`IntegrationsView`-tree-of-imports gained a backend-only dependency.

**I edited a file in `apps/web/src/components/` and nothing changed.**
Check that `pnpm design` is still running in your terminal. Astro's
HMR sometimes silently disconnects when you suspend the laptop or
your network drops.

**Hot reload sometimes loses scroll position / open modal state.**
Known and expected. The full-page swap on HMR is Astro's default for
SSR pages. Hit ⌘R to do it deliberately.

---

## For engineers

A few contracts to be aware of when extending or maintaining the
design app:

- **Type compatibility.** `IntegrationsState`, `BackupRunSummary`, and
  the fixture-shaped `AccountContext` are typed against the real
  apps/web definitions. If apps/web reshapes any of these,
  `apps/design/src/fixtures/*.ts` will fail to compile.
  That's the intended early-warning system.

- **No drizzle / cloudflare imports.** apps/design's runtime can't
  resolve `cloudflare:workers` or `db/schema` modules at the top of an
  apps/web file. The Vite config stubs `cloudflare:workers`; there's
  no equivalent for `db/schema`. Keep DB / Cloudflare-only code out of
  modules that anything in `apps/web/src/{components,layouts,views,
  stores,lib/{ui,types,config,sidebar}}/` imports at module-top.

- **Tailwind content scan.** apps/web's `src/styles/global.css` has an
  explicit `@source "../**/*.{astro,ts,tsx,html,mdx}"` directive. It's
  a no-op for apps/web (Tailwind already scans its project root) and
  load-bearing for apps/design (its Tailwind compilation root would
  otherwise miss every class used in apps/web shared components).
  Don't remove it.

- **New customer-facing pages in apps/web.** Add a mirror file under
  `apps/design/src/pages/` so the route renders here too. The mirror
  is usually 5–15 lines — `import SidebarLayout`, `import ViewFromWeb`,
  pass fixtures. See the existing pages for the shape.

- **New client-side API call.** If a page starts calling a new
  `/api/...` endpoint from a `<script>` block, add a matching branch
  to `apps/design/src/pages/api/[...path].ts` so the design app
  returns a sensible JSON response. Unknown paths fall through to
  `{ ok: true }`, which is usually fine but won't satisfy code that
  inspects the response body.

- **OpenSpec change.** `openspec/changes/system-design-app/` documents
  the architecture and the one apps/web edit this change introduced.

---

## Not a deploy target

The design app is local-dev only. It has no `wrangler.jsonc`, no
production env, no auth, and no rate limit — exposing it publicly
would leak the entire UI surface to anyone with the URL. If you ever
want a hosted preview, file a separate change to add a real auth gate.
