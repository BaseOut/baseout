# system-ui-sync-workflow — Codify the ui-only → design → web sync/promotion workflow

## Status

PROPOSED — 2026-07-10. Tooling/process only; no runtime code.

## Why

Dan iterates on UI/UX in `github.com/BaseOut/ui-only` (a monorepo fork with
**unrelated git history** — never mergeable). The repo has a proven 3-stage
pattern for landing that work — fetch → sync verbatim into `apps/design` →
promote into `apps/web` with real data wiring — but the procedure lives only
in commit messages (`789727e`, `6d4c698`, `53110f8`, `09949d3`) and memory.
Every run re-derives the mechanism, and the team directive from the
2026-07 strategy discussion ("repurpose existing, functional Storybook
widgets rather than recreating them") has no enforcement point in the
process itself.

The costs of the undocumented state are concrete: the "which files changed
since the last sync" archaeology is manual; the never-sync list (fork-local
tooling like `.claude/hooks/ds-guard.mjs`, root `package.json`) exists
nowhere; and the recurring functionality regressions (the backup live-status
"must refresh" bug) have no checklist gate at promotion time.

## What Changes

Three artifacts with distinct roles — mirroring the proven `oauth-setup.md`
split of procedure vs mutable state:

- **`.claude/skills/ui-sync/SKILL.md`** — the stable *procedure*, invocable
  as `/ui-sync`: preconditions, the four stages (status/scoping, sync →
  design, promote → web, data wiring), the repurpose directive with its
  intake order, the functionality-preservation checklist, the never-do list.
- **`shared/internal/ui-sync.md`** — the mutable *ledger*: remote +
  mechanism, path-mapping table, sync ledger (date | ui-only hash | baseout
  commit | scope), per-surface promotion status matrix, known traps.
  Updated in the same change as every sync/promotion (CLAUDE.md §3.7 rule).
- **`scripts/ui-sync-status.mjs`** + root `package.json` script
  `ui:sync-status` — the mechanical stage 0: parse the last synced hash from
  `git log --grep='ui-only@'`, fetch, report pending commits + changed files
  grouped by surface, and flag files whose local sync targets are dirty.

Plus a CLAUDE.md §3.7 extension making the runbook read-first/update
same-change rule apply to ui-only sync work.

## Non-Goals

- No mechanical test asserting allowlist rationales cite `SB_ENTRIES` ids —
  deferred until a promotion actually slips past the checklist + the
  existing `audit:components` gate.
- No automation of the sync itself (no scripted checkout) — file selection
  and path rewrites stay judgment calls guided by the runbook's mapping
  table.
- The first *run* of the workflow (sync ui-only@3153dfd, the schema-export /
  panels-round4 / notifications-inbox promotions) is separate work driven by
  this skill, filed as its own `web-*` changes.

## Impact

- New files only, plus two-line edits to root `package.json` and CLAUDE.md.
- No app runtime code touched; `system-*` scope per CLAUDE.md §3.6.
