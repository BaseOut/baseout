<!-- Change & Release Management (SOC 2 CC8.1). Keep the Verification section
     per CLAUDE.md §3.8 so reviewers can reproduce the result. -->

## What & why

<!-- The problem and the reasoning, not a file list. -->

## Verification

- **Demo:** <!-- one command + the observable result that proves it works -->
- **Test:** <!-- the automated test command(s) covering this change -->
- **Checks:** <!-- typecheck / build / db:check result you actually ran -->
- **Caveats:** <!-- env-gating, deployed-only, manual-only — or "n/a" -->

## Reviewer checklist

- [ ] Tests included for non-trivial logic (§3.4)
- [ ] No stray `console.*` / `debugger` (§3.5)
- [ ] Server-side validation on any new mutating route (§3.3)
- [ ] Secrets via `.dev.vars` / Cloudflare Secrets, none committed (§3.3)
- [ ] Spec reconciled (PRD / Features) where behavior changed
