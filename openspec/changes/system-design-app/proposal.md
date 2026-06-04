## Why

The boss wants a designer-friendly preview of the Baseout customer surface — a runnable app that boots without auth, without a database, without Cloudflare bindings, without OAuth, without Stripe — so the designer can navigate every customer-facing page end-to-end against realistic-looking fake data, edit shared components, and iterate without spinning up the full backend stack.

`apps/web` is the production frontend and depends on every one of those backends to render. Standing it up for a designer means setting up Postgres, Hyperdrive, the backup engine, the Trigger.dev worker, mkcert + a hosts-file entry for `baseout.local`, five OAuth registrations, and a Stripe test account. Most of that is invisible to the designer and irrelevant to design review.

This change introduces `apps/design/` — a thin sister app that imports every shared UI primitive from `apps/web` via a `@web/*` tsconfig + Vite path alias, but owns its own (a) pages, (b) middleware, (c) fixtures, and (d) catch-all API stub. The designer edits components inside `apps/web/src/components/`, `layouts/`, `styles/`, and `views/` — those changes flow to both apps automatically. apps/design exists to wire the runnable shell, not to hold UI.

## What Changes

- New workspace package `@baseout/design` at `apps/design/` — Astro 6.x SSR, Node adapter, port 4332.
- `astro.config.mjs` + `tsconfig.json` configure a `@web/*` alias that resolves to `apps/web/src/*`. `publicDir` points at `apps/web/public` so logos / fonts / icons resolve.
- `src/middleware.ts` injects fixture `user` + `account` into `Astro.locals`. No session, no DB, no auth. Honors `?fixture=empty|trial|failed` for state-variant previews.
- `src/fixtures/` holds typed mock data — `FIXTURE_ACCOUNT`, `FIXTURE_INTEGRATIONS_STATE`, `FIXTURE_BACKUP_RUNS` — typed against the real `@web/stores/connections#IntegrationsState` and `@web/lib/backup-runs/types#BackupRunSummary` interfaces so a view-prop drift surfaces as a TS error.
- `src/pages/` mirrors every customer-facing page in `apps/web/src/pages/` (excluding `/api`, `/ops`, and `/design-mode`). Each page is a thin shell that imports the shared `View` from `@web/views/` and feeds it fixture data.
- `src/pages/api/[...path].ts` is a single catch-all that returns realistic JSON for the small set of routes the rendered pages call from the client (run backup, cancel, delete, switch space, dismiss event, magic-link send, sign-out, onboarding complete, OAuth start). Everything else returns `200 { ok: true }`.
- Root `package.json` adds `pnpm design` → `pnpm --filter @baseout/design dev`.

## Capabilities

### New Capabilities

- `design-preview-app`: A runnable mirror of the customer-facing Baseout UI that boots without any backend dependency. Used by designers to iterate on shared UI components in `apps/web/src/` and see results live across every page in seconds, and by engineers as a stable visual regression surface that doesn't depend on Postgres or Trigger.dev being up.

### Modified Capabilities

One single-line addition to [apps/web/src/styles/global.css](apps/web/src/styles/global.css): an explicit `@source "../**/*.{astro,ts,tsx,html,mdx}"` directive next to the `@import "@opensided/theme/styles/tailwind.css"` import. This is a **no-op for apps/web** (Tailwind v4 already auto-scans the project root) but **load-bearing for apps/design**, which imports this stylesheet via `Layout.astro` from a different project root and would otherwise emit a CSS bundle missing every utility class used inside apps/web's components/layouts/views. The directive is documented in-place with the rationale.

## Out of Scope

- Refactoring `apps/web` pages or extracting more views into `apps/web/src/views/`. The current `View` boundary (DashboardView, IntegrationsView, PlaceholderView, NotFoundView, ConnectAirtableModal) is enough; if more shared views are needed later, that's an apps/web change, not an apps/design change.
- Hot reload from a published design tool (Pencil/Figma). The design app picks up file-edits via Astro's built-in HMR — that's the iteration loop.
- Storybook-style component browsing. The product surface IS the design review surface; component-in-isolation work can land later if useful.
- Visual regression testing / Playwright snapshots. The app is for human review; automating snapshot diffs is a future change if we decide it pays off.

## Risks + Mitigations

- **apps/web changes break the path-aliased imports.** If an apps/web file gains a transitive `db/schema` or `cloudflare:workers` import at module-top, apps/design's bundle blows up. Mitigation: the README documents which `@web/lib/*` modules are import-safe; tasks include a smoke step that runs `pnpm design` after every cross-cutting apps/web change to catch breakage early. Long-term mitigation: keep `apps/web/src/views/`, `components/`, `layouts/`, `styles/`, `stores/`, and `lib/types|ui|config|sidebar|backups/format` free of DB / Cloudflare module imports.
- **Fixture shape drift.** `IntegrationsState`, `BackupRunSummary`, and `AccountContext` are imported from `@web/*` for typing. If apps/web renames or restructures those shapes, the fixtures fail to compile. That's the intended behavior — a compile error beats a silent runtime divergence.
- **Designer edits the wrong place.** If the designer edits `apps/design/src/pages/`, those edits don't ship to production. README is explicit about which directories are shared vs. design-only.

## Status note

Initial implementation lives in commit (this branch). Smoke-tested by visiting every route at `http://localhost:4332` and confirming SSR + client-side interactions work against the catch-all API stub.
