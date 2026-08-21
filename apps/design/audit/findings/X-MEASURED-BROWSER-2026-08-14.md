---
id: X-MEASURED-BROWSER-2026-08-14
surface: four NEEDS-MEASUREMENT items taken in the browser (ship-order 28 · 29/D21 · 33 · 34)
url: http://localhost:4332/schema?tab=docs · /schema?tab=automations · /backups/run · / · /data · 24 routes swept · ?fixture=empty
shots: [audit/shots/XMB-A-01-schema-docs-900-sheet-plus-panel-open.png, audit/shots/XMB-A-02-schema-docs-900-after-one-escape-both-closed.png, audit/shots/XMB-B-01-drawer-au-modal-390-94vw-366px.png, audit/shots/XMB-B-02-entitypanel-390-paints-288-at-x101-not-350-at-x40.png, audit/shots/XMB-C1-01-badge-soft-neutral-dark-1.34-to-1.png]
scout: audit-scout
---

## 0 Instrument, and why prior narrow numbers in this audit are suspect

Every narrow width here was set with
`emulate({ viewport: "390x844x3,mobile,touch" })` / `"425x900x3,mobile,touch"` / `"1440x900x2"`,
never `resize_page`. `window.innerWidth` is returned **inside every payload below**, next to the
value being claimed. `matchMedia('(pointer: coarse)')` was confirmed `true` at both narrow widths.

One platform fact governs all of measurement **B** and must be stated before any of it:

| probe | value |
|---|---|
| `window.innerWidth` | 390 |
| `document.documentElement.clientWidth` | 390 |
| `100vw` painted | 390 |
| the same three with a **forced 20,983px-tall page** | 390 · 390 · 390 |
| `navigator.platform` | `MacIntel` |

**The scrollbar costs 0px here, at every width tested.** Chrome on macOS paints overlay scrollbars,
so `vw` and `%` are the same number and cannot diverge. Every claim in this repo that attributes a
panel-width difference to "`vw` counts the scrollbar" is therefore **unverifiable on this machine and
measured 0 here** — including `specs/16-responsive.md:472-474` ("The **8.41px** RecordPanel gained is
the scrollbar"). It would be ~15px on Windows/Linux classic scrollbars; I could not emulate that, so
that half is **unverified**, not disproven.

---

## 1 Job

Not a user surface. The job is the audit's own: convert four `NEEDS-MEASUREMENT` rows into numbers so
`audit-lead` can bind a severity instead of inheriting one. Where a lens below needs a surface, the
surfaces are `/schema` ▸ Docs (A, B), `/backups/run` (C1, D), `/` (D) and the five `?fixture=empty`
empty states (C2).

## 2 First five seconds

Two of the four measurements changed what the screen is doing in the first five seconds, so this lens
is not empty:

- **`/schema` ▸ Docs at 390 with one panel open** (`XMB-B-02`): 61px of the page survives to the LEFT
  of the `＋` rail, showing body text clipped mid-word — `The` / `hub.` / `com` / `anyt`. The eye
  lands on a vertical strip of broken words that no rule intends. See B.
- **`/backups/run` with the failed-attachments drawer open** (`XMB-C1-01`): the eye lands on the two
  red reason lines, correctly. The word `Won't retry` — the one word saying the failure is final — is
  not in the first five seconds, or the first thirty. See C1.

## 3 Navigation and orientation

One reachability fact, and it is the answer to a question the worklist asked:
`listSheet.ts:49` — `const OVERLAY_BELOW = 964` — and `:149` measures the **section column**, not the
viewport. At 1440 the column is 1136 and **no element in the document carries `is-list-overlay` at
all**. The co-open state finding X06-F8 asks for (`/schema` ▸ Docs, a listSheet *and* a panel) is
therefore **unreachable at 1440**. It was reached at viewport 900 (column 876). Recorded as a
navigation/orientation fact because it means the sheet silently changes from a column into an overlay
at a width nothing in the URL records.

## 4 Primary action

n/a for a measurement item — no primary action was added or judged. The Escape **key** is the closest
thing to an action under test, and A shows it currently performs two destructive acts per press.

## 5 Pattern inventory

| element | should be (storybook id) | actually is | verdict |
|---|---|---|---|
| Escape on a page with two overlays open | one owner that delegates (`PanelHost.astro:568-573` states the model) | 24 independent `document` listeners, all of which run | **drift** |
| `.ep-sheet` at ≤1279.98 | `pattern-side-panel-width` — one geometry app-wide | 288.79px, content-derived, viewport-independent | **drift** |
| `.rp-sheet` at ≤1279.98 | same entry | 350px at x=40 — correct | catalog |
| `Drawer` panel width | same entry (the catalog forbids per-surface panel geometry) | 3 bespoke `vw` literals, none overridden at narrow | **drift** |
| `badge badge-soft badge-neutral` (`BackupRunDetailView.astro:530`) | `badge` — the entry BANS this pair | the banned pair, painted | **drift** |
| unsized `.iconify` below the 12px floor | `sizing floor SM/12px` | `.74rem` / `.72rem`, no `ds-ok` | **drift** |
| empty-state sentence cap | one `ch` value (46ch bound as standard) | 7 values, none of which binds at 390 | **drift**, but invisible — see C2 |

## 6 States

| state | exists | correct | evidence |
|---|---|---|---|
| listSheet overlay + panel co-open | **yes**, below a 964px column | **no** — one Escape closes both | `XMB-A-01` → `XMB-A-02`; 24-listener log, A below |
| listSheet overlay at 1440 | **no** | n/a | `listSheet.ts:49,149`; zero `is-list-overlay` nodes at 1440 |
| one panel open at 390/425 | yes | **no** — 288.79px at x=101.21 | B; `XMB-B-02` |
| two panels open at 390 | yes | yes — 350px at x=40 | B |
| `Drawer` at 390/425 | yes | disagrees with the panel by 77.8px | B; `XMB-B-01` |
| permanent file failure, dark theme | yes | **no** — 1.34:1 | C1; `XMB-C1-01` |
| permanent file failure, light theme | yes | **no** — 4.35:1, undocumented | C1 |
| empty state at 1440 | yes (5 routes) | cap binds exactly | C2 |
| empty state at 390 | yes (5 routes) | cap never binds | C2 |
| unsized icon, 24 routes | yes | 3 visible below 12px | D |

**Reachability.** Nothing above was blocked by the harness. Two things were **not reached** and are
named in the report rather than smoothed over: `/integrations/configure/bases` was not swept, and the
icons that only exist inside interaction-gated states (`SchemaChat`, `schemaChat.ts`, `QuickAskDock`,
`typeaheadItems.ts`, `schemaRelationships.ts` — 15 of the 73 lines) had their host route loaded but
their state never opened.

## 7 Cross-surface consistency

The four measurements produce one shared finding: **the same job is done to four different numbers at
one viewport.** At 390, "an overlay over the page" paints

| host | painted width | left edge | spelling | file:line |
|---|---|---|---|---|
| `EntityPanel` `.ep-sheet` (1 panel) | **288.79** | **101.21** | `calc(100% - 40px)` | `EntityPanel.astro:315` |
| `RecordPanel` `.rp-sheet` | **350.00** | **40.00** | `calc(100% - 40px)` | `RecordPanel.astro:670` |
| `Drawer` default | **358.80** | **31.20** | `min(92vw,28rem)` | `Drawer.astro:27` |
| `Drawer` (`au-modal`) | **366.59** | **23.41** | `min(94vw,30rem)` | `SchemaAutomations.astro:257` |

Four widths, four left edges, **77.80px** of spread — and the first two rows are the *same
declaration in the same media query*. Comparison target: `specs/16-responsive.md:456-460`, "there is
one spelling of that", and `storybook.ts` ▸ `pattern-side-panel-width`, "one geometry app-wide".

## 8 Copy and tone

Not under test. One incidental: the `Won't retry` label in C1 is correct, terse, second-person-free
copy that the *colour* destroys — a copy finding that is not a copy defect. Worth recording so nobody
"fixes" the wording.

## 9 Foreign or surprising

The single most surprising measured fact: **`.ep-sheet` is 288.79px at a 390 viewport and 288.79px at
a 425 viewport.** A panel whose painted width does not change when the screen changes by 35px is not
a responsive rule at all — it is a content measurement. Mechanism in B.

## 10 Density and rhythm

- The three sub-12px icons (D) are the only measured breaches of the SM/12px floor that do not carry
  `ds-ok`. Seven sibling sub-12px rules do carry one, so the floor is otherwise being honoured
  deliberately.
- `1ch` measured **8.3701px** at `--t-14` = 14px (≥1280) and **7.7722px** at 13px (<1280). So every
  `ch` cap silently shrinks by 7.1% below 1280 — on top of never binding there (C2).

---

# A · Five competing Escape listeners → measured: 24, and nobody wins

**Method.** `http://localhost:4332/schema?tab=docs`, viewport `1440x900x2` then `900x900x2`.
`navigate_page` `initScript` (runs before any page module) patched
`EventTarget.prototype.addEventListener` to wrap every `keydown` registration with a logger recording
registration index, target, capture flag and the `apps/web` stack frame; and patched
`Event.prototype.stopPropagation` / `stopImmediatePropagation` to record the caller. Nothing was
inferred from source. `.dc-listtoggle` opened the sheet, `[data-entity-open]` opened the panel,
Escape was a real `press_key`.

**Raw — the population, at `/schema?tab=docs`, `innerWidth: 1440`**

| | count |
|---|---|
| `keydown` listeners on the page, all targets | **91** |
| on `document` | **22** |
| on `document`, from `apps/web` | **14**, from **8** sources |
| on `document`, from vendor (`@xyflow/react`) | 8 |

The 8 `apps/web` sources, in registration order — `tooltip.ts` · `collapsingSearch.ts` ·
`EntitySearch.astro` (**×6 instances**) · `schemaRelationships.ts` · `Drawer.astro` · `listSheet.ts`
(**×2**) · `PanelHost.astro` · `sectionTabs.ts`.

**Two corrections to F8's site list.** Of the 10 `document.addEventListener('keydown')` sites in the
tree, **7** handle Escape, not 5. F8 named `PanelHost.astro:574` · `Drawer.astro:126` ·
`schemaRelationships.ts:267` · `listSheet.ts:189` · `tooltip.ts:213`. It **missed**
`collapsingSearch.ts:70` (blurs a focused collapsing search) and `entityPanelController.ts:705`
(registered at `:719`). Conversely `sectionTabs.ts:81` and `EntitySearch.astro:266` are **`/`
handlers, not Escape** — they should come off any Escape ledger.

**Raw — one Escape keypress, sheet + panel both open, `innerWidth: 900`** (reproduced twice)

| # | delivered to | note |
|---|---|---|
| 1 | `tooltip.ts` | |
| 2 | `collapsingSearch.ts` | not in F8's list |
| 3–8 | `EntitySearch.astro` ×6 | `/` handler, no-ops on Escape |
| 9 | `schemaRelationships.ts` | |
| 10 | `Drawer.astro` | |
| 11 | `listSheet.ts` (instance 1) | |
| **12** | — | **`listSheet.ts:191` calls `stopPropagation()`** |
| 13 | `listSheet.ts` (instance 2) | **ran anyway** |
| 14 | `PanelHost.astro` | **ran anyway** — closes the panel |
| 15 | `sectionTabs.ts` | ran anyway |
| 16–23 | `@xyflow/react` ×8 | ran anyway |
| 24 | `entityPanelController.ts` | ran anyway |
| **25** | — | `entityPanelController.ts:711` calls `stopImmediatePropagation()` — **on the last listener; stopped nothing** |

`totalDeliveries: 24` · `deliveriesAfterListSheetStopPropagation: 13`.

**What closed:** the sheet (`is-list-open` removed) **and** the panel (`.ep-sheet` count 0 → the
element is gone). `XMB-A-01` shows both open; `XMB-A-02` shows both gone after one press.

**Verdict — F8 STANDS, but its mechanism is wrong and its severity is low.** F8 feared
non-determinism: "which one wins is listener-registration order". Measured, **nothing wins, because
every one of them runs.** `stopPropagation()` cannot stop a sibling listener on the *same target*, and
all 24 are on `document` — only `stopImmediatePropagation()` could, and the one call to it lands
last. Two further corrections: **one** Escape listener calls `stopPropagation`, not two; and it is
**not unconditional** — `listSheet.ts:190` returns unless that sheet is open.

The real defect is worse than the filed one and is not about ordering: **one Escape press destroys
every overlay on the page.** A user who opens the Documents list, opens a base panel to read it,
then dismisses the list, loses the panel too. Proposed **S2, not S3** (it breaks the learned
one-Escape-one-overlay expectation and silently discards work), and it strengthens F8's own proposed
disposition — a single delegating owner — because that is the only fix that can arbitrate.

---

# B · Drawer/panel width at narrow → the §8 fix resolves against a content-sized box

**Method.** `emulate` `390x844x3,mobile,touch` and `425x900x3,mobile,touch` (and `390x844x1` /
`425x900x1` for the Drawer, to remove `,mobile` as a variable — the numbers were identical).
`getBoundingClientRect()` and `getComputedStyle` on each host after opening it; `.ph-panels` and
`.ps-rail` measured alongside; a fixed probe element measured what each declared expression resolves
to. Scrollbar cost re-probed at every width (always 0 — see §0).

**Raw — `EntityPanel` `.ep-sheet`, `/schema?tab=docs`**

| innerWidth | `.ph-panels` clientWidth | `.ps-rail` | `.ep-sheet` painted | left edge | §8's stated result |
|---|---|---|---|---|---|
| 390, **one** panel | **328.79** | 40 | **288.79** | **101.21** | 350 at x=40 |
| 425, **one** panel | **329** | 40 | **288.79** | **136.21** | 385 at x=40 |
| 390, **two** panels | 390 (clamped) | 40 | **350.00** | **40.00** | 350 at x=40 ✓ |

**Mechanism.** `PanelHost.astro:623` —
`.ph-panels { position: absolute; top:0; right:0; bottom:0; display:flex; …; max-width: 100vw; }` —
declares **no width**, so an absolutely-positioned flex box shrink-to-fits from its content. The five
sheets then say `width: calc(100% - 40px)` (`EntityPanel.astro:315`, `RecordPanel.astro:670`,
`DataChangelog.astro:507`, `MediaPanel.astro:490`, `QuickAskDock.astro:541`), and that `100%`
resolves against the shrink-to-fit box — a **circular percentage**, which CSS breaks by sizing the
parent from the child's max-content contribution. Hence 328.79, hence 288.79, and hence the width is
**viewport-independent**: identical at 390 and 425. The documented 350-at-x=40 only appears once the
content pushes `.ph-panels` into its `max-width: 100vw` clamp.

**It is intermittent across hosts, for the same reason.** `RecordPanel` on `/data` at 390 measured
**350.00 at x=40** (`.ph-panels` = 390) — correct. Same declaration, same media query, different
content. So the fix works on `/data` and fails on `/schema`.

**Raw — `Drawer`** (no narrow override exists in `Drawer.astro`)

| spelling | site | 390 | 425 |
|---|---|---|---|
| `min(92vw,28rem)` (default prop) | `Drawer.astro:27`, live on `BackupRunDetailView.astro:524` | **358.80** at x=31.20 | **391.00** at x=34.00 |
| `min(94vw,30rem)` | `SchemaAutomations.astro:257` | **366.59** at x=23.41 | **399.50** at x=25.50 |

**How many px the scrollbar-inclusive `vw` actually costs: 0.00px, at 390 and at 425.**
`94vw` = 366.59 and `94%` of `documentElement.clientWidth` = 366.60 — a 0.01px rounding difference.
Overlay scrollbars; see §0.

**A second deflation, from source + probe.** F3's "two of the five fall back to a literal `480px`
instead — a different number below ~511px" is **unreachable**. `min(94vw,30rem)` and `480px` are the
same number at every width ≥ 511px, and below 1280 **all five hosts** override with
`calc(100% - 40px)` (`MediaPanel.astro:490`, `QuickAskDock.astro:541` confirmed). The two spellings
cannot disagree in any state a user can reach.

**Verdict — F3 CHANGES: the `vw`/scrollbar half FALLS on this platform, the one-contract half STANDS
and gains a new, larger defect.** Proposed **S2** (was S2) but re-aimed: the finding to fix is not
`--drawer-w`'s units, it is that `.ph-panels` has no width, which makes the already-applied §8 ruling
conditionally dead — the exact failure mode `infra-css-parse-error-invisible-to-gates` warns about,
and one `css-guard` cannot see because the cascade is correct and the *containing block* is wrong.
Precise change proposed (not applied): give `.ph-panels` an explicit `width: 100vw` (or
`inset-inline: 0`) so `100%` has a viewport-sized basis; then `calc(100% - 40px)` paints 350 at x=40
on the first panel too. Separately, `Drawer` needs the same narrow rule the five panels have — it is
the only overlay family without one. **`specs/16-responsive.md:462-479` should be corrected**: its
recorded verification (326.59 → 350, x 63.41 → 40) is not reproducible for the first panel, and its
"the 8.41px is the scrollbar" attribution measures 0 here.

---

# C · Two painted values

## C1 · `badge-soft badge-neutral` contrast — the catalog's numbers are exactly right, and incomplete

**Method.** `/backups/run`, viewport `1440x900x2`. Opened `#failed-drawer-detail`
(`BackupRunDetailView.astro:524`) to reach `Won't retry` (`:530`). Read `getComputedStyle` on the live
element; the tokens resolve to `oklab()`, which does **not** parse as rgb, so each colour was resolved
through a canvas 2d `fillStyle` drawn over opaque white and opaque black to recover colour + alpha,
then composited over the first opaque ancestor background. WCAG 2.x relative luminance and
`(L1+0.05)/(L2+0.05)` computed in-page.

**First correction: the theme in the brief does not exist.** `lib/theme.ts:13-14` —
`DARK_THEME = 'baseout'`, `LIGHT_THEME = 'baseout-light'`. There is no `baseout-dark`; the register
and the worklist both name it.

**Raw, `innerWidth: 1440`, 12px / weight 600**

| | dark (`baseout`) | light (`baseout-light`) |
|---|---|---|
| painted text | `rgb(44,44,51)` | `rgb(107,114,128)` |
| painted pill | `rgb(19,19,20)` | `rgb(242,243,244)` |
| opaque backdrop behind | `rgb(17,17,17)` | `rgb(255,255,255)` |
| **text vs pill** | **1.34** | **4.35** |
| **pill vs page behind** | **1.02** | **1.11** |
| text vs page behind | 1.36 | 4.83 |
| same slot as `badge-ghost` | **17.40** | **16.29** |

**Does it pass?** **No, in either theme.** Text fails AA 4.5:1 at **1.34** (dark) and **4.35**
(light) — 12px/600 is not "large text", so 4.5 is the threshold, and light misses it by 0.15. The
pill fails the 3:1 non-text/UI threshold at **1.02** and **1.11**, i.e. the *shape* is invisible in
both themes. `XMB-C1-01` shows it: the semantic red `2 failed` in the same drawer reads cleanly while
`Won't retry` is a ghost.

**Verdict — X08-F6 STANDS and STRENGTHENS.** The catalog's own figures reproduced to the digit
(1.34 / 1.02, and `badge-ghost` 17.4). What the catalog does **not** say, and should, is that the pair
also fails in the **light** theme (4.35 text, 1.11 pill) — `storybook.ts:732` scopes the ban's
evidence to "on the dark theme", which invites the reading that light is fine. Proposed severity
unchanged (**S2**); the ADOPT should also amend that sentence, since the audit's goal is a catalog
that describes behaviour rather than one true instance of it.

## C2 · The seven `ch` caps — the cap is not the binding constraint at 390, and 42 vs 46 is invisible everywhere

**Method.** Five `?fixture=empty` routes rendered in same-origin iframes at exactly 1440 and exactly
390 (`/backups`, `/reports`, `/restore`, `/data`, `/schema`). For each live empty-state sentence:
declared `max-width` in px, painted width, and **line count via `Range.getClientRects()` distinct
`top` values** — not estimated. Then the same string re-measured in a probe carrying the element's own
resolved `font` and `letter-spacing` at 42 / 44 / 46 / 48 / 52 / 56ch.

`1ch` = **8.3701px** at 14px (≥1280) and **7.7722px** at 13px (<1280, `--t-14` steps down per
`global.css:205`).

**Raw at 1440 — cap binds exactly (painted == declared) in 5 of 5. Line count per cap:**

| route · class | chars | 42ch | 44ch | 46ch | 48ch | 52ch | 56ch |
|---|---|---|---|---|---|---|---|
| `/backups` `.bl-empty-sub` (42ch live) | 102 | 2 | 2 | 2 | 2 | 2 | 2 |
| `/reports` `.rpl-empty-sub` (46ch) | 150 | 3 | 3 | 3 | 3 | 3 | 3 |
| `/restore` `.rh-empty-sub` (46ch) | 152 | 3 | 3 | 3 | 3 | 3 | 3 |
| `/data` `.sch-empty-sub` (44ch) | 122 | 3 | 3 | 3 | **2** | 2 | 2 |
| `/schema` `.sch-empty-sub` (44ch) | 133 | 3 | 3 | 3 | 3 | **2** | 2 |

**42ch vs 46ch: identical line count in 5 of 5.** 46ch vs 56ch: differs in 2 of 5.

**Raw at 390 — the cap never binds, 5 of 5:**

| route | declared cap px | painted px | parent px | `capIsBinding` |
|---|---|---|---|---|
| `/backups` | 326.43 | **316.0** | 366 | **false** |
| `/reports` | 357.52 | **316.0** | 366 | **false** |
| `/restore` | 357.52 | **316.0** | 366 | **false** |
| `/data` | 341.98 | **302.0** | 366 | **false** |
| `/schema` | 341.98 | **300.0** | 366 | **false** |

The centred shrink-to-fit container binds first, every time. Unconstrained at 390, 42ch and 46ch again
give identical line counts in 5 of 5; only 56ch differs (2 of 5).

**Verdict — X04-F2 STANDS as variance, FALLS as a visible defect; propose S2 → S4.** Is the difference
visible at all? **At 390, no — the cap is never reached, so all seven values render identically. At
1440 the cap binds exactly, but no adjacent pair in the ladder changes anything; only the 46-vs-56
gap does, and only on 2 of 5 sentences.** Consolidating on 46ch remains right — seven numbers for one
job is exactly the variance this audit exists to remove — but it should be scheduled as a
zero-user-impact tidy, not as a rendering fix, and it must not be bundled with work claiming a visual
payoff. The genuinely user-visible half is the one nobody filed: at 390 these sentences are governed
by a container nothing declares.

---

# D · The 73 unsized `.iconify` spans → the DEFER trigger has fired

**Method.** Census re-run: `git grep -o 'class="iconify lucide--[a-z0-9-]*"'` = **75 occurrences** on
**73 lines** across **31 files** (F5's "73" is `git grep -c`, i.e. lines — both numbers are right, in
different units). Then **24 routes** rendered in same-origin iframes at 1440, and every
`span.iconify` measured for computed `font-size` and painted box; "unsized" = no
`size-*` / `icon-*` / `text-*` / `w-*` / `h-*` utility in `class`. Sub-12px hits were then re-measured
on the real page with their `data-astro-source-loc` and full ancestor font-size chain.

**Raw — per-route minimum computed `font-size` of an unsized `.iconify`** (24 routes; `innerWidth`
reported 1440, iframe width 1440):

| min | routes |
|---|---|
| **11.52px** | `/`, `/integrations`, `/integrations/configure` |
| 12px | `/backups/run`, `/backups/run/base` |
| 13px | `/data`, `/panels`, `/schema` |
| 14px | `/inbox` |
| 15.2px | `/destinations/detail`, `/destinations/new`, `/sources/detail`, `/sources/new` |
| 19.2px | `/backups`, `/reports`, `/restore` |
| — (no unsized) | `/actions`, `/destinations`, `/help`, `/login`, `/settings`, `/settings/billing`, `/sources`, `/welcome` |

**Below 12px: YES — 3 visible instances, all on Home.** (`/integrations` is a redirect to `/` —
`apps/design/src/pages/integrations.astro` — so it is one surface, not two.)

| site | painted | box | the rule that sizes it |
|---|---|---|---|
| `SpaceHomeView.astro:220` `lucide--arrow-down` (KPI delta) | **11.84px** | **10.45 × 11.84** | `global.css:1902` — `.hm-delta .iconify { font-size: .74rem; }` |
| `SpaceHomeView.astro:440` `lucide--check` (pipeline connector) | **11.52px** | 11.52 × 11.52 | `SpaceHomeView.astro:726` — `.hm-conn-badge .iconify { font-size: .72rem; }` |
| `SpaceHomeView.astro:446` `lucide--check` (pipeline connector) | **11.52px** | 11.52 × 11.52 | same rule |
| `IntegrationsSetupWizard.astro:344`, `:349` `lucide--check` | 11.52px | — | `IntegrationsSetupWizard.astro:591` — `.review-link-badge .iconify { font-size: .72rem; }` — measured **not visible** in the default state |

**Mechanism correction, and it matters for the fix.** F5's mechanism — "carry no size utility and
inherit 1em (`global.css:1503`)" — is **not** what these are. Nearly every unsized span is sized by a
bespoke component CSS rule to 12 / 13 / 14 / 16 / 20px, which is why 22 of 24 routes are at or above
the floor. The three breaches are the opposite of unsized: they are **explicitly sized below the
floor in raw `rem` literals**, which `ds-lint` cannot see because `ds-checks.mjs` looks for `*-xs`
utilities and ~10px, not `.72rem`. None of the three carries `ds-ok` — unlike the seven sibling
sub-12px rules that do (`EntityPanel.astro:341`, `SchemaBrowse.astro:538`, `:695`,
`ReportDefinitionView.astro:1043`, `:1055`, `:1060`, `:1061`), so the floor is otherwise being
honoured deliberately and these are oversights, not policy.

**Verdict — X09-F5's DEFER trigger ("any measured icon below 12px") HAS FIRED, but it should not
reopen the 73-span sweep.** The measurement says the 73-span population is healthy and the
`1em`-inheritance premise is wrong; what needs work is **three CSS rules on two views**, which is a
far smaller and far better-aimed job than "collapse 73 spans". Propose splitting F5: the sub-12px
rules become their own **S3 · ADOPT** (lift `.74rem`/`.72rem` to `var(--t-12)`, or add `ds-ok` with a
stated reason if a 16px connector badge genuinely cannot hold a 12px glyph — note `.hm-conn-badge` is
only `1rem` square, so this may be a badge-size decision, not an icon one — **unverified which**);
the remaining 73-span consolidation **stays DEFER**, with the trigger rewritten to something the
measurement can actually falsify, e.g. "an unsized `.iconify` whose *nearest* `font-size` rule is
absent", since "below 12px" has now been satisfied by a mechanism the finding was not about.

**What I did not reach, plainly.** `/integrations/configure/bases` (`IntegrationsManageBasesView`,
1 line) was not swept. The `/schema` sweep loaded only the default tab, so icons emitted as runtime
HTML strings by `schemaChat.ts` (4), `typeaheadItems.ts` (1) and `schemaRelationships.ts` (1), and
those inside `SchemaChat.astro` (5) and `QuickAskDock.astro` (4) states I never opened, were **not
measured** — 15 of the 73 lines. I also measured only at 1440; the `<1280` type step-down
(`global.css:204-210`) lowers `--t-*`-sized icons, so a narrow sweep could find more sub-12px cases
and **was not run**.

---

## Findings

| # | severity | one-line defect | evidence | comparison target | proposed disposition |
|---|---|---|---|---|---|
| **M1** | **S2** (was S3) | **One Escape press closes every overlay on the page.** Measured: a single keypress with a listSheet and a panel co-open is delivered to **24** `document` listeners and both overlays close. `stopPropagation()` at delivery 12 was followed by 13 more deliveries, because siblings on the same target cannot be stopped. F8's "which one wins is registration order" is wrong in the safe direction — *nothing* wins. | `XMB-A-01` → `XMB-A-02`; instrumented 24-delivery log at `innerWidth: 900`; `listSheet.ts:191` (`stopPropagation`), `entityPanelController.ts:711` (`stopImmediatePropagation`, fires last) | `PanelHost.astro:568-573` — the one Escape owner that *delegates*, and whose comment already argues this model | **ADOPT the delegation model** (F8's own proposal), at S2 not S3 — the user loses a panel they were reading as collateral for dismissing a list |
| **M2** | **S4** | **F8's site list is wrong in both directions.** 7 Escape sites exist, not 5: it missed `collapsingSearch.ts:70` and `entityPanelController.ts:705`/`:719`. It also implies `stopPropagation` is called twice unconditionally — measured: **once**, and guarded by `!isOpen(h)`. Two sites often counted here (`sectionTabs.ts:81`, `EntitySearch.astro:266`) are `/` handlers, not Escape. | the 91-listener registry; `listSheet.ts:190`; `collapsingSearch.ts:70-74`; `entityPanelController.ts:705`; `sectionTabs.ts:81`; `EntitySearch.astro:266` | F8's list in `audit/findings/X06-X07-X15.md:270` | **ADOPT** — correct the ledger before item 28 is scoped off it |
| **M3** | **S1** | **The already-applied §8 panel-width ruling is conditionally dead: the first panel paints 288.79px at x=101.21 instead of 350 at x=40, and the number does not change between a 390 and a 425 viewport.** `.ph-panels` declares no width, so `calc(100% - 40px)` resolves against a shrink-to-fit box sized from the panel's own content. Opening a second panel clamps it to `100vw` and the documented number appears — so the same declaration is right on `/data` and wrong on `/schema`. 61.21px of the screen is left showing page text clipped mid-word. | `XMB-B-02`; `.ph-panels` clientWidth **328.79** (390) / **329** (425) vs `.rp-sheet` **350.00 at x=40** on `/data`; `PanelHost.astro:623`; `EntityPanel.astro:315` | `specs/16-responsive.md:462-479`, which records this fix as verified at "326.59 → 350, x 63.41 → 40" — not reproducible for the first panel; and `RecordPanel.astro:670`, the identical declaration that works | **ADOPT** — give `.ph-panels` an explicit viewport-sized basis (`width: 100vw` or `inset-inline: 0`), then re-verify all five hosts by computed value. **Correct `specs/16-responsive.md` §8**, which currently certifies a number the app does not paint |
| **M4** | **S2** | **`Drawer` is the only overlay family with no narrow width rule, so at 390 four "overlay over the page" hosts paint four widths at four left edges — 288.79/101.21 · 350.00/40.00 · 358.80/31.20 · 366.59/23.41, a 77.80px spread.** Two of those four are the same declaration in the same media query (M3). | measured at `innerWidth: 390` and 425; `Drawer.astro:27`; `SchemaAutomations.astro:257`; `XMB-B-01` | `specs/16-responsive.md:456-460` "there is one spelling of that"; `storybook.ts` ▸ `pattern-side-panel-width` "one geometry app-wide" | **ADOPT** — give `Drawer` the same `calc(100% - 40px)` narrow rule the five panels have; keep `min()` only against a `rem` cap |
| **M5** | **S4** | **F3's scrollbar rationale costs 0px on this platform, and its `480px`-vs-`--drawer-w` divergence is unreachable.** `innerWidth - documentElement.clientWidth` = **0** at every width tested, even with a forced 20,983px page (macOS overlay scrollbars), so `94vw` and `94%` differ by 0.01px. And `min(94vw,30rem)` == `480px` for all widths ≥511, while below 1280 all five hosts override with `calc(100% - 40px)`. | §0 probe table; `MediaPanel.astro:489-491`, `QuickAskDock.astro:540-542`; probe: `min(94vw,30rem)` → 366.59 vs `94%` → 366.60 at 390 | `specs/16-responsive.md:472-474` — "The **8.41px** RecordPanel gained is the scrollbar" | **ACCEPT + record** — drop the scrollbar argument from the spec (or scope it to classic-scrollbar platforms, **unverified** here) so item 34 is not justified by a 0px effect. The one-contract argument (M4) carries it on its own |
| **M6** | **S2** | **`badge-soft badge-neutral` fails contrast in BOTH themes, and the catalog only documents the dark one.** Painted and computed: dark **1.34** text / **1.02** pill; light **4.35** text / **1.11** pill. Fails AA 4.5:1 for text in both, and the 3:1 UI threshold for the pill in both — the chip has no readable text and no discernible shape in either theme. `badge-ghost` in the same slot: 17.40 dark / 16.29 light. | `XMB-C1-01`; canvas-resolved WCAG computation at `innerWidth: 1440`; `BackupRunDetailView.astro:530` | `storybook.ts:732`, whose evidence is scoped to "on the dark theme" — the reproduced figures are exact, the scope is not | **ADOPT** (unchanged) — and amend `storybook.ts:732` with the light-theme numbers, plus add the pair to `ds-checks.mjs`. Also: `baseout-dark` does not exist; the theme is `baseout` (`lib/theme.ts:13-14`) — fix the register and worklist wording |
| **M7** | **S4** (was S2) | **The seven `ch` caps are invisible: at 390 the cap never binds (5/5 — painted 300–316px against caps of 326–357px), and at 1440 no adjacent pair in the ladder changes the line count. 42ch and 46ch render identically in 5 of 5 sentences at both widths.** Only the 46-vs-56 gap moves anything, on 2 of 5. | line counts via `Range.getClientRects()` at 1440 and 390 on five `?fixture=empty` routes; `1ch` = 8.3701px / 7.7722px | `bl-empty-sub` 42ch (`BackupsListView.astro:430`) vs `rpl-empty-sub` 46ch (`ReportsView.astro:504`) — measured indistinguishable | **DEFER** — real variance, zero user impact. Trigger: the next time an empty-state sentence is rewritten, or any work on `.*-empty-sub`. Do **not** bundle it with work claiming a visual payoff |
| **M8** | **S3** | **Three icon rules paint below the 12px floor with no `ds-ok`, two of them visible on Home — the app's landing surface.** `global.css:1902` `.hm-delta .iconify { .74rem }` → **11.84px** (box 10.45 × 11.84); `SpaceHomeView.astro:726` `.hm-conn-badge .iconify { .72rem }` → **11.52px** ×2. `IntegrationsSetupWizard.astro:591` is the same rule, measured not-visible by default. `ds-lint` misses all three because `ds-checks.mjs` looks for `*-xs` and ~10px, not a `rem` literal. | measured on `/` at `innerWidth: 1440` with `data-astro-source-loc`: `SpaceHomeView.astro:220`, `:440`, `:446` | the seven sanctioned sub-12px rules that DO carry `ds-ok` (`EntityPanel.astro:341`, `SchemaBrowse.astro:538`, `:695`, `ReportDefinitionView.astro:1043`, `:1055`, `:1060`, `:1061`) | **ADOPT** — lift to `var(--t-12)`, or `ds-ok` with a stated reason. Note `.hm-conn-badge` is only `1rem` square, so this may be a badge-size decision rather than an icon one (**unverified**). Add a `rem`-literal check to `ds-checks.mjs` |
| **M9** | **S4** | **X09-F5's premise is wrong even though its trigger fired.** The 73-line/**75-occurrence** population is healthy — 22 of 24 routes measure ≥12px, and unsized spans are almost all sized by component CSS to 12/13/14/16/20px, not inheriting a bare `1em`. The three sub-12px cases (M8) are *explicitly* sized below the floor, a different defect. | 24-route sweep; `git grep -o` = 75 occurrences / `-c` = 73 lines / 31 files; `global.css:1503` (the claimed mechanism) | `X09-X12-X13.md:284` | **DEFER the sweep, ADOPT M8 separately** — and rewrite F5's trigger, since "any measured icon below 12px" has now been satisfied by a mechanism the finding was not about |
| **M10** | **S3** | **A listSheet silently changes from a column into a page overlay at a width nothing records, and above it the co-open state cannot exist at all.** `OVERLAY_BELOW = 964` is measured against the *section column*, not the viewport: at 1440 the column is 1136 and **zero** elements carry `is-list-overlay`. The state X06-F8 was filed against is unreachable at 1440 and only appeared at viewport 900 (column 876). | `listSheet.ts:49`, `:149`; measured `layout-content` clientWidth 1184 → section 1136 at 1440, 876 at 900 | the URL carries `?tab=` but nothing carries the sheet's mode — cf. lens 3, "whether the URL carries the state" | **DEFER** — trigger: any work on item 28 (which must reproduce at ≤964 column, not 1440) or on `wireViewState`. Recorded chiefly so the next scout does not conclude "no overlay" from a 1440 pass |

---

## What is good here — do not touch

- **`PanelHost.astro:568-579` is the right model and its comment is the best argument in the tree.**
  It asks the focused panel's KIND first and closes only when the kind declines, and it names the two
  cross-stack hacks it replaced. M1's fix is to give this owner the whole page, not to rewrite it.
- **`listSheet.ts:190`'s guard is correct.** `if (ev.key !== 'Escape' || !isOpen(h)) return;` — the
  sheet only consumes Escape when it is actually open. The finding accused it of being unconditional;
  it is not. Keep the guard.
- **`RecordPanel.astro:670` and `.rp-sheet` are the reference.** 350.00 at x=40 at a 390 viewport is
  exactly what §8 asked for. Fix `.ph-panels` so `EntityPanel` matches it; do not change this file.
- **`EntityPanel.astro:307-314`'s comment is load-bearing** even though its numbers are now wrong. It
  records *why* the custom property was abandoned for a direct `width` (an inline `--panel-w` from
  drag-resize outranks the media rule). That reasoning is still correct and must survive any edit to
  the width — it is the trap M3's fix could easily re-open.
- **The `ds-ok` discipline on sub-12px type is real and well-argued.** Seven rules carry one with a
  stated reason (`SchemaBrowse.astro:695`'s sort glyph: "aria-hidden, not text; sized like an icon,
  the ladder governs words"). M8 exists precisely because three rules broke a convention the rest of
  the tree keeps. Do not weaken the floor to absorb them.
- **`storybook.ts:732`'s ban is correct and its measurement is honest** — reproduced to the digit
  (1.34 / 1.02 / 17.4) by an independent method. It needs the light-theme numbers added, not
  revision.
- **`badge-ghost` is the right replacement,** confirmed: 17.40 dark and 16.29 light in the very slot
  that currently reads 1.34.
- **The `--t-*` step-down at 1280 works.** `--t-14` → 13px was measured live and every `ch`
  measurement tracked it. The compact rung is doing its job; C2's finding is about `ch` caps, not
  about the ladder.
- **The empty-state sentences themselves.** All five measured 2–3 lines at every cap — nobody has
  written an empty state that wraps to five lines. The copy is already the right length; only the
  declared cap is inconsistent.
