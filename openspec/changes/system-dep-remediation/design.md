# system-dep-remediation — design

## Constraints that shape the approach

- **Frozen lockfile + `minimumReleaseAge`.** The pnpm workspace pins `pnpm@9.12.0` and runs under a `minimumReleaseAge` supply-chain guard that blocks just-published versions, plus frozen-lockfile CI. Remediation must work **inside** these — upgrade to an in-range, old-enough version, or pin a fixed transitive via `pnpm.overrides`; never `--force`, never bump `minimumReleaseAge` down to grab a fresh patch, never hand-edit the lockfile.
- **Three disjoint populations, three paths** (see proposal §Why). The single GitHub number spans a non-workspace npm site, the pnpm workspace, and already-fixed-unpushed work. Conflating them is the failure mode.
- **No local Docker PG / limited integration harness.** Same deferral as the rest of the repo — verification leans on `typecheck` + `build` + unit suites, which is sufficient for dependency bumps (no new behavior).
- **Local-commit loop.** All work lands as local commits pending human smoke; the only push this change requests is the `product/website` cherry-pick, because the SOC 2 alert count is read from origin.

## D1 — Triage before touching anything

Remediation order is driven by a ledger, not by `pnpm audit` output alone. Build it from GitHub's own alert graph:

```
gh api repos/BaseOut/baseout/dependabot/alerts --paginate \
  -q '.[] | select(.state=="open") | {sev:.security_advisory.severity, pkg:.dependency.package.name, manifest:.dependency.manifest_path, ghsa:.security_advisory.ghsa_id, fixed:.security_vulnerability.first_patched_version.identifier}'
```

Classify each open alert into exactly one bucket:

| Bucket | Meaning | Action |
|---|---|---|
| `website-done` | in `product/website`, fixed by `15f4537` (unpushed) | push via cherry-pick (D2); do NOT re-work |
| `website-major` | `product/website`, only a major fixes it | decision (D5) |
| `ws-inrange` | pnpm workspace, an in-range/old-enough version fixes it | batch bump (D3/D4) |
| `ws-transitive` | pnpm workspace, transitive; direct dep can't move | `pnpm.overrides` pin (D3/D4) |
| `ws-major` | pnpm workspace, only a breaking major fixes it | decision (D5) |
| `risk-accept` | no safe fix and not exploitable in our usage | documented acceptance (D5) |

The ledger (severity × package × bucket × manifest) is written to `shared/internal/comp-ai-dependabot-ledger.md` and is the SOC 2 evidence artifact + the batch worklist. Manifest path disambiguates which app/lockfile owns each alert.

## D2 — product/website: push what's already fixed

The safe-fixes commit exists locally but its branch base predates the Comp AI history purge, so **the whole branch must not be merged/pushed** (it would reintroduce scrubbed history to origin). Cherry-pick the single lockfile-only commit onto the current scrubbed branch (recipe in [comp-ai-website-dep-remediation.md §"How to integrate"](../../../shared/internal/comp-ai-website-dep-remediation.md)):

```
git cherry-pick 15f4537        # touches only product/website/package-lock.json
cd product/website && npm ci && npm run build   # re-verify green
```

Then push (the one approved exception). This is the fastest single alert-count drop and it is fully isolated (`product/website` is npm, imported by nothing, no CI, cannot affect `apps/*`).

## D3 — Workspace remediation mechanism

For `ws-inrange`: raise the direct dependency's range in the owning `package.json` to the patched version (respecting `minimumReleaseAge` — pick the oldest patched version that clears the guard), then `pnpm install` to regenerate the lockfile.

For `ws-transitive`: add a scoped `pnpm.overrides` entry pinning the vulnerable transitive to its first patched version, scoped as narrowly as possible (`"parent>child": "x.y.z"` form when only one path is affected). Prefer an override over dragging a direct dep across a major just to move a transitive.

Regenerate with `pnpm install` (never edit `pnpm-lock.yaml` by hand); confirm `pnpm install --frozen-lockfile` is clean afterward.

## D4 — Batching + verification gate

Batch **by risk, smallest blast radius first**: the 2 criticals as their own batch(es), then highs grouped by shared parent/manifest so one override/upgrade clears several alerts. Each batch:

1. Apply the bump/override for that batch only.
2. `pnpm install` → `pnpm install --frozen-lockfile` clean.
3. In every app the batch touches: `pnpm --filter @baseout/<app> typecheck` + `build` + test suite green (per CLAUDE.md §3.4; the existing suites are the regression harness). Known pre-existing failures (e.g. the DO teardown hang, the 15 pre-existing web typecheck errors noted in the SOC 2 handoff §7) are recorded as baseline, not chased here.
4. Commit the batch locally with a §3.8 Verification block naming the cleared GHSA IDs. Independently revertible.

Stop-the-line: if a batch turns a green suite red and the fix isn't a trivial in-range adjustment, back the batch out and reclassify the alert to `ws-major` or `risk-accept` rather than forcing it.

## D5 — Majors and risk-acceptance

Breaking-major fixes (`website-major`, `ws-major`) are **not** performed here. For each:

- Record a decision entry (package, current→required major, what breaks, migration cost) in this file's Decisions log.
- Either **elect a migration** → file it as its own change (`system-<pkg>-upgrade` or `web-*`/website-specific), referencing this ledger; or **risk-accept** → write a dated, owner-attributed entry to the Comp AI exception register (`shared/internal/comp-ai-evidence/exception-register.md`) with the compensating control and re-review date.

The known majors on entry: `product/website` `astro 5→7` (live `apps/web` is on Astro 6, so 7 isn't even where the product is) and `@astrojs/cloudflare 12→14`. Default recommendation for the stale marketing site is **risk-accept + schedule**, not an unattended weekend migration.

## D6 — Close-out + SOC 2 evidence

After push + Dependabot re-scan: re-run the Comp AI `dependabot_enabled` + `code_scanning` checks, record before/after counts and the residual (risk-accepted) set in the ledger, and cross-link it from the policy→evidence map so the auditor sees remediation + a governed exception process rather than an open finding.

## Decisions log

- **2026-08-05 · `swiper` critical → RISK-ACCEPT (orphaned template).** The `swiper@^11.2.10` critical (GHSA-hmx5-qpq5-p643) is in `theme/package.json` = `nexus-react`, a `private` purchased React admin template. It is **not in the pnpm workspace** (`pnpm-workspace.yaml` covers `apps/*`, `apps/embed/*`, `packages/*` only), has **no workspace importer**, and swiper is **absent from `pnpm-lock.yaml`** — never installed, built, or deployed. No production exposure → no swiper 11→12 migration. Remediation = exception-register entry (task 5.2) + remove `theme/` or add a Dependabot ignore path so it stops alerting. See ledger §7.
- **Website majors (`astro`, `@astrojs/cloudflare`) → DEFERRED to post-rescan.** Dependabot now lists in-range fixes (`astro` 5.15.8 on the 5.x line; `@astrojs/cloudflare` 12.6.6 on 12.x) that partly overtake the older doc's "needs 5→7 / 12→14" claim. The true major-only residual can only be decided after the `15f4537` safe-fix push + Dependabot re-scan (task 6.1). Do not pre-commit to a migration.
