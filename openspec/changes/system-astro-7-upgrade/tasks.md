# Tasks — system-astro-7-upgrade

## 1. Recon

- [ ] 1.1 Pull the official Astro 7 upgrade guide (ctx7/find-docs) + the matching
      `@astrojs/cloudflare`, Starlight, and Astro Container API migration notes; write the
      applicable-breakage list into design.md D2.
- [ ] 1.2 Confirm the target versions clear the CVEs (astro >= 7.0.10) and satisfy the
      pnpm `minimumReleaseAge` gate.

## 2. apps/support

- [ ] 2.1 Bump astro + starlight + starlight-markdoc + markdoc + check; fix breakage.
- [ ] 2.2 Gates: build (134 pages), typecheck, `pnpm support:docs-check` green,
      draft exclusion still holds (no baseout-is-live in dist), deploy + spot-check
      support.baseout.com.

## 3. apps/admin

- [ ] 3.1 Bump astro + @astrojs/cloudflare + check; fix breakage (middleware/session gate).
- [ ] 3.2 Gates: typecheck, build, vitest, deploy to baseout-admin-dev, staff-gate smoke.

## 4. apps/design

- [ ] 4.1 Bump astro (+ Container-API renderer under .storybook/); fix breakage.
- [ ] 4.2 Gates: design build green, `pnpm --filter @baseout/web audit:components` exit 0,
      Storybook renders a sample story.

## 5. apps/web

- [ ] 5.1 Bump astro + @astrojs/cloudflare + check (+ Storybook renderer); fix breakage.
      Verify the worker entry still re-exports ConnectionDO/SpaceDO and the
      `import.meta.env.DEV` middleware branches tree-shake as before (§5.1).
- [ ] 5.2 Gates: typecheck, build, full unit suite, stories-coverage test, Playwright E2E
      (or the tracer subset), local magic-link flow via the e2e token hook.
- [ ] 5.3 Deploy `deploy:production`; human smoke: login on console.baseout.com + Backups
      poll survives navigation.

## 6. product/website — DONE (decision: archive, Autumn 2026-08-27)

- [x] 6.1 Decision: ARCHIVE "for now" (Autumn, 2026-08-27 — kills the 3 remaining highs;
      history preserves it, recovery pointer at product/website-ARCHIVED.md).
- [x] 6.2 Executed: `git rm -r product/website` + pointer file + CLAUDE.md layout note.

## 7. Close out

- [ ] 7.1 Dependabot dashboard: astro alerts on pnpm-lock.yaml + app manifests at zero.
- [ ] 7.2 Remove the astro deferral note from pnpm-workspace.yaml overrides header.
- [ ] 7.3 Archive this change (opsx:archive) + lat check.
