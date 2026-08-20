# Ship-first order — the whole product, surfaces and lenses merged

**Rewritten 2026-08-14 by `audit-lead` at the close of the final consolidation pass.**
**514 register rows · 49 decisions · 74 S1s.** This file merges the wave-local orders (S06–S18,
S19–S21, S22–S24, S24–S40 and the X lenses) into one list and supersedes the per-wave orders in
`audit/REGISTER.md`; those stay for their reasoning.

**How to read it.** The order is by *cost of not fixing it*, then by *cost of fixing it*, then by
*what unblocks what*. A number is a position, not a sprint. Items 1–11 are the ones a reviewer would
be right to stop the release over; 12–17 are the three bound vessels and the sweeps that fall out of
them; **item 17 is a hard gate, not a bullet**; 18+ is everything else, batched so a PR touches one
surface family at a time.

**What changed in this revision.**
- **One item was inserted on merit: the new S1 `X-M3` is item 5** (`.ph-panels` has no width).
  Everything below it shifts by one, so the old item 10 is now item 11. **That is insertion, not
  demotion.**
- **Item 9 (the neutral KPI dot) is CONFIRMED and must not be struck** — the measurement it was
  gated on has been taken.
- **The measurement-debt section at the foot is replaced** by what is *still* unmeasured. Seven of
  the nine debts are paid; the remaining unknowns are named and are different unknowns.
- **Oleh's ten rulings of 2026-08-14 are applied**, including two that removed scheduled work
  (the 33/29 card-padding edit, and D41's rationale) and two that added items nobody had filed
  (`toolbarFit`'s threshold; the badge gate switch-on).

**Three standing constraints from Oleh, 2026-08-14.**
- `EmptyState.astro`, an **alert vessel** and `Badge.astro`-as-the-only-path are **BOUND**.
- **`Running` is PRIMARY (blue).** Eight live sites change; D19 is complete.
- **`Table.astro` is DEFERRED, not rejected — and the re-open is a HARD GATE at item 17**, below.

---

## The first eleven — product-wide

| # | item | decision | why here |
|---|---|---|---|
| **1** | **S36-F1 (+S36-F3)** — the auth shell scrolls | **D35** | One CSS rule (`@apply flex h-screen w-full overflow-hidden` + a centred card), five screens, and it is the only row in the audit that makes a form **unsubmittable**: at 844×390 `Continue`'s bottom sits at 459.8 in a 390 viewport. Pair with S36-F3 (the 390 floor gate moves into `Layout.astro`, where `AuthLayout` inherits it) so the next viewport regression is reported instead of hidden. |
| **2** | **S25-F1 / X11-F2** — `Cancel` cancels again | **D30** | Two files, one state machine, and **the audit's own reference is the thing that is broken**. `setMode()` restores nothing and re-captures `entryValues` on *every* entry into edit, so one trip out through the `Read` segment permanently rebases what `Cancel` restores to and the next `Save` commits a value the user walked away from. Two lenses found it independently. Ship the `exitEdit` convergence for these two files only; the other two contracts follow at item 21. |
| **3** | **S32-F1** — Settings stops inventing a Space | **D17** | A trial user with no Space is shown a whole invented one: a blank name, confident schedule/destination/retention defaults, three named Airtable workspaces with live toggles, and a red **Delete Space** card. Under *both* `?fixture=trial` and `?fixture=empty`. It is the single most alarming thing a new user can see and the cause is a module constant rendered unconditionally. |
| **4** | **X08-F5 (+X08-F8's two throwing lookups)** — the logs stop guessing | **D43** | **The cheapest S1 in the audit.** Six `?? statusMeta.cancelled` / `?? statusMeta.issues` fallbacks label an unrecognised status with a word that **asserts a person acted** — on a backup log, the one screen whose job is to prove what ran. The correct answer is already written and shipped one file away (`SourcesView.astro:36-51`) with a 14-line comment arguing this exact case. Six lines of edit. Take the two `TypeError`-on-`undefined` lookups (`SourceDetailView.astro:181,189`) in the same PR. |
| **5** | **X-M3 — `.ph-panels` gets a width, and §8's ruling becomes true again** | **D45** | **NEW, and it is here on cost-of-fixing more than cost-of-not-fixing: it is one declaration.** `PanelHost.astro:623` declares an absolutely-positioned flex box with **no `width` and no `left`**, so it shrink-to-fits from its own content — and the five sheets' `width: calc(100% - 40px)` then resolves against a box sized by the very child it is sizing. The first panel paints **288.79px at x=101.21** instead of the documented 350 at x=40, **identically at 390 and at 425** (a panel whose width does not change when the screen changes by 35px is not a responsive rule, it is a content measurement), leaving 61px of page showing text clipped mid-word. Opening a *second* panel clamps the box to `100vw` and the documented number appears — which is why the same declaration is right on `/data` and wrong on `/schema`, and why nobody caught it. **Above items 6–11 because: one line, five hosts, no new surface; it must land before items 10/11 and 29 and 35 touch the same hosts; and it is the only row in the audit where a spec certifies a number the app does not paint (X-M11), so leaving it re-teaches the wrong geometry to everyone who reads §8.** Below items 1–4 because those four are false statements and an unsubmittable form, and this one is a bad width in a band. Verify by computed value on all five hosts, not by screenshot; keep `EntityPanel.astro:307-314`'s comment intact — it is the trap this fix can re-open. |
| **6** | **S36-F2 · S24-F9 · X13-F1/F2/X05-F4 · S28-F2** — the product can say "no", in one voice | **D32** (+D42 for the vessel) | Login and Register **refuse nothing**: empty submit does nothing, `#login-error` has no writer, `not-an-email` is accepted and confirmed with *"we sent a sign-in link"*. **The census now says exactly why it is one site and not many: `lib/auth-utils.ts`'s `showFormError` exists and has one importer out of the three views that use its markup shape — `Sidebar` imports it, `WelcomeView` re-implemented it by hand, `LoginView` got the markup and neither. The vessel is not missing; the wiring is.** The connect flow renders **0 of 19** documented failure messages while `StoragePicker` ships eight of the same codes in the engineer's register with `error_code:` printed to the user. One PR series, in this order: the auth refusals (smallest), the credential forms, then the 19-code deck into the live flow. |
| **7** | **S25-F2** — the app stops renaming the object you just created | **D38** | Small, and it breaks the user's trust in the only place they have just done work. |
| **8** | **G-A/D33 · X12-F4 · X12-F6 — the gate walks states, not labels · + X-M19, the two NUL bytes** | **D33** · **D21** | **Do this before the fix waves, not after.** `smoke.mjs` only, no client PR, roughly an hour: `/settings` declares six variants and no fixture variant · `bases.astro` has no `empty` branch · `/login` and `/register` declare zero variants · **eight of Schema's nine tabs are requested by nothing** · `/reports/[id]` reads no `?fixture=`. **Take the 2-character `DataBrowse.astro:936` fix in the same PR** (`'\0'` for the literal NUL): until it lands, every census in every later item silently omits one file, which is what produced six drifting counts in this audit and hid an 8th Escape listener. Items 1–7 otherwise ship back into an unwatched hole — and **D17's verification is blocked on this**: three of the 28 empty-state families have never been seen empty by anyone. |
| **9** | **X08-F7** — the neutral KPI dot | **D44** | **Four lines, and the measurement is now TAKEN: do not strike this row.** Probed in the live `.hm-kpi-v` host, `bg-base-content/40` computes to **`rgba(0,0,0,0)`** while `bg-warning` and `bg-success` paint — the utility does not exist, because `ReportBodyKpi.astro:164` builds the class by interpolation and Tailwind never sees the string. A transparent dot beside a bare number, where the tone is the dot's only carrier of meaning. **And no fixture in the tree sets `tone: 'neutral'`, so this was never findable by looking — only by reading a computed value.** The correct implementation is already in the tree at `connection-health-banner.ts:73-77`. |
| **10** | **X06-F1 + X06-F2** — focus enters the overlay; `Drawer` stops claiming modality | **D45** | The panel stack is the app's primary overlay, cap 10, and it is **invisible to a keyboard**: zero `.focus()` calls in either file, Tab walks the page *behind* the panel, Escape closes something the user never reached. `Drawer` asserts `aria-modal="true"` twice with no trap, no `inert`, no restore — the only place in the app where the markup contradicts the code. Bigger than 1–9; ship the focus work and the modality claim as two separate PRs. **Land item 5 first** — both touch `PanelHost`. |
| **11** | **X10-F1+F2 (+X10-F3)** — Automations and Interfaces stop destroying in one click | **D06** | No confirm, no undo, no way back, and the Delete control is invisible until hover — one Tab from a row whose Enter merely opens it. The app's own rule (`panelStack.ts:512-520`) is that a verb which cannot be taken back is not shippable, and `ReportsView.astro:242` puts both a dialog *and* an undo toast on a lesser act. `ConfirmModal` + `CONFIRM_DESTRUCTIVE` already exist: this is a move-onto, not a build. |

---

## 12–17 — the three bound vessels, and the S1s that ride with them

Oleh approved three vessels as **one wave of mechanical replacement**. Build them in this order; each
retires a large class of findings structurally rather than one file at a time.

| # | item | decision | notes |
|---|---|---|---|
| **12** | **`X11-F1` + `X11-F3` + the shared exit guard** — Docs gains a save; the report definition guards its exit | **D30** | Two S1s and the `lib/` helper they share. Docs is *an editor with no save control of any kind* and every route in overwrites the buffer. The report definition lights `Unsaved changes` and puts an unguarded `<a href="/reports">Cancel</a>` **on the next line**. Lift the wizard's interceptor into `lib/`, mount it on these two only, add `popstate`, add `beforeunload` **on these two only**. A blanket `beforeunload` is the app shouting where it whispers — see D30. |
| **13** | **`components/ui/Alert.astro`** | **D42** | The only Primitive in the catalog with no `reference:` component. **Scope now measured and it is two scopes, not one: the vessel closes 58 of the 79 `role="alert"` sites; the other 21 are not alert vessels and need a second, smaller answer** (`TextInput`/`Select` already own an `error` prop; the five `.reg-err` boxes should be that prop). **And the vessel's job is bigger than the class list: it must own the write/reveal ORDER (un-hide, then write), write only on change, and refuse a live role to a banner that is present at first paint or inside a focus-taking modal.** 13 of the 17 written sites currently write while `hidden` and then reveal — the order that suppresses the announcement — and 39 sites are SSR-static, where the role can never fire at all (X-M13, X-M14). **92% converged on `alert-soft` already** — a vessel plus a small sweep, not a rebuild. |
| **14** | **`components/ui/EmptyState.astro`** | **D17** | Retires 26 of 28 families and makes 15 tile declarations one. Sentence cap **bound to 46ch**. Four conditions, including the new capability gate. **The mechanism matters: an Astro scoped style cannot cross a file boundary — `global.css` already holds two orphaned shared attempts nobody adopted. A component or nothing.** **Do not expect the cap to change any rendering — measured, it changes none** (see X04-F2); it is here as the vessel's spec, not as a fix. |
| **15** | **`Badge.astro` as the only path · + X-M20 the gate · + X-M21 the catalog sentence** | **D44** | 10 call sites vs 243 raw class strings. **Take the three banned-pair sites in the first PR with item 9, switch on the two badge regex checks in `ds-checks.mjs` in the same PR, and fix the three files it reddens rather than `ds-ok`-ing them.** Amend `storybook.ts:732` with the light-theme numbers (4.35 text / 1.11 pill) — the pair fails in **both** themes and the entry only documents dark. Then migrate **batched by surface** — Schema, Data, Backups/Restore, Reports, registries. **`Running` is primary (blue)**: eight live amber sites change, seven `Running` and one `Generating` (`ReportDefinitionView.astro:235`). This is the largest diff in the audit and must not land as one PR. |
| **16** | **X14-F4 + X14-F5** — controls stop being double-submittable; a failed action speaks | **D49** | Four controls, two of which start work. And the cancel handler swallows its error behind a comment claiming no toast infrastructure exists — `undoToast.ts` now exists. Four small files. |
| **17** | **X07-F5 + X07-F9 (`wireRowKeys`)** — Enter works on every row | **D46** | Three tables paint a focus ring and do nothing on Enter, because the 3-line keyboard block was copied into 11 files and forgotten in 3. One `lib/wireRowKeys.ts`; the 11 copies delete. Ship this before the lead-cell links (item 22) — it is the half a user meets. |

### ⛔ HARD GATE — re-open D15 (`Table.astro`) before item 18

**This is a gate, not a bullet. Nothing in 18+ starts until it is answered in writing.** Oleh, ruling
9, 2026-08-14: *"put a hard stop in the ship order. D15 must be re-opened after item 16 and must not
be allowed to remain deferred by default."* (Item 16 in the order he ruled on is item 17 here — the
vessel wave, unchanged in content.)

**Four register rows are filed against deferred D15 and are dropped silently — not rejected, just
lost — if nobody re-opens it:**

| row | what waits |
|---|---|
| **S25-F4** | its structural half |
| **S25-F12** | all of it |
| **X01-F2** | its component half (the catalog half ships under D34/D40) |
| **X01-F1 / X01-F5** | the residue left after D40's header and sort work |

**What re-opening means, concretely:** by item 17 the sweeps in 24–26 and 36 will have established
how much of the table job is already shared, so the vessel can be designed against the residue rather
than against a guess. **Deliverable of the re-open: either an amended `audit/decisions/15-one-table.md`
that binds a vessel, or a written ACCEPT saying the four rows above are being declined and why.**
Either is acceptable. Silence is not.

---

## 18 onward — the sweeps, batched by surface

Nothing below changes what the product *claims*; all of it changes how much a user has to re-learn.
**Order within this block is by diff size ascending**, because these compete with feature work and
the small ones will actually ship.

| # | item | decision |
|---|---|---|
| 18 | **X-M15** — the three sub-12px icon rules (`global.css:1902` · `SpaceHomeView.astro:726` · `IntegrationsSetupWizard.astro:591`) go to `var(--t-12)`, or gain a `ds-ok` with a stated reason. **Two files, three lines, and two of the three are visible on Home.** Decide `.hm-conn-badge` at the element — it is `1rem` square and this may be a badge-size call | D23 |
| 19 | **X-M11 · X-M12 · X-M22** — the documentation corrections, **no client PR, run in parallel with anything**: `specs/16-responsive.md` §8 stops certifying 350/40 and drops (or platform-scopes) the scrollbar attribution · §3 and `global.css:340-347` stop describing the 33/29 padding split · `specs/02-shell-sidebar-topbar.md:195` stops naming `baseout-dark` | D20 · D45 |
| 20 | **S32-F2 / S32-F8** — the support dead end and the two Billing addresses. Retarget the eleven CTAs first (one line each) and the placeholder can be **deleted** rather than built | D14 · D17 |
| 21 | **X05-F3a** — the three hand-rolled tinted boxes become `Alert`; the wizard drops from three vessels to one | D42 |
| 22 | **X09-F2 + X09-F3** — `refineFacetIcons` delegates to `entityIconClass`, and the concept colour moves off `.lucide--table-2` onto `.concept-ic-table`. **Two files.** Measurement taken and X09-F3 is CONFIRMED **whole, not half**: `text-base-content/45` on `RestoreView.astro:345,643` computes **identically** to the bare global rule — Restore asks for muted and gets concept-green, because the global selector is (0,2,0) and the utility is (0,1,0) | D48 |
| 23 | **X11-F4** — the remaining two save contracts (C4, C7) converge on `exitEdit`; the read slot renders from the draft | D30 |
| 24 | **X07-F4** — the lead cell of all twelve clickable rows gains a real `<a href>`. Restores ⌘-click and new-tab on every list in the product | D46 |
| 25 | **X12-F2** then **X12-F1 + X12-F5** — the Record panel's trail becomes clickable (one file, independent); then the breadcrumb component gains its first consumer and the 25-page `getBreadcrumbs()` pipeline is either painted or deleted | D47 |
| 26 | **X01-F1 + X01-F3 + X01-F4 + X01-F6** — nine header constructions become one, sortable cells become real `<button>`s with `aria-sort` (both are **0** tree-wide today), and Schema Health drops `aria-hidden` from its column band. **Batch: Schema (six of twelve files), then Data, then Home.** Re-census first: the true figures are **19 of 25 files**, not 18 of 24 | D40 |
| 27 | **X01-F5** — `[data-sort-col]` moves off the element name so a grid head can carry it; Health, Docs and Interfaces sort by header and their toolbar sort menus delete | D40 |
| 28 | **X-M17 + X02-F7 + X02-F8 + X02-F10** — **fix `toolbarFit`'s threshold first** (`NARROW_AT = 1440` against a column that is 1184 on the target hardware, so `data-narrow` is permanent and the nine `.sch-tb` surfaces have only ever had one rendering); **then** three byte-identical private toolbars become `.sch-tb` and the collapsing search reaches all twelve listing surfaces. **Converge for variance, not for wrapping — measured at 1100, none of the three copies wraps.** Screenshot every dense toolbar at 1440 after the threshold change: button words and the full search field come back, and that is a visible change to the whole product | D41 |
| 29 | **X06-F6 + X06-F7 + X06-F8** — the bespoke dialog becomes `ConfirmModal`, `.rl-detail` registers as a `PanelHost` kind, and the **eight** competing `document` Escape listeners become one delegating owner. **Reproduce at a section column ≤964, not at 1440** — above that the co-open state does not exist (X-M18). The ledger is 8 sites, not 5: add `components/ui/collapsingSearch.ts:70`, `entityPanelController.ts:705`, `DataBrowse.astro:1313`; drop `sectionTabs.ts:81` and `EntitySearch.astro:266`, which handle `/`. **`stopPropagation` cannot arbitrate — all eight are on `document`** | D45 |
| 30 | **X-M16** — one button height: the 40px `md` carve-out deletes from the 17 views that hold it, and `decision-density-sm-is-default`'s "md = page-header CTA only" is amended in the same PR. **It takes `ds-audit` to exit 0.** Not a defect fix — zero off-tier buttons were measured — so review it as a design change: the page CTA now carries emphasis by colour and position alone. **`ConfirmModal`'s `ds-ok`'d md footer pair closes with it; D45's "not changing" list must be read alongside** | D23 |
| 31 | **X09-F1** — the twenty glyph bypasses collapse onto `entityIcon`; the six in-file twins delete | D48 |
| 32 | **D36 (one page name) · D37 (one narrow tier)** — sweeps, batched by surface | D36 · D37 |
| 33 | **X13-F3 + X13-F5** — `inbox.ts` and `ReportsView` call `fmtRelative`. **The `toLocale*` half is re-aimed and is smaller than it looked: not one date bug but a thousands separator the app pins in 13 places and leaves floating in 45.** Add `fmtCount` in `lib/` as a sibling of `time.ts` (same header, stating why the locale is pinned), sweep the **five shared files first** — `tablePager.ts` alone (4 calls, 15 importers) corrects the pager total on every paged table — then the ten leaves, then delete the 13 duplicate `nf` instances. **Do not "fix" the 14 `Intl.*` constructors' value: all 14 already pin `en-US`** | D09 |
| 34 | **X12-F3** — `wireViewState` on Schema's nine tabs and the three Data tabs. The rest is **DEFERRED** (trigger: a second filter on the surface, or the first support request needing a shareable list). **Add the listSheet's overlay mode to the same contract** (X-M18) — a console that turns into a page overlay records nothing | D07 |
| 35 | **X14-F3** — the six busy idioms converge on `setButtonLoading`; the `button` entry is ratified to describe it | D49 |
| 36 | **X08-F9 + X01-F14 + X13-F4 + X03-F11** — the copy and colour sweep: `text-error` off 13 benign `Clear filters`, one label for one control, one count grammar, one "show more" sentence | D44 · D19 · D41 |
| 37 | **X04-F2/F3/F4/F5, X05-F2, X08-F1/F2/F6, X-M13, X-M14** — the residue that falls out of items 13–15 once the vessels exist. **Do not do these before the vessels; they are the same edits twice.** X04-F2 is now **S4 and explicitly zero-payoff**: 46ch changes no rendering anywhere, at any width — ship it as a tidy and never bundle it with work claiming a visual difference | D17 · D42 · D44 |
| 38 | **X06-F3** — one width contract for drawer and panel: `Drawer` gains the same narrow rule the five panels have (it is the only overlay family without one), `--drawer-w` loses its `vw`, and the six `vw` literals delete. **Item 5 must land first** — until `.ph-panels` has a width, the panels' half of the contract is not actually in effect. **Justify it on one-contract grounds only: the scrollbar argument measures 0.00px on this platform** | D45 |
| 39 | **X03-F12** — the stated pager threshold, applied to four of the six unbounded tables (**two are inside D15 — do not touch them until the item-17 gate is answered**) | D41 |
| 40 | **D34** — the catalog's eight stale facts. **No client PR, so it can run in parallel with anything above**, and it should: three of the eight are actively teaching the drift that items 26 and 37 are undoing | D34 |
| 41 | **D38's remaining members and D39** — the largest diffs and the least urgent. D38 should land as one `lib/registry/` module, not as eighteen edits | D38 · D39 |

---

## After 41 — the reopen list

Nothing here is scheduled. Each has a trigger, and the trigger is the schedule.
**D15 is NOT on this list any more — it is the hard gate at item 17.**

- **The z-index ladder** (X06-F11). *Trigger: item 10 or item 29 landing — both move an overlay
  between layers.*
- **`LiveRefresh`** (X14-F7, X14-F8). *Trigger: the real re-fetch replacing `location.reload()`; and
  the D01/D17 staleness work.*
- **X-M18** — the listSheet's overlay mode in the URL. *Trigger: item 29 or any `wireViewState` work.*
- **X09-F5** — the 75-occurrence / 31-file unsized-icon sweep. **Trigger rewritten, because the old
  one ("any measured icon below 12px") fired on a mechanism the finding was not about:** *an unsized
  `.iconify` whose nearest `font-size` rule is absent.* The three real breaches are item 18.
- **D21's remaining track**: the six `getValue` closures · **167** `cursor: pointer` declarations.
  *Triggers written in the file.* **The baseline is 6 issues / 208 files, not 295 / 193 — and after
  item 30 it should be 0.**
- **X01-F16 · X07-F13 · X11-F7 · X14-F6's record.** *Triggers written in their rows.*
- **The six pending client decisions.** **#4 blocks all of Billing and #6 blocks all of Help** —
  neither has been put to the client, and until they are, S33 and S35 cannot be designed. Held
  deliberately per Oleh's ruling 10; assembled in `audit/CLIENT-QUESTIONS-PENDING.md`.

---

## What is still unmeasured

**Seven of the nine `NEEDS-MEASUREMENT` debts this file used to carry are PAID** — the neutral KPI dot
(confirmed, item 9), Restore's dead icon override (confirmed whole, item 22), the toolbar wrap
(falsified — nothing wraps; the real finding is the threshold, item 28), the Escape listeners
(24 deliveries, nobody wins, item 29), the panel widths (a new S1, item 5), the contrast pair (stands
and widens, item 15), the `ch` caps (S4, zero payoff, item 37), the `toLocale*` scope (item 33) and
the `role="alert"` announcement (answered from source: 4 of 79, item 13).

**What remains is a different list, and none of it blocks an item above.**

1. **Icons were measured only at 1440.** `global.css:204-210` steps the `--t-*` ladder down below
   1280, so a narrow sweep could find sub-12px cases beyond the three in item 18. **Not run.**
2. **Classic-scrollbar platforms.** Every `vw`-vs-`%` argument in `specs/16-responsive.md` §8 rests on
   a scrollbar that measures **0.00px** on macOS overlay scrollbars. ~15px on Windows/Linux could not
   be emulated. **Neither proved nor disproved — item 19 must say so rather than pick a side.**
3. **`/integrations/configure/bases`** (`IntegrationsManageBasesView`) has never been swept by any
   pass in this audit, at any width, for anything.
4. **15 of the 73 unsized-icon lines** were never measured: they are runtime HTML strings inside
   states nobody opened — `SchemaChat.astro`, `schemaChat.ts`, `QuickAskDock.astro`,
   `typeaheadItems.ts`, `schemaRelationships.ts`.
5. **`.rl-detail-panel`** — the seventh overlay — has never had its width measured at any viewport.
   It is the one host missing from the four-way comparison behind items 5 and 38, and the one
   item 29 proposes to fold into `PanelHost`.
6. **No screen reader ever ran.** Item 13's ordering argument is a source argument; the one probe that
   would settle the 19 reveal-only sites (*does un-hiding a pre-populated `role="alert"` announce?*)
   was not taken. It changes their description, not the remedy.
7. **Row counts for the six unbounded tables** (item 39) were never taken, so the pager threshold is
   still being written against a judgement rather than a number.
8. **Three of D17's 28 empty-state families have never been seen empty by anyone.** That is item 8's
   job, and until it lands item 14 cannot be verified at all.

**Instrument rules earned by this audit — carry them into every item above.** Set narrow viewports
with `emulate`, never `resize_page` (macOS floors a window at ~500px, so every "390" in waves 1–6 is
a 500-wide layout). Take any count that will be quoted with `/usr/bin/grep -a`, never the bare `grep`
in this shell (`ugrep -I` skips a binary-classified file with exit code 0). Verify a responsive fix by
reading the computed value at the width the rule claims to act on — a green `css-guard` says the
cascade agrees with the source, and item 5 is a rule whose cascade was correct and whose **containing
block** was wrong.
