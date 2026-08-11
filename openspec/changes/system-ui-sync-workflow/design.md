# system-ui-sync-workflow — Design

## The three-artifact split

| Artifact | Role | Mutability |
|---|---|---|
| `.claude/skills/ui-sync/SKILL.md` | Procedure (stages, checklists, never-do) | Stable — edited only when the process itself changes |
| `shared/internal/ui-sync.md` | Ledger (mapping table, sync history, promotion matrix, traps) | Updated same-change on every sync/promotion |
| `scripts/ui-sync-status.mjs` | Mechanical status (pending delta, dirty-target flags) | Stable |

Rationale: the repo already proves this split works for OAuth (`oauth-setup.md`)
and R2 (`r2-setup.md`) — procedure that rarely changes stays out of the file
that changes every run, so ledger diffs stay reviewable.

## Where the "repurpose Storybook widgets" directive is enforced

1. **Hard gate (exists):** `pnpm --filter @baseout/web audit:components` —
   `component-classification.test.ts` forces every component into one of the
   three governance tiers and the raw-markup allowlist forces a written
   rationale per view. The skill makes running this a blocking promotion step.
2. **Checklist (new, in the skill):** per promoted view/component, name the
   catalog entry being repurposed (`SB_ENTRIES` in
   `apps/design/src/lib/storybook.ts`); intake order Storybook → daisyUI
   direct → never custom; allowlist rationale cites which catalog primitives
   are composed.
3. **Mechanical rationale-citation test:** deferred (see proposal Non-Goals).

## ui-sync-status.mjs mechanics

- Zero-dep node, same style as `scripts/openspec-changes.mjs`.
- Last-synced hash: `git log --grep='ui-only@' -n 1 --format=%s` on HEAD's
  history, regex `/ui-only@([0-9a-f]{7,40})/` (5 prior commits already match
  this convention).
- `git fetch ui-only` (skippable with `--no-fetch` for offline use).
- Pending: `git rev-list --count <last>..ui-only/main` +
  `git diff --name-only <last>..ui-only/main`, bucketed by path prefix:
  `apps/web/src/**` (web layer → localize into design, promote later),
  `apps/design/**` (verbatim), `overview/**` + `research/**` (docs),
  `openspec/changes/**` (import renamed), everything else (review; likely
  never-sync).
- Dirty-target flags: map each pending upstream path through the runbook's
  path-mapping rules and check `git status --porcelain` for the local target.

## Skill shape

Frontmatter matches the root `.claude/skills/openspec-propose` precedent
(name + description that triggers on "sync ui-only / pull the designs /
promote a view"). Body is stage-ordered with explicit STOP points where a
human decision is needed (promotion scoping, upstream open questions).

## Decisions

- Skill lives at root `.claude/skills/ui-sync/` (repo-wide process, matches
  openspec-* placement) — not per-app `.claude/skills/`.
- The status script never writes anything; the ledger is updated by whoever
  runs the sync, in the sync commit itself.
- `research/**` binary screenshots (`shots/*.png`) are never synced; the
  ledger records the upstream hash so they stay retrievable from the remote.
