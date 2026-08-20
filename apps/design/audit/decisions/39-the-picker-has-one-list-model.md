# D39 — The base picker has one list model

**Rule in one sentence:** A list does not change its navigation model while the user is looking at
it — the base picker picks **one** model for both the flat phase and the grouped phase, and it uses
the app's one pager or no pager, never a fourth private one.

## Why this option, not the alternative

Measured: on arrival `/integrations/configure/bases` is flat and paginated at 10/page ("Page 1 of 5
· 50 bases"); roughly fifteen seconds later workspace matching lands, `applyView`
(`BaseSelectionTable.astro:1189-1196`) returns early whenever grouped, `onResolved` (`:1596-1605`)
flips grouping without user action, and **the pager vanishes with all 50 rows revealed**. The user
touched nothing. The reflow itself is designed, animated, argued in the catalog and genuinely good
work; the *pagination change* appears in none of that reasoning. It compounds: `Select all` fills to
the plan cap across pages the user cannot see.

`.bst-pager` is also a **fourth** pagination implementation, and it differs from `TablePager` in
every element — "Show N per page" vs "Rows", a page index vs a row range, labelled Prev/Next vs
icon-only squares, no top rule — against `TablePager.astro:8-9`'s own claim that *"there is no
second pager left to drift from."* There is, and it is embedded in the wizard too, because the
wizard mounts the same component.

The rejected alternative — keep the pager and page the groups — was rejected on
`decision-tree-showmore-not-pager`: slicing a hierarchy orphans children, and the grouped phase is a
hierarchy. So the honest resolution is **no pager on this surface, both phases**, with the scroller
and the search/sort band the picker already has doing the work. If the flat phase genuinely needs
paging at 50+ rows, then it is `TablePager` + `createPager` in **both** phases, and grouping is not
allowed to remove it.

## Surfaces changed

- `BaseSelectionTable.astro:678-692`, `:993-996`, `:1189-1196`, `:1596-1605` — one model. If a pager
  survives, it is `TablePager` + `createPager` and `applyView` stops special-casing grouped.
- `IntegrationsManageBasesView.astro` and `IntegrationsSetupWizard.astro` inherit it — the point of
  fixing it in the component rather than at the two hosts.
- `IntegrationsManageBasesView.astro:44` — at 390 `Done` sits at y=146 above a card spanning
  445→1202 with nothing at the bottom of a 2,275px scroll; the commit control moves to (or repeats
  at) the end of the task it commits. At 1440 `Done` at 40px is a sanctioned page-header CTA and is
  **not** the finding.

## storybook.ts

Amend `pattern-base-picker`: the entry describes the grouping reflow in detail and never mentions
pagination. It states the list model for **both** phases, that the model does not change without a
user action, and that the picker uses `TablePager` or nothing. Amend `pattern-table-toolbar` /
`table` with the general rule: **a list's navigation model is a property of the list, not of its
current sort or grouping.**

## Explicitly not changing

- **The workspace-resolution design.** A determinate bar pinned to the card edge (never a spinner —
  the percentage is known), held 500ms so a five-base account never blinks, resuming from the count
  it was handed, dropping to **neutral** on failure because a lookup that gave up is not a page
  error, and a FLIP transition rather than a skeleton over a ~0ms operation. Every choice is written
  down beside itself.
- **"Still matching" is not "No workspace."** Two tail buckets, never merged, each with its own
  tooltip explaining why its Auto-add cell is not a switch. The most disciplined state modelling in
  the audit so far.
- **No "Auto-enrolled" badge** — arriving automatically is an event and a badge is a state.
- The pan-not-fold decision and its arithmetic (D37 re-places one column inside it; nothing here
  reopens it).
- The `:global()` discipline and the comments that record the reflow-into-a-paragraph bug and the
  Astro-comment-in-a-ternary SSR 500.

## Members

S28-F6 (S2) · S28-F8 (S2) · S28-F7 (S2, the three cap sentences — one fact, one writer, and it
lives in this component) · S28-F15 (S3, **ACCEPT with the reason corrected**: the Auto-add track is
argued in-file as *"pulled tight against the thing it acts on"* and measures **464.6px, 45% of the
table**, the loosest track on the screen, against a base name capped at 256px — it cannot stay
described as tight; either cap the track at `max-content` or rewrite the comment and the entry).

## How to verify done

Load `/integrations/configure/bases` and wait through the resolve: the row count and the navigation
control are the same before and after the flip · `grep -rn "bst-pager" apps/web/src` returns 0 or
resolves to `TablePager` · `[data-bst-cap-text]` has exactly one writer with one sentence · at 390
the commit control is reachable from the end of the list · `pnpm ds-lint` and `pnpm typecheck`
green.
