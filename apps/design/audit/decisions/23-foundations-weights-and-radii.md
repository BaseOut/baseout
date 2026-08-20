# D23 — Foundations: weights and radii (INTERIM — completes when S01/S04/S05 are adjudicated)

**Rule:** Font weights come from the sanctioned ladder (400 / 500 / 600 + the 650 heading step if
ratified) and card/frame radii from named tokens (12px card · 6px control), so a hand-typed 11px
frame can never again sit one pixel off its own catalog entry.

## Why this option

Half of the original foundations complaint is already dead: `ed8b03b` moved the type ladder onto
`--t-*` tokens, and `ds-audit` fell from **295 issues / 193 files (2026-08-07)** to **6 issues /
207 files (2026-08-12, exit 1, all six unsized `btn` variants)**. What survives, on every surface
S06–S09 read, is exactly two axes:

- **Weights**: `550 · 650 · 740` appear on shared and local classes (`DataBrowse` runs five weights;
  `.cm-ini`/`.grp-name`/`.cl-empty-title` 650; `.hm-kpi-v` 740; `.dcp-tab` 550) against
  `text-color-weight`'s 400/500/600. 650 is used so consistently as the empty-state/heading weight
  that the likely correct fix is to **ratify 650 into the token ladder** and delete 550/740 — that
  call needs the S01/S04/S05 census, so this decision is interim.
- **Radii**: nine distinct values inside `DataBrowse` alone (`2·5·6·7·8·10·11·12·999px`), and the
  audit's cheapest demonstration that hand-typed radii drift: the Records frame at **11px** against
  the catalog's 12px, and `.cl-empty` at `.85rem` (13.6px) against `.dc-empty`'s 14px — 0.4px
  apart, both wrong. The 12px cluster on Attachments (frame, group card, kpi strip, empty tile) is
  the app's most consistent and is the evidence for **12px as the card token**.

The rejected alternative — filing a radius/weight row per view — is the 300-micro-fix failure mode;
this is one codemod-with-visual-diff per axis.

## The concrete changes

1. Define the tokens (12px card radius; weight ladder incl. or excl. 650 — decide from the full
   census) in `global.css` beside `--t-*`.
2. Codemod the hardcoded values onto the tokens, view by view, visual-diff reviewed. Data-section
   members: S06-F13 (+ recorded instances in S07 §10, S08 §10, S09 §10).
3. Fix the two adjacent near-misses immediately when D15/D17 touch those files anyway: `.dg-wrap`
   11px → `.tbl-frame` (D15, S06-F1) and the 13.6px/14px empty-card pair → one shared class (D17).

## Surfaces changed

Every surface with a hardcoded radius or off-ladder weight — the census completes when S01/S04/S05
are adjudicated. Do not run the codemod before then.

## storybook.ts

`radius`: name the 12px card token and the 6px control token explicitly. `text-color-weight`:
either add 650 with its use ("empty-state titles, group names") or state the 600 ceiling and list
the demotions.

## Not changing

Type sizes (already tokenised) · spacing (S06–S09 all measured clean on the 4px grid — the tokens
demonstrably work) · the six residual `ds-audit` hits (unsized `btn`, a separate two-line fix).

## Verify

`grep -c 'font-weight: *(550|740)'` → 0 across `apps/web/src`; `grep 'border-radius'` in component
code returns only token references; `ds-audit` count does not grow.


---

## AMENDMENT 2026-08-14 — two new members: one button height, and the sizing floor

This decision is the foundations home for *how big a thing is*, so both members land here rather than
in a new decision. **Neither is a new rule — both are the existing rules being applied to the places
that escaped them.**

### 1 · One button height — 32. Oleh, ruling 1. (Register row **X-M16**, S2)

**The 40px `md` carve-out is deleted from the 17 views that hold it, and
`decision-density-sm-is-default`'s "md = page-header CTA only" is amended in the same PR** — or the
next reader of the catalog restores the 40.

**Measured before the ruling: zero off-tier buttons.** The 40/32 split was fully obeyed. **So this is
not a defect fix; it is a deliberate reduction in the number of sizes the product has**, and it must be
reviewed as a design change rather than as a cleanup. **The cost, recorded because the lead
recommended keeping the split and was overruled: the page CTA loses size as its emphasis channel and
must carry emphasis by colour and position alone.**

**The argument nobody made when the ruling was taken, and it is the strongest one:** `ds-audit` today
is **exit 1 with 6 issues across 208 files, and all six are `unsized control = md`** —
`RunBackupButton.astro:47` · `ConfirmModal.astro:61` · `:65` · `BackupRunDetailView.astro:226` ·
`NotFoundView.astro:50` · `SpaceHomeView.astro:428`. **This ruling takes the design-system gate to
exit 0 for the first time in this audit.** Two of the six are `ConfirmModal`'s footer pair, which D45
currently lists under "not changing" as a sanctioned `ds-ok` — **that carve-out closes with this
ruling, and D45 must be read alongside it.**

### 2 · The 12px sizing floor, applied to the three rules that broke it (register row **X-M15**, S3)

Measured across 24 routes at 1440: **22 of 24 measure ≥ 12px**, so the floor is being honoured. Three
rules are not, **and none carries `ds-ok` while seven sibling sub-12px rules do** — which is what makes
these oversights rather than policy:

| rule | painted | where it shows |
|---|---|---|
| `global.css:1902` `.hm-delta .iconify { font-size: .74rem }` | **11.84px** (box 10.45 × 11.84) | `SpaceHomeView.astro:220`, the KPI delta arrow — **Home** |
| `SpaceHomeView.astro:726` `.hm-conn-badge .iconify { .72rem }` | **11.52px** ×2 | `:440`, `:446`, the pipeline connectors — **Home** |
| `IntegrationsSetupWizard.astro:591` `.review-link-badge .iconify { .72rem }` | 11.52px | measured **not visible** in the default state |

**Fix:** lift to `var(--t-12)`, or add `ds-ok` with a stated reason. **`.hm-conn-badge` is only `1rem`
square, so this may be a badge-size decision rather than an icon one — UNVERIFIED which, and the
implementer must decide it at the element.** The sanctioned siblings to imitate are
`EntityPanel.astro:341`, `SchemaBrowse.astro:538`, `:695`, `ReportDefinitionView.astro:1043`, `:1055`,
`:1060`, `:1061` — `SchemaBrowse.astro:695`'s reason is the model ("aria-hidden, not text; sized like
an icon, the ladder governs words"). **Do not weaken the floor to absorb the three.**

**Gate change that belongs with this, and it is why `ds-lint` never saw them:** `ds-checks.mjs` looks
for `*-xs` utilities and ~10px, **not a `rem` literal below 12px**. Add that check in the same edit as
the badge checks (X-M20).

**Still unmeasured, named:** the icon sweep ran only at **1440**, and `global.css:204-210` steps the
`--t-*` ladder down below 1280 — **a narrow sweep could find more sub-12px cases and was not run.**
