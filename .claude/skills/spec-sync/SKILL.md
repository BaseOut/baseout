---
name: spec-sync
description: Use to reconcile OpenSpec change/spec docs against the shipped codebase — find changes that are fully implemented but not archived, and completed changes that cite files which no longer exist. Triage the `pnpm spec:sync-status` report; composes with /opsx:archive. Report-driven, human-judged.
---

# spec-sync — keep OpenSpec docs in sync with the code

OpenSpec changes accumulate: some are fully implemented but never archived, some
cite files that have since moved or been deleted. This skill triages the drift so
`openspec/changes/` reflects reality. It reads a report — it does not edit specs
or archive on its own.

## Step 1 — run the reporter

```
pnpm spec:sync-status
```

It scans the active (non-`archive`) changes under `openspec/changes/` and prints:

- **archive-ready** — every checkbox in `tasks.md` is `[x]` (or `[~]` skipped),
  so the change is implemented but still active.
- **stale references** — for archive-ready changes only, `apps/… packages/…
  scripts/… shared/…` file paths cited in the docs that are missing on disk.
  (In-progress changes are skipped — their paths may be not-yet-created.)

## Step 2 — triage archive-ready changes

For each archive-ready change, confirm it truly shipped (spot-check the Demo/Test
lines in its `tasks.md`, or that its code is on the branch), then:

```
/opsx:archive <name>
```

Per CLAUDE.md §3.6 archived changes flow into `openspec/specs/`. Do NOT archive a
change whose tasks are checked but whose work you cannot verify landed — flip the
box back and finish it first (a checked box you can't substantiate is a §3.4
violation, not a done task).

## Step 3 — triage stale references

A stale ref in a **completed** change means the code moved after the spec was
written. Per file:

- **File was renamed/moved** → update the citation in `proposal.md` /
  `design.md` / `specs/**` to the new path (the spec is the durable record).
- **File was deleted (feature reverted)** → note it in the change; if the whole
  change was undone, it should be revised or removed, not archived as-if-shipped.
- **False positive** (a path inside a code fence that was illustrative, not a real
  file) → leave it; tighten the citation wording if it recurs.

## Notes / limits

- v1 is path-token level (has-an-extension, exists-on-disk) — NOT symbol
  resolution. A cited function/const that was renamed inside an existing file is
  not caught. Symbol-level detection is the documented follow-up.
- The reporter never fails the build (exit 0). Wire its exit into CI only once
  the archive backlog is drained, so it doesn't block on pre-existing debt.
- This is the OpenSpec sibling of the UI-fork drift skills (`/sync-reconcile`,
  `/ui-sync`): same "report → human triage" shape, different substrate.
