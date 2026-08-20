# X16 — A 915-line dead island behind the backups widget

**Found:** 2026-08-15, incidentally, while converging `CONFIRM_DESTRUCTIVE` (not by a dead-code sweep).
**Status:** REPORTED, NOT ACTED ON. Deleting 4 files is Oleh's call, and there is a precedent for
keeping a dead file on purpose (`IntegrationsView.astro`).

## What it is

`apps/web/src/components/backups/BackupHistoryWidget.astro` (550 lines) is rendered by nothing live.
Its only `.astro` mention is `IntegrationsView.astro` — the view CLAUDE.md records as
**deliberately kept as a copy deck, not a screen**. The live `/backups` page says so itself:

```
apps/design/src/pages/backups.astro:3
// Replaces the old RunBackupButton card + accordion BackupHistoryWidget.
```

And the widget is the **sole importer** of three modules, so they die with it:

| file | lines | only importer |
|---|---|---|
| `components/backups/BackupHistoryWidget.astro` | 550 | `IntegrationsView.astro` (itself dead) |
| `lib/backups/delete-button.ts` | 117 | the widget |
| `lib/backups/cancel-button.ts` | 102 | the widget |
| `lib/backups/widget-lifecycle.ts` | 146 | the widget |
| **total** | **915** | |

Verified with real imports, not mentions — the other files matching `BackupHistoryWidget` name it in
a doc comment (`"Mirrors the SSR markup in BackupHistoryWidget.astro"`), which is not an import:

```bash
grep -rna "from '.*backups/delete-button'" apps/web/src apps/design/src   # → the widget, twice
```

## Why it was invisible

The dead-view check in CLAUDE.md walks `apps/web/src/views/*.astro`. This is a **component**, and
its three orphans are `lib/`. Neither is in that loop's scope, so the sweep that deleted seven views
in August could not have seen this cluster. `ds-audit` reads it (it is tracked, and clean); `smoke`
never requests it, because no route renders it.

## The cost of leaving it

It is not inert. It is a **second, divergent implementation of two live behaviours** — run cancel and
run delete — with its own SSR markup, its own runtime HTML twin, and its own lifecycle. Anyone
grepping for the delete button finds it first (it sorts before `BackupsListView`). This convergence
pass hit exactly that: `delete-button.ts:52` was one of the seven sites rewriting `CONFIRM_DESTRUCTIVE`
by hand, and it was fixed — **in dead code**, which is work spent on a file no user reaches.

## Recommendation

Delete all four, in one commit, **unless** the widget is being kept for the same reason
`IntegrationsView.astro` is — i.e. it is the only place naming some state the live page has not grown
yet. That question is answerable by reading it, and it is worth asking before the delete, because
that is precisely the trap the last sweep avoided by keeping one file.

If it stays: give it the same header comment `IntegrationsView.astro` carries, so the next reader
knows within one screen that it is a deck and not a component.
