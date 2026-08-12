# system-sync-skills — Design

## Principle: extend the trio, don't fork it

The repo already proves the **procedure / ledger / mechanical-script** split
(OAuth, R2, ui-sync). This change adds the missing *directions* and a sibling for
specs, reusing the existing ledger (`shared/internal/ui-sync.md`) and the existing
last-synced-hash convention (`git log --grep='ui-only@'`) as the shared substrate.
No parallel ledger, no second source of truth.

| New/changed artifact | Role | Thrust |
|---|---|---|
| `scripts/sync-drift.mjs` | Mechanical: per-surface sync verdict (both directions) | A |
| `.claude/skills/sync-reconcile/SKILL.md` | Procedure: reverse-sync + drift triage | A |
| `scripts/ui-sync-status.mjs` (`--check`) | Gate: ledger-update + promotion-matrix checks | B |
| `scripts/storybook-reconcile.mjs` | Mechanical: 3-way catalog diff | B |
| `scripts/spec-sync-status.mjs` | Mechanical: openspec↔code drift report | C |
| `.claude/skills/spec-sync/SKILL.md` | Procedure: triage/archive/flag | C |

## Drift model (Thrust A) — the core idea

For a synced file `P` with last-synced fork hash `H`:

- **fork baseline** = `git show ui-only/H:<fork-path(P)>` (content the monorepo
  copied from), with the ledger's permitted import rewrites applied → the
  expected local content at sync time.
- **fork head** = `git show ui-only/main:<fork-path(P)>`.
- **local** = working-tree `P`.

Verdict:

| local vs baseline | forkHead vs baseline | verdict |
|---|---|---|
| same | same | `in-sync` |
| same | changed | `forward-pending` (fork ahead — normal `/ui-sync`) |
| changed | same | `reverse-pending` (local ahead — needs reverse-sync) |
| changed | changed | `diverged` (STOP — human reconcile) |

`fork-path(P)` and the import-rewrite reversal both come from `ui-sync.md §2`'s
path-mapping table — the single source of truth, so the drift script and the
`/ui-sync` skill can never disagree about mappings.

## Reverse-sync mechanics (Thrust A)

1. `git fetch ui-only`; resolve `H` from the last sync commit subject.
2. `sync-drift.mjs` lists `reverse-pending` / `diverged` files.
3. For each `reverse-pending` file: `git diff H..HEAD -- P` on the local side,
   run the **inverse** of the §2 import rewrites (e.g. relative `../..` →
   `@web/...`), and emit `patches/ui-only/<P>.patch`.
4. Human applies the patch to a `ui-only` checkout, verifies, pushes. The skill
   STOPs before any push (ui-sync never-do list: "never push or open PRs — human-
   tested local-commit loop"; "never `git merge` ui-only").
5. Update `ui-sync.md`: clear the surface's "pending reverse-sync" note.

`diverged` never auto-resolves — the skill surfaces both diffs and asks which
side wins, per file.

## Why a new skill, not just more `ui-sync` stages

`/ui-sync` is a *forward* mental model (fetch → design → web) with a clean
stage order. Reverse-sync inverts the flow and adds a genuinely different STOP
structure (which-side-wins per file, patch-to-fork). Bolting it onto the forward
skill would muddy both. `sync-reconcile` owns the reverse + drift path and links
back to `/ui-sync` for the forward case — same ledger, two procedures. (Mirrors
how `openspec-propose` and `openspec-archive-change` are separate skills over one
`openspec/` substrate.)

## Forward hardening (Thrust B)

- **Ledger gate:** `ui-sync-status.mjs --check` inspects the tip commit; if its
  subject matches `chore(design): sync ui-only@`, assert the same commit touched
  `shared/internal/ui-sync.md` (`git show --name-only`). Exit non-zero otherwise.
  Wire into CI's existing checks; do not add a new hook framework.
- **Promotion matrix:** parse the §4 table (fixed columns `surface | synced at |
  promoted in | data wired | legacy rollback`); for rows with a non-empty
  "promoted in", cross-check `forward-pending` on that surface's `apps/web` paths
  and print a warning. Reporting only — promotion is still human-judged.
- **`storybook-reconcile.mjs`:** emit the merge-base-style 3-way (local /
  fork@H / fork@main) for `apps/design/src/lib/storybook.ts`. Text only; the
  human still edits.

## Specs↔code (Thrust C)

`spec-sync-status.mjs` (zero-dep), three checks:

- **archive-ready:** `openspec/changes/*/tasks.md` where every `- [ ]`/`- [x]`
  line is checked and no `archive/` entry exists → suggest `/opsx:archive`.
- **stale references:** scan `proposal.md`/`design.md`/`specs/**` for
  `apps/**`/`packages/**`/`scripts/**` path tokens; `fs.existsSync` each; report
  misses. (Path-token regex only — no symbol resolution in v1.)
- **coverage (optional, off by default):** surfaces/routes with no owning spec —
  noisy, so gated behind a flag.

`spec-sync` skill triages the report: archive, open a follow-up, or flag missing
coverage. It composes with the existing `openspec-*` skills rather than replacing
them.

## Decisions

- **Skills at root `.claude/skills/<name>/`** (repo-wide process; matches
  `ui-sync` / `openspec-*`). Minimal frontmatter (`name` + `description`); **no
  `allowed-tools`** — the repo precedent (no skill uses it).
- **Scripts zero-dep node**, style of `scripts/ui-sync-status.mjs` /
  `scripts/openspec-changes.mjs`. Report/patch only; never mutate tracked files,
  never push.
- **One ledger.** `ui-sync.md` stays the source of truth for mappings + sync
  history; drift/reverse read it, they don't shadow it.
- **Phase 1 = Thrust A** is independently shippable and is what unblocks the
  `design-descriptions-readonly` upstream propagation. B and C can split into
  their own `system-*` changes if the appetite narrows.
- **No new secrets, bindings, or runtime code.** `system-*` boundary respected;
  if a skill ever needed app logic, it would be re-scoped (per §3.6).
