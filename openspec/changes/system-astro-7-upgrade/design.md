# Design — system-astro-7-upgrade

## D1 — Order: smallest blast radius first, web last

`apps/support` (static Starlight, no adapter at runtime, already builds standalone) →
`apps/admin` (small SSR surface, one middleware) → `apps/design` (no deploy, build is the gate,
but carries the Storybook renderer) → `apps/web` (middleware, DO re-exports, islands, Storybook
coverage test, Playwright E2E). Each app lands as its own commit with its own green gates, so a
failure strands one app on 6.x rather than the whole train mid-upgrade.

## D2 — Read the breaking-change list BEFORE touching versions

Task 1.1 is reading the official Astro 7 upgrade guide (use the find-docs/ctx7 flow — training
data will be stale for a 2026 major) and writing the applicable-breakage list into this file.
Known watch items from our own tree, to be confirmed against the guide:

- `@astrojs/cloudflare` major pairing: the adapter version that supports Astro 7, and whether the
  worker-entry shape changes (web re-exports `ConnectionDO`/`SpaceDO` beside the handler —
  CLAUDE.md §5.1; any entry change must preserve that).
- Vite major that Astro 7 brings, vs the `vite@7` override already pinned in pnpm-workspace.yaml.
- Storybook's Astro Container API usage in web/design (`.storybook/render-astro.ts`) — the
  Container API has churned between majors before.
- Starlight major compatible with Astro 7 for support (+ `@astrojs/starlight-markdoc`).
- `astro:content` / content-collection loader API for the support docs collection
  (`docsLoader()` + extended `docsSchema`).
- `import.meta.env.DEV`-gated branches in web middleware (tree-shaking behavior must not change
  which branch ships — the Hyperdrive vs DATABASE_URL split, §5.1).

## D3 — product/website: archive over upgrade (recommendation)

The site is superseded (repo docs call it the pre-relocation marketing site) and its lockfile
holds all 3 remaining HIGH alerts. Archiving = `git rm -r product/website` (history preserves it)
+ a README pointer. If Dan wants it kept servable, the alternative is astro 5→7 +
flowbite-react 0.10 inside that npm lockfile — budget a separate slice for it, and note
flowbite-react's Tailwind coupling. BLOCKED on Dan's answer either way; ask alongside the
env-separation regroup.

## D4 — Verification is per-app §3.8, not one big smoke

Per app: typecheck + build + unit suite green, then deploy (where the app deploys) and one
behavior smoke — web: magic-link login + a Backups page load (poll survives); admin: staff gate +
tracker; support: `pnpm support:docs-check` still green (the register reads frontmatter through
the collection) + portal pages render; design: harness build + `audit:components` exit 0.
The dependabot dashboard is the final gate: astro alerts drop to zero on the workspace lockfile
after the last app lands on main.
