# D20 — Stale intent and dead surfaces

**Rule:** Every live surface has a current intent doc and a truthful catalog entry; every route
either works or is gone; documents that describe a product that no longer exists are rewritten or
deleted the moment the audit closes.

## Why this option

Three journeys had to write "UNSTATED" for major surfaces (Data — the deepest section, ~4,500
lines, no spec at all; Reports — a *reference surface* whose spec describes a usage-metrics
placeholder; the whole Account group). Stale intent is not cosmetic: J07 showed the spec's two
still-binding demands (CSV, timezone) being silently violated because nobody could tell which
parts of the document still applied, and J01/J03 showed live `apps/web` code still linking a route
that 302s. The rejected alternative — leave specs as history — guarantees the next audit re-litigates
the same questions.

## The concrete changes

1. **Write `specs/16-data.md`** from the shipped surface + the flow-registry entries, before any
   further Data work. (J05-F15)
2. **Rewrite `specs/11-reports.md`** to the v2 model; explicitly answer CSV-export and timezone
   rather than dropping them. (J07-F21) Retire the v1 type family and the trigger snapshot that
   names a deleted schedule object. (J07-F20)
3. **Refresh `specs/07-integrations.md` + `specs/06-dashboard.md`** to the wizard/SpaceHomeView
   reality; retarget or delete the four live links into `/integrations`
   (`IntegrationsConfigureView.astro:45,162,163,281`). (J01-F11)
4. **`/integrations/configure/bases`**: delete, or wire with `&step=bases` and carry the
   selection — a second base-picker whose Done discards the answer cannot stay. (J01-F10)
5. **RATIFY the two stale catalog entries**: `pattern-setup-stepper` gets the shipped step order
   (Source → Bases → Destination → Options → Review) (J01-F7); `pattern-report-schedule` is
   rewritten or deleted, keeping the next-run-preview usageDo which D13 adopts. (J07-F23)
6. **Port `/profile` into `apps/web`** (`views/ProfileView.astro`, an `h1`, active nav marking,
   `size-*` icons) — it currently cannot ship. The Settings-merge question stays DEFERred on
   `specs/12` Option A/B/C from Dan. (J08-F14, F23)
7. **`/help`** — DEFER with the trigger written: before production, build the spec's four blocks
   (the diagnostic-info card first — the spec's own highest-value element) or pull the nav item.
   (J08-F19)
8. **Account-group intent** — DEFER: `decision-account-destinations` / `decision-ia-airbyte-model`
   are our decisions, not the client's; trigger = client confirmation, then a short
   `specs/17-account.md`. (J08-F24)
9. **OAuth hand-off** — DEFER, trigger: real OAuth wiring; the return state is designed before it
   is wired. (J01-F12)

## Surfaces changed

`specs/` · `storybook.ts` (two entries) · `IntegrationsConfigureView` links ·
`IntegrationsManageBasesView` · new `ProfileView.astro` · nav config (if Help is pulled).

## storybook.ts

The two RATIFY edits above, done in the style of `pattern-changelog-timeline`'s self-correction —
record *that* the entry was wrong and why it went stale.

## Not changing

`specs/00-design-principles.md` and `specs/01-naming-and-hierarchy.md` (still true, still the
judging standard) · the flow-registry (useful as the source for the new Data spec).

## Verify

Every route in the worklist resolves without a 302-to-`/`; `git grep '/integrations'` over
`apps/web/src` returns only live targets; each spec's header names the surface files it describes
and they exist; the two catalog entries match the shipped product.


---

## AMENDMENT 2026-08-14 — three documentation defects, all of them the same failure

Three new members, and they share one mechanism worth naming: **a document that records a fact as
verified is what stops anyone re-measuring it.** None is a UI change; all three are one PR with no
client code, and it can run in parallel with anything (ship item 19).

### X-M11 (S2) — `specs/16-responsive.md` §8 certifies a number the app does not paint

`:462-479` records the panel-width fix as applied and verified at **"326.59 → 350"** and left edge
**"63.41 → 40"**. Measured 2026-08-14 with the right instrument: the **first** panel paints
**288.79px at x=101.21**, identically at 390 and at 425. The fix works on `/data` and fails on
`/schema` from the identical declaration, because `.ph-panels` has no width (S1, register row X-M3,
D45). **Correct the recorded numbers, and say which case each applies to.**

Its **rationale** is separately wrong on this platform and must be stated precisely rather than
flipped: *"The **8.41px** RecordPanel gained is the scrollbar"* measures **0.00px** at 390 and at 425 —
`innerWidth − documentElement.clientWidth` = 0, even against a forced 20,983px page, because Chrome on
macOS paints overlay scrollbars, so `94vw` = 366.59 and `94%` = 366.60. **Classic-scrollbar platforms
(~15px) could not be emulated and are UNVERIFIED. So §8 is not disproved — its number is simply not
this platform's.** Either scope the sentence to those platforms or drop it; **do not overclaim in
either direction**, and do not let ship item 38 be justified by a 0px effect when the one-contract
argument carries it alone.

### X-M12 (S3) — `specs/02-shell-sidebar-topbar.md:195` names a theme that does not exist

*"Already wired to `@opensided/theme`'s `baseout-light` and `baseout-dark` themes."* **There is no
`baseout-dark`:** `lib/theme.ts:13-14` sets `DARK_THEME = 'baseout'`, `LIGHT_THEME = 'baseout-light'`.
Anyone writing or measuring a dark-theme rule from this sentence sets `data-theme="baseout-dark"`, gets
**no theme at all**, and measures the fallback — which is exactly how a contrast figure gets recorded
against the wrong palette. The audit's own single citation of the phantom theme
(`audit/findings/X04-X05-X08.md:376`) is corrected in place today; **`REGISTER.md` and `SHIP-ORDER.md`
never contained it.**

### X-M22 (S4) — two places describe a card-padding split the product no longer has

`specs/16-responsive.md` §3 and the comment at `apps/web/src/styles/global.css:340-347` both still
describe the 33-vs-29 narrow text inset as live. It was real when `.bl-panel` folded; **Oleh's ruling
of 2026-08-13 moved Backups to `data-narrow-pan` and the folded row's 4px inline padding went with
it.** Measured at a real 390: Home's `.hm-kpi` **29**, the report document's genuinely-folded
`.rptk-card` **29**, `.bl-panel` not comparable because it pans. **The ~14-file row-padding edit that
§3 calls "the real fix" is not needed and must not be scheduled.** For the record, 29 is not a grid
violation: it is `12` gutter + `1` border + `16` padding, and the 4px grid governs what an author
writes, not the sum of nested boxes — otherwise nesting would violate it automatically.
