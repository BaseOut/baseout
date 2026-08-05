# website-astro-7-upgrade

> Follow-up to [`system-dep-remediation`](../system-dep-remediation/proposal.md) — the `product/website` major-gated residual (ledger §9). **Prefix note:** `website` is a pragmatic prefix for the standalone pre-migration marketing site (`product/website`), which is not an `apps/*` app; per CLAUDE.md §3.6 it sits closest to `system-*`. Rename if the site relocates into `apps/web`.

## Why

`system-dep-remediation` cleared the in-range (safe-fix) CVEs on the isolated `product/website` npm marketing site (25→11 `npm audit` vulns via `15f4537`), but a residual of **~4 high (+ mediums/lows) Dependabot alerts** remains behind two breaking majors on this 3-month-untouched site: **`astro 5 → 7`** (pulling patched `undici`/`sharp`/`ws`/`h3`) and **`@astrojs/cloudflare` 12 → 14**. These were deliberately **not** forced (`npm audit fix --force` = unattended breaking upgrade); they're a judgment call, not a weekend change.

There's a prior question worth answering first: `product/website` is **isolated** (npm, not in the pnpm workspace, imported by nothing, no CI) and the live app is migrating to `apps/web` (Astro 6). So the real decision is **migrate the stale marketing site to Astro 7, or risk-accept its residual and retire/relocate it** rather than invest in a major migration of soon-to-be-legacy code.

## What Changes

**This change is a decision + (conditionally) a migration.** Decide one of:

- **(A) Migrate** — `astro 5→7` + `@astrojs/cloudflare 12→14` on `product/website`, reconcile the Astro 7 breaking changes (config, content collections, adapter API), `npm run build` green, confirm the residual highs clear on rescan.
- **(B) Risk-accept + schedule retirement** — if the marketing site is being superseded by `apps/web`, log a dated risk-acceptance in the Comp AI exception register (isolated, no CI, not shipped to the app surface) and set a removal/relocation date instead of migrating soon-to-be-dead code.

Recommendation: **(B)** unless the marketing site is staying independent — migrating a stale, isolated site to a major Astro version ahead of even the live app (which is on Astro 6) is low-value.

## Capabilities

### Modified Capabilities

_None in `openspec/specs/` — dependency migration / risk decision for a standalone site._

## Impact

- **Isolated blast radius** — `product/website` only (npm; not in the pnpm workspace; cannot affect `apps/*`). Touches `product/website/package.json` + `package-lock.json` (path A) or the exception register (path B).
- **Security:** clears the residual website highs (A) or governs them (B). No shared-secret/auth/SQL surface.
- **Risk:** (A) medium — Astro 5→7 is two majors on unmaintained code; (B) negligible. Reversible either way.
