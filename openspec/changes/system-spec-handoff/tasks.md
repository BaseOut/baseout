# Tasks — system-spec-handoff

Tooling-only (`system-*`, §3.6). One skill that **composes** `opsx:propose` + `sync-reconcile`'s
staging discipline over the `ui-sync.md` ledger — no `apps/*`/`packages/*` runtime code, no new state
file, no reporter, no inbound direction. Validated by a dry-run.

## 1. The `spec-handoff` skill

- [x] 1.1 Author `.claude/skills/spec-handoff/SKILL.md` (front-matter `name` + `description`;
      numbered procedure in the `ui-sync`/`sync-reconcile` house style): identify the surface →
      **confirm it is ABSENT from the fork** via `git ls-tree -r ui-only/main -- <path>` + `ui-sync.md`
      §2/§4 (bail to `/sync-reconcile` if present-and-edited; nothing if present-and-in-sync) → author
      a **self-contained** fork-side `openspec/changes/<x>/` (invert §2 `web-` prefix) with proposal +
      specs + **additive** tasks + **the relevant UI code** + a **`docs/` artifact explaining the
      changes**, citing `ui-sync.md §N` (§6) → stage a `change/<x>` branch (or `patches/ui-only/**`
      patch) adding plan + code + docs → STOP for the human upload → add the ledger §4/§7 handoff note.
      (`.claude/skills/spec-handoff/SKILL.md` — Steps 1–4 + Never-do + Notes.)
- [x] 1.2 Encode the guardrails explicitly: never merge into `ui-only`, never auto-push, never a PR,
      never `git merge ui-only`, **never implement it for him**, never hand-edit a synced file beyond
      the §2 inversion. Deliverable = **a plan the designer runs himself, WITH the relevant UI code +
      docs** — not a spec alone, and not our backend/db/auth wiring.
      (SKILL.md "Never-do" section + Prime directive.)

## 2. Docs

- [x] 2.1 `shared/internal/ui-sync.md` — add a "Handoff (a surface the fork LACKS → plan + code)"
      section: the placement table (vs `ui-sync`/`sync-reconcile`), the procedure, the
      self-contained/he-implements + code + docs deliverable, and the §4/§7 handoff-note convention.
      (New §7.)
- [x] 2.2 CLAUDE.md §3.7 + `openspec/AGENTS.md` — a pointer to `spec-handoff`, alongside the existing
      `ui-sync` / `sync-reconcile` / `spec-sync` references.
      (CLAUDE.md §3.7 reverse-direction paragraph; AGENTS.md §10 "where do I start?" table row.)

## 3. Dry-run validation

- [x] 3.1 Ran `/spec-handoff` against **`apps/admin`** (scoped slice: the table-primitives kit).
      Presence check `git ls-tree -r ui-only/main -- apps/admin` → 0 (absent ✓). Authored fork-side
      `openspec/changes/admin-console/` (proposal + specs + additive tasks + `docs/admin-console.md`)
      **bundling the real UI code** (FilterBar/SortHeader/Pager/EntityLink + the two pure helpers) and
      emitted a **git-applyable** `patches-ui-only/openspec-admin-console.patch` (10 new files). Dry-run
      artifacts staged in scratchpad only; ledger §4/§7 handoff-note convention exercised in the docs.

## 4. Verification

- [x] 4.1 Author-and-stop verified: `git apply --check` **OK** and the patch applied cleanly to a
      fresh checkout (all 10 files — plan + code + docs — land at the right fork paths); our
      `apps/admin` is untouched (`git status apps/admin` clean); no dry-run artifact leaked into the
      repo; `ui-only/main` tip unchanged (zero push/merge). Tasks are additive (add-only, apply from
      the fork's current branch). No stray `console.*` introduced.
      **Demo:** `git apply --check patches-ui-only/openspec-admin-console.patch` → OK, then apply →
      10 files. **Checks:** repo + fork untouched. **Caveats:** scoped slice (table kit), not the
      whole admin app; fork code-location (`apps/admin/**` vs `apps/design/**`) is the designer's
      confirm — flagged in the plan's task 0.1 + docs.
