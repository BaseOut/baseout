# system-astro-7-upgrade

## Why

Every dependabot alert left open after the 2026-08-27 remediation wave (27 alerts: 3 high,
14 medium, 10 low) is one of two things, and both are Astro majors:

- **Astro 6.x CVEs across the workspace** — CVE-2026-73422 (`>= 2.9.0, <= 7.0.9`) and
  CVE-2026-59729/-59727 are fixed only in Astro **7.0.10+**. Every 6.x version is vulnerable, so no
  override or patch bump can clear them; `apps/web` (6.4.8), `apps/admin` (6.1.2), `apps/design`
  (6.4.8) and `apps/support` (6.1.2) all carry them.
- **`product/website` on Astro 5.8.1** — its own lockfile holds the 3 remaining HIGH alerts
  (astro <6.3.3/<6.4.6 + deepmerge-ts via flowbite-react), all requiring majors (astro 5→7,
  flowbite-react 0.10).

The overrides mechanism (pnpm-workspace.yaml) explicitly excludes cross-major upgrades of
framework packages; this is the follow-up change that mechanism's header has pointed at since the
2026-08-05 remediation.

## What Changes

- **Astro `^6.x` → `^7.0.10+`** in `apps/web`, `apps/admin`, `apps/design`, `apps/support`, plus
  the matching majors of the integration packages each app uses (`@astrojs/cloudflare`,
  `@astrojs/check`, `@astrojs/starlight` + `starlight-markdoc` + `markdoc` in support,
  `@astrojs/sitemap`, Storybook's Astro renderer in web/design). One app per task, verified
  independently — web last, because it has the largest surface (middleware, islands, Storybook
  coverage gate, E2E).
- **`product/website` gets a decision, not silently an upgrade**: either (a) archive it (git
  history keeps it; kills 10 alerts including all 3 highs — the marketing site was superseded and
  the repo docs already call it legacy), or (b) upgrade astro 5→7 + flowbite-react. Decision is
  Dan's; default recommendation is (a).

## Capabilities

### New Capabilities

None — dependency/security change; behavior must be identical after.

### Modified Capabilities

None at the spec level. Runtime-visible changes are limited to whatever Astro 7's breaking-change
list forces (to be enumerated in design.md task 1 from the official v7 upgrade guide).

## Impact

- Blast radius: every Astro app's build pipeline, the `@astrojs/cloudflare` adapter contract
  (worker entry re-exports for DOs in web), Vite/vitest interplay, Storybook's Container-API
  renderer, and the support portal's Starlight + markdoc stack.
- CI: typecheck/build/test must be green per app before the next app starts.
- Deploys: each app redeploys after its bump; smoke per §3.8 Verification (login flow on web,
  staff gate on admin, portal build/serve on support, harness render on design).
- NOT in scope: any feature work, any wrangler/environment changes (Dan's separation work is
  in flight), the Astro 5 marketing site's content.
