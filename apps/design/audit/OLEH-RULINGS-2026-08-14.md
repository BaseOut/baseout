# Oleh's rulings — 2026-08-14

Ten decisions put to Oleh after the audit's adjudication closed (501 rows, D01–D49). All ten are
answered. Each entry states the ruling, what it costs, and where the work lands in
`audit/SHIP-ORDER.md`.

---

## 1 · Button tiers — **CONVERGE TO 32**

**Ruling:** one button height. Delete the 40px `md` carve-out from the 17 views that hold it.

Measured before the ruling: **zero** off-tier buttons — the 40/32 split was fully obeyed, so this is
not a defect fix, it is a deliberate reduction in the number of sizes the product has.

**This supersedes `decision-density-sm-is-default`'s "md = page-header CTA only" carve-out.** The
catalog entry must be amended in the same PR, or the next `ds-lint` reader will restore the 40.
Lead recommendation had been to keep the split; Oleh overruled it. Recorded because the argument
matters: the page CTA loses size as its emphasis channel and must carry emphasis by colour and
position alone.

## 2 · Card padding at narrow — **KEEP 16** (text lands at 29)

**Ruling:** no change to the padding. **The "33 vs 29" fork does not exist and never needed a
ruling** — it was dissolved by measurement, not by decision.

Measured at a real 390 viewport (`emulate`, not `resize_page`):

| surface | kind | painted left edge of text |
|---|---|---|
| Home `.hm-kpi` | card with no listing | **29** |
| Report document `.rptk-card` | card with a listing, genuinely folded (`display: grid`) | **29** |
| Backups `.bl-panel` | does not fold — a table that pans | not comparable |

The 33 was real when `.bl-panel` folded. **Oleh's own ruling of 2026-08-13 moved Backups to
`data-narrow-pan`**, and the folded row's 4px inline padding went with it. Every card now lands on
29. The ~14-file row-padding edit that §3 called "the real fix" is **not needed**.

**Action, and it is documentation only:** `specs/16-responsive.md` §3 and the comment at
`apps/web/src/styles/global.css:340-347` both still describe the 33/29 split as live. Correct both.
`REGISTER.md`'s row for it becomes an in-place correction, not a scheduled fix.

**Why 29 is not a grid violation** (Oleh's question, answered for the record): 29 is a *cumulative
distance from the viewport edge*, not a spacing declaration. It is `12` page gutter + `1` card
border + `16` card padding. 12 and 16 are grid values; the 1px is a border, which §3 explicitly
exempts. The 4px grid governs what an author writes, not the sum of nested boxes — otherwise
nesting would violate it automatically.

## 3 · Restore snapshot picker `.rs-snapwrap` — **PAN**

**Ruling:** the table stays a table and scrolls sideways. 715px of min-content in 294px of room.

The FOLD case rested on *"it is the Backups log filtered to one base, and Backups folds."*
**Measured today: Backups does not fold.** `.bl-tablewrap` is `overflow-x: auto`, clientWidth 332,
scrollWidth 623, `panRail` mounted, and the page itself does not scroll sideways. The premise of the
counter-argument was false. Oleh's ruling and the standard's default ("pan is the default; a fold
needs a reason") agree.

Independently confirmed: folding this row would hide the radio the step exists to press —
`pattern-mobile-row` has no leading-control slot and a cell with no `data-m` is `display: none`.

## 4 · Source detail `.reg-usewrap` — **PAN**

**Ruling:** pan. 601px in 349px. Schedule / Last backup / Status read down a column is the
*"is anything broken before I disconnect this"* scan, which is comparison.

**Do not touch destination-detail's identically-named `.reg-usewrap`** — 82px in 349, one column by
design, already classified FIT.

## 5 · `Running` badge colour — **PRIMARY (blue)**

**Ruling:** blue. Eight live sites change; the catalog's reading wins over the shipped one.

The precedent (`decision-density-sm-is-default`: shipped surfaces win, the catalog changes) is
**deliberately not followed here**, because its cost is a colour losing its meaning: amber already
carries paused, degraded, stale, removed and tier-gate, so an amber `Running` makes amber mean "not
green". In-progress gets its own colour.

Unblocks **D19's state-word colour column**, which was the last thing holding D19 interim.

## 6 · Badge regex checks in `.claude/hooks/ds-checks.mjs` — **ENABLE**

**Ruling:** switch on the two mechanically-detectable rules — the banned `badge-soft badge-neutral`
pair, and error-red on a literal non-failure set.

**Expect `ds-lint` to go red in three files nobody is touching.** That is the point: the ban is
stated in the catalog and live in the tree with every gate green. Fix those three in the same PR
rather than `ds-ok`-ing them.

## 7 · `toolbarFit.ts`'s 1440 threshold — **FIX IT**

**Ruling:** fix the threshold to measure what it claims, rather than declaring the narrow rendering
the default.

Measured today, and stated in no finding before this: `toolbarFit` compares `#layout-content`'s
`clientWidth` against **1440**, and that column is **1184 at a full-screen 1440 laptop** — the
sidebar takes 256. **The threshold can never evaluate false on the hardware this product runs on.**
`data-narrow` is not a narrow adaptation; it is the only state `.sch-tb` has ever had. Six
`global.css` rules that read as "below 1440 we drop button words and collapse search to a magnifier"
are in fact the permanent rendering.

Consequence to expect and to review by eye: at wide widths, button words and the full search field
**come back**, on nine `.sch-tb` surfaces. That is a visible change to every dense toolbar in the
product and it needs a screenshot at 1440 before it is called done.

Supersedes the framing in the `task-responsive-1440-toolbar` note.

## 8 · Converge the three private toolbars (D41) — **YES, with the rationale rewritten**

**Ruling:** converge `.bl-toolbar`, `.rpl-toolbar`, `.rh-toolbar` into `.sch-tb`. **But D41's stated
measurement is wrong and must be replaced, not repeated.**

D41 argues the copies' *"only answer to running out of room is to become two rows."* Measured at
1100: none of them wraps. They carry two and three controls totalling ~430px in an 1100px column and
never run out of room at any width the app is used at. Wrapping is a problem of the **dense**
toolbars, and those are already `.sch-tb`.

**The correct reason is variance:** three byte-identical private rules for one job. Rewrite D41's
"why" before the PR, or the next audit will measure for a wrap, fail to find one, and reverse a
correct decision.

## 9 · Re-opening `Table.astro` (D15) — **EXPLICIT STOP**

**Ruling:** yes — put a hard stop in the ship order. D15 must be re-opened after item 16 and must
not be allowed to remain deferred by default.

**Four rows are filed against it** — S25-F4's structural half, S25-F12, X01-F2's component half, and
the residue of X01-F1/F5. Without the stop they are dropped silently: not rejected, just lost.

## 10 · The five open client questions — **HOLD, do not send yet**

**Ruling:** keep them; assemble at the end of the session. Written up in
`audit/CLIENT-QUESTIONS-PENDING.md`.

---

## What this changes in the ship order

- **Item 4 is unblocked and unchanged** — the cheapest S1 in the audit still stands.
- **D19 completes** on ruling 5; its colour column can now be written.
- **Two register rows become in-place corrections, not work:** the 33/29 padding fix (ruling 2) and
  D41's rationale (ruling 8).
- **One new work item enters that no finding carried:** the `toolbarFit` threshold (ruling 7).
- **One new gate item:** the `ds-checks.mjs` switch-on plus the three files it reddens (ruling 6).
