# D45 — One overlay model

**Rule:** There are exactly three overlay kinds — a **modal** (`Modal.astro`, a native `<dialog>`), a
**panel** (`PanelHost`/`panelStack`, non-modal and coplanar) and a **sheet** (`Drawer side="bottom"`)
— each with one owner; DOM focus enters an overlay when it opens and returns to the opener when it
closes; nothing claims a modality it does not implement; and one page-level Escape owner asks the
topmost overlay first.

## Why this option, and what was rejected

Nothing in `specs/` or the catalog has ever answered *when a thing is a modal versus a drawer versus
a panel*. That absence is the finding: **seven implementations exist because nothing said which one
to reach for**, and the same user gets a coplanar non-dimming panel from Schema Browse, a 55%-black
scrim from a backup run, and a third thing from the relationship detail that looks like the drawer,
does not dim and does not stack.

**The measurement that picks the references.** `Modal.astro` is the only overlay in the app that gets
focus trapping, focus restoration and Escape **for free from the user agent** — zero lines of
keyboard code in the file, and correct in all three. Every other overlay hand-writes its Escape (five
separate `document` listeners) and gets focus wrong. And `PanelHost` is the only overlay that has
survived a real consolidation: `1c5ffa9` merged four `position:fixed; inset:0` roots into one host
with a kind registry, which is why it alone has a cap, a rail, persistence and an Escape that asks
the panel's *kind* first.

**Two S1s, and they are the same defect from two directions.** `panelStack`'s "focused" panel is a
CSS class and a z-order — **zero `.focus()` calls exist in either file** (lead-verified) — so opening
a panel leaves the caret on the row behind it, Tab walks the page *underneath*, Escape closes a panel
the user never reached, and closing restores nothing. `Drawer` meanwhile asserts `aria-modal="true"`
twice with no trap, no `inert`, no initial focus and no restore: **the only place in the app where
the markup asserts something about itself that the code contradicts**, while `QuickAskDock.astro:90`
writes `aria-modal="false"` correctly two files away.

**Rejected: giving `Drawer` a real focus trap.** Cheaper and more honest to drop the claim. It is
non-modal in every respect except its scrim; the app already has a correct modal (`<dialog>`) for
anything that genuinely needs one, and a second hand-written trap is a second thing to get wrong.

**Rejected: leaving `.rl-detail` alone because it works.** It is a seventh overlay with no stack, no
cap, no grip, no persistence, no `＋` and its own Escape — and an entity chip inside it opens the
shared `EntityPanel` **over** it, which is the exact second-stack handoff
`decision-one-stack-one-entity-one-drawer` bans. It is the unfinished tail of the stage-4 merge, not
a new project.

## The concrete changes

1. **Focus follows the overlay.** On open, `panelStack` focuses the panel's close button or first
   heading; on close, it restores focus to the opener. It must compose with
   `entityPanelController.ts:667-711`, the one place in the app that preserves a user's position
   across a re-render — not replace it.
2. **`Drawer` drops `aria-modal="true"`** (`:35`, `:56`) and becomes a `PanelHost` kind, or keeps the
   scrim and gains a trap + `inert` + restore. It must not keep asserting modality it does not have.
3. **`SchemaDocs.astro:263-273`'s hand-rolled `<dialog>` becomes `<ConfirmModal>`** with
   `CONFIRM_DESTRUCTIVE` (it currently uses a **solid** `btn-error` where all eight siblings use the
   outline, and states a consequence with no recovery). Zero new catalog surface — the entry exists.
4. **`.rl-detail` registers as a `PanelHost` kind**; its private Escape at `schemaRelationships.ts:267`
   deletes with it, and `.rl-detail-scrim` — a full-viewport click-catcher with `pointer-events:none`
   that explicitly does not dim, i.e. an element that exists and does nothing — goes with it.
5. **One Escape owner.** `PanelHost`'s delegation model is the shape: one page-level handler that
   asks the topmost overlay's kind. **CORRECTED 2026-08-14 by measurement — the problem is not that
   the wrong listener wins, it is that Escape has NO OWNER and every listener runs.** One press with
   a `listSheet` and a panel co-open was delivered to **24** `document` listeners, **13 of them
   after** `listSheet.ts:191`'s `stopPropagation()`, because `stopPropagation` cannot stop a sibling
   listener on the same target — and all of them are on `document`. The single
   `stopImmediatePropagation()` (`entityPanelController.ts:711`) is registered last and stops
   nothing. **Both overlays closed on one press.** There are **8** `document`-level Escape sites, not
   five: `PanelHost.astro:574` · `Drawer.astro:126` · `tooltip.ts:213` · `schemaRelationships.ts:267`
   · `listSheet.ts:189-193` · `components/ui/collapsingSearch.ts:70` ·
   `entityPanelController.ts:705`/`:719` · **`DataBrowse.astro:1313`** (found 2026-08-14; invisible to
   every earlier grep because of the file's NUL bytes). `sectionTabs.ts:81` and
   `EntitySearch.astro:266` are **`/` handlers** and come off the ledger. `listSheet.ts:190`'s
   `!isOpen(h)` guard is **correct and stays** — it was accused of being unconditional and is not.
   **Only a single delegating owner can arbitrate this; nothing weaker can.**
6. **`.ph-panels` gets a width — and this is item ONE in practice, because until it lands the panels'
   half of the width contract is not in effect.** `PanelHost.astro:623` declares
   `position: absolute; top:0; right:0; bottom:0; display:flex; … max-width:100vw` with **no
   `width` and no `left`**, so the box shrink-to-fits from its content and the five sheets'
   `width: calc(100% - 40px)` resolves against a parent sized by that same child. Measured: the first
   panel paints **288.79px at x=101.21** at a 390 viewport and **288.79 at 425** — viewport-independent
   — where §8 certifies 350 at x=40; a second panel clamps the box to `100vw` and the documented
   number appears. **Give `.ph-panels` a viewport-sized basis (`width: 100vw`, or `inset-inline: 0`),
   then re-read the computed width on all five hosts.**
7. **Panel width is one contract.** `--drawer-w: min(94vw, 30rem)` becomes a px value (`480px`), the
   six `w-[min(*vw,*rem)]` literals delete, `min()` survives only against a `rem` cap, and **`Drawer`
   gains the narrow `calc(100% - 40px)` rule it is the only overlay family to lack**. **Drawer
   and panel are the same object at different z-indexes** — a user cannot tell them apart by width, so
   §8's ruling applies to both or to neither. **Argue it on one-contract grounds only: measured, the
   scrollbar this section's original rationale invoked costs 0.00px on macOS overlay scrollbars** (390
   and 425, even against a forced 20,983px page); classic-scrollbar platforms are **UNVERIFIED**.

## Surfaces changed

`panelStack.ts` · `PanelHost.astro` · `Drawer.astro` · `SchemaDocs` · `SchemaRelationships` +
`schemaRelationships.ts` · `listSheet.ts` · `EntityPanel` · `RecordPanel` · `DataChangelog` ·
`MediaPanel` · `QuickAskDock` · `global.css:144`. **Batch, revised 2026-08-14: (0) `.ph-panels`'s missing width — one declaration, and it goes
FIRST because it is an S1 and because every later width measurement is meaningless until the
containing block is right. (1) focus, alone — one file. (2) `Drawer`'s modality claim, alone.
(3) the two bespoke overlays + the one Escape owner. (4) the remaining widths.**

## storybook.ts

- `pattern-multi-panel-drawer`: record the focus contract (focus in on open, restore on close) —
  it has never been written anywhere, in `specs/` or the catalog.
- **`drawer` splits** (the X06-F10 RATIFY): the entry keeps `side="end"/"start"` (daisyUI's checkbox
  drawer); a **new `sheet` entry** documents `side="bottom"`, which is a bespoke transform sheet with
  its own scrim, `height` prop and reduced-motion rule. One prop currently switches the engine, the
  layout model and the animation, and the catalog's silence is what makes that a trap. No code moves.
- State the three-kind rule and when to reach for each. This is the thing that never existed.
- The z-index ladder is **DEFERRED** (X06-F11) — eight levels, no token, no comment. **Trigger: this
  decision's item 2 or item 4 landing**, since both move an overlay between layers; the ladder gets
  written down in that same PR rather than re-derived.

## Not changing

`Modal.astro` + `ConfirmModal`'s `returnValue` contract — Escape, the backdrop and the ✕ all leave
`returnValue` empty and read as "not confirmed" with no special case; keep the unsized md footer pair
and its `ds-ok`. · `ConfirmModal`'s `confirmHref` anchors (8 uses) — **NOT-OURS**, a mirror-repo
stand-in for a server action, documented in the file. · `PanelHost.astro:568-579`'s Escape
delegation shape (the focus work adds to this file and must not disturb it) and `:582-591`, where tab
changes no longer close the stack — a real user complaint, correctly fixed, comment records that the
measured behaviour contradicted what everyone believed. · `pickerSearch.ts:997-1053`: the caret-position
guard on ←/→, the one-level Escape unwind with `stopPropagation`, the mousedown-vs-click
reconciliation. **It is the keyboard reference and should be lifted into the catalog verbatim, not
rewritten.** · The `Drawer`'s three "Close" labels — it has no verb because it has no decision.

## Verify

`grep -rn 'aria-modal="true"' apps/web/src` → 0 (or exactly the elements that trap) ·
`grep -rn "addEventListener\('keydown'" apps/web/src | grep -c Escape` → 1 ·
`grep -rn 'rl-detail\|dc-delete-modal' apps/web/src` shows both on `PanelHost`/`ConfirmModal` ·
`grep -rn '94vw\|92vw' apps/web/src` → 0 · **`getComputedStyle` on `.ph-panels` returns a width
equal to `documentElement.clientWidth` at 390 and at 425, and `.ep-sheet` then reads 350 at x=40 with
ONE panel open on `/schema`** — the first-panel case is the whole point; two panels already worked.
**Live, and none of it has been done except the measurement:** `/backups` → Tab to
a row → Enter → the focus ring is *inside* the panel → Tab stays inside → Escape returns focus to the
row. And read `clientWidth` on a drawer at 390 and 425 — per this repo's own history, not a screenshot.


---

## AMENDMENT 2026-08-14 — the measurement pass, and one new S1

**New member: X-M3 (S1).** `.ph-panels` has no width, so the panel-width ruling that
`specs/16-responsive.md` §8 records as *applied and verified* is **conditionally dead** — correct on
`/data`, wrong on `/schema`, from the identical declaration in the identical media query. Mechanism,
numbers and the fix are in item 6 above. Two things that matter more than the fix:

1. **It is the failure mode `infra-css-parse-error-invisible-to-gates` warns about, one layer up.**
   `css-guard` cannot see it, because the cascade is correct and the **containing block** is wrong.
   No gate in this repo models a containing block. The only instrument that catches this class is
   reading a computed value at the width the rule claims to act on, which is the standing rule.
2. **`EntityPanel.astro:307-314`'s comment is load-bearing even though its numbers are now wrong.**
   It records *why* the custom property was abandoned for a direct `width` — an inline `--panel-w`
   from drag-resize outranks the media rule. That reasoning survives; the trap this fix could re-open
   is re-introducing the variable.

**New member: X-M11 (S2) — correct the spec, in the same PR.** `specs/16-responsive.md:462-479`
certifies 326.59 → 350 and x 63.41 → 40 as verified, and the app does not paint it for the first
panel. **A spec that records a fix as verified is what stops anyone re-measuring it.** Its scrollbar
attribution ("the 8.41px is the scrollbar") measures 0.00px here and must be dropped or scoped to
classic-scrollbar platforms — **stated in both directions: not disproved, just not this platform's
number.**

**X06-F3's `vw` half falls; its one-contract half stands.** `min(94vw,30rem)` and `480px` are the
same number at every width ≥ 511, and below 1280 all five hosts override with `calc(100% - 40px)`, so
the "two fall back to 480px" clause describes a state no user can reach. What survives is worth more:
at 390, four "overlay over the page" hosts paint **288.79/101.21 · 350.00/40.00 · 358.80/31.20 ·
366.59/23.41** — four widths, four left edges, **77.80px** of spread, two of them the same rule.

**X06-F8 moves S3 → S2** on the 24-delivery measurement (item 5 above).

**X-M18 (S3, DEFER) is recorded against this decision as well as D07:** `OVERLAY_BELOW = 964`
(`listSheet.ts:49`) measures the **section column**, not the viewport, so at 1440 the column is 1136,
**zero** elements carry `is-list-overlay`, and the co-open state item 5 is about **cannot be reached
at 1440 at all**. Anyone reproducing the Escape work must do it at a section column ≤ 964 (viewport
~900). Filed chiefly so the next pass does not conclude "no overlay" from a 1440 sweep.

**One "not changing" entry closes.** This file's `ConfirmModal` carve-out — "keep the unsized md
footer pair and its `ds-ok`" — is **superseded by Oleh's ruling 1** (one button height, 32).
`ConfirmModal.astro:61` and `:65` are two of the six `ds-audit` issues that ruling clears. Read D23
alongside this section.

**Still unmeasured, named:** `.rl-detail-panel`'s width, at any viewport, by anyone. It is the only
overlay family absent from the four-host comparison above, and item 4 of this decision is what folds
it into `PanelHost`.
