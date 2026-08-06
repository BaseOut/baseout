# system-dep-remediation

## Why

GitHub Dependabot reports **~159 open alerts** across the `BaseOut/baseout` repository (per the Comp AI push-manifest: **2 critical, 67 high**, remainder moderate/low). Comp AI's `dependabot_enabled` / `code_scanning` SOC 2 checks read GitHub's dependency graph for the **pushed** repo, so this number is both a real security-debt signal and a live SOC 2 finding blocking the audit ([shared/internal/comp-ai-push-manifest.md](../../../shared/internal/comp-ai-push-manifest.md), [comp-ai-handoff-2026-08-03.md §9](../../../shared/internal/comp-ai-handoff-2026-08-03.md)).

The "159" is **not** 159 blindly-fixable pnpm bumps — it is three populations with different remediation paths, and treating them as one number is how a "quick fix" turns into a broken workspace:

1. **`product/website`** (npm-based marketing site, isolated from the pnpm workspace, imported by nothing, no CI). Already taken **25 → 11** on the local, **unpushed** branch `chore/website-dep-security` (commit `15f4537`, lockfile-only `npm audit fix`) per [comp-ai-website-dep-remediation.md](../../../shared/internal/comp-ai-website-dep-remediation.md). The remaining **11 (7 high, 4 low)** all sit behind two majors — `@astrojs/cloudflare 12→14` and `astro 5→7` — a real migration on a 3-month-stale site, i.e. a decision, not an unattended bump.
2. **The pnpm workspace (`apps/*`, `packages/*`)** — deliberately kept current under the repo's `minimumReleaseAge` + frozen-lockfile constraints (see the test-harness auto-memory). Most of the GitHub count here is **transitive** and must be resolved by upgrading in-range or via `pnpm.overrides`, never by relaxing the lockfile discipline.
3. **Alerts already remediated locally but not yet reflected on GitHub** because the fix is an unpushed local commit — these clear only after push + Dependabot re-scan, and must not be re-worked.

This change makes the remediation deliberate: **triage the real alert list first**, then remediate in risk-ordered batches with each app's existing typecheck/build/test suite as the regression gate, escalating the major-version migrations as explicit decisions rather than silently forcing them.

## What Changes

- **Triage pass (no code).** Pull the authoritative Dependabot alert list from GitHub (`gh api`), reconcile it against the three populations above, and produce a tracked breakdown by severity × package × fixability (in-range bump / `overrides` / major migration / already-fixed-unpushed / risk-accept). This becomes the working ledger and the SOC 2 evidence artifact.
- **Push the already-done `product/website` safe-fixes.** Cherry-pick `15f4537` onto the current scrubbed branch (per the documented cherry-pick recipe — **do not merge the whole branch**, its base predates the Comp AI history purge), re-verify `npm run build`, and push so Comp AI's count drops for the website share.
- **pnpm-workspace criticals, then highs.** Remediate the 2 criticals first, then the highs, in small risk-ordered batches — in-range upgrades or scoped `pnpm.overrides` for transitive CVEs — regenerating `pnpm-lock.yaml` under the frozen-lockfile/`minimumReleaseAge` discipline. After each batch: the touched apps' `typecheck` + `build` + full test suite stay green (the regression gate; CLAUDE.md §3.4). Batches are independently committable and reversible.
- **Major-version migrations become explicit decisions.** For alerts only fixable by a breaking major (`product/website` astro 5→7 / `@astrojs/cloudflare` 12→14, and any workspace equivalent), do **not** `--force`. Record each as a decision in `design.md` with cost/benefit and either schedule the migration as its own follow-up change or log a documented **risk-acceptance** (feeding the Comp AI exception register).
- **Re-scan + SOC 2 evidence.** After push, re-run the Comp AI `dependabot_enabled` / `code_scanning` checks and record the before/after alert counts as evidence.

Out of scope: relaxing `minimumReleaseAge` or the frozen-lockfile policy; any runtime behavior change beyond what a security patch inherently carries; the actual astro/@astrojs major migrations (each is its own change if elected); GitHub branch-protection / plan-tier decisions (tracked in the SOC 2 handoff §4); rotating the committed dev Postgres DSN (SOC 2 handoff §9 — separate decision).

## Capabilities

### New Capabilities

- `dependency-security`: the repository-wide posture requirement that Dependabot **critical** and **high** alerts are either remediated (in-range upgrade or scoped override) or carry a dated, owner-attributed risk-acceptance, with the remediation performed under the workspace's lockfile discipline and gated on green per-app verification.

### Modified Capabilities

_None in `openspec/specs/` — this establishes a new posture requirement; it does not alter an archived capability._

## Impact

- **Repo-wide, system-* scope.** Touches `pnpm-lock.yaml`, in-range `package.json` version ranges / `pnpm.overrides` across the workspace, and `product/website/package-lock.json` (the cherry-picked commit). No single app's runtime logic changes; the `system-` prefix is correct (repo-wide dependency hygiene per CLAUDE.md §3.6).
- **Verification:** per-batch `typecheck` + `build` + test-suite green in every touched app; `pnpm install --frozen-lockfile` clean; `product/website` `npm run build` green. No new tests are authored (dependency bumps have no new behavior to spec) — the existing suites are the regression harness, and any suite gap a bump exposes is fixed in place.
- **Security:** this **is** the security change — it reduces known-CVE exposure. It introduces no new secret, auth path, SQL surface, or external integration. The `minimumReleaseAge` supply-chain guard and frozen-lockfile discipline are preserved, not relaxed.
- **SOC 2:** directly clears / documents the `dependabot_enabled` + `code_scanning` findings and feeds the exception register for any risk-accepted majors. Companion to [comp-ai-handoff-2026-08-03.md §4](../../../shared/internal/comp-ai-handoff-2026-08-03.md).
- **Git hygiene:** local commits only, no push without explicit approval (auto-memory: human-tested local-commit loop). The `product/website` push is the one deliberate exception this change requests approval for, because the SOC 2 count cannot drop until it lands on origin.

## Reversibility

Each batch is a self-contained lockfile/override commit → `git revert` restores the prior dependency set; `pnpm install` regenerates from the reverted lockfile. The `product/website` push is a single cherry-picked lockfile-only commit, independently revertible. No schema, no data, no runtime-contract changes.
