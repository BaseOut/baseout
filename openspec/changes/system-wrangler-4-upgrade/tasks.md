# system-wrangler-4-upgrade — tasks

No new behavior ships; the gate is that every wrangler app still boots (`dev`), builds, and deploys after the upgrade, and `pnpm install --frozen-lockfile` is clean. Read [oauth-setup.md §3.7/§5.1/§8](../../../shared/internal/oauth-setup.md) BEFORE touching any `wrangler.jsonc`/`--var`/dev-host config. Local commits only; push per the approved remediation loop.

- [ ] 1.1 Inventory every `apps/*` that declares `wrangler` (grep `package.json`); record current versions (baseline `wrangler 3.114.17` on `apps/web`).
- [ ] 1.2 Bump `wrangler` to the oldest 4.x that clears the `minimumReleaseAge` gate (practical floor ≈ **4.112.0** per the test-harness memory — verify current). Regenerate `pnpm-lock.yaml`; `--frozen-lockfile` clean.
- [ ] 1.3 Reconcile `wrangler.jsonc(.example)` for the 4.x schema across apps; re-verify DO exports (`ConnectionDO`/`SpaceDO`), `compatibility_date`/`flags`, and the `--var PUBLIC_AUTH_BASE_URL` usage in the `dev` scripts (oauth-setup §5.1 precedence).
- [ ] 1.4 Verify per app: `dev` boots (baseout.local:4331 web, :4332 admin, server `wrangler dev`), `build` green, `deploy:dev` + `.dev.vars` secret-sync intact. Note any DO teardown-hang baseline (server memory) — don't chase.
- [ ] 1.5 Confirm on rescan that the 12 `undici` highs clear (miniflare's bundled undici now ≥ patched); update the `system-dep-remediation` ledger §9.
- [ ] 1.6 Update [oauth-setup.md](../../../shared/internal/oauth-setup.md) if any `--var`/dev-host/precedence behavior changed under 4.x (same-change rule, §3.7).
