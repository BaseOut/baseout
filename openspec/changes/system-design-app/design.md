## Context

The designer can't easily run `apps/web` end-to-end. It depends on Postgres (Hyperdrive), the backup engine service binding, the Trigger.dev worker, OAuth registrations for five providers, Stripe trial provisioning, an encryption key, and a `baseout.local` mkcert + hosts setup. Most of that is invisible to the designer and irrelevant to design review.

A standalone "preview" app that fakes everything below the UI is the cheapest path to giving the designer the full app surface to work against.

## Goals / Non-Goals

**Goals**

- The designer can boot the full Baseout customer UI with one command (`pnpm install` once, then `pnpm design`) and review every page in a browser at three breakpoints.
- Designer edits to shared UI (`apps/web/src/components/`, `layouts/`, `styles/`, `views/`) flow to both the design app and apps/web without copy-paste.
- Every customer-facing interaction (run backup, cancel, delete, switch space, reconnect, sign-out) either no-ops cleanly or appends a fake state change so the design review covers behavior, not just static markup.
- The design app's existence does not change apps/web's behavior, dependencies, or build.

**Non-Goals**

- Real auth, real DB, real OAuth, real Stripe.
- Hot-reload from external design tools (Pencil, Figma). Astro HMR is the iteration loop.
- Production deployment. The design app is dev-only — it has no `wrangler.jsonc`, no Cloudflare adapter, no secret handling, no public hosting target. It runs on `astro dev`.
- Storybook-style component browsing or visual regression tests. Both are reasonable follow-ups but not required for the boss's ask.

## Decisions

### Why a new app, not a `DESIGN_MODE` flag inside apps/web

A flag would force every loader (`getAccountContext`, `getIntegrationsState`, `listRecentRuns`, OAuth callback handlers, Stripe provisioning, etc.) to grow a `if (DESIGN_MODE) return fixture` branch. That spreads design-only code across the production tree and creates a permanent maintenance tax on apps/web. A sister app isolates the spoof entirely — apps/web stays exactly as it is.

### Why path alias, not copy

Copying components/layouts/styles into apps/design creates drift: every apps/web design improvement requires a parallel edit. Path alias (`@web/*` → `apps/web/src/*`) makes the design app a renderer harness over the production UI tree. The designer edits in `apps/web/src/` (where the code already lives) and sees results in both apps.

### Why Node SSR, not Cloudflare adapter

The Cloudflare adapter pulls in workerd, Hyperdrive proxying, KV bindings, and a wrangler config — all of which apps/design has zero use for. Plain `astro dev` on Node is one command, zero config, and the SSR contract is the same. Production parity is not a goal here.

### What pages are reused vs. copied

Three lib functions in apps/web are pure (`getProductName`, `getBreadcrumbs`, `getPageContext`) and safely importable. Five views in `apps/web/src/views/` (Dashboard, Integrations, Placeholder, NotFound, ConnectAirtableModal) take props and never touch `Astro.locals.db`. apps/design imports those directly.

Pages that mix fetching + rendering inline (login, register, welcome, profile, backups) are NOT reusable as-is — re-importing them would re-execute `getIntegrationsState`/`authClient.signIn.magicLink`/etc. Those four are rewritten as thin shells in apps/design that import the *components* from apps/web but stub the form handlers. Total inline page logic in apps/design is small (~500 lines across all pages).

### The fixture-variant query param

`?fixture=empty|trial|failed` lets the designer preview state variants from the URL bar — empty state, pre-onboarding, error state — without needing separate routes. The middleware reads the param and picks a fixture set. Three variants is enough for v1; if the designer asks for more, we add them as needed.

### The API catch-all

Pages render fine without an API surface, but interactions don't. The catch-all at `src/pages/api/[...path].ts` returns realistic-shaped JSON for the small set of routes the client-side `<script>` blocks call, and `200 { ok: true }` for everything else. This is what lets the designer click "Run backup now" and see the widget update.

The handler is one file, ~150 lines, with a clear path-matching switch. Easy to extend when new client-side fetches land.

### What's typed against `@web/*` and what isn't

Wire types (`IntegrationsState`, `BackupRunSummary`) are imported from `@web/*` so fixture shape drift is caught at compile time. `AccountContext` is mirrored locally in `src/fixtures/types.ts` because `@web/lib/account` transitively imports drizzle/`db/schema` at module top — type-only imports erase under Vite, but `astro check` would still need the dependency available. Mirroring the type is cheaper than adding drizzle as an apps/design dep.

## Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| An apps/web change adds a transitive `db/schema` or `cloudflare:workers` import to a shared component → apps/design fails to boot. | Medium. Discovered at boot time. | README documents the safe surface. Verification §6.5 runs `pnpm design` after cross-cutting apps/web changes. Long-term: keep shared components free of DB / Cloudflare imports at module-top. |
| Fixture shapes drift from `IntegrationsState` / `BackupRunSummary`. | Low. Compile error. | The fixtures are explicitly typed against the apps/web types via `@web/*` imports. |
| Designer edits `apps/design/src/pages/` thinking they're editing the production UI. | Medium. README is explicit + the path alias makes the source of truth visible in editor jumps. | First-week pairing with the designer; README; folder names suggest the boundary. |
| apps/design is mistaken for a deploy target. | Low. | `package.json` has no `deploy` script. README notes "dev-only." Future: a CI guard that fails if apps/design gains a `wrangler.jsonc` or `deploy:*` script. |

## Open Questions

- **Should `apps/design` get its own `/ops` mirror?** The user explicitly chose customer-facing-only for v1. If the staff-console gets meaningful design work later, file a separate change to add it (`/ops/*` paths + new fixtures for admin tables).
- **Should fixtures live in `packages/fixtures` to be shared with Playwright?** Maybe. Worth doing only if a second consumer materializes (Playwright E2E, Storybook). YAGNI for now.
- **Should we publish a hosted preview?** The boss didn't ask. If someone wants it later, we'd need a real auth gate even on the spoof app (the URL would otherwise be public). File separately if pursued.
