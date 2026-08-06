# website-astro-7-upgrade — tasks

Decision-first change. `product/website` is isolated npm (no pnpm workspace, no CI), so verification = `npm run build` green + rescan. Local commits; push per the remediation loop.

- [ ] 1.1 **Decision:** migrate (A) vs risk-accept + retire/relocate (B). Input needed: is `product/website` staying independent, or being superseded by `apps/web`? (Recommendation: B unless it stays independent.)

### If (A) migrate
- [ ] 2.1 `astro 5→7` + `@astrojs/cloudflare 12→14` in `product/website/package.json`; `npm install`.
- [ ] 2.2 Reconcile Astro 7 breaking changes (config, content collections, adapter API, image/sharp); `npm run build` → Complete!.
- [ ] 2.3 Confirm the residual `astro`/`sharp`/`ws`/`undici` website highs clear on rescan; update the `system-dep-remediation` ledger §9.

### If (B) risk-accept
- [ ] 3.1 Log a dated, owner-attributed risk-acceptance in `shared/internal/comp-ai-evidence/exception-register.md` (isolated site, no CI, not on the app surface; compensating control + retirement/relocation date).
- [ ] 3.2 Record the retirement/relocation plan (fold into `apps/web` or delete) so the residual doesn't linger indefinitely; update the ledger §9.
