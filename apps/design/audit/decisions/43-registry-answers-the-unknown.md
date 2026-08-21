# D43 — A registry answers the state it does not know

**Rule:** Every status registry in the product is **total**: it has a fallback, the fallback is
`Unknown` in a neutral paint, it never names a state that did not happen, and it never throws. A tone
name says what the state *is*, not what it looks like.

## Why this option, and what was rejected

`statusMeta[r.status] ?? statusMeta.cancelled` labels a run whose status the UI does not recognise
**`Cancelled`** — a word that asserts a person deliberately stopped it — on a **backup log**, the one
screen whose entire job is to prove what ran. Reports guesses `Issues`; the run-base view guesses
`Pending`. **The UI states something untrue: that is the charter's S1 test, met verbatim** (X08-F5,
lead-verified at all six sites).

Beneath it, 16 of 28 registries have no fallback at all and two are bare-indexed in a way that
**throws** — `usageStatus[u.status].label.toLowerCase()` is a runtime `TypeError` on a property of
`undefined`, in the same file that guards its own header badge 130 lines earlier (X08-F8). Two more
are ternary chains whose else-branch silently mislabels: anything not green/red becomes
`Could improve`.

**The answer is already written, shipped, and argued in this repo.** `SourcesView.astro:36-51` added
the `Unknown` neutral fallback on 2026-08-13 (`6e8ead0`) with a **14-line comment arguing exactly
this case**. This decision does not invent a rule; it applies a rule the product already made to the
26 registries that did not get it.

**Rejected: fixing only the three `Cancelled` sites.** They are the loudest instance of one class.
Fixing three leaves 13 silent registries and two that throw, and the next new registry invents its
own answer again — which is what happened to the 26.

**Rejected: treating the missing fallbacks as NOT-OURS.** Whether an out-of-map status can *occur* is
the backend's vocabulary and genuinely NOT-OURS. That the UI has **no branch for it** is entirely
ours, and it is what turns a backend surprise into a lie or a blank page.

**Not in scope, deliberately:** which *word* and which *colour* each known state gets. That is D19's
state-word table and it is blocked on Oleh's `Running` ruling. **This decision ships without it** —
the fallback contract is orthogonal to the vocabulary, and holding an S1 behind a taste call would be
the wrong trade.

## The concrete changes

1. **One helper, one call.** A `statusOf(registry, key)` in `lib/` returning
   `registry[key] ?? { label: 'Unknown', tone: 'idle' }`. All 28 registries route through it; no
   registry is indexed bare.
2. **The three `Cancelled` fallbacks and the two guesses go:** `BackupsListView.astro:208` ·
   `BackupRunDetailView.astro:189` · `RestoreHistoryView.astro:175` · `ReportsView.astro:136` ·
   `ReportDefinitionView.astro:211` · `BackupRunBaseView.astro:107`.
3. **The two throwing lookups are guarded:** `SourceDetailView.astro:181,189`.
4. **`sectionEmptyAlert` stops emitting `class="alert undefined"`** for a fourth key
   (`lib/reports/view.ts:29-33`, consumed raw at `ReportBodyKpi.astro:208,265,314,348`).
5. **The two mislabelling ternaries gain an unknown branch:** `SchemaBrowse.astro:65-68`
   (`Could improve`), `SpaceHomeView.astro:153-154`.
6. **Tone names say what the state is.** `broken` is currently painted through a class called
   `is-paused`, and `.is-paused` and `.is-warn` are the identical `--color-warning` at 8% — so the
   app's most severe connection state reads, in source, as its calmest, and the next editor to touch
   `.is-paused` styles two unrelated states at once. **Rename the tone; keep the paint.** The
   colour is defensible; the name is not.

## Surfaces changed

`BackupsListView` · `BackupRunDetailView` · `BackupRunBaseView` · `RestoreHistoryView` ·
`ReportsView` · `ReportDefinitionView` · `SourceDetailView` · `SpaceHomeView` · `SchemaBrowse` ·
`lib/reports/view.ts` · `ReportBodyKpi` · plus the remaining registries, **batched by section**.

## storybook.ts

`badge`: state the fallback contract as a rule — *a registry that meets a state it does not know
renders `Unknown` in neutral; it never guesses, never throws and never renders a blank cell* — and
cite `SourcesView.astro:36-51` as the reference implementation, with its comment. This is the clause
of D19's state-word table that does **not** depend on Oleh's `Running` ruling and can be written now.

## Not changing

`SpaceHomeView.astro:136-144` + `:651-681` remains the reference for status *semantics*: it is the
only registry that covers every level of its state machine, the only one with a real painted
`unknown`, and the only one that keeps the **word** in a separate map from the **colour** — which is
exactly the separation D19's table needs. Its only defect is the tone name above. · The `Unknown`
fallbacks already shipped on `SourcesView`, `DestinationsView` and `SpaceHomeView`.

## Verify

`grep -rn '?? statusMeta\.\|?? runStatusMeta\.\|?? statusMeta\[' apps/web/src` returns no fallback
naming a real state · `grep -rn 'usageStatus\[' apps/web/src` shows no bare index ·
`grep -rn 'is-paused' apps/web/src` → 0 · load each of `/backups`, `/backups/run`, `/restore`,
`/reports` with a fixture holding an unrecognised status string and read the painted label: it says
`Unknown`, the page does not throw, and no row claims a user acted.
