# NEXT STEPS — start here

**Written 2026-08-14 for whoever picks this up.** The audit's evidence pass is **finished**: 40 of 40
surfaces, 8 of 8 journeys, 16 of 16 lenses. Roughly **167 findings are filed, committed and pushed —
and not yet adjudicated**, so we know every problem and have no order to fix them in.

Read this file first. Do the steps in order. **Do not start changing `apps/web` before Step 2 is
done** — among the 167 there are findings that correct each other, and fixing them piecemeal will
make some of them worse.

---

## Step 1 · Adjudicate the surface findings

**Say to the agent:** *"Read `audit/PENDING-ADJUDICATION.md` and adjudicate the S24–S40 wave."*

That file is the brief: 83 findings across five files, two **register corrections** that must be
made in place rather than appended, three consolidation candidates, and the two write-surface S1s.

**Use `audit-lead`.** Three attempts died on transient **529 Overloaded** without writing anything —
that is a server-side condition, not a problem with the task. Retry it; nothing is half-done.

Expected outcome: register grows from **339** rows to roughly **420**.

## Step 2 · Adjudicate the lens findings

Same agent type, separate run. **Do not combine Steps 1 and 2** — 167 findings in one adjudication
is what has been failing.

Inputs: `audit/findings/X01-X03.md` · `X04-X05-X08.md` · `X06-X07-X15.md` · `X09-X12-X13.md`.
(X16 needs no lens pass — the responsive standard below covers it, with measurements.)

**Two things this step must settle rather than record:**
- **D17 can now be completed** (its rules landed; it needs the component from Step 3, plus one
  correction: the sentence cap has seven values and both "~44ch" and "48ch" are minority readings —
  46ch has six files).
- **D19 cannot be completed** — it is blocked on three rulings only the lead can bind, and
  `X04-X05-X08.md` names them.

Expected outcome: register at roughly **500** rows, with a merged ship-first order across the whole
product.

## Step 3 · One decision from Oleh that sets the size of everything after it

> **DECIDED 2026-08-14 by Oleh — three vessels now, `Table.astro` deferred.**
> Build `EmptyState.astro`, an alert vessel, and make `Badge.astro` the only path. **Do not build
> `Table.astro` in Wave 3** — revisit it after Waves 1–2, when the residual table findings are
> visible. Reason: the first three are one wave of mechanical replacement; the table job is a
> 9-class / 23-file migration whose size is not yet knowable, and bundling it into the same yes/no
> hid that. Adjudicate D15 (`one-table`) as **deferred, not rejected**; D17 (`one-empty-state`) and
> the alert vessel are **bound**.

**Two lenses independently found the same root cause: this codebase converges where a component
exists and diverges everywhere else.**

| job | has a component? | implementations |
|---|---|---|
| pagination | `TablePager.astro` | **1** across 13 mounts |
| tables | CSS class only | **9** across 23 files |
| empty states | none | **28** families across 30 files |
| status badges | `Badge.astro`, optional | 11 call sites vs **161** raw class strings |
| alerts | **none** — the only Primitive in the catalog with no `reference:` component | 5 vessels, 7 warning glyphs, 8 info glyphs |

The X04 reference's five CSS rules are declared **byte-identically in two view files**, because Astro
scoped styles cannot cross a file boundary. That mechanism *is* why there are 28 families.

**The question for Oleh: do we build `Table.astro`, `EmptyState.astro`, an alert vessel, and make
`Badge.astro` the only path — yes or no?** Yes closes dozens of findings structurally. No means
fixing them one at a time, and some will come back.

## Step 4 · Fix, in three waves

**Wave 1 — what lies to the user.** Not cosmetics: the product asserting things that are not true.
- Login and Register **refuse nothing** — empty submit does nothing at all, `#login-error` has no
  writer in the repo, `not-an-email` is accepted and confirmed with "we sent a sign-in link".
- The connect flow renders **0 of its 19** documented failure messages. The copy exists. Meanwhile
  `StoragePicker` **is** live and ships eight of the same codes in developer voice, printing
  `error_code:` to the user. We ship the engineer's words and keep the writer's in a dead file.
- Settings ▸ Space **invents a Space** — blank name, three named Airtable workspaces, and a red
  **Delete Space** card — for a trial user who has none.
- Three logs label an unrecognised status **`Cancelled`**: a word asserting a person deliberately
  stopped something. Reports guesses `Issues`.

**Wave 2 — what breaks the work.**
- The auth shell **cannot scroll** (`h-screen overflow-hidden` + a centred card clips both ends with
  no scrollbar). At 844×390 `Continue` sits at 459.8 in a 390 viewport — **the onboarding form cannot
  be submitted**.
- **The panel stack is invisible to a keyboard**: focus never moves into an opened panel, Tab walks
  the page behind it, Escape closes something the user never reached. `Drawer` asserts
  `aria-modal="true"` with no trap, no `inert`, no restore.
- **Docs is an editor with no save at all** — `openDoc` overwrites `editor.innerHTML` on every route in.
- **Automations and Interfaces destroy in one click** with no confirm and no undo, and nothing
  un-removes them.

**Wave 3 — the components from Step 3**, and the long tail falls with them.

## Step 5 · Decisions that are Oleh's and block nothing else

Can be answered in parallel with Steps 1–2:
- **Button tiers 40/32** — measured: zero off-tier buttons; 40 is the documented md carve-out for one
  page CTA. Converging them means deleting that carve-out from 17 views.
- **Card padding 33 or 29** at narrow — see the responsive section below; I gave Oleh wrong
  arithmetic and he decided on it.
- **The two table ties** — `.rs-snapwrap` and source-detail `.reg-usewrap`, both written up with
  numbers and both readings in `specs/16-responsive.md` §12.
- The six pending client decisions; **#4 blocks all of Billing and #6 blocks all of Help**.

---

# Mobile / responsive — where the rules live and what is left

## The rules

**`specs/16-responsive.md` is the standard.** Every rule in it carries the measurement it came from;
a rule with no evidence line under it is not a rule. Catalog entries that point at it:
`pattern-responsive`, `pattern-page-header`, `pattern-mobile-drilldown`, `pattern-mobile-row`,
`pattern-breakpoints` in `apps/design/src/lib/storybook.ts`.

**Supporting evidence files:** `audit/findings/X-RESPONSIVE-CENSUS.md` (what the app actually did,
measured at 390/430/768/1440) and `audit/findings/X-CSS-ORDER.md` (rules that are written and dead).

## How it works, in six lines

- **Boundaries:** `1279.98` · `767.98` · the **390** floor · `MOBILE_BREAKPOINT = 1280` authored once
  in `lib/mobileNav.ts`. No new boundary above 1280; below it a surface may fold at its own width
  only under four stated conditions.
- **One product, not two.** Narrow is the same app in a narrower window — an Airtable extension
  panel — not a phone edition. *"Make it work on a phone"* is never the reason for a rule; *"this
  content stops fitting at width W"* always is.
- **Tables:** *compare values down a column → **PAN** (measured min-width floors + `data-narrow-pan`,
  which mounts `panRail`); read a row as a self-contained record and open it → fold.* **Column count
  is not the test.** Oleh has rejected the fold twice, so **pan is the default and a fold needs a
  reason.**
- **Type:** every size from a `--t-*` token, never a literal. The compact scale steps them below the
  boundary. **Anything a user reads as information is ≥12px painted**; only small badges and labels
  may go below.
- **Radius is width-invariant** (3 of 361 declarations ever changed).
- **Controls:** the floor follows the **pointer**, not the width — 28px fine, 44px only under
  `pointer: coarse`.

## How a rule dies here — read `specs/16-responsive.md` §10 before editing any CSS

Four mechanisms, all proven in this repo, all with **every gate green**:
1. **Source order** — a narrow `@media` block above the declarations it overrides loses at equal
   specificity. A media query changes *when* a rule is considered, never whether it wins.
2. **Specificity** — an id-bearing shared rule (`#layout-content …`) outranks anything a view can
   write; and an Astro-scoped `[data-astro-cid-…]` outranks a shared `global.css` rule.
3. **A CSS comment that closes early** — a stray `*/`, or prose merely *quoting* one — silently
   swallows the rule after it.
4. **A stale Vite partial transform** — a scoped `<style>` served with old content, so source and
   browser disagree.

**Therefore: verify every edit by reading a COMPUTED value.** Source and `element.matches()` both lie
here. `pnpm css-guard` catches 1–3 statically; **nothing catches 4** except `smoke` after a restart.

Also: a scoped style **does not reach a child component's root** — that has cost time four times.

## The gates

`pnpm typecheck` · `pnpm ds-lint` · `pnpm smoke` · **`pnpm css-guard`** (new; `css-audit` for the
whole tree). `css-guard` was validated by replaying history — run against the tree before the fixes,
it found **all nine dead declarations at the exact lines the audit names** — and it caught a real
defect on its first live use.

**Known gate blind spots, all measured:**
- **`ds-lint` has never inspected `storybook.ts`** — it lives in `apps/design`, so the file defining
  the rules `ds-lint` enforces is not linted. The styleguide breaks three of its own stated rules.
- **`smoke` is green on states it never reaches:** `/settings` declares six variants and no fixture
  variant · `bases.astro` has no `empty` branch, so `?fixture=empty` serves the 50-base fixture ·
  `/login` and `/register` declare zero variants, leaving ten guarded auth branches walked by nothing.
- No gate measures a **painted** result. 11px body text passed every gate for months because it was
  formally a token and formally on the ladder.

## Covered — measured at 390 and looked at

Home · Backups (list, run, per-base) · Restore history · Reports (list, definition ×3 tabs, document,
new) · Sources (list, detail) · Destinations (list, detail) · Settings (drill-down) · Inbox · base
picker · Schema (Browse, Relationships, Changelog, Automations, Interfaces) · Data (Comments, Media,
Changelog, grid).

Accepted by Oleh without a dedicated pass: Restore flow · Settings inner (Billing, Profile, Help) ·
Actions · Schema Chat and Health.

## Not covered — this is what "finish the mobile work" means

1. **Integrations** — the page, the setup wizard, the authorizing step. Four screens, and the only
   path a new user must complete before the product does anything. Its narrow faults are already
   measured in `audit/findings/S28-S31.md`: the edit-mode tab bar becomes a 4-row 147px column, the
   grouped Auto-add switch is clipped to 27 of 33px with its label at **0px visible**, the first base
   row sits at y=646 of 844, and **`ConfirmModal`'s controls shrink 38→27px — a shared component, so
   that one reaches every dialog in the product.**
2. **Creation forms** — `sources/new`, `destinations/new`. Faults measured in
   `audit/findings/S24-S27.md`: both pages **name themselves twice** at 390 (app bar plus a
   non-`.text-title` h1, in different words), the h1 literals are frozen at 24/20 while every
   tokenised rule steps, and the connection-method option is a `<span>` no floor rule reaches — 34px
   on a coarse pointer beside 44px buttons.
3. **Auth** — Login, Register, Welcome. **The 390 floor gate is absent** (it lives in
   `SidebarLayout`; `AuthLayout` never renders it). They do keep working at 375 — measured — so the
   gate is S2; the S1 is the unscrollable shell in Wave 2 above.
4. **Data Browse at 390** — the grid pans, but nobody has looked at it. It is the largest grid in the
   product.
5. **404 and Styleguide** — the styleguide **destroys its own content below 1024**: its decision table
   is 561px of min-content inside a **44px** box with `overflow-x: hidden` and `body { overflow:
   hidden }`. Its own `pattern-responsive` says *compare down a column → pan*. It does not practise
   what it preaches.

## Responsive debt already recorded and not done

- **`94vw` survives in seven Drawer sites** (`--drawer-w: min(94vw, 30rem)` plus five literals, one
  of which is `92vw`) — the exact scrollbar defect §8 bans. **Drawer and the panel are one contract**
  (the same object at different z-indexes), so §8's `100%` ruling is incompletely applied.
- **Three radius deletions** the width-invariant rule "costs" were never done and were listed nowhere
  until now: `components/reports/ReportBodyKpi.astro:733`, `styles/global.css:1165`,
  `views/SpaceHomeView.astro:581`.
- **`.br-more` (fields)** computes 52px against its rows' 28 — the third instance of one indent bug.
- **50 numeric `fontSize` props in `SchemaCanvas.tsx`** (9.5 · 10.5 · 11.5 · 12.5 · 13.5). The census
  never saw them: it greps `font-size:`, not `fontSize:`. They size a fixed-geometry graph canvas, so
  it is **one decision, not fifty**.
- **`TrendChart` ×3** — on-ladder but unreachable by a CSS variable (ApexCharts config strings).
- **Two `badge-sm` at 11px** in Settings ▸ Security, and SecurityPanel's "Unlink" renders a
  missing-glyph box at 390.
- **`/restore` is the last surface without folded filters** — the other eight surfaces call
  `mountRefineCollapse`; its facets render as bare chevrons at narrow.
- `storybook.ts` §12 still lists Sources/Destinations as "FOLD, still to build". They pan.

## Two working agreements that produced most of today's real findings

- **Put a screenshot at 390 in front of Oleh as part of "done"**, not a written conclusion. Three
  defects yesterday were found only by looking: a rail painted outside its card, a stacked wall of
  Settings cards, a pile of badges where a table used to be. Three others were found only by
  measuring: 11px body text, an alert two rungs up, a 0px name column. **Neither method finds the
  other's class.**
- **Do not review your own work against your own criteria.** Every useful review this week came from
  handing an agent explicit criteria and telling it to find what was missed. Self-review checks the
  work against the rule you just invented, which is a closed loop — and twice this week a rule was
  derived backwards from Oleh's own decision and applied as law until he caught it by eye in seconds.
