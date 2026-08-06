# system-wrangler-4-upgrade

> Follow-up to [`system-dep-remediation`](../system-dep-remediation/proposal.md) — resolves the largest residual Dependabot cluster (see that change's ledger §9).

## Why

`system-dep-remediation` cleared 100 of 174 Dependabot alerts and drove criticals to 0, but **12 high `undici` alerts remain** because they are pulled transitively by an **old wrangler**: `wrangler 3.114.17 → miniflare 3.20250718.3 → undici 5.29.0`. undici 5.x has no in-range patch (the fix lives in undici 6.24+/7.24+), and **forcing undici to 6.x via a `pnpm.overrides` would break miniflare** — so the remediation change deliberately left it (stop-the-line rule). The real fix is upgrading wrangler to 4.x, whose miniflare bundles a patched undici.

Scope note: this is dev/build-tooling only (wrangler/miniflare run at dev + deploy time, not in the shipped Worker), so the 12 highs are low real-world risk — but they still count against the SOC 2 `dependabot_enabled` posture, and staying current on wrangler is independently worthwhile.

## What Changes

- Bump `wrangler` to **4.x** across every app that declares it (`apps/web`, `apps/server`, `apps/admin`, and any other `apps/*` with a wrangler devDependency), respecting the workspace `minimumReleaseAge` gate (per the test-harness auto-memory the practical floor is **wrangler 4.112.0** — older 4.x are blocked or buggy; confirm the current oldest-allowed 4.x at implementation time).
- Reconcile the wrangler **4.x config/CLI deltas**: `wrangler.jsonc(.example)` schema changes, `compatibility_date`/`compatibility_flags`, any renamed flags in the `dev`/`deploy` scripts (`apps/web/package.json` etc.), and the `--var` precedence behavior the OAuth runbook depends on ([oauth-setup.md §5.1/§8](../../../shared/internal/oauth-setup.md)).
- Regenerate `pnpm-lock.yaml`; confirm miniflare's undici is now ≥ patched and the 12 `undici` highs clear on rescan.
- Per-app verification: `dev` boots, `build` green, `deploy:dev` still works (the `.dev.vars` secret-sync pipeline unchanged), Durable Object exports intact.

Out of scope: any runtime behavior change; the non-wrangler residual CVEs (tracked in the ledger); touching `@trigger.dev/*` (separately pinned + `minimumReleaseAge`-excluded).

## Capabilities

### Modified Capabilities

_None in `openspec/specs/` — a tooling upgrade; establishes no new product requirement._

## Impact

- **Repo-wide `system-*`** — wrangler is a shared build/deploy tool across `apps/web`/`server`/`admin`. Touches each app's `package.json`, `wrangler.jsonc(.example)`, possibly `dev`/`deploy` scripts, and `pnpm-lock.yaml`.
- **Security:** clears the 12 `undici` highs; no new secret/auth/SQL surface. **Consult [oauth-setup.md](../../../shared/internal/oauth-setup.md) first** — wrangler 4.x `--var` precedence and dev-host behavior are load-bearing for the OAuth redirect flow, and a config regression there silently breaks Reconnect (§3.7).
- **R2 / Trigger.dev:** unaffected (backups run on the Trigger.dev Node runner, not wrangler).
- **Risk:** medium — a major CLI/config upgrade; verify each Worker boots + deploys before landing. Reversible via lockfile + config revert.
