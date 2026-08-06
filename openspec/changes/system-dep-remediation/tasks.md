# system-dep-remediation — tasks

No new behavior ships, so there is no red-green TDD loop; the **verification gate** per CLAUDE.md §3.4 is that every touched app's existing `typecheck` + `build` + test suite stays green after each batch, and `pnpm install --frozen-lockfile` is clean. Work lands as local commits (auto-memory: human-tested local-commit loop); the only push requested is the `product/website` cherry-pick (2.2), because Comp AI reads alert counts from origin. Batches are risk-ordered (criticals → highs) and independently revertible.

## 1. Triage (no code) — build the ledger

- [x] 1.1 Pull the authoritative open-alert list via `gh api repos/BaseOut/baseout/dependabot/alerts --paginate` (severity, package, manifest_path, GHSA, first-patched-version). Confirm the live totals vs the push-manifest's "2 critical / 67 high / ~159 total". — _2026-08-05: **173 open** (2C/69H/77M/25L), all npm; drifted up from the 159 in the push-manifest. Raw snapshot in session scratchpad._
- [x] 1.2 Classify every open alert into one bucket (design D1): `website-done` · `website-major` · `ws-inrange` · `ws-transitive` · `ws-major` · `risk-accept`. Disambiguate by manifest path (which app/lockfile owns it). — _Populations: website 89 (mostly `15f4537` safe-fix), pnpm-lock transitive 79, workspace-direct 5. Criticals: `better-auth` = ws-inrange (^1.6.5→≥1.6.11), `swiper` = ws-major (verify `theme/` live). All 71 crit+high have a patch available. Website "majors" (astro/@astrojs) partly overtaken by in-range backports — residual TBD at re-scan._
- [x] 1.3 Write the ledger to `shared/internal/comp-ai-dependabot-ledger.md` (severity × package × bucket × manifest × fix-version) — the batch worklist **and** the SOC 2 evidence artifact. — _Created `shared/internal/comp-ai-dependabot-ledger.md`._

## 2. product/website — push the already-done safe fixes

- [ ] 2.1 Cherry-pick `15f4537` onto the current scrubbed branch (design D2 recipe) — **do not merge the whole branch** (its base predates the Comp AI history purge); the commit touches only `product/website/package-lock.json`.
- [ ] 2.2 Re-verify `cd product/website && npm ci && npm run build` green, then **push** (the one approved exception; get explicit approval per §8). Confirms the website share of the count can drop on the next Dependabot scan.

## 3. Workspace — criticals

- [ ] 3.1 Remediate the 2 critical `ws-inrange`/`ws-transitive` alerts (design D3): in-range bump or scoped `pnpm.overrides`; `pnpm install` → `--frozen-lockfile` clean.
- [ ] 3.2 Verify: touched apps' `typecheck` + `build` + test suite green (baseline the known pre-existing failures — DO teardown hang, the 15 pre-existing web typecheck errors — do not chase). Commit locally with a §3.8 Verification block naming the cleared GHSA IDs.

## 4. Workspace — highs (batched)

- [ ] 4.1 Group the high `ws-inrange`/`ws-transitive` alerts by shared parent/manifest so one upgrade/override clears several; remediate smallest-blast-radius first (design D4).
- [ ] 4.2 Per batch: apply → `pnpm install` → `--frozen-lockfile` clean → touched-app `typecheck`/`build`/tests green → local commit with cleared-GHSA Verification block. Stop-the-line: a batch that turns a green suite red and isn't a trivial in-range fix gets backed out and reclassified to `ws-major`/`risk-accept` (do not `--force`).

## 5. Majors + risk-acceptance (decisions, not forced bumps)

- [~] 5.1 For each `website-major`/`ws-major` (known on entry: `astro 5→7`, `@astrojs/cloudflare 12→14` on `product/website`): record a Decisions-log entry in `design.md` (current→required major, what breaks, migration cost). — _2026-08-05: **`swiper` (ws-major) decided → risk-accept** (orphaned `theme/`=nexus-react template, not in workspace/lockfile/build). **Website majors deferred** — Dependabot now shows in-range backports (astro 5.15.8, @astrojs 12.6.6); true residual TBD at post-push re-scan (6.1). Both entries in design.md Decisions log._
- [ ] 5.2 Per decision, either **file a follow-up migration change** (`system-<pkg>-upgrade` / website-specific) referencing this ledger, or write a dated, owner-attributed **risk-acceptance** to `shared/internal/comp-ai-evidence/exception-register.md` (compensating control + re-review date). Default for the stale marketing site = risk-accept + schedule.

## 6. Close-out + SOC 2 evidence

- [ ] 6.1 After push + Dependabot re-scan, re-run the Comp AI `dependabot_enabled` + `code_scanning` checks; record before/after alert counts + the residual risk-accepted set in the ledger.
- [ ] 6.2 Cross-link the ledger from `shared/internal/comp-ai-policy-evidence-map.md` (vulnerability-patch-management + secure-development policies) so the auditor sees remediation + a governed exception process, not an open finding.
- [ ] 6.3 Full-repo sanity: `pnpm install --frozen-lockfile` clean from root; no `minimumReleaseAge` / frozen-lockfile policy was relaxed (grep the diff for lockfile-discipline config changes → none).
