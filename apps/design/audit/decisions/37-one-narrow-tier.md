# D37 — One narrow tier

**Rule in one sentence:** Below 1280 the app has **one** set of numbers — a card's inner padding is
16px, a control's floor follows the pointer (28px fine / 44px coarse) and is taken on the element
the user actually hits, and a stacked row's label and its control share one left edge.

## Why this option, not the alternative

The rejected alternative — fix each narrow defect on the surface that reported it — was rejected
because the same three numbers were re-derived independently on four surfaces this wave, and
`specs/16-responsive.md` already states all three rules. The gap is enforcement, not authorship.
Measured, at 390, in **one flow**: `.tab-body` **20px**, `.bst-gband` **12px**, `.modal-box`
**24px** — three card paddings and none of them is 16.

The control floor fails in three distinct ways, all measured:

- `ConfirmModal`'s controls **shrink** as the viewport narrows — 30/38/38px at 1440 becomes
  **27/27/27px** at 390, below the app's own `--control-min: 28px`. This is the shared destructive
  confirm, so it lands on every D06 dialog, not on one flow.
- The two workspace-level checkboxes in the base picker are bare `<input>`s inside `<span>`s —
  **20×20** targets in the same table where a base row is a **1007×41 `<label>`**. The floor is
  granted to the wrapping label; there is no wrapping label.
- The connection-method segment option is a `<span>` inside a `<label>`: measured 34px at 390 and
  matched by none of the selectors at `global.css:617-627`, so on a coarse pointer every button
  beside it grows to 44 and it does not. (D38's fix makes it a `.btn`, which grants the floor for
  free — the right kind of fix.)

And the stacked-row rule breaks on the app's densest narrow surface: on `/settings` at 390 every
control is indented **62px** behind an invisible 54px `.set-flag` "Saved" badge, so nine toggles on
Notifications start 62px right of their own labels with nothing in the gap — a reader assumes a
missing icon. In the same rows `.set-input { width: 100% }` is **written and dead**, because
`.set-rowctl { flex: 0 0 auto }` makes the percentage circular: Space name 155px, Backup schedule
82.2px, Data retention 85px inside a 316px row, with select values clipping to `Daily · 02⌄0` and
Quiet hours reading **`⌄ff`**.

## Surfaces changed

| rule | files |
|---|---|
| card padding 16 at narrow | `IntegrationsSetupWizard.astro` (`.tab-body`), `BaseSelectionTable.astro` (`.bst-gband`), `ConfirmModal.astro` (`.modal-box`) — and the sweep `specs/16-responsive.md` §3 already scopes |
| control floor on the hit element | `ConfirmModal.astro` (grow, never shrink, below 1280), `BaseSelectionTable.astro:527-533,616-629` (wrap both in the `<label>` the rest of the table uses), `SourceAddView.astro:138-142` (via D38) |
| one left edge in a stacked row | `SettingsView.astro:167-170,373,381-384` (take `.set-flag` out of flow below 640 — `position:absolute`, **not** `display`), `:365` (`.set-rowctl` stretches below 640 so the authored `width:100%` can bind) |
| narrow fold where none exists | `IntegrationsSetupWizard.astro` `.picker-empty` (98px text column beside a 128px button at 390 — stack below ~560); `.sch-tabbar` in wizard edit mode (a four-row 147px column where `/schema` holds one 38px row — mount `watchSectionNav` as `SchemaView.astro:375` and `DataView.astro:342` do); `pattern-setup-stepper` (suppress the `::after` connector on the last item of each visual row, or go vertical below ~560) |

## storybook.ts

Amend `pattern-mobile-row` with the left-edge rule stated as a **negative**: nothing invisible sits
in the control slot ahead of the control. Amend `confirm-modal` with the narrow numbers (padding and
the grow-never-shrink floor). Amend `pattern-setup-stepper` with its narrow answer — the entry says
nothing about narrow today, and it needs an answer either way.

## Explicitly not changing

- The **44px tap-target floor already achieved on Settings** — every toggle `<label>`, row button
  and back link measures 44, by growing the box around a `toggle-sm` rather than growing the switch
  (`SettingsView.astro:182-190`). F5/F6 must not disturb it.
- `.set-flag` using `opacity` rather than `display` — the reason is written at `:371-374` (a hub
  that twitches on every toggle reads as unstable). Take the box out of flow; do not switch to
  `display`.
- The `data-narrow-pan` **pan-not-fold** decision on the base picker (`BaseSelectionTable.astro:1004-1025`),
  whose arithmetic is 478px of fixed columns against 334px of width with max-content floors. D38
  asks for one column to be re-placed inside that decision; nothing here reopens it.
- The 390 floor gate itself, and zero horizontal overflow — 0 on all four integration routes and all
  five auth surfaces. That is the number `specs/16-responsive.md:213-218` protects.

## Members

S28-F3 (S2) · S28-F4 (S2) · S28-F5 (S2) · S28-F9 (S2) · S28-F11 (S2) · S28-F13 (S3) ·
S28-F14 (S3) · S32-F5 (S2) · S32-F6 (S2) · S24-F6 (S2).

## How to verify done

Read **computed values at the width the rule claims to act on** — that is the only instrument that
has ever caught these. At 390: every `.modal-box`/`.tab-body`/`.bst-gband` padding is 16; every
`ConfirmModal` control is ≥28 and grows under `pointer: coarse`; on `/settings?tab=notifications`
the label and the control share `x`; a select shows its whole value. `pnpm css-guard` green (all of
this is CSS, and `ds-lint` has no opinion on whether the browser reaches a declaration).
