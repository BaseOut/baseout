# system-sync-skills — Keep the design fork, the live app, and the specs in sync as both sides iterate

## Status

PROPOSED — 2026-08-11. `system-*` scope (tooling/process; no app runtime code).
Motivated by [design-descriptions-readonly](../design-descriptions-readonly/proposal.md):
a **live-side** change that must flow **back** to the `ui-only` fork — a
direction today's one-way tooling does not handle.

## Why

Today's sync tooling (`system-ui-sync-workflow`) is proven but **one-directional**:
`ui-only` fork → `apps/design` (verbatim) → `apps/web` (promote + wire). It has
no answer when the live app is the source of truth and the fork must catch up —
which is exactly the write-back removal we just filed, and, generally, "continued
iterations on either side staying in sync." The concrete gaps, from a read of the
current trio (`.claude/skills/ui-sync/SKILL.md`, `shared/internal/ui-sync.md`,
`scripts/ui-sync-status.mjs`):

1. **No reverse path / drift detection.** `ui-sync-status.mjs` only computes
   `last-synced..ui-only/main` (fork-ahead). Nothing detects when
   `apps/design`/`apps/web` have local changes on a synced surface that the fork
   lacks (local-ahead), so a later forward sync silently **clobbers** them — the
   precise risk that would re-import the deleted write-back fake.
2. **Ledger drift is unenforced.** §3/§4/§5 of `ui-sync.md` are updated by hand
   "in the same change"; nothing fails a sync commit that forgot to. The 2026-07-29
   row still reads "(this commit)" and flags **~190 un-synced fork commits**.
3. **Promotion state is prose-only.** "Promoted / staged / deferred" lives in a
   markdown table with no machine check that a "promoted" surface isn't sitting on
   un-synced upstream changes.
4. **`storybook.ts` reconcile is manual.** Both repos edit the one catalog file;
   every sync is a hand-done 3-way merge with only prose guidance.
5. **Specs drift from code.** Separately: `openspec/changes/*` accumulate — some
   fully implemented but unarchived, some referencing files/symbols that have
   since moved — with no drift report. (You asked for this thread too.)

## What Changes

Three thrusts, phased, **extending the existing trio** rather than forking a
parallel system. Same three-artifact philosophy (procedure skill + mutable ledger
+ mechanical zero-dep script) the repo already proves for OAuth/R2/ui-sync.

**Thrust A — bidirectional drift + reverse-sync *(phase 1; standalone value)***
- **`scripts/sync-drift.mjs`** + root script `ui:sync-drift` — for every synced
  surface, classify: `in-sync` / `forward-pending` (fork ahead) /
  `reverse-pending` (local ahead of the pinned fork baseline) / `diverged` (both).
  Reverse detection compares the local file against the fork content at the
  last-synced hash (`git show ui-only/<hash>:<mapped-path>`), modulo the ledger's
  permitted import rewrites.
- **`.claude/skills/sync-reconcile/SKILL.md`** — the reverse procedure: take a
  local change on a synced file, **un-apply** the import-path rewrites per the
  ledger mapping table, emit a `git`-applyable **patch** against a `ui-only`
  checkout for a human to apply + push (never auto-push — honors the ui-sync
  never-do list). Includes the drift triage and the "which side wins" STOP points.

**Thrust B — harden the forward pipeline *(phase 2)***
- **`scripts/ui-sync-status.mjs --check`** — non-zero exit if a
  `chore(design): sync ui-only@<hash>` commit did not also modify
  `shared/internal/ui-sync.md` (ledger-update gate; usable in CI / pre-commit).
- **Machine-checkable promotion matrix** — parse `ui-sync.md §4`; warn when a
  surface marked "promoted" has a pending upstream delta on its `apps/web` paths.
- **`scripts/storybook-reconcile.mjs`** — print the three `storybook.ts` versions
  (local `apps/design`, fork@pinned, fork@HEAD) as a merge-base diff to de-risk
  the standing 3-way reconcile.
- Fold the new checks into `.claude/skills/ui-sync/SKILL.md` stages.

**Thrust C — OpenSpec ↔ code sync *(phase 2)***
- **`scripts/spec-sync-status.mjs`** + `spec:sync-status` — report:
  changes whose `tasks.md` are all `[x]` but unarchived (archive-ready); proposal/
  spec file-path or symbol references that no longer exist on disk (stale);
  optionally, shipped surfaces with no owning spec. Report only.
- **`.claude/skills/spec-sync/SKILL.md`** — procedure to triage that report:
  archive completed changes (delegates to `/opsx:archive`), open a follow-up for
  stale specs, flag missing coverage. Human judgment throughout.

## Non-Goals

- **No auto-push to `ui-only`.** Reverse-sync emits a patch; a human applies and
  pushes. The fork has unrelated history and is never merged (ui-sync.md §1).
- **No auto-apply of the reverse patch to `apps/design`** beyond what a normal
  edit + `ui:sync-drift` verification covers — the point is a reviewable patch,
  not a silent write.
- **No new runtime code, DB, or secret.** Scripts are zero-dep node; skills are
  markdown. `system-*` per CLAUDE.md §3.6.
- **No semantic diff / AST tooling** for `storybook.ts` — a merge-base text diff
  is the phase-2 bar; a real 3-way merge tool is deferred.
- **Phase 2 (Thrusts B & C) may be split** into their own `system-*` changes if
  Thrust A ships first and the appetite shifts — they are independent.

## Impact

- **New:** `.claude/skills/sync-reconcile/SKILL.md`,
  `.claude/skills/spec-sync/SKILL.md`, `scripts/sync-drift.mjs`,
  `scripts/storybook-reconcile.mjs`, `scripts/spec-sync-status.mjs`; root
  `package.json` script entries (`ui:sync-drift`, `spec:sync-status`).
- **Edited:** `scripts/ui-sync-status.mjs` (add `--check`), the promotion-matrix
  parse; `.claude/skills/ui-sync/SKILL.md` + `shared/internal/ui-sync.md`
  (reference the reverse path + new checks); a CLAUDE.md §3.7 line noting the
  reverse-sync/drift skill alongside the forward runbook.
- **First real use:** propagating `design-descriptions-readonly` up to `ui-only`
  (its task 7.1) — the reverse-sync skill's motivating case.
- No app runtime touched; no push/PR (human-tested local-commit loop).
