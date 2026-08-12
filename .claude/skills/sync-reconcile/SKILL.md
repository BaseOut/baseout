---
name: sync-reconcile
description: Use when a LIVE-side change needs to flow BACK to the ui-only design fork, or to check whether apps/design and ui-only have drifted apart. Reverse of /ui-sync (fork→design→web). Detects in-sync / forward-pending / reverse-pending / diverged per surface and stages a human-approved patch UP to ui-only. Never auto-pushes.
---

# sync-reconcile — reverse-sync + drift triage (ui-only ⇄ apps/design)

`/ui-sync` moves work ONE way: `ui-only` fork → `apps/design` → `apps/web`. This
skill covers the other direction and the drift check, so **iteration on either
side stays in sync**. It is the sibling of `/ui-sync` over the same ledger
(`shared/internal/ui-sync.md`) — read that ledger first, always.

The motivating case: `design-descriptions-readonly` removed the faked Airtable
write-back from `apps/design/.../EntityPanel.astro`. That is a live-side edit the
one-way pipeline can't propagate, and which a future forward `/ui-sync` would
silently re-import. This skill is how it flows back up.

## Preconditions

- Read `shared/internal/ui-sync.md` §1, §2 (mapping table), §4 (promotion
  matrix), §5 (traps) FIRST.
- `git fetch ui-only` is done for you by the drift script (skip with `--no-fetch`
  when offline; it reuses the last fetched `ui-only/main`).
- Know the last design-sync point: the most recent `chore(design): sync
  ui-only@<hash>` commit. The drift script prints it.

## Step 1 — read the drift report

```
pnpm ui:sync-drift                         # whole repo
pnpm ui:sync-drift --path apps/design/src/components/schema   # one surface
```

Each synced file gets one of four verdicts (see `scripts/sync-drift.mjs`):

| verdict | meaning | action |
|---|---|---|
| `in-sync` | neither side changed it since the sync | nothing |
| `forward-pending` | the fork changed it | hand to `/ui-sync` (forward) |
| `reverse-pending` | WE changed it (`apps/design/**`), fork did not | Step 2 — emit a patch UP |
| `diverged` | BOTH changed it | Step 3 — STOP, reconcile per file |

## Step 2 — reverse-sync a `reverse-pending` file UP to ui-only

For each `reverse-pending` file `P` (always `apps/design/**`):

1. Produce the local diff since the sync point:
   `git diff <syncCommit>.. -- P` (the script prints `<syncCommit>`; include the
   working tree if the edit is uncommitted: `git diff <syncCommit> -- P`).
2. **Invert the import-path rewrites** the forward sync applied, per
   `ui-sync.md §2` "Permitted rewrites" (e.g. relative `../../lib/ui` → the fork's
   `@web/...` form; the `src/lib/ui.ts` shim). The patch must apply against the
   fork's copy of the file, whose path is the §2 inverse of `P` (usually the same
   path in the fork's full monorepo tree, or its `apps/web/src/**` origin).
3. Write the patch to `patches/ui-only/<P>.patch` (git-applyable).
4. **STOP. Hand the patch to a human** to apply against a `ui-only` checkout,
   verify, and `git push`. NEVER push to `ui-only` yourself. NEVER `git merge
   ui-only` (unrelated history — ui-sync.md §1).
5. After the human confirms the push, update `ui-sync.md`: clear that surface's
   "pending reverse-sync" note (§4/§5) and, if it created a new fork sync point,
   add a §3 ledger row.

## Step 3 — a `diverged` file (STOP, human decides)

Diverged = the fork advanced the file AND we changed it since the sync. There is
no safe automatic answer. Surface BOTH diffs:

- local since sync: `git diff <syncCommit> -- P`
- fork since sync:  `git diff <lastSynced>..ui-only/main -- <forkPathOf(P)>`

Then ask the human which side wins, **per file** (or per hunk). Common outcomes:
take-ours-then-reverse-sync (re-apply the fork's other changes on top of ours),
take-theirs-then-reapply (forward-sync the fork, re-apply our edit), or a manual
merge. Do not guess.

> Example from `design-descriptions-readonly`: `EntityPanel.astro` is **diverged**
> — the fork advanced the panel while we removed the write-back. So it is NOT a
> clean reverse patch: reconcile the fork's panel changes against the write-back
> removal by hand, then push the combined result up.

## Step 4 — forward-pending

Not this skill's job — run `/ui-sync` (and `pnpm ui:sync-status` for the full
forward delta). Listed here only so one command gives the whole bidirectional
picture.

## Never-do (inherited from /ui-sync)

- Never push to `ui-only` or open a PR — human-tested local-commit loop.
- Never `git merge ui-only` (unrelated history).
- Never hand-edit a synced file beyond the §2 import-rewrite inversion.
- Never auto-resolve a `diverged` file.
- Never sync (either direction) while a file is `diverged` — reconcile first.

## Notes / limits

- v1 drift is a FILE-LEVEL model (commit ranges + working tree), not a
  content-level 3-way. It answers "did each side touch this file", not "do the
  bytes still match modulo rewrites." The content-level refinement (baseline =
  `git show ui-only/<hash>:<path>` with rewrite-aware normalization) is the
  documented follow-up in `system-sync-skills/tasks.md`.
- Large `forward-pending` counts are the accumulated un-synced fork backlog the
  ledger already flags (§3) — not new drift this run introduced.
